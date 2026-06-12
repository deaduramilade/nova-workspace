'use client';

import React from 'react';
import { LiveStatusPayload, QUALITY_COLORS } from '../lib/workspaceTypes';
import { presenceDotClass } from '../lib/presenceUtils';

interface WorkspaceLiveStatusProps {
  live: LiveStatusPayload | null;
}

export default function WorkspaceLiveStatus({ live }: WorkspaceLiveStatusProps) {
  if (!live) {
    return <p className="text-xs text-readable-subtle text-center py-8">Loading live status...</p>;
  }

  const updatedLabel = new Date(live.updated_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-readable-subtle uppercase tracking-wide">Team pulse</p>
        <span className="text-[9px] text-emerald-400/80 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {updatedLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Online', value: live.summary.online, color: 'text-emerald-400' },
          { label: 'In workspace', value: live.summary.in_workspace, color: 'text-sky-400' },
          { label: 'In Neko', value: live.summary.in_neko_stream, color: 'text-violet-400' },
          { label: 'In meeting', value: live.summary.in_meeting, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-lg p-2.5 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-readable-subtle">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-readable-subtle uppercase tracking-wide px-1">Live activity</p>

      {live.members.map((m) => (
        <div
          key={m.username}
          className={`glass rounded-xl p-3 flex items-center gap-3 transition-opacity ${
            m.is_self ? 'ring-1 ring-sky-400/40 bg-sky-500/5' : ''
          } ${!m.is_online ? 'opacity-60' : ''}`}
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400/80 to-indigo-500/80 flex items-center justify-center text-[10px] font-semibold">
              {m.display_name.split(' ').map((n) => n[0]).join('')}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
              m.is_online ? presenceDotClass('online', true) : presenceDotClass('offline', false)
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {m.display_name}{m.is_self ? ' (you)' : ''}
            </p>
            <p className="text-[10px] text-readable-subtle truncate">
              {m.activity.icon} {m.status_message || m.activity.label}
            </p>
            {m.in_neko && m.workspace_id && (
              <p className="text-[9px] text-violet-300 mt-0.5">🦊 Active in Neko stream</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className={`text-[9px] capitalize ${QUALITY_COLORS[m.stream_quality] ?? ''}`}>
              {m.stream_quality}
            </span>
            {m.latency_ms != null && (
              <p className="text-[9px] text-readable-subtle">{m.latency_ms}ms</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}