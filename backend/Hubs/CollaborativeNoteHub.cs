using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Realtime;

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
    private static readonly TimeSpan PersistDebounce = TimeSpan.FromSeconds(3);

    private readonly IYjsDocumentStore _documentStore;
    private readonly INodeRepository _nodeRepository;
    private readonly IPermissionRepository _permissionRepository;

    public CollaborativeNoteHub(IYjsDocumentStore documentStore, INodeRepository nodeRepository, IPermissionRepository permissionRepository)
    {
        _documentStore = documentStore;
        _nodeRepository = nodeRepository;
        _permissionRepository = permissionRepository;
    }

    private Guid UserId => Guid.Parse(Context.UserIdentifier ?? Context.User!.FindFirst("sub")!.Value);
    private static string NoteGroup(Guid nodeId) => $"note:{nodeId}";

    public async Task JoinNote(Guid nodeId)
    {
        var access = await _permissionRepository.CheckAccessAsync(nodeId, UserId);
        if (access is null)
        {
            throw new HubException("You do not have access to this note.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, NoteGroup(nodeId));

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
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, NoteGroup(nodeId));
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("UserLeft", nodeId, Context.ConnectionId);
    }

    /// <summary>Broadcasts a Yjs document update to all other clients editing the same note.</summary>
    public async Task SendYjsUpdate(Guid nodeId, byte[] update)
    {
        var access = await _permissionRepository.CheckAccessAsync(nodeId, UserId);
        if (access is null || access == "Read")
        {
            throw new HubException("You do not have edit access to this note.");
        }

        _documentStore.ApplyUpdate(nodeId, update);
        _documentStore.ScheduleFlush(nodeId, _nodeRepository, PersistDebounce);

        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("ReceiveYjsUpdate", nodeId, update);
    }

    /// <summary>Broadcasts awareness (cursor position, selection, user color) to peers.</summary>
    public async Task SendAwarenessUpdate(Guid nodeId, byte[] update)
    {
        await Clients.OthersInGroup(NoteGroup(nodeId)).SendAsync("ReceiveAwarenessUpdate", nodeId, update);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
