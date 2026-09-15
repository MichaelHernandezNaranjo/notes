using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class AuditRepository : IAuditRepository
{
    private readonly DapperContext _context;

    public AuditRepository(DapperContext context) => _context = context;

    public async Task InsertAsync(Guid userId, Guid? nodeId, string action, string? metadataJson)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Audit_Insert",
            new { UserId = userId, NodeId = nodeId, Action = action, MetadataJson = metadataJson },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<AuditLogEntry>> GetByNodeAsync(Guid nodeId, int top)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<AuditLogEntry>(
            "sp_Audit_GetByNode",
            new { NodeId = nodeId, Top = top },
            commandType: CommandType.StoredProcedure);
    }
}
