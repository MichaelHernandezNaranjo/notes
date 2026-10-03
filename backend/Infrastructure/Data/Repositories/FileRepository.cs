using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class FileRepository : IFileRepository
{
    private readonly DapperContext _context;

    public FileRepository(DapperContext context) => _context = context;

    public async Task<NodeFile> CreateAsync(Guid nodeId, string storedName, string originalName, string contentType, long sizeBytes, Guid createdBy)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<NodeFile>(
            "sp_File_Create",
            new { NodeId = nodeId, StoredName = storedName, OriginalName = originalName, ContentType = contentType, SizeBytes = sizeBytes, CreatedBy = createdBy },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<NodeFile?> GetByIdAsync(Guid fileId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<NodeFile>(
            "sp_File_GetById",
            new { FileId = fileId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<NodeFile>> ListByNodeTreeAsync(Guid nodeId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<NodeFile>(
            "sp_File_ListByNodeTree",
            new { NodeId = nodeId },
            commandType: CommandType.StoredProcedure);
    }
}
