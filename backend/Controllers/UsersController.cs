using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepository;

    public UsersController(IUserRepository userRepository) => _userRepository = userRepository;

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await _userRepository.GetByIdAsync(User.GetUserId());
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPut("me/language")]
    public async Task<IActionResult> UpdateLanguage([FromBody] UpdateLanguageRequest request)
    {
        await _userRepository.UpdatePreferredLanguageAsync(User.GetUserId(), request.Language);
        return NoContent();
    }
}
