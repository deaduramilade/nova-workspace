'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePresence } from '../contexts/RealtimeContext';
import { STATUS_OPTIONS, STATUS_PRESETS } from '../lib/presenceTypes';
import { presenceDotClass } from '../lib/presenceUtils';

export default function PresenceStatusBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    authenticated, myPresence, connected, networkOnline,
    setPresence, setStatusMessage, presenceStats,
  } = usePresence();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (pathname === '/login' || pathname === '/register' || !authenticated) return null;

  const status = myPresence?.status ?? 'offline';
  const isOnline = myPresence?.is_online ?? false;

  return (
    <div className="presence-status-bar">
      <button
        onClick={() => setOpen((o) => !o)}
        className="presence-status-trigger glass"
        aria-label="Your presence status"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${presenceDotClass(status, isOnline && networkOnline)}`} />
        <span className="text-xs font-medium truncate max-w-[120px]">
          {!networkOnline ? 'Offline' : myPresence?.status_message || status}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      </button>

      {open && (
        <div className="presence-status-menu glass-dark">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold">Your Presence</p>
            {presenceStats && (
              <p className="text-[10px] text-readable-subtle mt-0.5">
                Team: {presenceStats.online} online · {presenceStats.offline} offline
              </p>
            )}
          </div>

          <div className="p-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPresence(opt.value)}
                disabled={status === 'in_call'}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  status === opt.value ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300' : 'stat-pill'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          <div className="px-3 pb-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Set a status message..."
              className="w-full text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/40"
              maxLength={120}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setMessage(preset); setStatusMessage(preset); }}
                  className="text-[10px] px-2 py-1 rounded-md stat-pill"
                >
                  {preset}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusMessage(message)}
              className="mt-2 w-full text-xs py-2 rounded-lg btn-primary text-white font-medium"
            >
              Save status message
            </button>
          </div>

          <button
            onClick={() => { router.push('/presence'); setOpen(false); }}
            className="w-full px-4 py-3 text-xs text-sky-300 border-t border-white/10 hover:bg-white/5"
          >
            Open Team Presence Hub →
          </button>
        </div>
      )}
    </div>
  );
}