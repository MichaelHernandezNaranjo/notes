using NotesApp.Api.Domain.Entities;
using NotesApp.Api.Domain.Interfaces;

namespace NotesApp.Api.Services;

public interface IGroupService
{
    Task<Group> CreateAsync(Guid userId, string name, string? description);
    Task AddMemberAsync(Guid groupId, Guid userId, string role);
    Task RemoveMemberAsync(Guid groupId, Guid userId);
    Task<IEnumerable<GroupMember>> GetMembersAsync(Guid groupId);
    Task<IEnumerable<Group>> ListByUserAsync(Guid userId);
    Task DeleteAsync(Guid groupId);
}

public sealed class GroupService : IGroupService
{
    private readonly IGroupRepository _groupRepository;

    public GroupService(IGroupRepository groupRepository) => _groupRepository = groupRepository;

    public Task<Group> CreateAsync(Guid userId, string name, string? description) =>
        _groupRepository.CreateAsync(name, description, userId);

    public Task AddMemberAsync(Guid groupId, Guid userId, string role) =>
        _groupRepository.AddMemberAsync(groupId, userId, role);

    public Task RemoveMemberAsync(Guid groupId, Guid userId) =>
        _groupRepository.RemoveMemberAsync(groupId, userId);

    public Task<IEnumerable<GroupMember>> GetMembersAsync(Guid groupId) =>
        _groupRepository.GetMembersAsync(groupId);

    public Task<IEnumerable<Group>> ListByUserAsync(Guid userId) =>
        _groupRepository.ListByUserAsync(userId);

    public Task DeleteAsync(Guid groupId) =>
        _groupRepository.DeleteAsync(groupId);
}
