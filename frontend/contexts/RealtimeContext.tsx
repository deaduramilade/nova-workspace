'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRealtimeSocket } from '../hooks/useRealtimeSocket';
import { playMessageSound } from '../lib/notificationSound';
import { CallLogEntry, CallSession } from '../lib/callTypes';
import { DIRECTORY_USERS, PresenceStats, PresenceUser, SettablePresenceStatus } from '../lib/presenceTypes';
import { splitPresenceDirectory } from '../lib/presenceUtils';

interface RealtimeContextValue {
  connected: boolean;
  networkOnline: boolean;
  authenticated: boolean;
  displayName: string;
  username: string;
  presenceDirectory: PresenceUser[];
  onlineUsers: PresenceUser[];
  offlineUsers: PresenceUser[];
  myPresence: PresenceUser | null;
  presenceStats: PresenceStats | null;
  callLogs: CallLogEntry[];
  activeCalls: CallSession[];
  incomingCall: CallSession | null;
  currentCall: CallSession | null;
  setPresence: (status: SettablePresenceStatus) => boolean;
  setStatusMessage: (message: string) => boolean;
  refreshPresence: () => boolean;
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
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function getUser() {
  if (typeof window === 'undefined') return { username: 'guest', display_name: 'Guest' };
  try {
    const raw = localStorage.getItem('nova_user');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { username: 'guest', display_name: 'Guest' };
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const networkOnline = useNetworkStatus();
  const [user, setUser] = useState(getUser);
  const [hasToken, setHasToken] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [directorySeeded, setDirectorySeeded] = useState(false);

  const hideOnAuth = pathname === '/login' || pathname === '/register';
  const displayName = user.display_name || user.username;
  const enabled = !hideOnAuth && hasToken;

  useEffect(() => {
    setUser(getUser());
    setHasToken(!!localStorage.getItem('access_token'));
  }, [pathname]);

  const callHandlers = useMemo(() => ({
    incoming_call: (data: Record<string, unknown>) => {
      setIncomingCall(data.call as CallSession);
      playMessageSound();
    },
    call_initiated: (data: Record<string, unknown>) => {
      const call = data.call as CallSession;
      setCurrentCall(call);
      router.push(`/calls/${call.id}`);
    },
    call_accepted: (data: Record<string, unknown>) => {
      setCurrentCall(data.call as CallSession);
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
    participant_joined: (data: Record<string, unknown>) => setCurrentCall(data.call as CallSession),
    presentation_started: (data: Record<string, unknown>) => setCurrentCall(data.call as CallSession),
    presentation_stopped: (data: Record<string, unknown>) => setCurrentCall(data.call as CallSession),
  }), [router]);

  const socket = useRealtimeSocket(displayName, user.username, enabled, networkOnline, callHandlers);

  useEffect(() => {
    if (!hasToken || hideOnAuth) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    axios
      .get('http://localhost:8000/api/v1/presence/directory', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.users) {
          socket.setPresenceDirectory(res.data.users);
          setDirectorySeeded(true);
        }
      })
      .catch(() => {
        socket.setPresenceDirectory(DIRECTORY_USERS.filter((u) => u.username !== user.username));
        setDirectorySeeded(true);
      });
  }, [hasToken, hideOnAuth, user.username, socket.setPresenceDirectory]);

  const presenceDirectory = socket.presenceDirectory.length > 0 || directorySeeded
    ? socket.presenceDirectory
    : DIRECTORY_USERS.filter((u) => u.username !== user.username);

  const { online: onlineUsers, offline: offlineUsers } = useMemo(
    () => splitPresenceDirectory(presenceDirectory, user.username),
    [presenceDirectory, user.username]
  );

  const value = useMemo(() => ({
    connected: socket.connected && networkOnline,
    networkOnline,
    authenticated: hasToken,
    displayName,
    username: user.username,
    presenceDirectory,
    onlineUsers,
    offlineUsers,
    myPresence: socket.myPresence,
    presenceStats: socket.presenceStats,
    callLogs: socket.callLogs,
    activeCalls: socket.activeCalls,
    incomingCall,
    currentCall,
    setPresence: socket.setPresence,
    setStatusMessage: socket.setStatusMessage,
    refreshPresence: socket.refreshPresence,
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
  }), [
    socket, networkOnline, hasToken, displayName, user.username,
    presenceDirectory, onlineUsers, offlineUsers, incomingCall, currentCall, router,
  ]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}

export function usePresence() {
  const rt = useRealtime();
  return {
    connected: rt.connected,
    networkOnline: rt.networkOnline,
    authenticated: rt.authenticated,
    displayName: rt.displayName,
    username: rt.username,
    presenceDirectory: rt.presenceDirectory,
    onlineUsers: rt.onlineUsers,
    offlineUsers: rt.offlineUsers,
    myPresence: rt.myPresence,
    presenceStats: rt.presenceStats,
    setPresence: rt.setPresence,
    setStatusMessage: rt.setStatusMessage,
    refreshPresence: rt.refreshPresence,
  };
}

export function useCalls() {
  return useRealtime();
}