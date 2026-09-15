import type { PresenceUser } from './YjsSignalRProvider';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

function colorFor(seed: string): string {
  const index = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
  return COLORS[index];
}

/** Renders live avatars of the users currently viewing/editing the active note. */
export function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {users.slice(0, 5).map((user) => (
        <div
          key={user.connectionId}
          title={user.name}
          style={{ backgroundColor: colorFor(user.connectionId) }}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg-elevated text-xs font-semibold text-white"
        >
          {user.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
      ))}
      {users.length > 5 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg-elevated bg-neutral-700 text-xs text-white">
          +{users.length - 5}
        </div>
      )}
    </div>
  );
}
