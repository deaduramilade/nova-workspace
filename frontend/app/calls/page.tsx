'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageNav from '../../components/PageNav';
import { useCalls } from '../../contexts/CallContext';
import { CALL_TYPE_ICONS, CALL_TYPE_LABELS, CallLogEntry, CallType, OnlineUser } from '../../lib/callTypes';

type Tab = 'users' | 'ongoing' | 'received' | 'missed' | 'all';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(secs: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LogRow({ log, onJoin }: { log: CallLogEntry; onJoin?: () => void }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-lg shrink-0">
        {CALL_TYPE_ICONS[log.call_type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{log.title}</p>
        <p className="text-xs text-readable-subtle truncate">
          {log.initiator_name} · {log.participants.join(', ')}
        </p>
        <p className="text-[10px] text-readable-subtle mt-0.5">{formatTime(log.timestamp)}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
          log.status === 'missed' ? 'badge-busy' :
          log.status === 'ongoing' ? 'badge-active' : 'stat-pill'
        }`}>
          {log.status}
        </span>
        {log.duration_seconds != null && (
          <p className="text-[10px] text-readable-subtle mt-1">{formatDuration(log.duration_seconds)}</p>
        )}
      </div>
      {onJoin && log.status === 'ongoing' && (
        <button onClick={onJoin} className="btn-primary px-3 py-1.5 rounded-lg text-xs text-white">Join</button>
      )}
    </div>
  );
}

function UserRow({ user, onCall }: { user: OnlineUser; onCall: (type: CallType) => void }) {
  const statusColor = user.status === 'online' ? 'bg-emerald-400' : user.status === 'in_call' ? 'bg-sky-400' : 'bg-amber-400';
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-xs font-semibold">
          {user.display_name.split(' ').map((n) => n[0]).join('')}
        </div>
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${statusColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.display_name}</p>
        <p className="text-xs text-readable-subtle capitalize">{user.status.replace('_', ' ')}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {(['1on1', 'meeting'] as CallType[]).map((type) => (
          <button
            key={type}
            onClick={() => onCall(type)}
            disabled={user.status === 'in_call'}
            className="glass px-2.5 py-1.5 rounded-lg text-[10px] font-medium hover:bg-white/5 disabled:opacity-40"
            title={CALL_TYPE_LABELS[type]}
          >
            {CALL_TYPE_ICONS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const {
    connected, onlineUsers, callLogs, activeCalls,
    initiateCall, joinCall, authenticated,
  } = useCalls();
  const [tab, setTab] = useState<Tab>('users');
  const [callType, setCallType] = useState<CallType>('group');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const missed = useMemo(() => callLogs.filter((l) => l.status === 'missed'), [callLogs]);
  const received = useMemo(() => callLogs.filter((l) => l.direction === 'incoming' && l.status !== 'missed'), [callLogs]);

  const handleCallUser = (user: OnlineUser, type: CallType) => {
    const names = { [user.username]: user.display_name };
    initiateCall(type, [user.username], `${CALL_TYPE_LABELS[type]} with ${user.display_name}`, names);
  };

  const handleGroupCall = () => {
    if (selectedUsers.length === 0) return;
    const names: Record<string, string> = {};
    selectedUsers.forEach((u) => {
      const found = onlineUsers.find((o) => o.username === u);
      if (found) names[u] = found.display_name;
    });
    initiateCall(callType, selectedUsers, `${CALL_TYPE_LABELS[callType]}`, names);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Call Users', count: onlineUsers.length },
    { id: 'ongoing', label: 'Ongoing', count: activeCalls.length },
    { id: 'received', label: 'Received', count: received.length },
    { id: 'missed', label: 'Missed', count: missed.length },
    { id: 'all', label: 'All Logs', count: callLogs.length },
  ];

  return (
    <div className="min-h-screen text-readable">
      <PageNav
        title="Calls & Meetings"
        status={{ label: connected ? 'Signaling live' : 'Reconnecting...', active: connected }}
      />

      <main className="pt-20 pb-12 px-6 lg:px-8 max-w-4xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Call Center</h2>
          <p className="text-readable-muted text-sm">
            1-on-1 calls, group calls, meetings, and live demo presentations.
          </p>
        </header>

        {!authenticated && (
          <div className="glass rounded-xl p-6 mb-6 text-center text-sm text-readable-muted">
            Sign in to make and receive real-time calls.
          </div>
        )}

        {/* Quick actions */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(['1on1', 'group', 'meeting', 'presentation'] as CallType[]).map((type) => (
            <button
              key={type}
              onClick={() => { setCallType(type); setTab('users'); }}
              className={`glass rounded-xl p-4 text-center hover:bg-white/5 transition-colors ${callType === type ? 'border border-sky-400/40' : ''}`}
            >
              <span className="text-2xl block mb-2">{CALL_TYPE_ICONS[type]}</span>
              <span className="text-xs font-medium">{CALL_TYPE_LABELS[type]}</span>
            </button>
          ))}
        </section>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300' : 'glass text-readable-muted'
              }`}
            >
              {t.label}{t.count != null ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3">Start {CALL_TYPE_LABELS[callType]}</h3>
              <p className="text-xs text-readable-subtle mb-3">Select users then start:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {onlineUsers.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => setSelectedUsers((prev) =>
                      prev.includes(u.username) ? prev.filter((x) => x !== u.username) : [...prev, u.username]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedUsers.includes(u.username)
                        ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300'
                        : 'stat-pill'
                    }`}
                  >
                    {u.display_name}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGroupCall}
                disabled={selectedUsers.length === 0}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              >
                Start {CALL_TYPE_LABELS[callType]}
              </button>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-readable-muted uppercase tracking-wide">People to call</h3>
              {onlineUsers.map((u) => (
                <UserRow key={u.username} user={u} onCall={(type) => handleCallUser(u, type)} />
              ))}
            </div>
          </div>
        )}

        {tab === 'ongoing' && (
          <div className="space-y-3">
            {activeCalls.length === 0 && <p className="text-readable-subtle text-sm text-center py-8">No ongoing calls.</p>}
            {activeCalls.map((call) => (
              <div key={call.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{call.title}</p>
                  <p className="text-xs text-readable-subtle">{call.participants.map((p) => p.display_name).join(', ')}</p>
                </div>
                <button onClick={() => joinCall(call.id)} className="btn-primary px-4 py-2 rounded-xl text-xs text-white">
                  Join
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'received' && (
          <div className="space-y-3">
            {received.length === 0 && <p className="text-readable-subtle text-sm text-center py-8">No received calls.</p>}
            {received.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}

        {tab === 'missed' && (
          <div className="space-y-3">
            {missed.length === 0 && <p className="text-readable-subtle text-sm text-center py-8">No missed calls.</p>}
            {missed.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}

        {tab === 'all' && (
          <div className="space-y-3">
            {callLogs.length === 0 && <p className="text-readable-subtle text-sm text-center py-8">No call history yet.</p>}
            {callLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                onJoin={log.status === 'ongoing' ? () => router.push(`/calls/${log.call_id}`) : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}