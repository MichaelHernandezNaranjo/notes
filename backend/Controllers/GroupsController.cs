using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/groups")]
public sealed class GroupsController : ControllerBase
{
    private readonly IGroupService _groupService;

    public GroupsController(IGroupService groupService) => _groupService = groupService;

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await _groupService.ListByUserAsync(User.GetUserId()));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGroupRequest request) =>
        Ok(await _groupService.CreateAsync(User.GetUserId(), request.Name, request.Description));

    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id) => Ok(await _groupService.GetMembersAsync(User.GetUserId(), id));

    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddGroupMemberRequest request)
    {
        await _groupService.AddMemberAsync(User.GetUserId(), id, request.UserId, request.Role);
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        await _groupService.RemoveMemberAsync(User.GetUserId(), id, userId);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _groupService.DeleteAsync(User.GetUserId(), id);
        return NoContent();
    }
}
