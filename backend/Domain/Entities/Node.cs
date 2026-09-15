namespace NotesApp.Api.Domain.Entities;

public sealed class Node
{
    public Guid Id { get; init; }
    public Guid? ParentId { get; init; }
    public Guid OwnerId { get; init; }
    public string Type { get; init; } = "Note"; // "Folder" | "Note"
    public string Name { get; init; } = string.Empty;
    public string? ContentJson { get; init; }
    public byte[]? ContentYjsState { get; init; }
    public int SortOrder { get; init; }
    public bool IsDeleted { get; init; }
    public DateTime? DeletedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool IsFavorite { get; init; }
}

public sealed class NodePermission
{
    public Guid Id { get; init; }
    public Guid NodeId { get; init; }
    public string GranteeType { get; init; } = string.Empty; // User | Group | PublicLink
    public Guid? GranteeId { get; init; }
    public string AccessLevel { get; init; } = string.Empty; // Read | Edit
    public string? ShareToken { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public string? UserDisplayName { get; init; }
    public string? UserEmail { get; init; }
    public string? GroupName { get; init; }
}

public sealed class AuditLogEntry
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid? NodeId { get; init; }
    public string Action { get; init; } = string.Empty;
    public string? MetadataJson { get; init; }
    public DateTime CreatedAt { get; init; }
    public string? DisplayName { get; init; }
    public string? AvatarUrl { get; init; }
}
