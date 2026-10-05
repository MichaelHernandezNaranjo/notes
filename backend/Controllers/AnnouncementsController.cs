using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Infrastructure.Data.Repositories;

namespace NotesApp.Api.Controllers;

/// <summary>Announcements addressed to the signed-in user (everyone's, or just theirs).</summary>
[ApiController]
[Authorize]
[Route("api/announcements")]
public sealed class AnnouncementsController : ControllerBase
{
    private readonly IAdminRepository _admin;

    public AnnouncementsController(IAdminRepository admin) => _admin = admin;

    [HttpGet]
    public async Task<IActionResult> Pending() => Ok(await _admin.ListPendingAnnouncementsAsync(User.GetUserId()));

    [HttpPost("{id:guid}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id)
    {
        await _admin.DismissAnnouncementAsync(User.GetUserId(), id);
        return NoContent();
    }
}
