using Microsoft.Extensions.Caching.Memory;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

/// <summary>Current account state, read from the database (not from the JWT) so blocking or demoting takes effect within seconds.</summary>
public sealed record UserStatus(bool Exists, bool IsActive, bool IsSuperAdmin, string Email);

public interface IUserStatusService
{
    Task<UserStatus> GetAsync(Guid userId);
    void Invalidate(Guid userId);
    /// <summary>True when the e-mail is configured as a root administrator (cannot be demoted or blocked from the panel).</summary>
    bool IsRootAdminEmail(string email);
    IReadOnlyCollection<string> RootAdminEmails { get; }
}

public sealed class UserStatusService : IUserStatusService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

    private readonly IUserRepository _users;
    private readonly IMemoryCache _cache;
    private readonly HashSet<string> _rootEmails;

    public UserStatusService(IUserRepository users, IMemoryCache cache, IConfiguration configuration)
    {
        _users = users;
        _cache = cache;
        _rootEmails = (configuration.GetSection("Admin:SuperAdminEmails").Get<string[]>() ?? [])
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim().ToLowerInvariant())
            .ToHashSet();
    }

    public IReadOnlyCollection<string> RootAdminEmails => _rootEmails;

    public bool IsRootAdminEmail(string email) => _rootEmails.Contains(email.Trim().ToLowerInvariant());

    public async Task<UserStatus> GetAsync(Guid userId)
    {
        if (_cache.TryGetValue(CacheKey(userId), out UserStatus? cached) && cached is not null) return cached;

        // sp_User_GetById only returns active users: a null result means blocked or removed.
        User? user = await _users.GetByIdAsync(userId);
        var status = user is null
            ? new UserStatus(false, false, false, string.Empty)
            : new UserStatus(true, user.IsActive, user.IsSuperAdmin, user.Email);
        _cache.Set(CacheKey(userId), status, Ttl);
        return status;
    }

    public void Invalidate(Guid userId) => _cache.Remove(CacheKey(userId));

    private static string CacheKey(Guid userId) => $"userstatus:{userId}";
}
