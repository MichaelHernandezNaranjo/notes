using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

public interface INodeService
{
    Task<NodeDto> CreateAsync(Guid userId, CreateNodeRequest request);
    Task<NodeDto?> RenameAsync(Guid userId, Guid nodeId, string name);
    Task<NodeDto?> MoveAsync(Guid userId, Guid nodeId, Guid? newParentId, int? newSortOrder);
    Task<NodeDto?> DuplicateAsync(Guid userId, Guid nodeId);
    Task SoftDeleteAsync(Guid userId, Guid nodeId);
    Task RestoreAsync(Guid userId, Guid nodeId);
    Task HardDeleteAsync(Guid userId, Guid nodeId);
    Task<IEnumerable<NodeDto>> GetTreeAsync(Guid userId);
    Task<IEnumerable<NodeDto>> GetChildrenAsync(Guid userId, Guid? parentId);
    Task<IEnumerable<NodeDto>> GetRecentAsync(Guid userId, int top);
    Task<IEnumerable<NodeDto>> GetFavoritesAsync(Guid userId);
    Task<IEnumerable<NodeDto>> GetTrashAsync(Guid userId);
    Task<bool> ToggleFavoriteAsync(Guid userId, Guid nodeId);
    Task<NodeDto?> GetByIdAsync(Guid userId, Guid nodeId, bool touchRecent = true);
}

public sealed class NodeService : INodeService
{
    private readonly INodeRepository _nodeRepository;
    private readonly IPermissionRepository _permissionRepository;
    private readonly IAuditRepository _auditRepository;
    private readonly IFileService _fileService;

    public NodeService(INodeRepository nodeRepository, IPermissionRepository permissionRepository, IAuditRepository auditRepository, IFileService fileService)
    {
        _nodeRepository = nodeRepository;
        _permissionRepository = permissionRepository;
        _auditRepository = auditRepository;
        _fileService = fileService;
    }

    public async Task<NodeDto> CreateAsync(Guid userId, CreateNodeRequest request)
    {
        if (request.ParentId is not null)
        {
            await EnsureAccessAsync(userId, request.ParentId.Value, requireEdit: true);
        }

        var node = await _nodeRepository.CreateAsync(request.ParentId, userId, request.Type, request.Name);
        await _auditRepository.InsertAsync(userId, node.Id, "NodeCreated", null);
        return Map(node);
    }

    public async Task<NodeDto?> RenameAsync(Guid userId, Guid nodeId, string name)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: true);
        await EnsureNotTrashedAsync(nodeId);
        var node = await _nodeRepository.RenameAsync(nodeId, name);
        await _auditRepository.InsertAsync(userId, nodeId, "NodeRenamed", null);
        return node is null ? null : Map(node);
    }

    public async Task<NodeDto?> MoveAsync(Guid userId, Guid nodeId, Guid? newParentId, int? newSortOrder)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: true);
        await EnsureNotTrashedAsync(nodeId);
        if (newParentId is not null)
        {
            await EnsureAccessAsync(userId, newParentId.Value, requireEdit: true);
        }

        var node = await _nodeRepository.MoveAsync(nodeId, newParentId, newSortOrder);
        await _auditRepository.InsertAsync(userId, nodeId, "NodeMoved", null);
        return node is null ? null : Map(node);
    }

    public async Task<NodeDto?> DuplicateAsync(Guid userId, Guid nodeId)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: false);
        var node = await _nodeRepository.DuplicateAsync(nodeId, userId);
        return node is null ? null : Map(node);
    }

    public async Task SoftDeleteAsync(Guid userId, Guid nodeId)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: true);
        await _nodeRepository.SoftDeleteAsync(nodeId);
        await _auditRepository.InsertAsync(userId, nodeId, "NodeSoftDeleted", null);
    }

    public async Task RestoreAsync(Guid userId, Guid nodeId)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: true);
        await _nodeRepository.RestoreAsync(nodeId);
        await _auditRepository.InsertAsync(userId, nodeId, "NodeRestored", null);
    }

    public async Task HardDeleteAsync(Guid userId, Guid nodeId)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: true);

        // Collect the images first: the DB rows disappear (cascade) with the nodes.
        var files = await _fileService.ListTreeAsync(nodeId);
        await _nodeRepository.HardDeleteAsync(nodeId);
        _fileService.DeleteFromDisk(files);

        // The node no longer exists, so the audit row cannot reference it (FK); keep its id in the metadata.
        await _auditRepository.InsertAsync(userId, null, "NodeHardDeleted", $"{{\"nodeId\":\"{nodeId}\"}}");
    }

    public async Task<IEnumerable<NodeDto>> GetTreeAsync(Guid userId) =>
        (await _nodeRepository.GetTreeByUserAsync(userId)).Select(Map);

    public async Task<IEnumerable<NodeDto>> GetChildrenAsync(Guid userId, Guid? parentId) =>
        (await _nodeRepository.GetChildrenAsync(parentId, userId)).Select(Map);

    public async Task<IEnumerable<NodeDto>> GetRecentAsync(Guid userId, int top) =>
        (await _nodeRepository.GetRecentAsync(userId, top)).Select(Map);

    public async Task<IEnumerable<NodeDto>> GetFavoritesAsync(Guid userId) =>
        (await _nodeRepository.GetFavoritesAsync(userId)).Select(Map);

    public async Task<IEnumerable<NodeDto>> GetTrashAsync(Guid userId) =>
        (await _nodeRepository.GetTrashAsync(userId)).Select(Map);

    public Task<bool> ToggleFavoriteAsync(Guid userId, Guid nodeId) =>
        _nodeRepository.ToggleFavoriteAsync(userId, nodeId);

    public async Task<NodeDto?> GetByIdAsync(Guid userId, Guid nodeId, bool touchRecent = true)
    {
        await EnsureAccessAsync(userId, nodeId, requireEdit: false);
        var node = await _nodeRepository.GetByIdAsync(nodeId);
        if (node is null) return null;

        if (touchRecent)
        {
            await _nodeRepository.TouchRecentAsync(userId, nodeId);
        }

        return Map(node);
    }

    private async Task EnsureNotTrashedAsync(Guid nodeId)
    {
        var node = await _nodeRepository.GetByIdAsync(nodeId);
        if (node is { IsDeleted: true })
        {
            throw new UnauthorizedAccessException("This node is in the trash and cannot be modified. Restore it first.");
        }
    }

    private async Task EnsureAccessAsync(Guid userId, Guid nodeId, bool requireEdit)
    {
        var access = await _permissionRepository.CheckAccessAsync(nodeId, userId);
        if (access is null)
        {
            throw new UnauthorizedAccessException("You do not have access to this node.");
        }

        if (requireEdit && access == "Read")
        {
            throw new UnauthorizedAccessException("Read-only access does not permit this operation.");
        }
    }

    private static NodeDto Map(Node n) => new(
        n.Id, n.ParentId, n.OwnerId, n.Type, n.Name, n.ContentJson,
        n.SortOrder, n.IsDeleted, n.DeletedAt, n.CreatedAt, n.UpdatedAt, n.IsFavorite, n.Path, n.DeletedRootId);
}
