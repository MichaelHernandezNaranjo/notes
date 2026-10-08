namespace NotesApp.Api.Application.DTOs;

public sealed record LoginRequest(string Code, string RedirectUri, string? TermsVersion = null);
public sealed record RefreshRequest(string RefreshToken);
public sealed record AuthResponse(string AccessToken, string RefreshToken, UserDto User);

public sealed record UserDto(Guid Id, string Email, string DisplayName, string? AvatarUrl, string PreferredLanguage, bool IsSuperAdmin = false);

public sealed record CreateNodeRequest(Guid? ParentId, string Type, string Name);
public sealed record RenameNodeRequest(string Name);
public sealed record MoveNodeRequest(Guid? NewParentId, int? NewSortOrder, bool Reorder = false, Guid? BeforeNodeId = null);

public sealed record NodeDto(
    Guid Id, Guid? ParentId, Guid OwnerId, string Type, string Name,
    string? ContentJson, int SortOrder, bool IsDeleted, DateTime? DeletedAt,
    DateTime CreatedAt, DateTime UpdatedAt, bool IsFavorite, string? Path = null, Guid? DeletedRootId = null,
    string? AccessLevel = null, bool CanManage = false, long ContentSizeBytes = 0, long MaxNoteBytes = 0);

public sealed record NodeSearchResultDto(Guid Id, Guid? ParentId, string Name, string Type, string Path, string[] PathIds);

public sealed record CreateGroupRequest(string Name, string? Description);
public sealed record AddGroupMemberRequest(Guid UserId, string Role);

public sealed record ShareWithEmailRequest(string Email, string AccessLevel, DateTime? ExpiresAt = null);
public sealed record UpdatePermissionRequest(string AccessLevel, DateTime? ExpiresAt = null);
public sealed record ShareLinkRequest(DateTime? ExpiresAt = null, bool Regenerate = false);

public sealed record SharingDto(
    IEnumerable<NodePermissionDto> People,
    IEnumerable<ShareInvitationDto> Invitations,
    ShareLinkDto? Link);

public sealed record NodePermissionDto(
    Guid Id, string GranteeType, string AccessLevel, DateTime CreatedAt, DateTime? ExpiresAt,
    string? DisplayName, string? Email, string? AvatarUrl, bool Inherited, Guid SourceNodeId, string? SourceNodeName);

public sealed record ShareInvitationDto(Guid Id, string Email, string AccessLevel, DateTime CreatedAt, DateTime ExpiresAt);
public sealed record ShareLinkDto(string Token, DateTime CreatedAt, DateTime? ExpiresAt, int ViewCount);
public sealed record ShareResultDto(string Kind, Guid Id, string Email);

public sealed record PublicTreeNodeDto(Guid Id, Guid? ParentId, string Type, string Name);
public sealed record PublicShareDto(Guid NodeId, string Name, string Type, DateTime? ExpiresAt, IEnumerable<PublicTreeNodeDto> Tree);
public sealed record PublicNodeDto(Guid Id, string Type, string Name, byte[]? State);

public sealed record UpdateLanguageRequest(string Language);
