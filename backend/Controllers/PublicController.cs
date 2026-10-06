using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

/// <summary>
/// Anonymous, read-only access through a public share link. Nothing here accepts or returns user identities; every call re-validates
/// the token (exists, not expired, nothing trashed) and the requested node/file must lie inside the shared subtree.
/// Invalid tokens and out-of-scope ids all answer the same 404.
/// </summary>
[ApiController]
[AllowAnonymous]
[EnableRateLimiting("public")]
[Route("api/public/{token}")]
public sealed partial class PublicController : ControllerBase
{
    private readonly IPermissionRepository _permissions;
    private readonly IFileService _files;

    public PublicController(IPermissionRepository permissions, IFileService files)
    {
        _permissions = permissions;
        _files = files;
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{20,64}$")]
    private static partial Regex TokenFormat();

    private void ApplyHeaders()
    {
        Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        Response.Headers["Cache-Control"] = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
    }

    [HttpGet]
    public async Task<ActionResult<PublicShareDto>> Get(string token)
    {
        ApplyHeaders();
        if (!TokenFormat().IsMatch(token)) return NotFound();
        var root = await _permissions.ResolvePublicAsync(token);
        if (root is null) return NotFound();
        var tree = (await _permissions.GetPublicTreeAsync(token)).Select(n => new PublicTreeNodeDto(n.Id, n.ParentId, n.Type, n.Name));
        return Ok(new PublicShareDto(root.NodeId, root.NodeName, root.NodeType, root.ExpiresAt, tree));
    }

    [HttpGet("nodes/{nodeId:guid}")]
    public async Task<ActionResult<PublicNodeDto>> GetNode(string token, Guid nodeId)
    {
        ApplyHeaders();
        if (!TokenFormat().IsMatch(token)) return NotFound();
        var node = await _permissions.GetPublicNodeAsync(token, nodeId);
        return node is null ? NotFound() : Ok(new PublicNodeDto(node.Id, node.Type, node.Name, node.ContentYjsState));
    }

    [HttpGet("files/{fileId:guid}")]
    public async Task<IActionResult> GetFile(string token, Guid fileId)
    {
        if (!TokenFormat().IsMatch(token)) return NotFound();
        var opened = await _files.OpenPublicAsync(token, fileId);
        if (opened is null) return NotFound();

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        // Short-lived: once the link is revoked the images stop being served within a minute.
        Response.Headers["Cache-Control"] = "private, max-age=60";
        return File(opened.Value.Content, opened.Value.File.ContentType);
    }
}
