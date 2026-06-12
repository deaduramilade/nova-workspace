export type { PresenceStatus as UserCallStatus, PresenceUser, PresenceStats } from './presenceTypes';
export type { PresenceUser as OnlineUser } from './presenceTypes';
export { DIRECTORY_USERS, CALLABLE_USERS } from './presenceTypes';

export type CallType = '1on1' | 'group' | 'meeting' | 'presentation';
export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
export type CallDirection = 'outgoing' | 'incoming' | 'missed';

export interface CallParticipant {
  username: string;
  display_name: string;
  status: string;
}

export interface CallSession {
  id: string;
  call_type: CallType;
  title: string;
  host: string;
  host_name: string;
  status: CallStatus;
  presentation_active: boolean;
  participants: CallParticipant[];
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface CallLogEntry {
  id: string;
  call_id: string;
  call_type: CallType;
  title: string;
  direction: CallDirection;
  status: CallStatus;
  participants: string[];
  initiator: string;
  initiator_name: string;
  timestamp: string;
  duration_seconds: number | null;
}

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  '1on1': '1-on-1 Call',
  group: 'Group Call',
  meeting: 'Meeting',
  presentation: 'Live Demo',
};

export const CALL_TYPE_ICONS: Record<CallType, string> = {
  '1on1': '📞',
  group: '👥',
  meeting: '📋',
  presentation: '🖥',
};