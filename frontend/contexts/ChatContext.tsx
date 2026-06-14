'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useChatSocket } from '../hooks/useChatSocket';
import { playMessageSound } from '../lib/notificationSound';
import { Attachment, ChatMessage, ChatTargetType, ChatUser } from '../lib/chatTypes';

interface ChatContextValue {
  roomId: string;
  connected: boolean;
  messages: ChatMessage[];
  unreadCount: number;
  isOpen: boolean;
  displayName: string;
  username: string;
  team: string;
  setTeam: (team: string) => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string, targetType?: ChatTargetType, targetValue?: string) => boolean;
  sendNotice: (content: string, targetType?: ChatTargetType, targetValue?: string) => boolean;
  sendAttachment: (attachment: Attachment, caption?: string, targetType?: ChatTargetType, targetValue?: string) => boolean;
  clearUnread: () => void;
  setRoomId: (id: string) => void;
  authenticated: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function getUser(): ChatUser {
  if (typeof window === 'undefined') return { username: 'guest' };
  try {
    const raw = localStorage.getItem('nova_user');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { username: 'guest', display_name: 'Guest' };
}

function resolveRoomId(pathname: string): string {
  const breakoutMatch = pathname.match(/\/breakout-room\/([^/]+)/);
  if (breakoutMatch) return `breakout-${breakoutMatch[1]}`;
  const workspaceMatch = pathname.match(/\/workspace\/([^/]+)/);
  if (workspaceMatch) return `workspace-${workspaceMatch[1]}`;
  return 'team-general';
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<ChatUser>({ username: 'guest' });
  const [roomId, setRoomId] = useState('team-general');
  const [team, setTeam] = useState('Workspace 1');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const hideOnAuth = pathname === '/login' || pathname === '/register';
  const displayName = user.display_name || user.username;
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setRoomId(resolveRoomId(pathname));
    setHasToken(!!localStorage.getItem('access_token'));
  }, [pathname]);

  const enabled = !hideOnAuth && hasToken;

  const userRef = useRef(user);
  const displayNameRef = useRef(displayName);
  userRef.current = user;
  displayNameRef.current = displayName;

  const handleIncoming = useCallback(
    (msg: ChatMessage) => {
      const isOwn = msg.sender === userRef.current.username || msg.sender_name === displayNameRef.current;
      if (!isOpen && !isOwn) {
        setUnreadCount((c) => c + 1);
        playMessageSound();
      } else if (!isOwn && msg.sender !== 'system') {
        playMessageSound();
      }
    },
    [isOpen]
  );

  const { connected, messages, sendMessage, sendNotice, sendAttachment, username } = useChatSocket({
    roomId,
    displayName,
    username: user.username,
    team,
    enabled,
    onMessage: handleIncoming,
  });

  const openChat = () => { setIsOpen(true); setUnreadCount(0); };
  const closeChat = () => setIsOpen(false);
  const toggleChat = () => {
    setIsOpen((o) => {
      if (!o) setUnreadCount(0);
      return !o;
    });
  };
  const clearUnread = () => setUnreadCount(0);

  const value = useMemo(
    () => ({
      roomId,
      connected,
      messages,
      unreadCount,
      isOpen,
      displayName,
      username,
      team,
      setTeam,
      openChat,
      closeChat,
      toggleChat,
      sendMessage,
      sendNotice,
      sendAttachment,
      clearUnread,
      setRoomId,
      authenticated: hasToken,
    }),
    [roomId, connected, messages, unreadCount, isOpen, displayName, username, team, sendMessage, sendNotice, sendAttachment, hasToken]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}