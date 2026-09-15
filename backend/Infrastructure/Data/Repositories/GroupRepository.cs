using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class GroupRepository : IGroupRepository
{
    private readonly DapperContext _context;

    public GroupRepository(DapperContext context) => _context = context;

    public async Task<Group> CreateAsync(string name, string? description, Guid createdBy)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<Group>(
            "sp_Group_Create",
            new { Name = name, Description = description, CreatedBy = createdBy },
            commandType: CommandType.StoredProcedure);
    }

    public async Task AddMemberAsync(Guid groupId, Guid userId, string role)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Group_AddMember",
            new { GroupId = groupId, UserId = userId, Role = role },
            commandType: CommandType.StoredProcedure);
    }

    public async Task RemoveMemberAsync(Guid groupId, Guid userId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Group_RemoveMember",
            new { GroupId = groupId, UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<GroupMember>> GetMembersAsync(Guid groupId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<GroupMember>(
            "sp_Group_GetMembers",
            new { GroupId = groupId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<Group>> ListByUserAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QueryAsync<Group>(
            "sp_Group_ListByUser",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task DeleteAsync(Guid groupId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_Group_Delete",
            new { GroupId = groupId },
            commandType: CommandType.StoredProcedure);
    }
}
