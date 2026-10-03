using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class NodeRepository : INodeRepository
{
    private readonly DapperContext _context;

    public NodeRepository(DapperContext context) => _context = context;

    public async Task<Node> CreateAsync(Guid? parentId, Guid ownerId, string type, string name)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<Node>(
            "sp_Node_Create",
            new { ParentId = parentId, OwnerId = ownerId, Type = type, Name = name },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<Node?> RenameAsync(Guid nodeId, string name)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<Node>(
            "sp_Node_Rename",
            new { NodeId = nodeId, Name = name },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<Node?> MoveAsync(Guid nodeId, Guid? newParentId, int? newSortOrder)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<Node>(
            "sp_Node_Move",
            new { NodeId = nodeId, NewParentId = newParentId, NewSortOrder = newSortOrder },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<Node?> DuplicateAsync(Guid nodeId, Guid ownerId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<Node>(
            "sp_Node_Duplicate",
            new { NodeId = nodeId, OwnerId = ownerId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task SoftDeleteAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Node_SoftDelete",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task RestoreAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Node_Restore",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task HardDeleteAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Node_HardDelete",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetTreeByUserAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetTreeByUser",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetChildrenAsync(Guid? parentId, Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetChildren",
            new { ParentId = parentId, UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<Node?> GetByIdAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<Node>(
            "sp_Node_GetById",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetRecentAsync(Guid userId, int top)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetRecent",
            new { UserId = userId, Top = top },
            commandType: CommandType.StoredProcedure);
    }

    public async Task TouchRecentAsync(Guid userId, Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Node_TouchRecent",
            new { UserId = userId, NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<bool> ToggleFavoriteAsync(Guid userId, Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<bool>(
            "sp_Node_ToggleFavorite",
            new { UserId = userId, NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetFavoritesAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetFavorites",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetSharedWithMeAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetSharedWithMe",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<NodeSearchResult>> SearchAsync(Guid userId, string query, int top)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<NodeSearchResult>(
            "sp_Node_Search",
            new { UserId = userId, Query = query, Top = top },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Node>> GetTrashAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Node>(
            "sp_Node_GetTrash",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task SaveContentAsync(Guid nodeId, string? contentJson, byte[]? contentYjsState)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Node_SaveContent",
            new { NodeId = nodeId, ContentJson = contentJson, ContentYjsState = contentYjsState },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<Node?> GetContentAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<Node>(
            "sp_Node_GetContent",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }
}
