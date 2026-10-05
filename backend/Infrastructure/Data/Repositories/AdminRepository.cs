using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed record AdminUserPage(IReadOnlyList<AdminUserRow> Items, int Total);

public interface IAdminRepository
{
    // Users
    Task<AdminUserPage> ListUsersAsync(string? search, string filter, string sort, int offset, int limit, IEnumerable<Guid>? onlineIds = null);
    Task<AdminUserBasic?> GetUserAsync(Guid userId);
    Task SetBlockedAsync(Guid userId, bool blocked, string? reason);
    Task SetQuotaAsync(Guid userId, long? quotaBytes);
    Task SetSuperAdminAsync(Guid userId, bool isSuperAdmin);
    Task TouchSeenAsync(Guid userId);

    // Metrics
    Task<AdminOverviewRow> GetOverviewAsync();
    Task<long?> GetDatabaseSizeAsync();
    Task<IReadOnlyList<TopUserRow>> GetTopUsersAsync(int top);
    Task<IReadOnlyList<ActivityDayRow>> GetActivityAsync(int days);

    // Storage
    Task<StorageUsageRow> GetUsageAsync(Guid userId);
    Task AssertContentAllowanceAsync(Guid nodeId, long newBytes);

    // Announcements
    Task<IReadOnlyList<AnnouncementRow>> ListAnnouncementsAsync();
    Task<AnnouncementRow> CreateAnnouncementAsync(string title, string message, string severity, Guid? targetUserId, DateTime? expiresAt, Guid createdBy);
    Task<AnnouncementRow?> UpdateAnnouncementAsync(Guid id, string title, string message, string severity, DateTime? expiresAt);
    Task DeleteAnnouncementAsync(Guid id);
    Task<IReadOnlyList<PendingAnnouncementRow>> ListPendingAnnouncementsAsync(Guid userId);
    Task DismissAnnouncementAsync(Guid userId, Guid id);
}

/// <summary>Administration, metrics, storage and announcements. Every call goes through a stored procedure.</summary>
public sealed class AdminRepository : IAdminRepository
{
    private readonly DapperContext _context;

    public AdminRepository(DapperContext context) => _context = context;

    private static CommandType SP => CommandType.StoredProcedure;

    public async Task<AdminUserPage> ListUsersAsync(string? search, string filter, string sort, int offset, int limit, IEnumerable<Guid>? onlineIds = null)
    {
        using var conn = _context.CreateConnection();
        var rows = (await conn.QueryAsync<AdminUserRow>(
            "sp_Admin_ListUsers",
            new { Search = search, Filter = filter, Sort = sort, Offset = offset, Limit = limit, OnlineIds = onlineIds is null ? null : string.Join(',', onlineIds) },
            commandType: SP)).ToList();
        return new AdminUserPage(rows, rows.Count > 0 ? rows[0].TotalCount : 0);
    }

    public async Task<AdminUserBasic?> GetUserAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<AdminUserBasic>("sp_Admin_GetUser", new { UserId = userId }, commandType: SP);
    }

    public async Task SetBlockedAsync(Guid userId, bool blocked, string? reason)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Admin_SetBlocked", new { UserId = userId, Blocked = blocked, Reason = reason }, commandType: SP);
    }

    public async Task SetQuotaAsync(Guid userId, long? quotaBytes)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Admin_SetQuota", new { UserId = userId, QuotaBytes = quotaBytes }, commandType: SP);
    }

    public async Task SetSuperAdminAsync(Guid userId, bool isSuperAdmin)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Admin_SetSuperAdmin", new { UserId = userId, IsSuperAdmin = isSuperAdmin }, commandType: SP);
    }

    public async Task TouchSeenAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_User_TouchSeen", new { UserId = userId }, commandType: SP);
    }

    public async Task<AdminOverviewRow> GetOverviewAsync()
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<AdminOverviewRow>("sp_Admin_Overview", commandType: SP);
    }

    public async Task<long?> GetDatabaseSizeAsync()
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<long?>("sp_Admin_DatabaseSize", commandType: SP);
    }

    public async Task<IReadOnlyList<TopUserRow>> GetTopUsersAsync(int top)
    {
        using var conn = _context.CreateConnection();
        return (await conn.QueryAsync<TopUserRow>("sp_Admin_TopUsers", new { Top = top }, commandType: SP)).ToList();
    }

    public async Task<IReadOnlyList<ActivityDayRow>> GetActivityAsync(int days)
    {
        using var conn = _context.CreateConnection();
        return (await conn.QueryAsync<ActivityDayRow>("sp_Admin_Activity", new { Days = days }, commandType: SP)).ToList();
    }

    public async Task<StorageUsageRow> GetUsageAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<StorageUsageRow>("sp_Storage_GetUsage", new { UserId = userId }, commandType: SP)
               ?? new StorageUsageRow();
    }

    public async Task AssertContentAllowanceAsync(Guid nodeId, long newBytes)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Node_AssertContentAllowance", new { NodeId = nodeId, NewBytes = newBytes }, commandType: SP);
    }

    public async Task<IReadOnlyList<AnnouncementRow>> ListAnnouncementsAsync()
    {
        using var conn = _context.CreateConnection();
        return (await conn.QueryAsync<AnnouncementRow>("sp_Announcement_ListAdmin", commandType: SP)).ToList();
    }

    public async Task<AnnouncementRow> CreateAnnouncementAsync(string title, string message, string severity, Guid? targetUserId, DateTime? expiresAt, Guid createdBy)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<AnnouncementRow>(
            "sp_Announcement_Create",
            new { Title = title, Message = message, Severity = severity, TargetUserId = targetUserId, ExpiresAt = expiresAt, CreatedBy = createdBy },
            commandType: SP);
    }

    public async Task<AnnouncementRow?> UpdateAnnouncementAsync(Guid id, string title, string message, string severity, DateTime? expiresAt)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<AnnouncementRow>(
            "sp_Announcement_Update",
            new { Id = id, Title = title, Message = message, Severity = severity, ExpiresAt = expiresAt },
            commandType: SP);
    }

    public async Task DeleteAnnouncementAsync(Guid id)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Announcement_Delete", new { Id = id }, commandType: SP);
    }

    public async Task<IReadOnlyList<PendingAnnouncementRow>> ListPendingAnnouncementsAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return (await conn.QueryAsync<PendingAnnouncementRow>("sp_Announcement_ListPending", new { UserId = userId }, commandType: SP)).ToList();
    }

    public async Task DismissAnnouncementAsync(Guid userId, Guid id)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_Announcement_Dismiss", new { UserId = userId, Id = id }, commandType: SP);
    }
}
