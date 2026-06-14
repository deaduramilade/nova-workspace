'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import ChatPanel from '../../../components/ChatPanel';
import NekoStatusPanel from '../../../components/NekoStatusPanel';
import PresenceUserRow from '../../../components/PresenceUserRow';
import WorkingHoursPanel from '../../../components/WorkingHoursPanel';
import SupervisorLiveTools from '../../../components/SupervisorLiveTools';
import WorkspaceLiveStatus from '../../../components/WorkspaceLiveStatus';
import { usePhase3 } from '../../../contexts/Phase3Context';
import { useChat } from '../../../contexts/ChatContext';
import { usePresence } from '../../../contexts/RealtimeContext';
import { tickLocalHours } from '../../../lib/workingHours';
import {
  LiveStatusPayload,
  NekoHealth,
  StreamingSession,
  TeamHoursMember,
  WorkingHoursStatus,
} from '../../../lib/workspaceTypes';
import { Attachment } from '../../../lib/chatTypes';
import { presenceDotClass } from '../../../lib/presenceUtils';

type SidebarTab = 'live' | 'hours' | 'neko' | 'supervisor' | 'people' | 'chat';

import { apiUrl, authHeaders as getAuthHeaders } from '../../../lib/api';

const API = apiUrl('/streaming');
const POLL_INTERVAL_MS = 5000;

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<StreamingSession | null>(null);
  const [nekoHealth, setNekoHealth] = useState<NekoHealth | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatusPayload | null>(null);
  const [myHours, setMyHours] = useState<WorkingHoursStatus | null>(null);
  const [teamHours, setTeamHours] = useState<TeamHoursMember[]>([]);
  const [teamTotal, setTeamTotal] = useState(0);
  const [localToday, setLocalToday] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamReady, setStreamReady] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('live');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsUploading, setWsUploading] = useState(false);
  const wsFileInputRef = useRef<HTMLInputElement>(null);

  const { setRoomId, openChat, sendAttachment: chatSendAttachment } = useChat();
  const { onlineUsers, connected: presenceConnected, myPresence } = usePresence();
  const { setActiveWorkspaceId, syncNow, syncStatus } = usePhase3();

  useEffect(() => {
    setActiveWorkspaceId(Number(workspaceId));
    syncNow();
  }, [workspaceId, setActiveWorkspaceId, syncNow]);

  const authHeaders = useCallback(() => getAuthHeaders(), []);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    setError('');
    setStreamError(false);
    setStreamReady(false);

    try {
      const response = await axios.get(`${API}/join/${workspaceId}`, { headers: authHeaders() });
      setSession(response.data);
      setNekoHealth(response.data.neko ?? null);
      setMyHours(response.data.working_hours ?? null);
      setRoomId(`workspace-${workspaceId}`);
    } catch {
      setError('Failed to connect to streaming session. Check backend and Neko Docker container.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router, setRoomId, authHeaders]);

  const pollLiveData = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const [liveRes, hoursRes, nekoRes] = await Promise.all([
        axios.get(`${API}/live-status/${workspaceId}`, { headers: authHeaders() }),
        axios.get(`${API}/working-hours/${workspaceId}`, { headers: authHeaders() }),
        axios.get(`${API}/neko/health`, { params: { workspace_id: workspaceId }, headers: authHeaders() }),
      ]);
      setLiveStatus(liveRes.data);
      setMyHours(hoursRes.data.mine);
      setTeamHours(hoursRes.data.team);
      setTeamTotal(hoursRes.data.team_total_today_seconds);
      setSessionSeconds(hoursRes.data.mine?.session_seconds ?? 0);
      setNekoHealth(nekoRes.data);
      await axios.post(`${API}/working-hours/${workspaceId}/tick`, null, { headers: authHeaders() });
      setLocalToday(tickLocalHours(POLL_INTERVAL_MS / 1000));
    } catch { /* silent poll */ }
  }, [workspaceId, authHeaders]);

  useEffect(() => { loadSession(); }, [loadSession]);

  useEffect(() => {
    if (!myHours?.active || !myHours.started_at) return;
    const started = new Date(myHours.started_at).getTime();
    const tick = () => setSessionSeconds(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [myHours?.active, myHours?.started_at]);

  useEffect(() => {
    if (!session) return;
    pollLiveData();
    const id = setInterval(pollLiveData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, pollLiveData]);

  useEffect(() => {
    if (!session?.stream_url) return;
    const timeout = setTimeout(() => { if (!streamReady) setStreamError(true); }, 12000);
    return () => clearTimeout(timeout);
  }, [session?.stream_url, streamReady]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        axios.post(`${API}/working-hours/${workspaceId}/end`, null, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    };
  }, [workspaceId]);

  const handleFullscreen = async () => {
    const el = streamContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
  };

  const handleRefresh = () => {
    if (iframeRef.current && session?.stream_url) {
      setStreamReady(false);
      setStreamError(false);
      iframeRef.current.src = session.stream_url;
      toast.success('Neko stream refreshed');
    }
  };

  const handlePopOut = () => {
    if (session?.stream_url) window.open(session.stream_url, '_blank', 'noopener,noreferrer');
  };

  const triggerWorkspaceUpload = () => {
    if (!wsUploading) wsFileInputRef.current?.click();
  };

  const handleWorkspaceFileUpload = async (file: File) => {
    if (!file || wsUploading) return;
    setWsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(apiUrl('/files/upload'), form, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      const att: Attachment = {
        id: data.id,
        filename: data.filename,
        url: apiUrl(data.download_path),
        size: data.size,
        content_type: data.content_type,
      };
      const ok = chatSendAttachment ? chatSendAttachment(att, 'Uploaded to workspace', 'all') : false;
      if (ok) {
        setSidebarTab('chat');
        openChat();
        toast.success(`Shared ${data.filename}`);
      } else {
        toast.error('Uploaded but could not post to chat');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Workspace file upload failed');
    } finally {
      setWsUploading(false);
      if (wsFileInputRef.current) wsFileInputRef.current.value = '';
    }
  };

  const onWsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleWorkspaceFileUpload(f);
  };

  if (loading) {
    return (
      <div className="min-h-screen text-readable flex flex-col items-center justify-center gap-6 p-8">
        <div className="nova-spinner" />
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Connecting to Neko workspace</p>
          <p className="text-readable-muted text-sm">Auth · Neko health · Session · Working hours</p>
        </div>
        <div className="workspace-connect-steps">
          {['Auth', 'Neko', 'Stream', 'Hours'].map((step, i) => (
            <div key={step} className="workspace-connect-step" style={{ animationDelay: `${i * 0.4}s` }}>
              <span className="workspace-connect-dot" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen text-readable flex items-center justify-center p-8">
        <div className="glass rounded-2xl p-10 max-w-lg text-center card-accent card-accent-sky">
          <span className="text-4xl mb-4 block">🦊</span>
          <h2 className="text-xl font-semibold mb-2">Neko stream unavailable</h2>
          <p className="text-readable-muted text-sm mb-6">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={loadSession} className="btn-primary px-6 py-2.5 rounded-xl text-sm text-white">Retry</button>
            <button onClick={() => router.push('/')} className="glass px-6 py-2.5 rounded-xl text-sm">Dashboard</button>
          </div>
          <p className="text-[11px] text-readable-subtle mt-6">
            <code className="text-sky-300">docker unpause nova-neko</code>
          </p>
        </div>
      </div>
    );
  }

  const participants = onlineUsers.length > 0 ? onlineUsers : session.participants;
  const nekoOnline = nekoHealth?.online ?? false;

  return (
    <div className="workspace-stream-page min-h-screen text-readable flex flex-col">
      <Toaster position="top-center" />

      <header className="workspace-stream-toolbar glass border-b border-white/10 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/')} className="workspace-tool-btn" title="Dashboard">←</button>
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-rose-500 rounded-xl flex items-center justify-center text-sm shrink-0">
            🦊
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{session.workspace_name}</h1>
            <p className="text-[10px] text-readable-subtle flex items-center gap-2 flex-wrap">
              <span className={`flex items-center gap-1 ${nekoOnline && streamReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${nekoOnline && streamReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {nekoOnline ? (streamReady ? 'Neko live' : 'Neko connecting') : 'Neko offline'}
              </span>
              <span>·</span>
              <span>{formatElapsed(sessionSeconds)}</span>
              <span>·</span>
              <span>{liveStatus?.summary.in_neko_stream ?? 0} in stream</span>
              {syncStatus.pending > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-400">{syncStatus.pending} queued</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {nekoHealth?.latency_ms != null && (
            <span className="hidden sm:inline text-[10px] stat-pill px-2 py-1">{nekoHealth.latency_ms}ms</span>
          )}
          {myPresence && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] stat-pill px-2.5 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${presenceDotClass(myPresence.status, myPresence.is_online)}`} />
              {myPresence.status_message || myPresence.status}
            </span>
          )}
          <input ref={wsFileInputRef} type="file" className="hidden" onChange={onWsFileChange} disabled={wsUploading} />
          <button
            onClick={triggerWorkspaceUpload}
            disabled={wsUploading}
            className="workspace-tool-btn"
            title="Upload file and share to this workspace (appears in workspace chat)"
          >
            {wsUploading ? '⏳' : '📤'}
          </button>
          <button onClick={handleRefresh} className="workspace-tool-btn" title="Refresh">↻</button>
          <button onClick={handlePopOut} className="workspace-tool-btn hidden sm:flex" title="Open Neko">↗</button>
          <button onClick={handleFullscreen} className="workspace-tool-btn">{isFullscreen ? '⊡' : '⛶'}</button>
          <button onClick={() => setSidebarOpen((o) => !o)} className="workspace-tool-btn">{sidebarOpen ? '⟩' : '⟨'}</button>
        </div>
      </header>

      <div className="workspace-stream-body flex flex-1 min-h-0">
        <div ref={streamContainerRef} className={`workspace-stream-viewport flex-1 relative min-w-0 ${isFullscreen ? 'bg-black' : ''}`}>
          {!streamReady && !streamError && (
            <div className="workspace-stream-overlay">
              <div className="nova-spinner mb-4" />
              <p className="text-sm font-medium">Connecting to Neko Firefox...</p>
              <p className="text-xs text-readable-subtle mt-1">WebRTC stream · Workspace {workspaceId}</p>
            </div>
          )}
          {streamError && (
            <div className="workspace-stream-overlay">
              <span className="text-4xl mb-3">🦊</span>
              <p className="text-sm font-medium mb-1">Neko stream delayed</p>
              <p className="text-xs text-readable-subtle mb-4 text-center max-w-sm">
                Container may be paused. Unpause Neko or open the stream directly.
              </p>
              <div className="flex gap-2">
                <button onClick={handleRefresh} className="btn-primary px-4 py-2 rounded-xl text-xs text-white">Refresh</button>
                <button onClick={handlePopOut} className="glass px-4 py-2 rounded-xl text-xs">Open Neko</button>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={session.stream_url}
            className="workspace-stream-iframe w-full h-full border-0"
            allow="camera; microphone; clipboard-write; fullscreen; display-capture"
            title={session.workspace_name}
            onLoad={() => { setStreamReady(true); setStreamError(false); }}
          />
        </div>

        {sidebarOpen && (
          <aside className="workspace-stream-sidebar glass-dark border-l border-white/10 flex flex-col shrink-0">
            <div className="flex border-b border-white/10 overflow-x-auto">
              {([
                ['live', 'Live'],
                ['hours', 'Hours'],
                ['neko', 'Neko'],
                ['supervisor', 'Super'],
                ['people', 'Team'],
                ['chat', 'Chat'],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => { setSidebarTab(tab); if (tab === 'chat') openChat(); }}
                  className={`flex-1 min-w-[52px] py-3 text-[10px] font-medium whitespace-nowrap ${
                    sidebarTab === tab ? 'text-sky-300 border-b-2 border-sky-400' : 'text-readable-subtle'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {sidebarTab === 'live' && <WorkspaceLiveStatus live={liveStatus} />}
              {sidebarTab === 'hours' && (
                <WorkingHoursPanel
                  mine={myHours}
                  team={teamHours}
                  teamTotal={teamTotal}
                  sessionElapsed={sessionSeconds}
                  localToday={localToday}
                />
              )}
              {sidebarTab === 'neko' && (
                <NekoStatusPanel
                  neko={nekoHealth}
                  streamReady={streamReady}
                  onRefresh={handleRefresh}
                  onOpenNeko={handlePopOut}
                />
              )}
              {sidebarTab === 'supervisor' && (
                <SupervisorLiveTools workspaceId={Number(workspaceId)} compact />
              )}
              {sidebarTab === 'people' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <p className="text-[10px] text-readable-subtle uppercase tracking-wide px-1">
                    {presenceConnected ? 'Live presence' : 'Team'}
                  </p>
                  {participants.length === 0 ? (
                    <p className="text-xs text-readable-subtle text-center py-6">No one else online</p>
                  ) : (
                    participants.map((u) => <PresenceUserRow key={u.username} user={u} compact />)
                  )}
                </div>
              )}
              {sidebarTab === 'chat' && (
                <div className="flex-1 min-h-0 chat-embedded-wrapper">
                  <ChatPanel embedded />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}