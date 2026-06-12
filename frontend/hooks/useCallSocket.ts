'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CallLogEntry, CallSession, OnlineUser } from '../lib/callTypes';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

type CallEventHandler = (payload: Record<string, unknown>) => void;

export function useCallSocket(
  displayName: string,
  username: string,
  enabled: boolean,
  handlers: Record<string, CallEventHandler>
) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !enabled) return;

    const params = new URLSearchParams({ token, display_name: displayName });
    const ws = new WebSocket(`${WS_BASE}/api/v1/calls/ws?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ event: 'get_logs' }));
      ws.send(JSON.stringify({ event: 'get_active_calls' }));
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (enabled && wsRef.current === ws) connect();
      }, 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const handler = handlersRef.current[data.event];
        if (handler) handler(data);

        if (data.event === 'online_users') setOnlineUsers(data.users);
        if (data.event === 'call_logs') setCallLogs(data.logs);
        if (data.event === 'active_calls') setActiveCalls(data.calls);

        const call = data.call as CallSession | undefined;
        if (call?.id) {
          if (data.event === 'call_ended' || call.status === 'ended' || call.status === 'rejected') {
            setActiveCalls((prev) => prev.filter((c) => c.id !== call.id));
          } else if (
            ['call_initiated', 'call_accepted', 'incoming_call', 'participant_joined', 'presentation_started', 'presentation_stopped'].includes(data.event)
          ) {
            setActiveCalls((prev) => {
              const idx = prev.findIndex((c) => c.id === call.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = call;
                return next;
              }
              return [...prev, call];
            });
          }
        }

        if (['call_initiated', 'call_accepted', 'call_rejected', 'call_ended', 'participant_joined'].includes(data.event)) {
          ws.send(JSON.stringify({ event: 'get_logs' }));
        }
      } catch { /* ignore */ }
    };
  }, [displayName, enabled]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const initiateCall = useCallback(
    (callType: string, targets: string[], title?: string, targetNames?: Record<string, string>) => {
      return send({ event: 'initiate_call', call_type: callType, targets, title, target_names: targetNames });
    },
    [send]
  );

  const acceptCall = useCallback((callId: string) => send({ event: 'accept_call', call_id: callId }), [send]);
  const rejectCall = useCallback((callId: string) => send({ event: 'reject_call', call_id: callId }), [send]);
  const endCall = useCallback((callId: string) => send({ event: 'end_call', call_id: callId }), [send]);
  const joinCall = useCallback((callId: string) => send({ event: 'join_call', call_id: callId }), [send]);
  const startPresentation = useCallback((callId: string) => send({ event: 'start_presentation', call_id: callId }), [send]);
  const stopPresentation = useCallback((callId: string) => send({ event: 'stop_presentation', call_id: callId }), [send]);
  const refreshLogs = useCallback(() => send({ event: 'get_logs' }), [send]);
  const refreshActive = useCallback(() => send({ event: 'get_active_calls' }), [send]);

  return {
    connected,
    onlineUsers,
    callLogs,
    activeCalls,
    setCallLogs,
    setActiveCalls,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    joinCall,
    startPresentation,
    stopPresentation,
    refreshLogs,
    refreshActive,
    username,
  };
}