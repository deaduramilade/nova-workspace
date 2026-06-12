import { PresenceUser } from './presenceTypes';

export interface NekoHealth {
  online: boolean;
  status: string;
  latency_ms: number | null;
  http_status: number | null;
  neko_url: string;
  browser: string;
  checked_at: string;
  error?: string;
  room?: NekoRoom;
}

export interface NekoRoom {
  room_id: string;
  connected: boolean;
  viewers: number;
  max_viewers: number;
  bitrate_kbps: number;
  fps: number;
  resolution: string;
  codec: string;
  password_protected: boolean;
}

export interface WorkingHoursStatus {
  username: string;
  workspace_id: number;
  session_seconds: number;
  today_seconds: number;
  active: boolean;
  started_at: string | null;
}

export interface TeamHoursMember {
  username: string;
  display_name: string;
  today_seconds: number;
  active_in_workspace: boolean;
  simulated?: boolean;
}

export interface LiveActivity {
  code: string;
  label: string;
  icon: string;
}

export interface LiveMemberStatus {
  username: string;
  display_name: string;
  is_online: boolean;
  in_neko: boolean;
  workspace_id: number | null;
  activity: LiveActivity;
  status_message: string;
  updated_at: string;
  stream_quality: string;
  latency_ms: number | null;
  is_self?: boolean;
}

export interface LiveStatusPayload {
  workspace_id: number;
  updated_at: string;
  members: LiveMemberStatus[];
  summary: {
    online: number;
    in_workspace: number;
    in_neko_stream: number;
    in_meeting: number;
  };
}

export interface StreamingSession {
  workspace_id: number;
  workspace_name: string;
  workspace_status: string;
  stream_url: string;
  neko_url: string;
  neko_password?: string;
  status: string;
  session_id: string;
  host: string;
  host_display_name?: string;
  participants: PresenceUser[];
  participant_count: number;
  features: string[];
  quality: string;
  message: string;
  neko?: NekoHealth;
  working_hours?: WorkingHoursStatus;
}

export const WORKSPACE_FEATURES: Record<string, { label: string; icon: string }> = {
  browser_stream: { label: 'Neko Browser', icon: '🦊' },
  clipboard: { label: 'Clipboard Sync', icon: '📋' },
  fullscreen: { label: 'Fullscreen', icon: '⛶' },
  chat: { label: 'Team Chat', icon: '💬' },
  presence: { label: 'Live Presence', icon: '🟢' },
  working_hours: { label: 'Working Hours', icon: '⏱' },
};

export const QUALITY_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-sky-400',
  fair: 'text-amber-400',
  offline: 'text-slate-500',
};