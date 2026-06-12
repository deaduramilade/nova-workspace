'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import ChatPanel from '../../../components/ChatPanel';
import PresenceUserRow from '../../../components/PresenceUserRow';
import { useChat } from '../../../contexts/ChatContext';
import { usePresence } from '../../../contexts/RealtimeContext';
import { StreamingSession, WORKSPACE_FEATURES } from '../../../lib/workspaceTypes';
import { presenceDotClass } from '../../../lib/presenceUtils';

type SidebarTab = 'people' | 'chat' | 'info';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamReady, setStreamReady] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('people');
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { setRoomId, openChat } = useChat();
  const { onlineUsers, connected: presenceConnected, myPresence } = usePresence();

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError('');
    setStreamError(false);
    setStreamReady(false);

    try {
      const response = await axios.get(
        `http://localhost:8000/api/v1/streaming/join/${workspaceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSession(response.data);
      setRoomId(`workspace-${workspaceId}`);
    } catch {
      setError('Failed to connect to streaming session. Check that the backend and Neko are running.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, router, setRoomId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!session?.stream_url) return;
    const timeout = setTimeout(() => {
      if (!streamReady) setStreamError(true);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [session?.stream_url, streamReady]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    const el = streamContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && session?.stream_url) {
      setStreamReady(false);
      setStreamError(false);
      iframeRef.current.src = session.stream_url;
      toast.success('Stream refreshed');
    }
  };

  const handlePopOut = () => {
    if (session?.stream_url) window.open(session.stream_url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen text-readable flex flex-col items-center justify-center gap-6 p-8">
        <div className="nova-spinner" />
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Connecting to workspace stream</p>
          <p className="text-readable-muted text-sm">Authenticating · Resolving Neko session · Preparing browser</p>
        </div>
        <div className="workspace-connect-steps">
          {['Auth', 'Session', 'Stream'].map((step, i) => (
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
      <div className="min-h-screen text-readable">
        <div className="pt-24 flex items-center justify-center p-8">
          <div className="glass rounded-2xl p-10 max-w-lg text-center card-accent card-accent-sky">
            <span className="text-4xl mb-4 block">⚠</span>
            <h2 className="text-xl font-semibold mb-2">Stream unavailable</h2>
            <p className="text-readable-muted text-sm mb-6">{error || 'Could not load workspace session.'}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={loadSession} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium text-white">
                Retry connection
              </button>
              <button onClick={() => router.push('/')} className="glass px-6 py-2.5 rounded-xl text-sm font-medium">
                Back to Dashboard
              </button>
            </div>
            <p className="text-[11px] text-readable-subtle mt-6">
              Ensure Docker Neko is running: <code className="text-sky-300">docker unpause nova-neko</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const participants = onlineUsers.length > 0 ? onlineUsers : session.participants;

  return (
    <div className="workspace-stream-page min-h-screen text-readable flex flex-col">
      <Toaster position="top-center" />

      {/* Toolbar */}
      <header className="workspace-stream-toolbar glass border-b border-white/10 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="glass w-9 h-9 rounded-xl flex items-center justify-center text-sm hover:bg-white/5 shrink-0"
            title="Back to dashboard"
          >
            ←
          </button>
          <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
            N
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{session.workspace_name}</h1>
            <p className="text-[10px] text-readable-subtle flex items-center gap-2 flex-wrap">
              <span className={`flex items-center gap-1 ${streamReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${streamReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {streamReady ? 'Stream live' : streamError ? 'Stream delayed' : 'Connecting...'}
              </span>
              <span>·</span>
              <span>{formatElapsed(elapsed)}</span>
              <span>·</span>
              <span>{session.participant_count + (onlineUsers.length || 0)} viewing</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex badge-active text-[10px] px-2.5 py-1 rounded-full capitalize">
            {session.quality}
          </span>
          {myPresence && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] stat-pill px-2.5 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${presenceDotClass(myPresence.status, myPresence.is_online)}`} />
              You: {myPresence.status_message || myPresence.status}
            </span>
          )}
          <button onClick={handleRefresh} className="workspace-tool-btn" title="Refresh stream">↻</button>
          <button onClick={handlePopOut} className="workspace-tool-btn hidden sm:flex" title="Open in new tab">↗</button>
          <button onClick={handleFullscreen} className="workspace-tool-btn" title="Fullscreen">
            {isFullscreen ? '⊡' : '⛶'}
          </button>
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="workspace-tool-btn"
            title={sidebarOpen ? 'Hide panel' : 'Show panel'}
          >
            {sidebarOpen ? '⟩' : '⟨'}
          </button>
        </div>
      </header>

      <div className="workspace-stream-body flex flex-1 min-h-0">
        {/* Stream viewport */}
        <div
          ref={streamContainerRef}
          className={`workspace-stream-viewport flex-1 relative min-w-0 ${isFullscreen ? 'bg-black' : ''}`}
        >
          {!streamReady && !streamError && (
            <div className="workspace-stream-overlay">
              <div className="nova-spinner mb-4" />
              <p className="text-sm font-medium">Loading browser stream...</p>
              <p className="text-xs text-readable-subtle mt-1">Neko Firefox · Workspace {workspaceId}</p>
            </div>
          )}

          {streamError && (
            <div className="workspace-stream-overlay">
              <span className="text-4xl mb-3">🖥</span>
              <p className="text-sm font-medium mb-1">Stream taking longer than expected</p>
              <p className="text-xs text-readable-subtle mb-4 text-center max-w-sm">
                Neko may still be starting. You can wait, refresh, or open the stream directly.
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

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="workspace-stream-sidebar glass-dark border-l border-white/10 flex flex-col shrink-0">
            <div className="flex border-b border-white/10">
              {([
                ['people', `People (${participants.length})`],
                ['chat', 'Chat'],
                ['info', 'Session'],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => {
                    setSidebarTab(tab);
                    if (tab === 'chat') openChat();
                  }}
                  className={`flex-1 py-3 text-[11px] font-medium transition-colors ${
                    sidebarTab === tab
                      ? 'text-sky-300 border-b-2 border-sky-400'
                      : 'text-readable-subtle hover:text-readable'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {sidebarTab === 'people' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <p className="text-[10px] text-readable-subtle uppercase tracking-wide px-1 mb-2">
                    {presenceConnected ? 'Live presence' : 'Team members'}
                  </p>
                  {participants.length === 0 ? (
                    <p className="text-xs text-readable-subtle text-center py-6">No one else online yet</p>
                  ) : (
                    participants.map((u) => (
                      <PresenceUserRow key={u.username} user={u} compact />
                    ))
                  )}
                  <button
                    onClick={() => router.push('/presence')}
                    className="w-full mt-4 glass py-2.5 rounded-xl text-xs font-medium hover:bg-white/5"
                  >
                    View full presence hub
                  </button>
                </div>
              )}

              {sidebarTab === 'chat' && (
                <div className="flex-1 min-h-0 chat-embedded-wrapper">
                  <ChatPanel embedded />
                </div>
              )}

              {sidebarTab === 'info' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Session</p>
                    <div className="glass rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-readable-subtle">ID</span><span className="font-mono text-[10px]">{session.session_id}</span></div>
                      <div className="flex justify-between"><span className="text-readable-subtle">Host</span><span>{session.host}</span></div>
                      <div className="flex justify-between"><span className="text-readable-subtle">Status</span><span className="capitalize badge-active px-2 py-0.5 rounded-full text-[10px]">{session.workspace_status}</span></div>
                      <div className="flex justify-between"><span className="text-readable-subtle">Quality</span><span className="capitalize">{session.quality}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Features</p>
                    <div className="flex flex-wrap gap-2">
                      {session.features.map((f) => {
                        const meta = WORKSPACE_FEATURES[f];
                        return (
                          <span key={f} className="stat-pill px-2.5 py-1.5 rounded-lg text-[10px]">
                            {meta?.icon} {meta?.label ?? f}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Quick actions</p>
                    <div className="space-y-2">
                      <button onClick={() => router.push('/calls')} className="w-full glass py-2.5 rounded-xl text-xs font-medium hover:bg-white/5">
                        Start a call
                      </button>
                      <button onClick={() => router.push('/team-game')} className="w-full glass py-2.5 rounded-xl text-xs font-medium hover:bg-white/5">
                        Team break game
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}