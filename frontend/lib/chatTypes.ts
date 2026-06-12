export type ChatMessageType = 'message' | 'notice';
export type ChatTargetType = 'all' | 'user' | 'team';

export interface ChatMessage {
  type: ChatMessageType;
  room_id: string;
  content: string;
  sender: string;
  sender_name: string;
  target_type: ChatTargetType;
  target_value: string | null;
  timestamp: string;
}

export interface ChatUser {
  username: string;
  display_name?: string;
}

export const TEAM_OPTIONS = ['Workspace 1', 'Workspace 2', 'Workspace 3'];

export const ONLINE_USERS = [
  'John Doe',
  'Alice Smith',
  'Michael Chen',
];