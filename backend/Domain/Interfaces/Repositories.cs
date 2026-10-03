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
    Task<Node?> MoveAsync(Guid nodeId, Guid? newParentId, int? newSortOrder);
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
    Task<NodePermission> GrantAsync(Guid nodeId, string granteeType, Guid? granteeId, string accessLevel, Guid createdBy, DateTime? expiresAt);
    Task<NodePermission> CreateShareLinkAsync(Guid nodeId, string accessLevel, string shareToken, Guid createdBy, DateTime? expiresAt);
    Task RevokeAsync(Guid permissionId);
    Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId);
    Task<string?> CheckAccessAsync(Guid nodeId, Guid userId);
    Task<NodePermission?> GetByShareTokenAsync(string shareToken);
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
