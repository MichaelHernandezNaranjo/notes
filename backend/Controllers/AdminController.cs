using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Hubs;
using NotesApp.Api.Infrastructure.Data.Repositories;
using NotesApp.Api.Infrastructure.Realtime;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

public sealed record BlockUserRequest(string? Reason);
public sealed record SetQuotaRequest(long? QuotaBytes);
public sealed record SetAdminRequest(bool IsSuperAdmin);
public sealed record AnnouncementRequest(string Title, string Message, string? Severity, Guid? TargetUserId, DateTime? ExpiresAt);

/// <summary>
/// Administration API. Only super admins (checked against the database on every call).
/// It exposes metadata and storage figures, never the content of anybody's notes.
/// </summary>
[ApiController]
[Authorize]
[SuperAdminOnly]
[Route("api/admin")]
public sealed class AdminController : ControllerBase
{
    private const long MaxQuotaBytes = 1L * 1024 * 1024 * 1024 * 1024; // 1 TB sanity cap
    private static readonly HashSet<string> Filters = ["all", "active", "blocked", "admins", "over", "online"];
    private static readonly HashSet<string> Sorts = ["lastLogin", "name", "created", "usage"];
    private static readonly HashSet<string> Severities = ["Info", "Warning", "Critical"];

    private readonly IAdminRepository _admin;
    private readonly IUserStatusService _status;
    private readonly IAuditRepository _audit;
    private readonly IPresenceTracker _presence;
    private readonly IHubContext<PresenceHub> _hub;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;

    public AdminController(IAdminRepository admin, IUserStatusService status, IAuditRepository audit, IPresenceTracker presence,
        IHubContext<PresenceHub> hub, IConfiguration configuration, IWebHostEnvironment env)
    {
        _admin = admin;
        _status = status;
        _audit = audit;
        _presence = presence;
        _hub = hub;
        _configuration = configuration;
        _env = env;
    }

    private Guid Me => User.GetUserId();

    // ---------------------------------------------------------------- metrics

    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
    {
        var stats = await _admin.GetOverviewAsync();
        var dbBytes = await _admin.GetDatabaseSizeAsync().ConfigureAwait(false);
        var top = await _admin.GetTopUsersAsync(10);
        var activity = await _admin.GetActivityAsync(30);

        long? diskTotal = null, diskFree = null;
        try
        {
            var root = Path.GetFullPath(_configuration["Files:RootPath"] ?? Path.Combine(_env.ContentRootPath, "App_Data", "files"));
            var drive = new DriveInfo(Path.GetPathRoot(root)!);
            diskTotal = drive.TotalSize;
            diskFree = drive.AvailableFreeSpace;
        }
        catch (Exception)
        {
            // Not available on every platform/container: the panel just hides the figure.
        }

        return Ok(new
        {
            stats,
            online = _presence.OnlineUserIds().Count,
            databaseBytes = dbBytes,
            // SQL Server Express caps each database at 10 GB.
            databaseLimitBytes = _configuration.GetValue<long?>("Storage:DatabaseLimitBytes") ?? 10L * 1024 * 1024 * 1024,
            diskTotalBytes = diskTotal,
            diskFreeBytes = diskFree,
            topUsers = top,
            activity
        });
    }

    // ---------------------------------------------------------------- users

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? search, [FromQuery] string filter = "all", [FromQuery] string sort = "lastLogin",
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        if (!Filters.Contains(filter)) filter = "all";
        if (!Sorts.Contains(sort)) sort = "lastLogin";
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(page, 1);
        search = search is { Length: > 100 } ? search[..100] : search;

        var online = _presence.OnlineUserIds();
        var result = await _admin.ListUsersAsync(search, filter, sort, (page - 1) * pageSize, pageSize, filter == "online" ? online : null);
        var onlineSet = online.ToHashSet();

        var items = result.Items.Select(u => new
        {
            u.Id, u.Email, u.DisplayName, u.AvatarUrl, u.CreatedAt, u.LastLoginAt, u.LastSeenAt,
            u.IsActive, u.BlockedAt, u.BlockReason, u.IsSuperAdmin,
            u.StorageQuotaBytes, u.EffectiveQuotaBytes, u.UsedBytes, u.NoteCount,
            isOnline = onlineSet.Contains(u.Id),
            isRoot = _status.IsRootAdminEmail(u.Email),
            isSelf = u.Id == Me
        });

