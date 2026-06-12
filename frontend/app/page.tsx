'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import BreakoutRoomModal, { BreakoutRoom } from '../components/BreakoutRoomModal';
import { getBreakoutRooms } from '../lib/breakoutRooms';

interface Workspace {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

const PROJECT_META = [
  { humans: 4, agents: 7, sessions: 12, accent: 'card-accent-sky' },
  { humans: 2, agents: 5, sessions: 8, accent: 'card-accent-emerald' },
  { humans: 6, agents: 9, sessions: 21, accent: 'card-accent-violet' },
  { humans: 3, agents: 4, sessions: 5, accent: 'card-accent-amber' },
];

const ONLINE_USERS = [
  { name: 'John Doe', status: 'Working', location: 'Workspace 1', hours: '6.5h', weather: '28°C Lagos' },
  { name: 'Alice Smith', status: 'In session', location: 'Workspace 2', hours: '4.2h', weather: '27°C Cloudy' },
  { name: 'Michael Chen', status: 'Available', location: 'Workspace 1', hours: '7.8h', weather: '29°C' },
];

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const badgeClass =
    normalized === 'active' ? 'badge-active' :
    normalized === 'busy' ? 'badge-busy' : 'badge-idle';

  return (
    <span className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${badgeClass}`}>
      {status}
    </span>
  );
}

export default function NovaDashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBreakTimer, setShowBreakTimer] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(45 * 60);
  const [showBreakoutModal, setShowBreakoutModal] = useState(false);
  const [activeBreakoutRooms, setActiveBreakoutRooms] = useState<BreakoutRoom[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      setLoading(false);
      return;
    }

    const fetchWorkspaces = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/workspaces/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWorkspaces(res.data);
      } catch {
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
    setActiveBreakoutRooms(getBreakoutRooms());
  }, []);

  // Break Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showBreakTimer && breakTimeLeft > 0) {
      timer = setInterval(() => {
        setBreakTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (breakTimeLeft === 0) {
      setShowBreakTimer(false);
      toast.success("Break time completed. Welcome back to work.");
    }
    return () => clearInterval(timer);
  }, [showBreakTimer, breakTimeLeft]);

  const startBreak = () => {
    setBreakTimeLeft(45 * 60);
    setShowBreakTimer(true);
  };

  const createBreakoutRoom = () => {
    setShowBreakoutModal(true);
  };

  const playLightGame = () => {
    router.push('/team-game');
  };

  const displayWorkspaces = workspaces.length > 0
    ? workspaces.map((ws, i) => ({
        ...ws,
        ...PROJECT_META[i % PROJECT_META.length],
      }))
    : [1, 2, 3].map((i) => ({
        id: i,
        name: `AI Agent Collaboration ${i}`,
        status: 'active',
        created_at: new Date().toISOString(),
        ...PROJECT_META[(i - 1) % PROJECT_META.length],
      }));

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="nova-spinner" />
        <p className="text-readable-muted text-sm">Loading your workspaces...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-readable">
      <Toaster position="top-center" />

      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10 lg:right-80">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg shadow-sky-500/20">
              N
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Nova Workspace</h1>
              <p className="text-xs text-readable-subtle">AI-Native Collaborative Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="btn-primary hidden sm:inline-flex px-5 py-2.5 rounded-xl text-sm font-medium text-white">
              New Workspace
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">Alex Rivera</div>
                <div className="text-xs text-readable-subtle">@arivera</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center font-semibold text-sm ring-2 ring-white/10">
                AR
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-6 lg:px-8 max-w-7xl mx-auto lg:mr-80">
        <header className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Welcome back, Alex
          </h2>
          <p className="text-lg text-readable-muted leading-relaxed">
            Pick up where you left off — your projects and sessions are ready.
          </p>
        </header>

        {/* Overview stats */}
        <section className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects', value: displayWorkspaces.length },
            { label: 'Team Online', value: '12' },
            { label: 'AI Agents', value: '24' },
            { label: 'Hours Today', value: '87.5' },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
              </div>
              <p className="text-sm text-readable-muted">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Supervisor panel */}
        <section className="mb-10 glass rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-semibold">Supervisor Oversight</h3>
            <span className="text-xs text-readable-subtle ml-auto">Live monitoring</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="stat-pill rounded-xl px-4 py-3">
              <p className="text-readable-subtle text-xs mb-1">Active Workspaces</p>
              <p className="font-semibold text-lg">{displayWorkspaces.length}</p>
            </div>
            <div className="stat-pill rounded-xl px-4 py-3">
              <p className="text-readable-subtle text-xs mb-1">Online Users</p>
              <p className="font-semibold text-lg">12</p>
            </div>
            <div className="stat-pill rounded-xl px-4 py-3">
              <p className="text-readable-subtle text-xs mb-1">Hours Tracked Today</p>
              <p className="font-semibold text-lg">87.5 hrs</p>
            </div>
          </div>
        </section>

        {/* Project cards */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Your Projects</h3>
            <span className="text-sm text-readable-subtle">{displayWorkspaces.length} workspaces</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayWorkspaces.map((project) => (
              <article
                key={project.id}
                className={`glass-card card-accent ${project.accent} rounded-2xl p-6 cursor-pointer group`}
                onClick={() => router.push(`/workspace/${project.id}`)}
              >
                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-lg shrink-0 group-hover:from-sky-500/30 group-hover:to-indigo-500/30 transition-colors">
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold leading-snug truncate">{project.name}</h4>
                      <p className="text-xs text-readable-subtle mt-0.5">
                        Updated {formatRelativeTime(project.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  <div className="stat-pill rounded-lg px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold leading-none">{project.humans}</p>
                    <p className="text-[11px] text-readable-subtle mt-1">Humans</p>
                  </div>
                  <div className="stat-pill rounded-lg px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold leading-none">{project.agents}</p>
                    <p className="text-[11px] text-readable-subtle mt-1">AI Agents</p>
                  </div>
                  <div className="stat-pill rounded-lg px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold leading-none">{project.sessions}</p>
                    <p className="text-[11px] text-readable-subtle mt-1">Sessions</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-readable-muted">Open workspace</span>
                  <span className="text-sky-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h3 className="text-lg font-semibold mb-5">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/workspace/1')}
              className="glass px-6 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Start New Session
            </button>
            <button
              onClick={createBreakoutRoom}
              className="glass px-6 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors border border-sky-400/30"
            >
              Create Breakout Room
            </button>
            <button
              onClick={startBreak}
              className="glass px-6 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Start Break (45 min)
            </button>
            <button 
              onClick={playLightGame}
              className="glass px-6 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Team Game (Break)
            </button>
            <button
              onClick={() => router.push('/calls')}
              className="glass px-6 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors border border-emerald-400/30"
            >
              Calls & Meetings
            </button>
          </div>
        </section>
      </main>

      {/* Online users sidebar */}
      <aside className="w-80 border-l border-white/10 glass-dark fixed right-0 top-0 bottom-0 overflow-auto hidden lg:block z-40">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 className="text-base font-semibold">Online Now</h3>
            <span className="text-xs text-readable-subtle ml-auto">{ONLINE_USERS.length} users</span>
          </div>

          <div className="space-y-3">
            {ONLINE_USERS.map((user) => (
              <div key={user.name} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center font-semibold text-xs shrink-0">
                  {user.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  <p className="text-xs text-readable-subtle truncate">{user.location}</p>
                  <p className="text-xs text-readable-subtle">Today: {user.hours}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 badge-active text-[10px] rounded-full mb-1">
                    {user.status}
                  </span>
                  <p className="text-[10px] text-readable-subtle">{user.weather}</p>
                </div>
              </div>
            ))}
          </div>

          {activeBreakoutRooms.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-readable-subtle uppercase tracking-wide mb-2">Active Breakout Rooms</p>
              <div className="space-y-2">
                {activeBreakoutRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/breakout-room/${room.id}`)}
                    className="w-full glass rounded-xl p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{room.name}</p>
                    <p className="text-[11px] text-readable-subtle truncate">{room.topic}</p>
                    <p className="text-[10px] text-sky-400 mt-1">{room.members.length} members · {room.duration}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowBreakoutModal(true)}
            className="mt-6 w-full glass py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors border border-sky-400/20"
          >
            Create Breakout Room
          </button>
        </div>
      </aside>

      {/* Break Timer Modal */}
      {showBreakTimer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="glass rounded-3xl p-12 text-center max-w-md">
            <h3 className="text-2xl font-semibold mb-4">Break Time</h3>
            <div className="text-6xl font-mono mb-8">
              {Math.floor(breakTimeLeft / 60)}:{(breakTimeLeft % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-readable-muted mb-8">Relax and recharge. Binaural audio is playing.</p>
            <button
              onClick={() => setShowBreakTimer(false)}
              className="glass px-8 py-3 rounded-2xl text-sm font-medium"
            >
              End Break Early
            </button>
          </div>
        </div>
      )}

      <BreakoutRoomModal
        isOpen={showBreakoutModal}
        onClose={() => setShowBreakoutModal(false)}
        onlineUsers={ONLINE_USERS}
        onRoomCreated={(room) => {
          setActiveBreakoutRooms(getBreakoutRooms());
          toast.success(`Breakout room "${room.name}" created`);
        }}
      />
    </div>
  );
}