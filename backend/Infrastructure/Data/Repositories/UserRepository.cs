using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly DapperContext _context;

    public UserRepository(DapperContext context) => _context = context;

    public async Task<User?> GetByGoogleIdAsync(string googleId)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<User>(
            "sp_User_GetByGoogleId",
            new { GoogleId = googleId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<User?> GetByIdAsync(Guid id)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<User>(
            "sp_User_GetById",
            new { Id = id },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<User> UpsertAsync(string googleId, string email, string displayName, string? avatarUrl)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<User>(
            "sp_User_Upsert",
            new { GoogleId = googleId, Email = email, DisplayName = displayName, AvatarUrl = avatarUrl },
            commandType: CommandType.StoredProcedure);
    }

    public async Task UpdatePreferredLanguageAsync(Guid userId, string language)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_User_UpdatePreferredLanguage",
            new { UserId = userId, Language = language },
            commandType: CommandType.StoredProcedure);
    }
}