        return Ok(new { items, total = result.Total, page, pageSize });
    }

    [HttpPost("users/{id:guid}/block")]
    public async Task<IActionResult> Block(Guid id, [FromBody] BlockUserRequest request)
    {
        var target = await _admin.GetUserAsync(id);
        if (target is null) return NotFound();
        if (id == Me) return BadRequest(new { error = "You cannot block yourself.", code = "cannot_block_self" });
        if (_status.IsRootAdminEmail(target.Email)) return BadRequest(new { error = "Root administrators cannot be blocked.", code = "cannot_block_root" });

        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (reason is { Length: > 500 }) reason = reason[..500];

        await _admin.SetBlockedAsync(id, true, reason);
        _status.Invalidate(id);
        // Tell any open tab right now; the HTTP filter already refuses its next request.
        await _hub.Clients.Group(PresenceHub.UserGroup(id)).SendAsync("Blocked");
        await Audit("Admin.UserBlocked", new { userId = id, email = target.Email, reason });
        return NoContent();
    }

    [HttpPost("users/{id:guid}/unblock")]
    public async Task<IActionResult> Unblock(Guid id)
    {
        var target = await _admin.GetUserAsync(id);
        if (target is null) return NotFound();

        await _admin.SetBlockedAsync(id, false, null);
        _status.Invalidate(id);
        await Audit("Admin.UserUnblocked", new { userId = id, email = target.Email });
        return NoContent();
    }

    [HttpPut("users/{id:guid}/quota")]
    public async Task<IActionResult> SetQuota(Guid id, [FromBody] SetQuotaRequest request)
    {
        var target = await _admin.GetUserAsync(id);
        if (target is null) return NotFound();
        if (request.QuotaBytes is < 0 or > MaxQuotaBytes)
            return BadRequest(new { error = "Invalid quota.", code = "invalid_quota" });

        await _admin.SetQuotaAsync(id, request.QuotaBytes);
        await Audit("Admin.QuotaChanged", new { userId = id, email = target.Email, quotaBytes = request.QuotaBytes });
        return NoContent();
    }

    [HttpPut("users/{id:guid}/admin")]
    public async Task<IActionResult> SetAdmin(Guid id, [FromBody] SetAdminRequest request)
    {
        var target = await _admin.GetUserAsync(id);
        if (target is null) return NotFound();
        if (id == Me) return BadRequest(new { error = "You cannot change your own role.", code = "cannot_change_self" });
        if (_status.IsRootAdminEmail(target.Email) && !request.IsSuperAdmin)
            return BadRequest(new { error = "The root administrator cannot be demoted.", code = "root_admin" });
        if (request.IsSuperAdmin && !target.IsActive)
            return BadRequest(new { error = "A blocked user cannot be made an administrator.", code = "user_blocked" });

        // sp_Admin_SetSuperAdmin refuses (50004) to remove the last administrator.
        await _admin.SetSuperAdminAsync(id, request.IsSuperAdmin);
        _status.Invalidate(id);
        await Audit(request.IsSuperAdmin ? "Admin.AdminGranted" : "Admin.AdminRevoked", new { userId = id, email = target.Email });
        return NoContent();
    }

    // ---------------------------------------------------------------- announcements

    [HttpGet("announcements")]
    public async Task<IActionResult> Announcements() => Ok(await _admin.ListAnnouncementsAsync());

    [HttpPost("announcements")]
    public async Task<IActionResult> CreateAnnouncement([FromBody] AnnouncementRequest request)
    {
        var invalid = Validate(request, out var title, out var message, out var severity);
        if (invalid is not null) return invalid;

        if (request.TargetUserId is { } target && await _admin.GetUserAsync(target) is null)
            return NotFound(new { error = "Target user not found.", code = "user_not_found" });

        var created = await _admin.CreateAnnouncementAsync(title, message, severity, request.TargetUserId, ToUtc(request.ExpiresAt), Me);
        await Push(created);
        await Audit("Admin.AnnouncementCreated", new { announcementId = created.Id, request.TargetUserId, severity });
        return Ok(created);
    }

    [HttpPut("announcements/{id:guid}")]
    public async Task<IActionResult> UpdateAnnouncement(Guid id, [FromBody] AnnouncementRequest request)
    {
        var invalid = Validate(request, out var title, out var message, out var severity);
        if (invalid is not null) return invalid;

        var updated = await _admin.UpdateAnnouncementAsync(id, title, message, severity, ToUtc(request.ExpiresAt));
        if (updated is null) return NotFound();
        await Push(updated);
        await Audit("Admin.AnnouncementUpdated", new { announcementId = id });
        return Ok(updated);
    }

    [HttpDelete("announcements/{id:guid}")]
    public async Task<IActionResult> DeleteAnnouncement(Guid id)
    {
        var existing = (await _admin.ListAnnouncementsAsync()).FirstOrDefault(a => a.Id == id);
        if (existing is null) return NotFound();

        await _admin.DeleteAnnouncementAsync(id);
        await Audience(existing.TargetUserId).SendAsync("AnnouncementRemoved", id);
        await Audit("Admin.AnnouncementDeleted", new { announcementId = id });
        return NoContent();
    }

    // ---------------------------------------------------------------- helpers

    private IClientProxy Audience(Guid? targetUserId) =>
        targetUserId is null ? _hub.Clients.Group(PresenceHub.AllGroup) : _hub.Clients.Group(PresenceHub.UserGroup(targetUserId.Value));

    private Task Push(AnnouncementRow a) =>
        Audience(a.TargetUserId).SendAsync("Announcement", new PendingAnnouncementRow
        {
            Id = a.Id, Title = a.Title, Message = a.Message, Severity = a.Severity, CreatedAt = a.CreatedAt, ExpiresAt = a.ExpiresAt
        });

    private Task Audit(string action, object metadata) => _audit.InsertAsync(Me, null, action, JsonSerializer.Serialize(metadata));

    private static DateTime? ToUtc(DateTime? value) => value is null ? null : value.Value.Kind == DateTimeKind.Utc ? value : value.Value.ToUniversalTime();

    private IActionResult? Validate(AnnouncementRequest request, out string title, out string message, out string severity)
    {
        title = (request.Title ?? string.Empty).Trim();
        message = (request.Message ?? string.Empty).Trim();
        severity = Severities.Contains(request.Severity ?? "Info") ? request.Severity ?? "Info" : "Info";

        if (title.Length is 0 or > 200) return BadRequest(new { error = "The title must have 1-200 characters.", code = "invalid_title" });
        if (message.Length is 0 or > 2000) return BadRequest(new { error = "The message must have 1-2000 characters.", code = "invalid_message" });
        if (request.ExpiresAt is { } exp && ToUtc(exp) <= DateTime.UtcNow) return BadRequest(new { error = "The expiry date must be in the future.", code = "invalid_expiry" });
        return null;
    }
}
