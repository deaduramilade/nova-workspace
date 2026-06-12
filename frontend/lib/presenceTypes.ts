export type PresenceStatus = 'online' | 'offline' | 'busy' | 'in_call' | 'away';
export type SettablePresenceStatus = 'online' | 'busy' | 'away';

export interface PresenceUser {
  username: string;
  display_name: string;
  status: PresenceStatus;
  status_message: string;
  is_online: boolean;
  last_seen: string | null;
  connected_at?: string | null;
  last_activity?: string | null;
}

export interface PresenceStats {
  total: number;
  online: number;
  offline: number;
  busy: number;
  in_call: number;
  away: number;
}

export const DIRECTORY_USERS: PresenceUser[] = [
  { username: 'johndoe', display_name: 'John Doe', status: 'offline', status_message: '', is_online: false, last_seen: null },
  { username: 'alicesmith', display_name: 'Alice Smith', status: 'offline', status_message: '', is_online: false, last_seen: null },
  { username: 'michaelchen', display_name: 'Michael Chen', status: 'offline', status_message: '', is_online: false, last_seen: null },
  { username: 'sarahlee', display_name: 'Sarah Lee', status: 'offline', status_message: '', is_online: false, last_seen: null },
  { username: 'davidkim', display_name: 'David Kim', status: 'offline', status_message: '', is_online: false, last_seen: null },
];

export const STATUS_OPTIONS: { value: SettablePresenceStatus; label: string; icon: string }[] = [
  { value: 'online', label: 'Online', icon: '🟢' },
  { value: 'busy', label: 'Busy', icon: '🔴' },
  { value: 'away', label: 'Away', icon: '🟡' },
];

/** @deprecated Use DIRECTORY_USERS */
export const CALLABLE_USERS = DIRECTORY_USERS;

export const STATUS_PRESETS = [
  'In a meeting',
  'Focus time',
  'On a call',
  'Be back soon',
  'Out for lunch',
];