using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/nodes")]
public sealed class NodesController : ControllerBase
{
    private readonly INodeService _nodeService;

    public NodesController(INodeService nodeService) => _nodeService = nodeService;

    [HttpGet("tree")]
    public async Task<ActionResult<IEnumerable<NodeDto>>> GetTree() =>
        Ok(await _nodeService.GetTreeAsync(User.GetUserId()));

    [HttpGet("children")]
    public async Task<ActionResult<IEnumerable<NodeDto>>> GetChildren([FromQuery] Guid? parentId) =>
        Ok(await _nodeService.GetChildrenAsync(User.GetUserId(), parentId));

    [HttpGet("recent")]
    public async Task<ActionResult<IEnumerable<NodeDto>>> GetRecent([FromQuery] int top = 10) =>
        Ok(await _nodeService.GetRecentAsync(User.GetUserId(), top));

    [HttpGet("favorites")]
    public async Task<ActionResult<IEnumerable<NodeDto>>> GetFavorites() =>
        Ok(await _nodeService.GetFavoritesAsync(User.GetUserId()));

    [HttpGet("trash")]
    public async Task<ActionResult<IEnumerable<NodeDto>>> GetTrash() =>
        Ok(await _nodeService.GetTrashAsync(User.GetUserId()));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NodeDto>> GetById(Guid id)
    {
        var node = await _nodeService.GetByIdAsync(User.GetUserId(), id);
        return node is null ? NotFound() : Ok(node);
    }

    [HttpPost]
    public async Task<ActionResult<NodeDto>> Create([FromBody] CreateNodeRequest request) =>
        Ok(await _nodeService.CreateAsync(User.GetUserId(), request));

    [HttpPut("{id:guid}/rename")]
    public async Task<ActionResult<NodeDto>> Rename(Guid id, [FromBody] RenameNodeRequest request)
    {
        var node = await _nodeService.RenameAsync(User.GetUserId(), id, request.Name);
        return node is null ? NotFound() : Ok(node);
    }

    [HttpPut("{id:guid}/move")]
    public async Task<ActionResult<NodeDto>> Move(Guid id, [FromBody] MoveNodeRequest request)
    {
        var node = await _nodeService.MoveAsync(User.GetUserId(), id, request.NewParentId, request.NewSortOrder);
        return node is null ? NotFound() : Ok(node);
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<NodeDto>> Duplicate(Guid id)
    {
        var node = await _nodeService.DuplicateAsync(User.GetUserId(), id);
        return node is null ? NotFound() : Ok(node);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SoftDelete(Guid id)
    {
        await _nodeService.SoftDeleteAsync(User.GetUserId(), id);
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        await _nodeService.RestoreAsync(User.GetUserId(), id);
        return NoContent();
    }

    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> HardDelete(Guid id)
    {
        await _nodeService.HardDeleteAsync(User.GetUserId(), id);
        return NoContent();
    }

    [HttpPost("{id:guid}/favorite")]
    public async Task<ActionResult<bool>> ToggleFavorite(Guid id) =>
        Ok(await _nodeService.ToggleFavoriteAsync(User.GetUserId(), id));
}
