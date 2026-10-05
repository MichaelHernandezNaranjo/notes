namespace NotesApp.Api.Domain.Entities;

/// <summary>Row of the admin user list (see sp_Admin_ListUsers).</summary>
public sealed class AdminUserRow
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime? LastSeenAt { get; init; }
    public bool IsActive { get; init; }
    public DateTime? BlockedAt { get; init; }
    public string? BlockReason { get; init; }
    public bool IsSuperAdmin { get; init; }
    /// <summary>Explicit per-user quota; null = default.</summary>
    public long? StorageQuotaBytes { get; init; }
    /// <summary>Quota that actually applies; null = unlimited (super admins).</summary>
    public long? EffectiveQuotaBytes { get; init; }
    public long UsedBytes { get; init; }
    public int NoteCount { get; init; }
    public int TotalCount { get; init; }
}

public sealed class AdminOverviewRow
{
    public int TotalUsers { get; init; }
    public int BlockedUsers { get; init; }
    public int SuperAdmins { get; init; }
    public int Active7d { get; init; }
    public int Active30d { get; init; }
    public int NewUsers7d { get; init; }
    public int Notes { get; init; }
    public int Folders { get; init; }
    public int TrashedItems { get; init; }
    public int Images { get; init; }
    public long TextBytes { get; init; }
    public long ImageBytes { get; init; }
    public int OverQuotaUsers { get; init; }
    public long DefaultQuotaBytes { get; init; }
}

public sealed class ActivityDayRow
{
    public DateTime Day { get; init; }
    public int Signups { get; init; }
    public int Actions { get; init; }
    public int ActiveUsers { get; init; }
}

public sealed class TopUserRow
{
    public Guid Id { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public long UsedBytes { get; init; }
    public long? QuotaBytes { get; init; }
}

public sealed class StorageUsageRow
{
    public long UsedBytes { get; init; }
    /// <summary>null = unlimited.</summary>
    public long? QuotaBytes { get; init; }
}

public sealed class AdminUserBasic
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public bool IsSuperAdmin { get; init; }
}

public sealed class AnnouncementRow
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Severity { get; init; } = "Info";
    public Guid? TargetUserId { get; init; }
    public string? TargetName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public int DismissedCount { get; init; }
}

public sealed class PendingAnnouncementRow
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Severity { get; init; } = "Info";
    public DateTime CreatedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
}
