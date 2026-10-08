using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Data.Repositories;
using NotesApp.Api.Infrastructure.Realtime;
using NotesApp.Api.Services;

namespace NotesApp.Api.Hubs;

/// <summary>
/// Real-time collaboration hub for BlockNote notes. Transports Yjs binary
/// updates and awareness (presence/cursor) payloads between all clients that
/// currently have the same note open. Persistence to SQL Server is debounced
/// via <see cref="IYjsDocumentStore"/> and only executed through Stored
/// Procedures.
/// </summary>
[Authorize]
public sealed class CollaborativeNoteHub : Hub
{
    private readonly IYjsDocumentStore _documentStore;
    private readonly INodeRepository _nodeRepository;
    private readonly IPermissionRepository _permissionRepository;
    private readonly INoteContentService _content;
    private readonly IUserStatusService _userStatus;
    private readonly INoteConnectionTracker _connections;

    public CollaborativeNoteHub(IYjsDocumentStore documentStore, INodeRepository nodeRepository, IPermissionRepository permissionRepository,
        INoteContentService content, IUserStatusService userStatus, INoteConnectionTracker connections)
    {
        _documentStore = documentStore;
        _nodeRepository = nodeRepository;
        _permissionRepository = permissionRepository;
        _content = content;
        _userStatus = userStatus;
        _connections = connections;
    }

    private Guid UserId => Guid.Parse(Context.UserIdentifier ?? Context.User!.FindFirst("sub")!.Value);
    private static string NoteGroup(Guid nodeId) => $"note:{nodeId}";

    public async Task JoinNote(Guid nodeId)
    {
        var status = await _userStatus.GetAsync(UserId);
        if (!status.Exists || !status.IsActive)
        {
            throw new HubException("account_blocked");
        }

        var access = await _permissionRepository.CheckAccessAsync(nodeId, UserId);
        if (access is null)
        {
            throw new HubException("no_access");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, NoteGroup(nodeId));
        _connections.Add(Context.ConnectionId, UserId, nodeId, access);

        var existingState = _documentStore.GetState(nodeId);
        if (existingState is null)
        {
            var node = await _nodeRepository.GetContentAsync(nodeId);
            existingState = node?.ContentYjsState;
        }

        // Send the current document state to the newly joined client so it can sync up.
        await Clients.Caller.SendAsync("SyncState", nodeId, existingState);

        // Notify others so they can render the new participant's avatar.
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("UserJoined", nodeId, Context.ConnectionId, Context.User?.FindFirst("name")?.Value);
    }

    public async Task LeaveNote(Guid nodeId)
    {
        if (!_connections.IsIn(Context.ConnectionId, nodeId)) return;
        _connections.Remove(Context.ConnectionId, nodeId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, NoteGroup(nodeId));
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("UserLeft", nodeId, Context.ConnectionId);
    }

    private async Task EnsureEditableAsync(Guid nodeId)
    {
        // Only connections that joined (and were not removed after a revocation) may talk to the note group.
        if (!_connections.IsIn(Context.ConnectionId, nodeId))
        {
            throw new HubException("no_access");
        }

        // The account may have been blocked after this connection was opened.
        var status = await _userStatus.GetAsync(UserId);
        if (!status.Exists || !status.IsActive)
        {
            throw new HubException("account_blocked");
        }

        var access = await _permissionRepository.CheckAccessAsync(nodeId, UserId);
        if (access is null || access == "Read")
        {
            throw new HubException("read_only");
        }

        // Trashed notes are read-only until restored.
        var node = await _nodeRepository.GetByIdAsync(nodeId);
        if (node is null || node.IsDeleted)
        {
            throw new HubException("This note is in the trash and cannot be edited.");
        }
    }

    /// <summary>Broadcasts a Yjs document update to all other clients editing the same note.</summary>
    public async Task SendYjsUpdate(Guid nodeId, byte[] update)
    {
        await EnsureEditableAsync(nodeId);

        // Deltas are only relayed; persistence uses full snapshots (SaveSnapshot).
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("ReceiveYjsUpdate", nodeId, update);
    }

    /// <summary>Legacy path (older cached clients): the current client saves over HTTP (PUT /api/nodes/{id}/content). Same checks.</summary>
    public async Task SaveSnapshot(Guid nodeId, byte[] state)
    {
        await EnsureEditableAsync(nodeId);
        try
        {
            await _content.SaveAsync(UserId, nodeId, state);
        }
        catch (NoteTooLargeException)
        {
            throw new HubException("note_too_large");
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number == 50003)
        {
            throw new HubException("quota_exceeded");
        }
    }

    /// <summary>Broadcasts awareness (cursor position, selection, user color) to peers.</summary>
    public async Task SendAwarenessUpdate(Guid nodeId, byte[] update)
    {
        // Spectators too may share their cursor, but only members of the note group.
        if (!_connections.IsIn(Context.ConnectionId, nodeId)) return;
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("ReceiveAwarenessUpdate", nodeId, update);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var nodeId in _connections.RemoveConnection(Context.ConnectionId))
        {
            await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("UserLeft", nodeId, Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
