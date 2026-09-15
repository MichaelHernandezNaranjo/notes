using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/nodes/{nodeId:guid}/permissions")]
public sealed class PermissionsController : ControllerBase
{
    private readonly IPermissionService _permissionService;

    public PermissionsController(IPermissionService permissionService) => _permissionService = permissionService;

    [HttpGet]
    public async Task<IActionResult> List(Guid nodeId) => Ok(await _permissionService.ListByNodeAsync(nodeId));

    [HttpPost]
    public async Task<IActionResult> Grant(Guid nodeId, [FromBody] GrantPermissionRequest request) =>
        Ok(await _permissionService.GrantAsync(nodeId, request.GranteeType, request.GranteeId, request.AccessLevel, User.GetUserId(), request.ExpiresAt));

    [HttpPost("link")]
    public async Task<IActionResult> CreateShareLink(Guid nodeId, [FromBody] CreateShareLinkRequest request) =>
        Ok(await _permissionService.CreateShareLinkAsync(nodeId, request.AccessLevel, User.GetUserId(), request.ExpiresAt));

    [HttpDelete("{permissionId:guid}")]
    public async Task<IActionResult> Revoke(Guid nodeId, Guid permissionId)
    {
        await _permissionService.RevokeAsync(permissionId);
        return NoContent();
    }

    [HttpGet("~/api/share/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByToken(string token)
    {
        var permission = await _permissionService.GetByShareTokenAsync(token);
        return permission is null ? NotFound() : Ok(permission);
    }
}
