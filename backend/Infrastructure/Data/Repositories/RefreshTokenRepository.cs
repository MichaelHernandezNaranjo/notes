using System.Data;
using Dapper;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Infrastructure.Data.Repositories;

public sealed class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly DapperContext _context;

    public RefreshTokenRepository(DapperContext context) => _context = context;

    public async Task<RefreshToken> CreateAsync(Guid userId, string tokenHash, DateTime expiresAt)
    {
        using var conn = _context.CreateConnection();
        return await conn.QuerySingleAsync<RefreshToken>(
            "sp_RefreshToken_Create",
            new { UserId = userId, TokenHash = tokenHash, ExpiresAt = expiresAt },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<(RefreshToken Token, User User)?> ValidateAsync(string tokenHash)
    {
        using var conn = _context.CreateConnection();
        var result = await conn.QueryAsync<RefreshTokenRow>(
            "sp_RefreshToken_Validate",
            new { TokenHash = tokenHash },
            commandType: CommandType.StoredProcedure);

        var row = result.FirstOrDefault();
        if (row is null) return null;

        var token = new RefreshToken
        {
            Id = row.Id,
            UserId = row.UserId,
            TokenHash = row.TokenHash,
            ExpiresAt = row.ExpiresAt,
            RevokedAt = row.RevokedAt,
            CreatedAt = row.CreatedAt
        };
        var user = new User
        {
            Id = row.UserId,
            Email = row.Email,
            DisplayName = row.DisplayName,
            PreferredLanguage = row.PreferredLanguage
        };
        return (token, user);
    }

    public async Task RevokeAsync(string tokenHash)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_RefreshToken_Revoke",
            new { TokenHash = tokenHash },
            commandType: CommandType.StoredProcedure);
    }

    public async Task RevokeAllForUserAsync(Guid userId)
    {
        using var conn = _context.CreateConnection();
        await conn.ExecuteAsync(
            "sp_RefreshToken_RevokeAllForUser",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);
    }

    private sealed class RefreshTokenRow
    {
        public Guid Id { get; init; }
        public Guid UserId { get; init; }
        public string TokenHash { get; init; } = string.Empty;
        public DateTime ExpiresAt { get; init; }
        public DateTime? RevokedAt { get; init; }
        public DateTime CreatedAt { get; init; }
        public string Email { get; init; } = string.Empty;
        public string DisplayName { get; init; } = string.Empty;
        public string PreferredLanguage { get; init; } = "es";
    }
}
