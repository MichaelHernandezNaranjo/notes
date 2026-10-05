using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Data.Repositories;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly IAdminRepository _admin;

    public UsersController(IUserRepository userRepository, IAdminRepository admin)
    {
        _userRepository = userRepository;
        _admin = admin;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await _userRepository.GetByIdAsync(User.GetUserId());
        return user is null
            ? NotFound()
            : Ok(new UserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl, user.PreferredLanguage, user.IsSuperAdmin));
    }

    /// <summary>Storage used by the current user and the limit that applies to them (null = unlimited).</summary>
    [HttpGet("me/storage")]
    public async Task<IActionResult> GetMyStorage() => Ok(await _admin.GetUsageAsync(User.GetUserId()));

    [HttpPut("me/language")]
    public async Task<IActionResult> UpdateLanguage([FromBody] UpdateLanguageRequest request)
    {
        await _userRepository.UpdatePreferredLanguageAsync(User.GetUserId(), request.Language);
        return NoContent();
    }
}
