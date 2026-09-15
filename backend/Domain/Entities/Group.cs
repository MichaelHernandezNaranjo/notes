namespace NotesApp.Api.Domain.Entities;

public sealed class Group
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
    public bool IsDeleted { get; init; }
    public string? Role { get; init; } // populated when listed for a specific user
}

public sealed class GroupMember
{
    public Guid GroupId { get; init; }
    public Guid UserId { get; init; }
    public string Role { get; init; } = "Member";
    public DateTime JoinedAt { get; init; }
    public string? Email { get; init; }
    public string? DisplayName { get; init; }
    public string? AvatarUrl { get; init; }
}
