using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

public sealed record FileUploadResult(Guid Id, string Url, string ContentType, long Size);

public sealed class FileValidationException(string message) : Exception(message);

public interface IFileService
{
    Task<FileUploadResult> UploadAsync(Guid userId, Guid nodeId, Stream content, long length, string originalName);
    Task<(NodeFile File, Stream Content)?> OpenReadAsync(Guid userId, Guid fileId);
    Task<(NodeFile File, Stream Content)?> OpenPublicAsync(string token, Guid fileId);
    Task<IReadOnlyList<NodeFile>> ListTreeAsync(Guid nodeId);
    void DeleteFromDisk(IEnumerable<NodeFile> files);
}

/// <summary>Stores note images on disk (Docker volume) and their metadata via stored procedures.</summary>
public sealed class FileService : IFileService
{
    public const long MaxBytes = 10 * 1024 * 1024; // 10 MB

    private readonly IFileRepository _files;
    private readonly INodeRepository _nodes;
    private readonly IPermissionRepository _permissions;
    private readonly string _root;

    public FileService(IFileRepository files, INodeRepository nodes, IPermissionRepository permissions, IConfiguration configuration, IWebHostEnvironment env)
    {
        _files = files;
        _nodes = nodes;
        _permissions = permissions;
        _root = Path.GetFullPath(configuration["Files:RootPath"] ?? Path.Combine(env.ContentRootPath, "App_Data", "files"));
    }

    public async Task<FileUploadResult> UploadAsync(Guid userId, Guid nodeId, Stream content, long length, string originalName)
    {
        var access = await _permissions.CheckAccessAsync(nodeId, userId);
        if (access is null || access == "Read")
            throw new UnauthorizedAccessException("You do not have edit access to this note.");

        var node = await _nodes.GetByIdAsync(nodeId);
        if (node is null || node.IsDeleted)
            throw new UnauthorizedAccessException("This note is in the trash and cannot be modified.");

        if (length <= 0) throw new FileValidationException("The file is empty.");
        if (length > MaxBytes) throw new FileValidationException("The file exceeds the 10 MB limit.");

        // Read into memory (bounded by MaxBytes) so the real signature can be validated before anything touches disk.
        using var buffer = new MemoryStream((int)Math.Min(length, MaxBytes));
        await content.CopyToAsync(buffer);
        if (buffer.Length > MaxBytes) throw new FileValidationException("The file exceeds the 10 MB limit.");

        var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);
        var (contentType, extension) = Sniff(bytes)
            ?? throw new FileValidationException("Unsupported image type. Allowed: PNG, JPEG, GIF, WebP.");

        var storedName = $"{Guid.NewGuid():N}{extension}";
        var directory = Path.Combine(_root, nodeId.ToString("N"));
        Directory.CreateDirectory(directory);
        var fullPath = Path.Combine(directory, storedName);
        await File.WriteAllBytesAsync(fullPath, buffer.ToArray());

        try
        {
            var safeName = Path.GetFileName(originalName);
            if (safeName.Length > 260) safeName = safeName[..260];
            var meta = await _files.CreateAsync(nodeId, storedName, safeName, contentType, buffer.Length, userId);
            return new FileUploadResult(meta.Id, $"/api/files/{meta.Id}", contentType, buffer.Length);
        }
        catch
        {
            File.Delete(fullPath); // do not leave orphans if the metadata insert fails
            throw;
        }
    }

    public async Task<(NodeFile File, Stream Content)?> OpenPublicAsync(string token, Guid fileId)
    {
        var file = await _permissions.GetPublicFileAsync(token, fileId);
        return file is null ? null : Open(file);
    }

    private (NodeFile File, Stream Content)? Open(NodeFile file)
    {
        var path = Path.Combine(_root, file.NodeId.ToString("N"), file.StoredName);
        if (!File.Exists(path)) return null;

        return (file, new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, useAsync: true));
    }

    public async Task<(NodeFile File, Stream Content)?> OpenReadAsync(Guid userId, Guid fileId)
    {
        var file = await _files.GetByIdAsync(fileId);
        if (file is null) return null;

        var access = await _permissions.CheckAccessAsync(file.NodeId, userId);
        if (access is null) throw new UnauthorizedAccessException("You do not have access to this file.");

        return Open(file);
    }

    public async Task<IReadOnlyList<NodeFile>> ListTreeAsync(Guid nodeId) =>
        (await _files.ListByNodeTreeAsync(nodeId)).ToList();

    public void DeleteFromDisk(IEnumerable<NodeFile> files)
    {
        foreach (var file in files)
        {
            try
            {
                File.Delete(Path.Combine(_root, file.NodeId.ToString("N"), file.StoredName));
            }
            catch (IOException)
            {
                // Best effort: the DB rows are already gone; a leftover file is harmless.
            }
        }
    }

    /// <summary>Detects PNG/JPEG/GIF/WebP from magic bytes. SVG and everything else is rejected.</summary>
    private static (string ContentType, string Extension)? Sniff(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A)
            return ("image/png", ".png");
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
            return ("image/jpeg", ".jpg");
        if (b.Length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8' && (b[4] == '7' || b[4] == '9') && b[5] == 'a')
            return ("image/gif", ".gif");
        if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P')
            return ("image/webp", ".webp");
        return null;
    }
}
