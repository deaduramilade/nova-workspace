'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CallLogEntry, CallSession, PresenceUser } from '../lib/callTypes';
import {
  applyUserOffline,
  applyUserOnline,
  mergePresenceSnapshot,
} from '../lib/presenceUtils';

import { WS_BASE } from '../lib/api';
const HEARTBEAT_MS = 30_000;

type CallEventHandler = (payload: Record<string, unknown>) => void;

export function useCallSocket(
  displayName: string,
  username: string,
  enabled: boolean,
  networkOnline: boolean,
  handlers: Record<string, CallEventHandler>
) {
  const [connected, setConnected] = useState(false);
  const [presenceDirectory, setPresenceDirectory] = useState<PresenceUser[]>([]);
  const [myPresence, setMyPresence] = useState<PresenceUser | null>(null);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    clearHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'heartbeat' }));
      }
    }, HEARTBEAT_MS);
  }, [clearHeartbeat]);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !enabled || !networkOnline) return;

    const params = new URLSearchParams({ token, display_name: displayName });
    const ws = new WebSocket(`${WS_BASE}/api/v1/calls/ws?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      startHeartbeat(ws);
      ws.send(JSON.stringify({ event: 'get_logs' }));
      ws.send(JSON.stringify({ event: 'get_active_calls' }));
      ws.send(JSON.stringify({ event: 'get_presence' }));
    };

    ws.onclose = () => {
      setConnected(false);
      clearHeartbeat();
      if (enabled && networkOnline) {
        setTimeout(() => {
          if (wsRef.current === ws) connect();
        }, 3000);
      }
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const handler = handlersRef.current[data.event];
        if (handler) handler(data);

        if (data.event === 'presence_snapshot') {
          const users = (data.users as PresenceUser[]) ?? [];
          setPresenceDirectory((prev) => mergePresenceSnapshot(prev, users));
          if (data.you) setMyPresence(data.you as PresenceUser);
        }

        if (data.event === 'online_users') {
          const online = (data.users as PresenceUser[]) ?? [];
          setPresenceDirectory((prev) => {
            const onlineMap = new Map(online.map((u) => [u.username, u]));
            return prev.map((u) => {
              const live = onlineMap.get(u.username);
              if (live) return { ...u, ...live, is_online: true };
              if (u.username === username) return u;
              return u.is_online ? { ...u, is_online: false, status: 'offline' } : u;
            });
          });
        }

        if (data.event === 'user_offline' && data.username) {
          setPresenceDirectory((prev) =>
            applyUserOffline(prev, data.username as string, data.last_seen as string | null)
          );
        }

        if (data.event === 'user_online' && data.username) {
          setPresenceDirectory((prev) => applyUserOnline(prev, data.username as string));
        }

        if (data.event === 'presence_updated' && data.username && data.status) {
          setPresenceDirectory((prev) =>
            prev.map((u) =>
              u.username === data.username
                ? { ...u, status: data.status as PresenceUser['status'], is_online: true }
                : u
            )
          );
          if (data.username === username) {
            setMyPresence((prev) =>
              prev ? { ...prev, status: data.status as PresenceUser['status'] } : prev
            );
          }
        }

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
  }, [displayName, enabled, networkOnline, username, startHeartbeat, clearHeartbeat]);

  useEffect(() => {
    if (!networkOnline) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      clearHeartbeat();
      return;
    }
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      clearHeartbeat();
    };
  }, [connect, networkOnline, clearHeartbeat]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (!networkOnline) return false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, [networkOnline]);

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
  const refreshPresence = useCallback(() => send({ event: 'get_presence' }), [send]);
  const setPresence = useCallback(
    (status: 'online' | 'busy' | 'away') => send({ event: 'set_presence', status }),
    [send]
  );

  return {
    connected,
    presenceDirectory,
    myPresence,
    setPresenceDirectory,
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
    refreshPresence,
    setPresence,
    username,
  };
}