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
    /// <summary>Ancestor names (root first), only populated by the trash listing.</summary>
    public string? Path { get; init; }
    /// <summary>Highest trashed ancestor (or itself), only populated by the trash listing.</summary>
    public Guid? DeletedRootId { get; init; }
}

public sealed class NodeFile
{
    public Guid Id { get; init; }
    public Guid NodeId { get; init; }
    public string StoredName { get; init; } = string.Empty;
    public string OriginalName { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long SizeBytes { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
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
