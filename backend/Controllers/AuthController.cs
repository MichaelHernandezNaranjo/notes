using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) => _authService = authService;

    /// <summary>
    /// Receives the Google OAuth 2.0 authorization code obtained by the
    /// frontend redirect, exchanges it server-side (client secret never
    /// exposed to the browser) and returns our own JWT access/refresh pair.
    /// </summary>
    [HttpPost("google/callback")]
    public async Task<ActionResult<AuthResponse>> GoogleCallback([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginWithGoogleAsync(request.Code, request.RedirectUri, request.TermsVersion);
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest request)
    {
        var result = await _authService.RefreshAsync(request.RefreshToken);
        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request)
    {
        await _authService.LogoutAsync(request.RefreshToken);
        return NoContent();
    }
}
