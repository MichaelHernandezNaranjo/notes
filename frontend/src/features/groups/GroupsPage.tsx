import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { groupsApi, type GroupDto, type GroupMemberDto } from '../../services/groupsApi';

export function GroupsPage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  const refreshGroups = useCallback(async () => {
    const list = await groupsApi.list();
    setGroups(list);
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      groupsApi.getMembers(selectedGroupId).then(setMembers);
    } else {
      setMembers([]);
    }
  }, [selectedGroupId]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await groupsApi.create(newGroupName.trim(), null);
    setNewGroupName('');
    await refreshGroups();
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border-subtle p-4">
        <h2 className="mb-3 text-lg font-medium text-white">{t('groups.title')}</h2>
        <div className="mb-3 flex gap-2">
          <input
            className="flex-1 rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-sm"
            placeholder={t('groups.createGroup')}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-accent-emerald px-3 py-1 text-sm text-white hover:bg-accent-emerald-dark"
            onClick={handleCreateGroup}
          >
            +
          </button>
        </div>
        <div className="space-y-1">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-white/5 ${
                selectedGroupId === group.id ? 'bg-accent-blue/10 text-accent-blue' : ''
              }`}
              onClick={() => setSelectedGroupId(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6">
        {selectedGroupId ? (
          <>
            <h3 className="mb-4 text-base font-medium text-white">{t('groups.members')}</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded border border-border-subtle px-3 py-2 text-sm"
                >
                  <span>{member.displayName} · {member.email}</span>
                  <span className="text-xs text-neutral-400">{member.role}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">Selecciona un grupo</p>
        )}
      </div>
    </div>
  );
}
