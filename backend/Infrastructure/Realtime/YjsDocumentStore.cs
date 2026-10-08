using System.Collections.Concurrent;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Realtime;

/// <summary>
/// Keeps the latest Yjs binary state for each note in memory while it is
/// being actively edited, and persists it to SQL Server (via Stored Procedure)
/// on a debounce timer instead of on every single keystroke/update.
/// This dramatically reduces write pressure on the database during
/// collaborative editing sessions.
/// </summary>
public interface IYjsDocumentStore
{
    void ApplyUpdate(Guid nodeId, byte[] update);
    byte[]? GetState(Guid nodeId);
    void ScheduleFlush(Guid nodeId, INodeRepository repository, TimeSpan debounce);
    Task FlushNowAsync(Guid nodeId, INodeRepository repository);
    void Evict(Guid nodeId);
}

public sealed class YjsDocumentStore : IYjsDocumentStore
{
    private sealed class DocState
    {
        public readonly object Lock = new();
        public byte[]? MergedState;
        public Timer? DebounceTimer;
    }

    private readonly ConcurrentDictionary<Guid, DocState> _docs = new();

    public void ApplyUpdate(Guid nodeId, byte[] update)
    {
        var doc = _docs.GetOrAdd(nodeId, _ => new DocState());
        lock (doc.Lock)
        {
            // NOTE: a production implementation would merge using the Yjs
            // update-merging algorithm (Y.mergeUpdates). Here we keep the most
            // recent full-state snapshot sent by the client (BlockNote/Yjs
            // clients periodically send a compacted full state) which is
            // sufficient for persistence purposes; live sync between clients
            // is handled purely by SignalR broadcast, not by this store.
            doc.MergedState = update;
        }
    }

    public byte[]? GetState(Guid nodeId) =>
        _docs.TryGetValue(nodeId, out var doc) ? doc.MergedState : null;

    public void ScheduleFlush(Guid nodeId, INodeRepository repository, TimeSpan debounce)
    {
        var doc = _docs.GetOrAdd(nodeId, _ => new DocState());
        lock (doc.Lock)
        {
            doc.DebounceTimer?.Dispose();
            doc.DebounceTimer = new Timer(async _ =>
            {
                // An exception escaping an async timer callback would take the whole process down: log and carry on.
                try { await FlushNowAsync(nodeId, repository); }
                catch (Exception ex) { Console.Error.WriteLine($"[YjsDocumentStore] Flush of note {nodeId} failed: {ex}"); }
            }, null, debounce, Timeout.InfiniteTimeSpan);
        }
    }

    public async Task FlushNowAsync(Guid nodeId, INodeRepository repository)
    {
        if (!_docs.TryGetValue(nodeId, out var doc)) return;

        byte[]? state;
        lock (doc.Lock)
        {
            state = doc.MergedState;
        }

        if (state is not null)
        {
            await repository.SaveContentAsync(nodeId, contentJson: null, contentYjsState: state);
        }
    }

    public void Evict(Guid nodeId)
    {
        if (_docs.TryRemove(nodeId, out var doc))
        {
            doc.DebounceTimer?.Dispose();
        }
    }
}
