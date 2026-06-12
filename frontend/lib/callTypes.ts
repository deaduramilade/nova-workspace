export type CallType = '1on1' | 'group' | 'meeting' | 'presentation';
export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
export type CallDirection = 'outgoing' | 'incoming' | 'missed';
export type UserCallStatus = 'online' | 'busy' | 'in_call';

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

export interface OnlineUser {
  username: string;
  display_name: string;
  status: UserCallStatus;
}

export const CALLABLE_USERS = [
  { username: 'johndoe', display_name: 'John Doe', status: 'online' as const },
  { username: 'alicesmith', display_name: 'Alice Smith', status: 'online' as const },
  { username: 'michaelchen', display_name: 'Michael Chen', status: 'online' as const },
  { username: 'sarahlee', display_name: 'Sarah Lee', status: 'busy' as const },
  { username: 'davidkim', display_name: 'David Kim', status: 'online' as const },
];

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