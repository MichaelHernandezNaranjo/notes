using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
public sealed class FilesController : ControllerBase
{
    private readonly IFileService _fileService;

    public FilesController(IFileService fileService) => _fileService = fileService;

    /// <summary>Uploads an image (PNG/JPEG/GIF/WebP, max 10 MB) that belongs to a note.</summary>
    [HttpPost("api/nodes/{nodeId:guid}/files")]
    [RequestSizeLimit(FileService.MaxBytes + 1024 * 1024)] // multipart overhead
    public async Task<IActionResult> Upload(Guid nodeId, IFormFile file)
    {
        try
        {
            await using var stream = file.OpenReadStream();
            var result = await _fileService.UploadAsync(User.GetUserId(), nodeId, stream, file.Length, file.FileName);
            return Ok(result);
        }
        catch (FileValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("api/files/{fileId:guid}")]
    public async Task<IActionResult> Download(Guid fileId)
    {
        var opened = await _fileService.OpenReadAsync(User.GetUserId(), fileId);
        if (opened is null) return NotFound();

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        // Revalidated on every use so a revoked share stops serving images immediately (no 24 h browser cache).
        Response.Headers["Cache-Control"] = "private, no-cache";
        return File(opened.Value.Content, opened.Value.File.ContentType);
    }
}
