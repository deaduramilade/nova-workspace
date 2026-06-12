import { PresenceUser } from './presenceTypes';

export interface StreamingSession {
  workspace_id: number;
  workspace_name: string;
  workspace_status: string;
  stream_url: string;
  neko_url: string;
  status: string;
  session_id: string;
  host: string;
  participants: PresenceUser[];
  participant_count: number;
  features: string[];
  quality: string;
  message: string;
}

export const WORKSPACE_FEATURES: Record<string, { label: string; icon: string }> = {
  browser_stream: { label: 'Browser Stream', icon: '🖥' },
  clipboard: { label: 'Clipboard Sync', icon: '📋' },
  fullscreen: { label: 'Fullscreen', icon: '⛶' },
  chat: { label: 'Team Chat', icon: '💬' },
  presence: { label: 'Live Presence', icon: '🟢' },
};