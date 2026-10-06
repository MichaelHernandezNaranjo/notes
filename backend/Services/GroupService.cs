using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

public interface IGroupService
{
    Task<Group> CreateAsync(Guid userId, string name, string? description);
    Task AddMemberAsync(Guid userId, Guid groupId, Guid memberId, string role);
    Task RemoveMemberAsync(Guid userId, Guid groupId, Guid memberId);
    Task<IEnumerable<GroupMember>> GetMembersAsync(Guid userId, Guid groupId);
    Task<IEnumerable<Group>> ListByUserAsync(Guid userId);
    Task DeleteAsync(Guid userId, Guid groupId);
}

/// <summary>Group membership is managed only by the group's owners/admins; members can see who else is in the group.</summary>
public sealed class GroupService : IGroupService
{
    private readonly IGroupRepository _groupRepository;

    public GroupService(IGroupRepository groupRepository) => _groupRepository = groupRepository;

    public Task<Group> CreateAsync(Guid userId, string name, string? description) =>
        _groupRepository.CreateAsync(name, description, userId);

    public async Task AddMemberAsync(Guid userId, Guid groupId, Guid memberId, string role)
    {
        await RequireRoleAsync(userId, groupId, admin: true);
        // Ownership is never handed out through this endpoint.
        if (role is not ("Member" or "Admin")) throw new SharingException("invalid_role", "Role must be Member or Admin.");
        await _groupRepository.AddMemberAsync(groupId, memberId, role);
    }

    public async Task RemoveMemberAsync(Guid userId, Guid groupId, Guid memberId)
    {
        // Anyone may leave a group; removing others needs owner/admin.
        if (userId != memberId) await RequireRoleAsync(userId, groupId, admin: true);
        else await RequireRoleAsync(userId, groupId, admin: false);
        await _groupRepository.RemoveMemberAsync(groupId, memberId);
    }

    public async Task<IEnumerable<GroupMember>> GetMembersAsync(Guid userId, Guid groupId)
    {
        var members = (await _groupRepository.GetMembersAsync(groupId)).ToList();
        if (members.All(m => m.UserId != userId)) throw new UnauthorizedAccessException("You are not a member of this group.");
        return members;
    }

    public Task<IEnumerable<Group>> ListByUserAsync(Guid userId) =>
        _groupRepository.ListByUserAsync(userId);

    public async Task DeleteAsync(Guid userId, Guid groupId)
    {
        var members = await _groupRepository.GetMembersAsync(groupId);
        if (!members.Any(m => m.UserId == userId && m.Role == "Owner"))
            throw new UnauthorizedAccessException("Only the group owner can delete it.");
        await _groupRepository.DeleteAsync(groupId);
    }

    private async Task RequireRoleAsync(Guid userId, Guid groupId, bool admin)
    {
        var me = (await _groupRepository.GetMembersAsync(groupId)).FirstOrDefault(m => m.UserId == userId);
        if (me is null || (admin && me.Role is not ("Owner" or "Admin")))
            throw new UnauthorizedAccessException("You do not have permission to manage this group.");
    }
}
