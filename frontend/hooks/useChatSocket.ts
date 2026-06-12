'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatTargetType } from '../lib/chatTypes';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface UseChatSocketOptions {
  roomId: string;
  displayName: string;
  username: string;
  team?: string;
  enabled?: boolean;
  onMessage?: (msg: ChatMessage) => void;
}

export function useChatSocket({
  roomId,
  displayName,
  username,
  team,
  enabled = true,
  onMessage,
}: UseChatSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !enabled) return;

    const params = new URLSearchParams({
      token,
      display_name: displayName,
    });
    if (team) params.set('team', team);

    const ws = new WebSocket(`${WS_BASE}/api/v1/chat/ws/${roomId}?${params}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (enabled && wsRef.current === ws) connect();
      }, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const msg: ChatMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
        onMessageRef.current?.(msg);
      } catch { /* ignore */ }
    };
  }, [roomId, displayName, team, enabled]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback(
    (content: string, targetType: ChatTargetType = 'all', targetValue?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        target_type: targetType,
        target_value: targetValue || null,
      }));
      return true;
    },
    []
  );

  const sendNotice = useCallback(
    (content: string, targetType: ChatTargetType = 'all', targetValue?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
      wsRef.current.send(JSON.stringify({
        type: 'notice',
        content,
        target_type: targetType,
        target_value: targetValue || null,
      }));
      return true;
    },
    []
  );

  return { connected, messages, sendMessage, sendNotice, username };
}