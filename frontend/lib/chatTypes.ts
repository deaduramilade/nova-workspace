export type ChatMessageType = 'message' | 'notice';
export type ChatTargetType = 'all' | 'user' | 'team';

export interface Attachment {
  id?: string;
  filename: string;
  url: string; // resolved usable URL (apiUrl + download_path on sender)
  size?: number;
  content_type?: string;
}

export interface ChatMessage {
  type: ChatMessageType;
  room_id: string;
  content: string;
  sender: string;
  sender_name: string;
  target_type: ChatTargetType;
  target_value: string | null;
  timestamp: string;
  attachment?: Attachment;
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