using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Hubs;

namespace NotesApp.Api.Infrastructure.Realtime;

/// <summary>Who is currently inside which note group of the collaborative hub, and with what access level.</summary>
public interface INoteConnectionTracker
{
    void Add(string connectionId, Guid userId, Guid nodeId, string access);
    void Remove(string connectionId, Guid nodeId);
    /// <summary>Forgets a connection and returns the notes it was in.</summary>
    IReadOnlyList<Guid> RemoveConnection(string connectionId);
    bool IsIn(string connectionId, Guid nodeId);
    IReadOnlyList<NoteConnection> Snapshot();
}

public sealed class NoteConnection
{
    public required string ConnectionId { get; init; }
    public required Guid UserId { get; init; }
    public required Guid NodeId { get; init; }
    public string Access { get; set; } = "Read";
}

public sealed class NoteConnectionTracker : INoteConnectionTracker
{
    private readonly ConcurrentDictionary<(string, Guid), NoteConnection> _entries = new();

    public void Add(string connectionId, Guid userId, Guid nodeId, string access) =>
        _entries[(connectionId, nodeId)] = new NoteConnection { ConnectionId = connectionId, UserId = userId, NodeId = nodeId, Access = access };

    public void Remove(string connectionId, Guid nodeId) => _entries.TryRemove((connectionId, nodeId), out _);

    public IReadOnlyList<Guid> RemoveConnection(string connectionId)
    {
        var nodes = _entries.Keys.Where(k => k.Item1 == connectionId).Select(k => k.Item2).ToList();
        foreach (var node in nodes) _entries.TryRemove((connectionId, node), out _);
        return nodes;
    }

    public bool IsIn(string connectionId, Guid nodeId) => _entries.ContainsKey((connectionId, nodeId));

    public IReadOnlyList<NoteConnection> Snapshot() => _entries.Values.ToList();
}

/// <summary>
/// Re-evaluates the access of everybody connected to a note after sharing changed: people who lost access are removed from the
/// SignalR group (they stop receiving updates) and every affected client is told, so its UI can switch to read-only or leave.
/// </summary>
public interface INoteAccessEnforcer
{
    Task RecheckAsync();
}

public sealed class NoteAccessEnforcer : INoteAccessEnforcer
{
    private readonly INoteConnectionTracker _tracker;
    private readonly IHubContext<CollaborativeNoteHub> _hub;
    private readonly IServiceScopeFactory _scopes;

    public NoteAccessEnforcer(INoteConnectionTracker tracker, IHubContext<CollaborativeNoteHub> hub, IServiceScopeFactory scopes)
    {
        _tracker = tracker;
        _hub = hub;
        _scopes = scopes;
    }

    public async Task RecheckAsync()
    {
        var entries = _tracker.Snapshot();
        if (entries.Count == 0) return;

        using var scope = _scopes.CreateScope();
        var permissions = scope.ServiceProvider.GetRequiredService<IPermissionRepository>();

        foreach (var entry in entries)
        {
            var access = await permissions.CheckAccessAsync(entry.NodeId, entry.UserId);
            if (string.Equals(access, entry.Access, StringComparison.Ordinal)) continue;

            var group = $"note:{entry.NodeId}";
            if (access is null)
            {
                await _hub.Groups.RemoveFromGroupAsync(entry.ConnectionId, group);
                _tracker.Remove(entry.ConnectionId, entry.NodeId);
            }
            else
            {
                entry.Access = access;
            }

            await _hub.Clients.Client(entry.ConnectionId).SendAsync("AccessChanged", entry.NodeId, access);
        }
    }
}
