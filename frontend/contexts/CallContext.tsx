'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCallSocket } from '../hooks/useCallSocket';
import { playMessageSound } from '../lib/notificationSound';
import { CallLogEntry, CallSession, CALLABLE_USERS, OnlineUser } from '../lib/callTypes';

interface CallContextValue {
  connected: boolean;
  onlineUsers: OnlineUser[];
  callLogs: CallLogEntry[];
  activeCalls: CallSession[];
  incomingCall: CallSession | null;
  currentCall: CallSession | null;
  displayName: string;
  username: string;
  initiateCall: (type: string, targets: string[], title?: string, names?: Record<string, string>) => boolean;
  acceptCall: (id: string) => boolean;
  rejectCall: (id: string) => boolean;
  endCall: (id: string) => boolean;
  joinCall: (id: string) => boolean;
  joinCallSilent: (id: string) => boolean;
  startPresentation: (id: string) => boolean;
  stopPresentation: (id: string) => boolean;
  refreshLogs: () => boolean;
  refreshActive: () => boolean;
  authenticated: boolean;
}

const CallContext = createContext<CallContextValue | null>(null);

function getUser() {
  if (typeof window === 'undefined') return { username: 'guest', display_name: 'Guest' };
  try {
    const raw = localStorage.getItem('nova_user');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { username: 'guest', display_name: 'Guest' };
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(getUser);
  const [hasToken, setHasToken] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);

  const hideOnAuth = pathname === '/login' || pathname === '/register';
  const displayName = user.display_name || user.username;
  const enabled = !hideOnAuth && hasToken;

  useEffect(() => {
    setUser(getUser());
    setHasToken(!!localStorage.getItem('access_token'));
  }, [pathname]);

  const handlers = useMemo(() => ({
    incoming_call: (data: Record<string, unknown>) => {
      const call = data.call as CallSession;
      setIncomingCall(call);
      playMessageSound();
    },
    call_initiated: (data: Record<string, unknown>) => {
      const call = data.call as CallSession;
      setCurrentCall(call);
      router.push(`/calls/${call.id}`);
    },
    call_accepted: (data: Record<string, unknown>) => {
      const call = data.call as CallSession;
      setCurrentCall(call);
      setIncomingCall(null);
    },
    call_rejected: () => setIncomingCall(null),
    call_ended: () => {
      setCurrentCall(null);
      setIncomingCall(null);
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/calls/')) {
        router.push('/calls');
      }
    },
    participant_joined: (data: Record<string, unknown>) => {
      setCurrentCall(data.call as CallSession);
    },
    presentation_started: (data: Record<string, unknown>) => {
      setCurrentCall(data.call as CallSession);
    },
    presentation_stopped: (data: Record<string, unknown>) => {
      setCurrentCall(data.call as CallSession);
    },
  }), [router, pathname]);

  const socket = useCallSocket(displayName, user.username, enabled, handlers);

  const mergedUsers: OnlineUser[] = socket.onlineUsers.length > 0
    ? socket.onlineUsers
    : CALLABLE_USERS;

  const value = useMemo(() => ({
    connected: socket.connected,
    onlineUsers: mergedUsers,
    callLogs: socket.callLogs,
    activeCalls: socket.activeCalls,
    incomingCall,
    currentCall,
    displayName,
    username: user.username,
    initiateCall: socket.initiateCall,
    acceptCall: (id: string) => { socket.acceptCall(id); router.push(`/calls/${id}`); return true; },
    rejectCall: socket.rejectCall,
    endCall: socket.endCall,
    joinCall: (id: string) => { socket.joinCall(id); router.push(`/calls/${id}`); return true; },
    joinCallSilent: socket.joinCall,
    startPresentation: socket.startPresentation,
    stopPresentation: socket.stopPresentation,
    refreshLogs: socket.refreshLogs,
    refreshActive: socket.refreshActive,
    authenticated: hasToken,
  }), [socket, incomingCall, currentCall, displayName, user.username, hasToken, router, mergedUsers]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCalls() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used within CallProvider');
  return ctx;
}