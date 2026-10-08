using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Data.Repositories;
using NotesApp.Api.Infrastructure.Realtime;

namespace NotesApp.Api.Services;

/// <summary>The note's document exceeds the per-note size limit. Mapped to HTTP 413 <c>note_too_large</c>.</summary>
public sealed class NoteTooLargeException(long maxBytes) : Exception($"The note exceeds the maximum size of {maxBytes} bytes.")
{
    public long MaxBytes { get; } = maxBytes;
}

public sealed record NoteSaveResult(long SizeBytes, long MaxBytes);

public interface INoteContentService
{
    long MaxNoteBytes { get; }
    /// <summary>Persists the full Yjs state of a note after checking access, trash, account, per-note limit and the owner's quota.</summary>
    Task<NoteSaveResult> SaveAsync(Guid userId, Guid nodeId, byte[] state);
}

/// <summary>Single place where a note snapshot is validated and stored (used by the HTTP endpoint and by the hub).</summary>
public sealed class NoteContentService : INoteContentService
{
    public const long DefaultMaxNoteBytes = 64L * 1024 * 1024;

    private readonly INodeRepository _nodes;
    private readonly IPermissionRepository _permissions;
    private readonly IAdminRepository _admin;
    private readonly IUserStatusService _userStatus;
    private readonly IYjsDocumentStore _store;
    private readonly ILogger<NoteContentService> _log;

    public long MaxNoteBytes { get; }

    public NoteContentService(INodeRepository nodes, IPermissionRepository permissions, IAdminRepository admin, IUserStatusService userStatus,
        IYjsDocumentStore store, IConfiguration configuration, ILogger<NoteContentService> log)
    {
        _nodes = nodes;
        _permissions = permissions;
        _admin = admin;
        _userStatus = userStatus;
        _store = store;
        _log = log;
        MaxNoteBytes = configuration.GetValue<long?>("Notes:MaxNoteBytes") is > 0 and var configured ? configured : DefaultMaxNoteBytes;
    }

    public async Task<NoteSaveResult> SaveAsync(Guid userId, Guid nodeId, byte[] state)
    {
        var status = await _userStatus.GetAsync(userId);
        if (!status.Exists || !status.IsActive) throw new AccountBlockedException();

        var access = await _permissions.CheckAccessAsync(nodeId, userId);
        if (access is null) throw new UnauthorizedAccessException("You do not have access to this note.");
        if (access == "Read") throw new UnauthorizedAccessException("Read-only access does not permit this operation.");

        var node = await _nodes.GetByIdAsync(nodeId);
        if (node is null || node.IsDeleted) throw new UnauthorizedAccessException("This note is in the trash and cannot be edited.");
        if (node.Type != "Note") throw new UnauthorizedAccessException("Only notes have content.");

        if (state.LongLength > MaxNoteBytes)
        {
            _log.LogWarning("Note {NodeId}: snapshot of {Size} bytes rejected (limit {Max}).", nodeId, state.LongLength, MaxNoteBytes);
            throw new NoteTooLargeException(MaxNoteBytes);
        }

        // Growth past the owner's quota is refused (SqlException 50003 -> 413 quota_exceeded); shrinking is always allowed.
        await _admin.AssertContentAllowanceAsync(nodeId, state.LongLength);

        await _nodes.SaveContentAsync(nodeId, contentJson: null, contentYjsState: state);
        _store.ApplyUpdate(nodeId, state); // joiners get the latest state from memory
        return new NoteSaveResult(state.LongLength, MaxNoteBytes);
    }
}
