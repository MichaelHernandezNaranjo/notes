using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class PermissionRepository : IPermissionRepository
{
    private readonly DapperContext _context;

    public PermissionRepository(DapperContext context) => _context = context;

    public async Task<NodePermission> GrantAsync(Guid nodeId, string granteeType, Guid? granteeId, string accessLevel, Guid createdBy, DateTime? expiresAt)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<NodePermission>(
            "sp_Permission_Grant",
            new { NodeId = nodeId, GranteeType = granteeType, GranteeId = granteeId, AccessLevel = accessLevel, CreatedBy = createdBy, ExpiresAt = expiresAt },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<NodePermission> CreateShareLinkAsync(Guid nodeId, string accessLevel, string shareToken, Guid createdBy, DateTime? expiresAt)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<NodePermission>(
            "sp_Permission_CreateShareLink",
            new { NodeId = nodeId, AccessLevel = accessLevel, ShareToken = shareToken, CreatedBy = createdBy, ExpiresAt = expiresAt },
            commandType: CommandType.StoredProcedure);
    }

    public async Task RevokeAsync(Guid permissionId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Permission_Revoke",
            new { PermissionId = permissionId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<NodePermission>(
            "sp_Permission_ListByNode",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<string?> CheckAccessAsync(Guid nodeId, Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<string?>(
            "sp_Permission_CheckAccess",
            new { NodeId = nodeId, UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<NodePermission?> GetByShareTokenAsync(string shareToken)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<NodePermission>(
            "sp_Permission_GetByShareToken",
            new { ShareToken = shareToken },
            commandType: CommandType.StoredProcedure);
    }
}
