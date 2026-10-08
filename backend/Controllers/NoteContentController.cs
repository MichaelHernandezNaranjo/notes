using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/nodes/{id:guid}/content")]
public sealed class NoteContentController : ControllerBase
{
    private readonly INoteContentService _content;

    public NoteContentController(INoteContentService content) => _content = content;

    /// <summary>Stores the full Yjs state of a note (raw binary body). Over HTTP so a large note gets a normal error instead of a dropped WebSocket.</summary>
    [HttpPut]
    [Consumes("application/octet-stream")]
    public async Task<ActionResult<NoteSaveResult>> Save(Guid id)
    {
        // Allow the body up to the per-note limit (+1 byte, so exceeding it is detectable and answered with 413 note_too_large).
        var feature = HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = _content.MaxNoteBytes + 1;

        if (Request.ContentLength > _content.MaxNoteBytes) throw new NoteTooLargeException(_content.MaxNoteBytes);

        using var buffer = new MemoryStream(Request.ContentLength is > 0 and <= int.MaxValue ? (int)Request.ContentLength.Value : 0);
        try
        {
            await Request.Body.CopyToAsync(buffer, HttpContext.RequestAborted);
        }
        catch (Microsoft.AspNetCore.Server.Kestrel.Core.BadHttpRequestException)
        {
            throw new NoteTooLargeException(_content.MaxNoteBytes);
        }

        return Ok(await _content.SaveAsync(User.GetUserId(), id, buffer.ToArray()));
    }
}
