using NotesApp.Api.Domain.Entities;

namespace NotesApp.Api.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByGoogleIdAsync(string googleId);
    Task<User?> GetByIdAsync(Guid id);
    Task<User> UpsertAsync(string googleId, string email, string displayName, string? avatarUrl, string? termsVersion);
    Task UpdatePreferredLanguageAsync(Guid userId, string language);
}

public interface IRefreshTokenRepository
{
    Task<RefreshToken> CreateAsync(Guid userId, string tokenHash, DateTime expiresAt);
    Task<(RefreshToken Token, User User)?> ValidateAsync(string tokenHash);
    Task RevokeAsync(string tokenHash);
    Task RevokeAllForUserAsync(Guid userId);
}

public interface IGroupRepository
{
    Task<Group> CreateAsync(string name, string? description, Guid createdBy);
    Task AddMemberAsync(Guid groupId, Guid userId, string role);
    Task RemoveMemberAsync(Guid groupId, Guid userId);
    Task<IEnumerable<GroupMember>> GetMembersAsync(Guid groupId);
    Task<IEnumerable<Group>> ListByUserAsync(Guid userId);
    Task DeleteAsync(Guid groupId);
}

public interface INodeRepository
{
    Task<Node> CreateAsync(Guid? parentId, Guid ownerId, string type, string name);
    Task<Node?> RenameAsync(Guid nodeId, string name);
    Task<Node?> MoveAsync(Guid nodeId, Guid? newParentId, int? newSortOrder, bool reorder = false, Guid? beforeNodeId = null);
    Task<Node?> DuplicateAsync(Guid nodeId, Guid ownerId);
    Task SoftDeleteAsync(Guid nodeId);
    Task RestoreAsync(Guid nodeId);
    Task HardDeleteAsync(Guid nodeId);
    Task<IEnumerable<Node>> GetTreeByUserAsync(Guid userId);
    Task<IEnumerable<Node>> GetChildrenAsync(Guid? parentId, Guid userId);
    Task<IEnumerable<Node>> GetSharedWithMeAsync(Guid userId);
    Task<IEnumerable<NodeSearchResult>> SearchAsync(Guid userId, string query, int top);
    Task<Node?> GetByIdAsync(Guid nodeId);
    Task<IEnumerable<Node>> GetRecentAsync(Guid userId, int top);
    Task TouchRecentAsync(Guid userId, Guid nodeId);
    Task<bool> ToggleFavoriteAsync(Guid userId, Guid nodeId);
    Task<IEnumerable<Node>> GetFavoritesAsync(Guid userId);
    Task<IEnumerable<Node>> GetTrashAsync(Guid userId);
    Task SaveContentAsync(Guid nodeId, string? contentJson, byte[]? contentYjsState);
    Task<Node?> GetContentAsync(Guid nodeId);
}

public interface IPermissionRepository
{
    Task<ShareResult> ShareWithEmailAsync(Guid nodeId, string email, string accessLevel, Guid createdBy, DateTime? expiresAt);
    /// <summary>Returns the affected grantee (null when nothing matched).</summary>
    Task<Guid?> UpdateAsync(Guid permissionId, Guid nodeId, string accessLevel, DateTime? expiresAt, Guid updatedBy);
    Task<(bool Found, Guid? UserId)> RevokeAsync(Guid permissionId, Guid nodeId);
    Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId);
    Task<IEnumerable<ShareInvitation>> ListInvitationsAsync(Guid nodeId);
    Task<bool> RevokeInvitationAsync(Guid invitationId, Guid nodeId);
    Task<ShareLinkInfo?> GetShareLinkAsync(Guid nodeId);
    Task<ShareLinkInfo> UpsertShareLinkAsync(Guid nodeId, string token, Guid createdBy, DateTime? expiresAt, bool regenerate);
    Task DisableShareLinkAsync(Guid nodeId);
    Task<string?> CheckAccessAsync(Guid nodeId, Guid userId);
    Task<int> RedeemInvitationsAsync(Guid userId, string email);

    // Anonymous read access through a public link.
    Task<PublicRoot?> ResolvePublicAsync(string token);
    Task<IEnumerable<PublicTreeNode>> GetPublicTreeAsync(string token);
    Task<PublicNodeContent?> GetPublicNodeAsync(string token, Guid nodeId);
    Task<NodeFile?> GetPublicFileAsync(string token, Guid fileId);
}

public interface IAuditRepository
{
    Task InsertAsync(Guid userId, Guid? nodeId, string action, string? metadataJson);
    Task<IEnumerable<AuditLogEntry>> GetByNodeAsync(Guid nodeId, int top);
}

public interface IFileRepository
{
    Task<NodeFile> CreateAsync(Guid nodeId, string storedName, string originalName, string contentType, long sizeBytes, Guid createdBy);
    Task<NodeFile?> GetByIdAsync(Guid fileId);
    Task<IEnumerable<NodeFile>> ListByNodeTreeAsync(Guid nodeId);
}
