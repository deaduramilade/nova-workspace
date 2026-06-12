import { PresenceStatus, PresenceUser } from './presenceTypes';

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Never seen';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function presenceStatusLabel(user: PresenceUser): string {
  if (!user.is_online) return 'Offline';
  if (user.status_message) return user.status_message;
  return user.status.replace('_', ' ');
}

export function presenceDotClass(status: PresenceStatus, isOnline: boolean): string {
  if (!isOnline || status === 'offline') return 'presence-dot-offline';
  if (status === 'online') return 'presence-dot-online';
  if (status === 'in_call') return 'presence-dot-in-call';
  if (status === 'busy') return 'presence-dot-busy';
  if (status === 'away') return 'presence-dot-away';
  return 'presence-dot-offline';
}

export function canCallUser(user: PresenceUser): boolean {
  return user.is_online && user.status !== 'in_call' && user.status !== 'busy';
}

export function splitPresenceDirectory(users: PresenceUser[], excludeUsername?: string) {
  const filtered = excludeUsername
    ? users.filter((u) => u.username !== excludeUsername)
    : users;
  return {
    online: filtered.filter((u) => u.is_online),
    offline: filtered.filter((u) => !u.is_online),
    all: filtered,
  };
}

export function mergePresenceSnapshot(current: PresenceUser[], incoming: PresenceUser[]): PresenceUser[] {
  const map = new Map(current.map((u) => [u.username, { ...u, status_message: u.status_message ?? '' }]));
  for (const user of incoming) {
    map.set(user.username, { ...user, status_message: user.status_message ?? '' });
  }
  return Array.from(map.values()).sort(
    (a, b) => Number(b.is_online) - Number(a.is_online) || a.display_name.localeCompare(b.display_name)
  );
}

export function applyUserOffline(users: PresenceUser[], username: string, lastSeen?: string | null): PresenceUser[] {
  return users.map((u) =>
    u.username === username
      ? { ...u, is_online: false, status: 'offline', last_seen: lastSeen ?? u.last_seen }
      : u
  );
}

export function applyUserOnline(users: PresenceUser[], username: string): PresenceUser[] {
  return users.map((u) =>
    u.username === username
      ? { ...u, is_online: true, status: u.status === 'offline' ? 'online' : u.status, last_seen: null }
      : u
  );
}