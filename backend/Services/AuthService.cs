using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Auth;
using NotesApp.Api.Infrastructure.Data.Repositories;

namespace NotesApp.Api.Services;

/// <summary>The login request did not carry an explicit acceptance of the current Terms &amp; Privacy Policy version.</summary>
public sealed class TermsNotAcceptedException(string requiredVersion)
    : Exception("The current Terms and Conditions must be accepted to sign in.")
{
    public string RequiredVersion { get; } = requiredVersion;
}

/// <summary>The account is blocked by an administrator.</summary>
public sealed class AccountBlockedException() : Exception("This account has been blocked.");

public interface IAuthService
{
    Task<AuthResponse> LoginWithGoogleAsync(string code, string redirectUri, string? termsVersion);
    Task<AuthResponse> RefreshAsync(string refreshToken);
    Task LogoutAsync(string refreshToken);
}

public sealed class AuthService : IAuthService
{
    private readonly IGoogleOAuthService _googleOAuthService;
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IAdminRepository _adminRepository;
    private readonly IPermissionRepository _permissionRepository;
    private readonly IUserStatusService _userStatus;
    private readonly IConfiguration _configuration;

    public AuthService(
        IGoogleOAuthService googleOAuthService,
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IJwtTokenService jwtTokenService,
        IAdminRepository adminRepository,
        IPermissionRepository permissionRepository,
        IUserStatusService userStatus,
        IConfiguration configuration)
    {
        _googleOAuthService = googleOAuthService;
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _jwtTokenService = jwtTokenService;
        _adminRepository = adminRepository;
        _permissionRepository = permissionRepository;
        _userStatus = userStatus;
        _configuration = configuration;
    }

    public async Task<AuthResponse> LoginWithGoogleAsync(string code, string redirectUri, string? termsVersion)
    {
        // Checked first: without explicit acceptance of the current Terms nothing is exchanged or stored.
        var currentVersion = _configuration["Terms:Version"];
        if (string.IsNullOrEmpty(currentVersion) || !string.Equals(termsVersion, currentVersion, StringComparison.Ordinal))
        {
            throw new TermsNotAcceptedException(currentVersion ?? string.Empty);
        }

        var profile = await _googleOAuthService.ExchangeCodeAndGetProfileAsync(code, redirectUri);
        var user = await _userRepository.UpsertAsync(profile.GoogleId, profile.Email, profile.DisplayName, profile.AvatarUrl, termsVersion);

        // A blocked account is returned untouched by the upsert; refuse the login (no tokens are issued).
        if (!user.IsActive)
        {
            throw new AccountBlockedException();
        }

        // Root administrators come from configuration, and only when Google vouches for the e-mail address.
        if (profile.EmailVerified)
        {
            // People shared items by e-mail before they had an account: those invitations become real access now.
            await _permissionRepository.RedeemInvitationsAsync(user.Id, profile.Email);
        }

        if (profile.EmailVerified && !user.IsSuperAdmin && _userStatus.IsRootAdminEmail(profile.Email))
        {
            await _adminRepository.SetSuperAdminAsync(user.Id, true);
            _userStatus.Invalidate(user.Id);
            user = await _userRepository.GetByIdAsync(user.Id) ?? user;
        }

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken)
    {
        var hash = _jwtTokenService.HashToken(refreshToken);
        // The stored procedure only accepts tokens of active (non-blocked) users.
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

        var userDto = new UserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl, user.PreferredLanguage, user.IsSuperAdmin);
        return new AuthResponse(accessToken, refreshToken, userDto);
    }
}
