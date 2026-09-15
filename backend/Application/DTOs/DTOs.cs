namespace NotesApp.Api.Application.DTOs;

public sealed record LoginRequest(string Code, string RedirectUri);
public sealed record RefreshRequest(string RefreshToken);
public sealed record AuthResponse(string AccessToken, string RefreshToken, UserDto User);

public sealed record UserDto(Guid Id, string Email, string DisplayName, string? AvatarUrl, string PreferredLanguage);

public sealed record CreateNodeRequest(Guid? ParentId, string Type, string Name);
public sealed record RenameNodeRequest(string Name);
public sealed record MoveNodeRequest(Guid? NewParentId, int? NewSortOrder);

public sealed record NodeDto(
    Guid Id, Guid? ParentId, Guid OwnerId, string Type, string Name,
    string? ContentJson, int SortOrder, bool IsDeleted, DateTime? DeletedAt,
    DateTime CreatedAt, DateTime UpdatedAt, bool IsFavorite);

public sealed record CreateGroupRequest(string Name, string? Description);
public sealed record AddGroupMemberRequest(Guid UserId, string Role);

public sealed record GrantPermissionRequest(string GranteeType, Guid? GranteeId, string AccessLevel, DateTime? ExpiresAt);
public sealed record CreateShareLinkRequest(string AccessLevel, DateTime? ExpiresAt);

public sealed record UpdateLanguageRequest(string Language);
