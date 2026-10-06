using System.Security.Cryptography;
using NotesApp.Api.Application.DTOs;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Infrastructure.Realtime;

namespace NotesApp.Api.Services;

/// <summary>A sharing request that is invalid (bad e-mail, past expiry...). Mapped to HTTP 400 with a machine code.</summary>
public sealed class SharingException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public interface IPermissionService
{
    Task<SharingDto> GetSharingAsync(Guid userId, Guid nodeId);
    Task<ShareResultDto> ShareWithEmailAsync(Guid userId, Guid nodeId, ShareWithEmailRequest request);
    Task UpdateAsync(Guid userId, Guid nodeId, Guid permissionId, UpdatePermissionRequest request);
    Task RevokeAsync(Guid userId, Guid nodeId, Guid permissionId);
    Task RevokeInvitationAsync(Guid userId, Guid nodeId, Guid invitationId);
    Task<ShareLinkDto> EnableLinkAsync(Guid userId, Guid nodeId, ShareLinkRequest request);
    Task DisableLinkAsync(Guid userId, Guid nodeId);
}

/// <summary>Managing who can see a note or folder is reserved to its owner (or the owner of a parent folder).</summary>
public sealed class PermissionService : IPermissionService
{
    private readonly IPermissionRepository _permissions;
    private readonly IAuditRepository _audit;
    private readonly INoteAccessEnforcer _enforcer;

    public PermissionService(IPermissionRepository permissions, IAuditRepository audit, INoteAccessEnforcer enforcer)
    {
        _permissions = permissions;
        _audit = audit;
        _enforcer = enforcer;
    }

    public async Task<SharingDto> GetSharingAsync(Guid userId, Guid nodeId)
    {
        await EnsureOwnerAsync(userId, nodeId);
        var people = (await _permissions.ListByNodeAsync(nodeId)).Select(p => new NodePermissionDto(
            p.Id, p.GranteeType, p.AccessLevel, p.CreatedAt, p.ExpiresAt,
            p.UserDisplayName ?? p.GroupName, p.UserEmail, p.UserAvatarUrl, p.Inherited, p.SourceNodeId, p.SourceNodeName));
        var invitations = (await _permissions.ListInvitationsAsync(nodeId))
            .Select(i => new ShareInvitationDto(i.Id, i.Email, i.AccessLevel, i.CreatedAt, i.ExpiresAt));
        var link = await _permissions.GetShareLinkAsync(nodeId);
        return new SharingDto(people, invitations, link is null ? null : ToDto(link));
    }

    public async Task<ShareResultDto> ShareWithEmailAsync(Guid userId, Guid nodeId, ShareWithEmailRequest request)
    {
        await EnsureOwnerAsync(userId, nodeId);
        ValidateExpiry(request.ExpiresAt);
        var result = await _permissions.ShareWithEmailAsync(nodeId, request.Email, request.AccessLevel, userId, request.ExpiresAt);
        await _audit.InsertAsync(userId, nodeId, "NodeShared", $"{{\"email\":\"{Escape(result.Email)}\",\"level\":\"{request.AccessLevel}\",\"kind\":\"{result.Kind}\"}}");
        await _enforcer.RecheckAsync();
        return new ShareResultDto(result.Kind, result.Id, result.Email);
    }

    public async Task UpdateAsync(Guid userId, Guid nodeId, Guid permissionId, UpdatePermissionRequest request)
    {
        await EnsureOwnerAsync(userId, nodeId);
        ValidateExpiry(request.ExpiresAt);
        var affected = await _permissions.UpdateAsync(permissionId, nodeId, request.AccessLevel, request.ExpiresAt, userId)
            ?? throw new KeyNotFoundException("Permission not found.");
        await _audit.InsertAsync(userId, nodeId, "NodePermissionChanged", $"{{\"user\":\"{affected}\",\"level\":\"{request.AccessLevel}\"}}");
        await _enforcer.RecheckAsync();
    }

    public async Task RevokeAsync(Guid userId, Guid nodeId, Guid permissionId)
    {
        await EnsureOwnerAsync(userId, nodeId);
        var (found, grantee) = await _permissions.RevokeAsync(permissionId, nodeId);
        if (!found) throw new KeyNotFoundException("Permission not found.");
        await _audit.InsertAsync(userId, nodeId, "NodeShareRevoked", $"{{\"user\":\"{grantee}\"}}");
        await _enforcer.RecheckAsync();
    }

    public async Task RevokeInvitationAsync(Guid userId, Guid nodeId, Guid invitationId)
    {
        await EnsureOwnerAsync(userId, nodeId);
        if (!await _permissions.RevokeInvitationAsync(invitationId, nodeId)) throw new KeyNotFoundException("Invitation not found.");
        await _audit.InsertAsync(userId, nodeId, "NodeInvitationRevoked", null);
    }

    public async Task<ShareLinkDto> EnableLinkAsync(Guid userId, Guid nodeId, ShareLinkRequest request)
    {
        await EnsureOwnerAsync(userId, nodeId);
        ValidateExpiry(request.ExpiresAt);
        var existed = await _permissions.GetShareLinkAsync(nodeId) is not null;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace("+", "-").Replace("/", "_").Replace("=", "");
        var link = await _permissions.UpsertShareLinkAsync(nodeId, token, userId, request.ExpiresAt, request.Regenerate);
        await _audit.InsertAsync(userId, nodeId, !existed ? "NodeLinkCreated" : request.Regenerate ? "NodeLinkRegenerated" : "NodeLinkUpdated", null);
        return ToDto(link);
    }

    public async Task DisableLinkAsync(Guid userId, Guid nodeId)
    {
        await EnsureOwnerAsync(userId, nodeId);
        await _permissions.DisableShareLinkAsync(nodeId);
        await _audit.InsertAsync(userId, nodeId, "NodeLinkDisabled", null);
    }

    private async Task EnsureOwnerAsync(Guid userId, Guid nodeId)
    {
        var access = await _permissions.CheckAccessAsync(nodeId, userId);
        if (access is null) throw new KeyNotFoundException("Node not found.");
        if (access != "Owner") throw new UnauthorizedAccessException("Only the owner can manage who has access.");
    }

    private static void ValidateExpiry(DateTime? expiresAt)
    {
        if (expiresAt is not null && expiresAt.Value.ToUniversalTime() <= DateTime.UtcNow)
            throw new SharingException("invalid_expiry", "The expiry date must be in the future.");
    }

    private static string Escape(string value) => value.Replace("\\", "\\\\").Replace("\"", "\\\"");

    private static ShareLinkDto ToDto(Domain.Entities.ShareLinkInfo l) => new(l.ShareToken, l.CreatedAt, l.ExpiresAt, l.ViewCount);
}
