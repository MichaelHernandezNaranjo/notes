using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

/// <summary>Sharing management. Every action is reserved to the owner of the node (checked in <see cref="PermissionService"/>).</summary>
[ApiController]
[Authorize]
[Route("api/nodes/{nodeId:guid}/sharing")]
public sealed class PermissionsController : ControllerBase
{
    private readonly IPermissionService _service;

    public PermissionsController(IPermissionService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<SharingDto>> Get(Guid nodeId) => Ok(await _service.GetSharingAsync(User.GetUserId(), nodeId));

    [HttpPost("people")]
    public async Task<ActionResult<ShareResultDto>> Share(Guid nodeId, [FromBody] ShareWithEmailRequest request) =>
        Ok(await _service.ShareWithEmailAsync(User.GetUserId(), nodeId, request));

    [HttpPut("people/{permissionId:guid}")]
    public async Task<IActionResult> Update(Guid nodeId, Guid permissionId, [FromBody] UpdatePermissionRequest request)
    {
        await _service.UpdateAsync(User.GetUserId(), nodeId, permissionId, request);
        return NoContent();
    }

    [HttpDelete("people/{permissionId:guid}")]
    public async Task<IActionResult> Revoke(Guid nodeId, Guid permissionId)
    {
        await _service.RevokeAsync(User.GetUserId(), nodeId, permissionId);
        return NoContent();
    }

    [HttpDelete("invitations/{invitationId:guid}")]
    public async Task<IActionResult> RevokeInvitation(Guid nodeId, Guid invitationId)
    {
        await _service.RevokeInvitationAsync(User.GetUserId(), nodeId, invitationId);
        return NoContent();
    }

    [HttpPut("link")]
    public async Task<ActionResult<ShareLinkDto>> EnableLink(Guid nodeId, [FromBody] ShareLinkRequest request) =>
        Ok(await _service.EnableLinkAsync(User.GetUserId(), nodeId, request));

    [HttpDelete("link")]
    public async Task<IActionResult> DisableLink(Guid nodeId)
    {
        await _service.DisableLinkAsync(User.GetUserId(), nodeId);
        return NoContent();
    }
}
