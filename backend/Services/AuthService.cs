using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Auth;

namespace NotesApp.Api.Services;

public interface IAuthService
{
    Task<AuthResponse> LoginWithGoogleAsync(string code, string redirectUri);
    Task<AuthResponse> RefreshAsync(string refreshToken);
    Task LogoutAsync(string refreshToken);
}

public sealed class AuthService : IAuthService
{
    private readonly IGoogleOAuthService _googleOAuthService;
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IConfiguration _configuration;

    public AuthService(
        IGoogleOAuthService googleOAuthService,
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IJwtTokenService jwtTokenService,
        IConfiguration configuration)
    {
        _googleOAuthService = googleOAuthService;
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _jwtTokenService = jwtTokenService;
        _configuration = configuration;
    }

    public async Task<AuthResponse> LoginWithGoogleAsync(string code, string redirectUri)
    {
        var profile = await _googleOAuthService.ExchangeCodeAndGetProfileAsync(code, redirectUri);
        var user = await _userRepository.UpsertAsync(profile.GoogleId, profile.Email, profile.DisplayName, profile.AvatarUrl);
        return await IssueTokensAsync(user);
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken)
    {
        var hash = _jwtTokenService.HashToken(refreshToken);
        var result = await _refreshTokenRepository.ValidateAsync(hash)
            ?? throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        await _refreshTokenRepository.RevokeAsync(hash);
        return await IssueTokensAsync(result.User);
    }

    public async Task LogoutAsync(string refreshToken)
    {
        var hash = _jwtTokenService.HashToken(refreshToken);
        await _refreshTokenRepository.RevokeAsync(hash);
    }

    private async Task<AuthResponse> IssueTokensAsync(User user)
    {
        var accessToken = _jwtTokenService.CreateAccessToken(user);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();
        var refreshHash = _jwtTokenService.HashToken(refreshToken);
        var refreshDays = double.Parse(_configuration["Jwt:RefreshTokenDays"] ?? "30");

        await _refreshTokenRepository.CreateAsync(user.Id, refreshHash, DateTime.UtcNow.AddDays(refreshDays));

        var userDto = new UserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl, user.PreferredLanguage);
        return new AuthResponse(accessToken, refreshToken, userDto);
    }
}
