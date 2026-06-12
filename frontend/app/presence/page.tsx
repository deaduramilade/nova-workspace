'use client';

import React, { useMemo, useState } from 'react';
import PageNav from '../../components/PageNav';
import PresenceUserRow from '../../components/PresenceUserRow';
import { usePresence } from '../../contexts/RealtimeContext';
import { STATUS_OPTIONS, STATUS_PRESETS } from '../../lib/presenceTypes';
import { presenceDotClass } from '../../lib/presenceUtils';

export default function PresencePage() {
  const {
    connected, networkOnline, presenceDirectory, onlineUsers, offlineUsers,
    myPresence, presenceStats, setPresence, setStatusMessage, authenticated,
  } = usePresence();
  const [statusMessage, setStatusMessageInput] = useState(myPresence?.status_message ?? '');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const filtered = useMemo(() => {
    if (filter === 'online') return onlineUsers;
    if (filter === 'offline') return offlineUsers;
    return presenceDirectory;
  }, [filter, presenceDirectory, onlineUsers, offlineUsers]);

  const connectionLabel = !networkOnline
    ? 'You are offline'
    : connected
      ? 'Enhanced presence live'
      : 'Reconnecting...';

  return (
    <div className="min-h-screen text-readable">
      <PageNav title="Team Presence" status={{ label: connectionLabel, active: connected && networkOnline }} />

      <main className="pt-20 pb-12 px-6 lg:px-8 max-w-4xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Enhanced Real-Time Presence</h2>
          <p className="text-readable-muted text-sm">
            Live online/offline status, custom messages, auto-away, and heartbeat sync across the workspace.
          </p>
        </header>

        {!networkOnline && (
          <div className="presence-offline-banner rounded-xl p-4 mb-6 text-sm">
            You are offline. Presence updates pause until your connection returns.
          </div>
        )}

        {presenceStats && (
          <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
              { label: 'Online', value: presenceStats.online, color: 'text-emerald-300' },
              { label: 'Offline', value: presenceStats.offline, color: 'text-slate-400' },
              { label: 'Busy', value: presenceStats.busy, color: 'text-amber-300' },
              { label: 'In Call', value: presenceStats.in_call, color: 'text-sky-300' },
              { label: 'Away', value: presenceStats.away, color: 'text-violet-300' },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-readable-subtle mt-1">{s.label}</p>
              </div>
            ))}
          </section>
        )}

        {authenticated && myPresence && (
          <section className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-3 h-3 rounded-full ${presenceDotClass(myPresence.status, myPresence.is_online)}`} />
              <h3 className="text-sm font-semibold">Your Status</h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPresence(opt.value)}
                  disabled={myPresence.status === 'in_call'}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    myPresence.status === opt.value
                      ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300'
                      : 'stat-pill'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            <input
              value={statusMessage}
              onChange={(e) => setStatusMessageInput(e.target.value)}
              placeholder="Custom status message..."
              className="w-full text-sm px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/40 mb-3"
              maxLength={120}
            />
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setStatusMessageInput(p)}
                  className="text-xs px-3 py-1.5 rounded-lg stat-pill"
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusMessage(statusMessage)}
              className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            >
              Update Status Message
            </button>
          </section>
        )}

        <div className="flex gap-2 mb-6">
          {(['all', 'online', 'offline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                filter === f ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300' : 'glass text-readable-muted'
              }`}
            >
              {f}{f === 'all' ? ` (${presenceDirectory.length})` : f === 'online' ? ` (${onlineUsers.length})` : ` (${offlineUsers.length})`}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-readable-subtle text-sm text-center py-8">No users match this filter.</p>
          )}
          {filtered.map((u) => (
            <PresenceUserRow key={u.username} user={u} />
          ))}
        </div>
      </main>
    </div>
  );
}