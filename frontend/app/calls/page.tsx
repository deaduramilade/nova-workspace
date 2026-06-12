'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageNav from '../../components/PageNav';
import PresenceUserRow from '../../components/PresenceUserRow';
import { useCalls } from '../../contexts/RealtimeContext';
import { CALL_TYPE_ICONS, CALL_TYPE_LABELS, CallLogEntry, CallType } from '../../lib/callTypes';
import { PresenceUser } from '../../lib/presenceTypes';
import { canCallUser } from '../../lib/presenceUtils';

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

export default function CallsPage() {
  const router = useRouter();
  const {
    connected, networkOnline, onlineUsers, offlineUsers, presenceDirectory,
    myPresence, callLogs, activeCalls,
    initiateCall, joinCall, setPresence, authenticated,
  } = useCalls();
  const [tab, setTab] = useState<Tab>('users');
  const [callType, setCallType] = useState<CallType>('group');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const missed = useMemo(() => callLogs.filter((l) => l.status === 'missed'), [callLogs]);
  const received = useMemo(() => callLogs.filter((l) => l.direction === 'incoming' && l.status !== 'missed'), [callLogs]);

  const selectableUsers = useMemo(
    () => presenceDirectory.filter((u) => canCallUser(u)),
    [presenceDirectory]
  );

  const handleCallUser = (user: PresenceUser, type: CallType) => {
    if (!canCallUser(user)) return;
    const names = { [user.username]: user.display_name };
    initiateCall(type, [user.username], `${CALL_TYPE_LABELS[type]} with ${user.display_name}`, names);
  };

  const handleGroupCall = () => {
    const callableSelected = selectedUsers.filter((u) => {
      const found = presenceDirectory.find((o) => o.username === u);
      return found && canCallUser(found);
    });
    if (callableSelected.length === 0) return;
    const names: Record<string, string> = {};
    callableSelected.forEach((u) => {
      const found = presenceDirectory.find((o) => o.username === u);
      if (found) names[u] = found.display_name;
    });
    initiateCall(callType, callableSelected, `${CALL_TYPE_LABELS[callType]}`, names);
  };

  const connectionLabel = !networkOnline
    ? 'You are offline'
    : connected
      ? `${onlineUsers.length} online · ${offlineUsers.length} offline`
      : 'Reconnecting...';

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Team Directory', count: presenceDirectory.length },
    { id: 'ongoing', label: 'Ongoing', count: activeCalls.length },
    { id: 'received', label: 'Received', count: received.length },
    { id: 'missed', label: 'Missed', count: missed.length },
    { id: 'all', label: 'All Logs', count: callLogs.length },
  ];

  return (
    <div className="min-h-screen text-readable">
      <PageNav
        title="Calls & Meetings"
        status={{ label: connectionLabel, active: connected && networkOnline }}
      />

      <main className="pt-20 pb-12 px-6 lg:px-8 max-w-4xl mx-auto">
        {!networkOnline && (
          <div className="glass rounded-xl p-4 mb-6 border border-amber-400/30 text-sm text-amber-200/90">
            You are offline. Calls and presence updates will resume when your connection returns.
          </div>
        )}

        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Call Center</h2>
          <p className="text-readable-muted text-sm">
            Real-time presence — see who is online, busy, in a call, or offline.
          </p>
        </header>

        {!authenticated && (
          <div className="glass rounded-xl p-6 mb-6 text-center text-sm text-readable-muted">
            Sign in to make and receive real-time calls.
          </div>
        )}

        {authenticated && myPresence && (
          <section className="glass rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
            <span className="text-xs text-readable-subtle">Your status:</span>
            {(['online', 'busy', 'away'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setPresence(status)}
                disabled={myPresence.status === 'in_call'}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  myPresence.status === status
                    ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300'
                    : 'stat-pill'
                }`}
              >
                {status}
              </button>
            ))}
          </section>
        )}

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

        {tab === 'users' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3">Start {CALL_TYPE_LABELS[callType]}</h3>
              <p className="text-xs text-readable-subtle mb-3">Select online users (offline users cannot be called):</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {presenceDirectory.map((u) => {
                  const callable = canCallUser(u);
                  return (
                    <button
                      key={u.username}
                      onClick={() => callable && setSelectedUsers((prev) =>
                        prev.includes(u.username) ? prev.filter((x) => x !== u.username) : [...prev, u.username]
                      )}
                      disabled={!callable}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedUsers.includes(u.username)
                          ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300'
                          : 'stat-pill'
                      } ${!callable ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {u.display_name}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleGroupCall}
                disabled={selectedUsers.filter((u) => selectableUsers.some((s) => s.username === u)).length === 0}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              >
                Start {CALL_TYPE_LABELS[callType]}
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-readable-muted uppercase tracking-wide">
                Online ({onlineUsers.length})
              </h3>
              {onlineUsers.length === 0 && (
                <p className="text-readable-subtle text-sm text-center py-4">No one else is online right now.</p>
              )}
              {onlineUsers.map((u) => (
                <PresenceUserRow key={u.username} user={u} onCall={(type) => handleCallUser(u, type)} />
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-readable-muted uppercase tracking-wide">
                Offline ({offlineUsers.length})
              </h3>
              {offlineUsers.length === 0 && (
                <p className="text-readable-subtle text-sm text-center py-4">Everyone in the directory is online.</p>
              )}
              {offlineUsers.map((u) => (
                <PresenceUserRow key={u.username} user={u} />
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