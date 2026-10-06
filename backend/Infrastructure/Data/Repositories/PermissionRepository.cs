using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class PermissionRepository : IPermissionRepository
{
    private readonly DapperContext _context;

    public PermissionRepository(DapperContext context) => _context = context;

    private static CommandType Sp => CommandType.StoredProcedure;

    public async Task<ShareResult> ShareWithEmailAsync(Guid nodeId, string email, string accessLevel, Guid createdBy, DateTime? expiresAt)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<ShareResult>(
            "sp_Permission_ShareWithEmail",
            new { NodeId = nodeId, Email = email, AccessLevel = accessLevel, CreatedBy = createdBy, ExpiresAt = expiresAt },
            commandType: Sp);
    }

    public async Task<Guid?> UpdateAsync(Guid permissionId, Guid nodeId, string accessLevel, DateTime? expiresAt, Guid updatedBy)
    {
        using var conn = _context.CreateConnection();
        var rows = (await conn.QueryAsync<GranteeRow>(
            "sp_Permission_Update",
            new { PermissionId = permissionId, NodeId = nodeId, AccessLevel = accessLevel, ExpiresAt = expiresAt, UpdatedBy = updatedBy },
            commandType: Sp)).ToList();
        return rows.Count == 0 ? null : rows[0].UserId ?? Guid.Empty;
    }

    public async Task<(bool Found, Guid? UserId)> RevokeAsync(Guid permissionId, Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        var rows = (await conn.QueryAsync<GranteeRow>(
            "sp_Permission_Revoke",
            new { PermissionId = permissionId, NodeId = nodeId },
            commandType: Sp)).ToList();
        return (rows.Count > 0, rows.Count > 0 ? rows[0].UserId : null);
    }

    public async Task<IEnumerable<NodePermission>> ListByNodeAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<NodePermission>("sp_Permission_ListByNode", new { NodeId = nodeId }, commandType: Sp);
    }

    public async Task<IEnumerable<ShareInvitation>> ListInvitationsAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<ShareInvitation>("sp_Invitation_ListByNode", new { NodeId = nodeId }, commandType: Sp);
    }

    public async Task<bool> RevokeInvitationAsync(Guid invitationId, Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<int>("sp_Invitation_Revoke", new { InvitationId = invitationId, NodeId = nodeId }, commandType: Sp) > 0;
    }

    public async Task<ShareLinkInfo?> GetShareLinkAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<ShareLinkInfo>("sp_ShareLink_Get", new { NodeId = nodeId }, commandType: Sp);
    }

    public async Task<ShareLinkInfo> UpsertShareLinkAsync(Guid nodeId, string token, Guid createdBy, DateTime? expiresAt, bool regenerate)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<ShareLinkInfo>(
            "sp_ShareLink_Upsert",
            new { NodeId = nodeId, Token = token, CreatedBy = createdBy, ExpiresAt = expiresAt, Regenerate = regenerate },
            commandType: Sp);
    }

    public async Task DisableShareLinkAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync("sp_ShareLink_Disable", new { NodeId = nodeId }, commandType: Sp);
    }

    public async Task<string?> CheckAccessAsync(Guid nodeId, Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<string?>("sp_Permission_CheckAccess", new { NodeId = nodeId, UserId = userId }, commandType: Sp);
    }

    public async Task<int> RedeemInvitationsAsync(Guid userId, string email)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<int>("sp_User_RedeemInvitations", new { UserId = userId, Email = email }, commandType: Sp);
    }

    public async Task<PublicRoot?> ResolvePublicAsync(string token)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<PublicRoot>("sp_Public_Resolve", new { Token = token }, commandType: Sp);
    }

    public async Task<IEnumerable<PublicTreeNode>> GetPublicTreeAsync(string token)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<PublicTreeNode>("sp_Public_GetTree", new { Token = token }, commandType: Sp);
    }

    public async Task<PublicNodeContent?> GetPublicNodeAsync(string token, Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<PublicNodeContent>("sp_Public_GetNode", new { Token = token, NodeId = nodeId }, commandType: Sp);
    }

    public async Task<NodeFile?> GetPublicFileAsync(string token, Guid fileId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<NodeFile>("sp_Public_GetFile", new { Token = token, FileId = fileId }, commandType: Sp);
    }

    private sealed class GranteeRow
    {
        public Guid? UserId { get; init; }
    }
}
