using System.Collections.Concurrent;

namespace NotesApp.Api.Infrastructure.Realtime;

/// <summary>
/// Tracks who has the app open (one presence connection per browser tab). It lives in memory, so it is exact
/// only with a single backend instance; after a restart it is rebuilt as clients reconnect.
/// </summary>
public interface IPresenceTracker
{
    void Add(string connectionId, Guid userId);
    void Remove(string connectionId);
    bool IsOnline(Guid userId);
    IReadOnlyCollection<Guid> OnlineUserIds();
}

public sealed class PresenceTracker : IPresenceTracker
{
    private readonly ConcurrentDictionary<string, Guid> _connections = new();

    public void Add(string connectionId, Guid userId) => _connections[connectionId] = userId;

    public void Remove(string connectionId) => _connections.TryRemove(connectionId, out _);

    public bool IsOnline(Guid userId) => _connections.Values.Contains(userId);

    public IReadOnlyCollection<Guid> OnlineUserIds() => _connections.Values.Distinct().ToList();
}
