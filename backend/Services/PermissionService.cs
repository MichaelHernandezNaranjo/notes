using System.Security.Cryptography;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

public interface IPermissionService
{
    Task<NodePermission> GrantAsync(Guid nodeId, string granteeType, Guid? granteeId, string accessLevel, Guid createdBy, DateTime? expiresAt);
    Task<NodePermission> CreateShareLinkAsync(Guid nodeId, string accessLevel, Guid createdBy, DateTime? expiresAt);
    Task RevokeAsync(Guid permissionId);
    Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId);
    Task<string?> CheckAccessAsync(Guid nodeId, Guid userId);
    Task<NodePermission?> GetByShareTokenAsync(string shareToken);
}

public sealed class PermissionService : IPermissionService
{
    private readonly IPermissionRepository _permissionRepository;

    public PermissionService(IPermissionRepository permissionRepository) => _permissionRepository = permissionRepository;

    public Task<NodePermission> GrantAsync(Guid nodeId, string granteeType, Guid? granteeId, string accessLevel, Guid createdBy, DateTime? expiresAt) =>
        _permissionRepository.GrantAsync(nodeId, granteeType, granteeId, accessLevel, createdBy, expiresAt);

    public Task<NodePermission> CreateShareLinkAsync(Guid nodeId, string accessLevel, Guid createdBy, DateTime? expiresAt)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").Replace("=", "");
        return _permissionRepository.CreateShareLinkAsync(nodeId, accessLevel, token, createdBy, expiresAt);
    }

    public Task RevokeAsync(Guid permissionId) => _permissionRepository.RevokeAsync(permissionId);

    public Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId) => _permissionRepository.ListByNodeAsync(nodeId);

    public Task<string?> CheckAccessAsync(Guid nodeId, Guid userId) => _permissionRepository.CheckAccessAsync(nodeId, userId);

    public Task<NodePermission?> GetByShareTokenAsync(string shareToken) => _permissionRepository.GetByShareTokenAsync(shareToken);
}
