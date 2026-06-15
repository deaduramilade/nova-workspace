'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { SyncEngine } from '../lib/crdt/syncEngine';
import { CRDTState, SyncStatus, SupervisorFeedback } from '../lib/crdt/types';
import { FeedbackTool, SupervisorOverview } from '../lib/supervisorTypes';
import { useRole } from './RoleContext';

import { apiUrl, authHeaders as getAuthHeaders } from '../lib/api';

const SUPERVISOR_API = apiUrl('/supervisor');
const SYNC_API = apiUrl('/sync');

interface Phase3ContextValue {
  overview: SupervisorOverview | null;
  feedbackTools: FeedbackTool[];
  isSupervisor: boolean;
  isHR: boolean;
  isAdmin: boolean;
  currentRole: string; // effective role for convenience
  recentFeedback: SupervisorFeedback[];
  incomingFeedback: SupervisorFeedback[];
  crdtState: CRDTState | null;
  syncStatus: SyncStatus;
  activeWorkspaceId: number;
  setActiveWorkspaceId: (id: number) => void;
  sendFeedback: (type: string, message: string, target?: string) => Promise<boolean>;
  dismissFeedback: (id: string) => void;
  markFeedbackRead: (id: string) => Promise<void>;
  refreshOverview: () => Promise<void>;
  syncNow: () => Promise<void>;
  setLocalField: (key: string, value: unknown) => Promise<void>;
  handleSupervisorEvent: (feedback: SupervisorFeedback) => void;
}

const Phase3Context = createContext<Phase3ContextValue | null>(null);

const authHeaders = getAuthHeaders;



export function Phase3Provider({ children }: { children: React.ReactNode }) {
  const networkOnline = useNetworkStatus();
  const [overview, setOverview] = useState<SupervisorOverview | null>(null);
  const [feedbackTools, setFeedbackTools] = useState<FeedbackTool[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<SupervisorFeedback[]>([]);
  const [incomingFeedback, setIncomingFeedback] = useState<SupervisorFeedback[]>([]);
  const [crdtState, setCrdtState] = useState<CRDTState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: 0, lastSyncAt: null, version: 0, syncing: false, offline: false,
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(1);
  const engineRef = useRef<SyncEngine | null>(null);

  // Delegate role information to the dedicated global RoleProvider for consistency
  const { effectiveRole, realRole, isAdmin, isHR, isSupervisor, isTesting } = useRole();
  const currentRole = effectiveRole; // backward compat + for Phase3 consumers

  useEffect(() => {
    engineRef.current = new SyncEngine(activeWorkspaceId);
    const unsub = engineRef.current.subscribe((s) => {
      setSyncStatus({ ...s, offline: !networkOnline });
    });
    return unsub;
  }, [activeWorkspaceId, networkOnline]);

  const refreshOverview = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const [ovRes, toolsRes, fbRes, syncRes] = await Promise.all([
        axios.get(`${SUPERVISOR_API}/overview`, { headers: authHeaders() }),
        axios.get(`${SUPERVISOR_API}/tools`, { headers: authHeaders() }),
        axios.get(`${SUPERVISOR_API}/feedback/recent`, {
          params: { workspace_id: activeWorkspaceId },
          headers: authHeaders(),
        }),
        axios.get(`${SYNC_API}/status`, { headers: authHeaders() }),
      ]);
      setOverview(ovRes.data);
      setFeedbackTools(toolsRes.data.feedback_types ?? []);
      setRecentFeedback(fbRes.data.items ?? []);
      if (syncRes.data) {
        setOverview((prev) => prev ?? {
          phase: 3,
          is_supervisor: toolsRes.data.is_supervisor,
          role: toolsRes.data.role,
          updated_at: new Date().toISOString(),
          integrations: syncRes.data.integrations,
          metrics: { online_users: 0, total_users: 0, active_workspaces: 0, hours_tracked_today: 0, pending_feedback: 0 },
        });
      }
    } catch { /* silent */ }
  }, [activeWorkspaceId]);

  const syncNow = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = await engine.pullState();
    if (state) setCrdtState(state);
    await engine.flush();
    setSyncStatus(engine.getStatus(!networkOnline));
  }, [networkOnline]);

  const handleSupervisorEvent = useCallback((feedback: SupervisorFeedback) => {
    setIncomingFeedback((prev) => [feedback, ...prev].slice(0, 5));
    setRecentFeedback((prev) => [feedback, ...prev].slice(0, 30));
    toast(feedback.message, { icon: feedback.type === 'praise' ? '⭐' : '👋' });
  }, []);

  useEffect(() => {
    refreshOverview();
    const id = setInterval(refreshOverview, 15000);
    return () => clearInterval(id);
  }, [refreshOverview]);

  useEffect(() => {
    const onFeedback = (e: Event) => {
      const detail = (e as CustomEvent<SupervisorFeedback>).detail;
      if (detail) handleSupervisorEvent(detail);
    };
    window.addEventListener('nova-supervisor-feedback', onFeedback);
    return () => window.removeEventListener('nova-supervisor-feedback', onFeedback);
  }, [handleSupervisorEvent]);

  useEffect(() => {
    if (networkOnline) {
      syncNow();
    } else {
      setSyncStatus((s) => ({ ...s, offline: true }));
    }
  }, [networkOnline, syncNow, activeWorkspaceId]);

  const sendFeedback = useCallback(async (type: string, message: string, target?: string) => {
    try {
      const res = await axios.post(
        `${SUPERVISOR_API}/feedback`,
        { type, message, target_username: target, workspace_id: activeWorkspaceId },
        { headers: authHeaders() },
      );
      const fb = res.data.feedback as SupervisorFeedback;
      setRecentFeedback((prev) => [fb, ...prev]);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} sent`);
      return true;
    } catch {
      toast.error('Failed to send feedback');
      return false;
    }
  }, [activeWorkspaceId]);

  const dismissFeedback = useCallback((id: string) => {
    setIncomingFeedback((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const markFeedbackRead = useCallback(async (id: string) => {
    try {
      await axios.post(`${SUPERVISOR_API}/feedback/${id}/read`, null, { headers: authHeaders() });
    } catch { /* ignore */ }
    dismissFeedback(id);
  }, [dismissFeedback]);

  const setLocalField = useCallback(async (key: string, value: unknown) => {
    await engineRef.current?.setLocal(key, value);
    setSyncStatus(engineRef.current?.getStatus(!networkOnline) ?? syncStatus);
  }, [networkOnline, syncStatus]);

  const value = useMemo(() => ({
    overview,
    feedbackTools,
    isSupervisor,
    isHR,
    isAdmin,
    currentRole: effectiveRole || currentRole, // prefer effective from RoleContext
    recentFeedback,
    incomingFeedback,
    crdtState,
    syncStatus,
    activeWorkspaceId,
    setActiveWorkspaceId,
    sendFeedback,
    dismissFeedback,
    markFeedbackRead,
    refreshOverview,
    syncNow,
    setLocalField,
    handleSupervisorEvent,
  }), [
    overview, feedbackTools, isSupervisor, isHR, isAdmin, recentFeedback, incomingFeedback,
    crdtState, syncStatus, activeWorkspaceId, sendFeedback, dismissFeedback,
    markFeedbackRead, refreshOverview, syncNow, setLocalField, handleSupervisorEvent,
  ]);

  return <Phase3Context.Provider value={value}>{children}</Phase3Context.Provider>;
}

export function usePhase3() {
  const ctx = useContext(Phase3Context);
  if (!ctx) throw new Error('usePhase3 must be used within Phase3Provider');
  return ctx;
}