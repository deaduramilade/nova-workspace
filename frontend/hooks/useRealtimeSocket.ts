'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CallLogEntry, CallSession } from '../lib/callTypes';
import { PresenceStats, PresenceUser } from '../lib/presenceTypes';
import {
  applyUserOffline,
  applyUserOnline,
  mergePresenceSnapshot,
} from '../lib/presenceUtils';

import { WS_BASE } from '../lib/api';
const HEARTBEAT_MS = 30_000;
const IDLE_AWAY_MS = 5 * 60_000;

type RealtimeEventHandler = (payload: Record<string, unknown>) => void;

export function useRealtimeSocket(
  displayName: string,
  username: string,
  enabled: boolean,
  networkOnline: boolean,
  callHandlers: Record<string, RealtimeEventHandler>
) {
  const [connected, setConnected] = useState(false);
  const [presenceDirectory, setPresenceDirectory] = useState<PresenceUser[]>([]);
  const [myPresence, setMyPresence] = useState<PresenceUser | null>(null);
  const [presenceStats, setPresenceStats] = useState<PresenceStats | null>(null);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callHandlersRef = useRef(callHandlers);
  callHandlersRef.current = callHandlers;

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (!networkOnline) return false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, [networkOnline]);

  const resetIdleTimer = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    if (!enabled || !networkOnline) return;
    idleRef.current = setTimeout(() => {
      send({ event: 'set_presence', status: 'away' });
    }, IDLE_AWAY_MS);
  }, [enabled, networkOnline, send]);

  const reportActivity = useCallback(() => {
    send({ event: 'activity' });
    resetIdleTimer();
  }, [send, resetIdleTimer]);

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
    const ws = new WebSocket(`${WS_BASE}/api/v1/presence/ws?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      startHeartbeat(ws);
      ws.send(JSON.stringify({ event: 'get_presence' }));
      ws.send(JSON.stringify({ event: 'get_logs' }));
      ws.send(JSON.stringify({ event: 'get_active_calls' }));
      resetIdleTimer();
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
        const callHandler = callHandlersRef.current[data.event];
        if (callHandler) callHandler(data);

        if (data.event === 'presence_snapshot') {
          const users = (data.users as PresenceUser[]) ?? [];
          setPresenceDirectory((prev) => mergePresenceSnapshot(prev, users));
          if (data.you) setMyPresence(data.you as PresenceUser);
          if (data.stats) setPresenceStats(data.stats as PresenceStats);
        }

        if (data.event === 'user_offline' && data.username) {
          setPresenceDirectory((prev) =>
            applyUserOffline(prev, data.username as string, data.last_seen as string | null)
          );
        }

        if (data.event === 'user_online' && data.username) {
          setPresenceDirectory((prev) => applyUserOnline(prev, data.username as string));
        }

        if (data.event === 'presence_updated' && data.username) {
          setPresenceDirectory((prev) =>
            prev.map((u) =>
              u.username === data.username
                ? {
                    ...u,
                    status: (data.status as PresenceUser['status']) ?? u.status,
                    status_message: (data.status_message as string) ?? u.status_message,
                    is_online: true,
                  }
                : u
            )
          );
          if (data.username === username) {
            setMyPresence((prev) =>
              prev
                ? {
                    ...prev,
                    status: (data.status as PresenceUser['status']) ?? prev.status,
                    status_message: (data.status_message as string) ?? prev.status_message,
                  }
                : prev
            );
          }
        }

        if (data.event === 'call_logs') setCallLogs(data.logs);
        if (data.event === 'active_calls') setActiveCalls(data.calls);

        if (data.event === 'supervisor_feedback' && data.feedback) {
          window.dispatchEvent(
            new CustomEvent('nova-supervisor-feedback', { detail: data.feedback }),
          );
        }

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
  }, [displayName, enabled, networkOnline, username, startHeartbeat, clearHeartbeat, resetIdleTimer]);

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
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [connect, networkOnline, clearHeartbeat]);

  useEffect(() => {
    if (!enabled) return;
    const onActivity = () => reportActivity();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reportActivity();
      else send({ event: 'set_presence', status: 'away' });
    };
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, reportActivity, send]);

  const initiateCall = useCallback(
    (callType: string, targets: string[], title?: string, targetNames?: Record<string, string>) =>
      send({ event: 'initiate_call', call_type: callType, targets, title, target_names: targetNames }),
    [send]
  );
  const acceptCall = useCallback((id: string) => send({ event: 'accept_call', call_id: id }), [send]);
  const rejectCall = useCallback((id: string) => send({ event: 'reject_call', call_id: id }), [send]);
  const endCall = useCallback((id: string) => send({ event: 'end_call', call_id: id }), [send]);
  const joinCall = useCallback((id: string) => send({ event: 'join_call', call_id: id }), [send]);
  const startPresentation = useCallback((id: string) => send({ event: 'start_presentation', call_id: id }), [send]);
  const stopPresentation = useCallback((id: string) => send({ event: 'stop_presentation', call_id: id }), [send]);
  const refreshLogs = useCallback(() => send({ event: 'get_logs' }), [send]);
  const refreshActive = useCallback(() => send({ event: 'get_active_calls' }), [send]);
  const refreshPresence = useCallback(() => send({ event: 'get_presence' }), [send]);
  const setPresence = useCallback((status: 'online' | 'busy' | 'away') => send({ event: 'set_presence', status }), [send]);
  const setStatusMessage = useCallback((message: string) => send({ event: 'set_status_message', message }), [send]);

  return {
    connected,
    presenceDirectory,
    myPresence,
    presenceStats,
    setPresenceDirectory,
    callLogs,
    activeCalls,
    send,
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
    setStatusMessage,
    reportActivity,
  };
}