using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NotesApp.Api.Controllers;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Data.Repositories;
using NotesApp.Api.Infrastructure.Realtime;

namespace NotesApp.Api.Hubs;

/// <summary>
/// Lightweight connection opened as soon as a user is signed in (one per tab). It tells the admins who is online,
/// delivers announcements in real time and lets the server drop a user the moment they are blocked.
/// </summary>
[Authorize]
public sealed class PresenceHub : Hub
{
    public const string AllGroup = "all";
    public static string UserGroup(Guid userId) => $"user:{userId}";

    private readonly IPresenceTracker _tracker;
    private readonly IAdminRepository _admin;

    public PresenceHub(IPresenceTracker tracker, IAdminRepository admin)
    {
        _tracker = tracker;
        _admin = admin;
    }

    private Guid CurrentUserId => Context.User!.GetUserId();

    public override async Task OnConnectedAsync()
    {
        var userId = CurrentUserId;
        _tracker.Add(Context.ConnectionId, userId);
        await Groups.AddToGroupAsync(Context.ConnectionId, AllGroup);
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        await _admin.TouchSeenAsync(userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _tracker.Remove(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Heartbeat from the client so "last seen" keeps moving while the tab stays open.</summary>
    public Task Ping() => _admin.TouchSeenAsync(CurrentUserId);
}
