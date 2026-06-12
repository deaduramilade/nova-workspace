'use client';

import React from 'react';
import { NekoHealth } from '../lib/workspaceTypes';

interface NekoStatusPanelProps {
  neko: NekoHealth | null;
  streamReady: boolean;
  onRefresh: () => void;
  onOpenNeko: () => void;
}

export default function NekoStatusPanel({ neko, streamReady, onRefresh, onOpenNeko }: NekoStatusPanelProps) {
  const room = neko?.room;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦊</span>
          <div>
            <p className="text-sm font-semibold">Neko Firefox</p>
            <p className="text-[10px] text-readable-subtle">m1k1o/neko streaming</p>
          </div>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
          neko?.online ? 'badge-active' : 'badge-busy'
        }`}>
          {neko?.online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="glass rounded-xl p-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">Latency</p>
          <p className="font-semibold">{neko?.latency_ms != null ? `${neko.latency_ms}ms` : '—'}</p>
        </div>
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">Stream</p>
          <p className={`font-semibold ${streamReady ? 'text-emerald-400' : 'text-amber-400'}`}>
            {streamReady ? 'Live' : 'Loading'}
          </p>
        </div>
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">Bitrate</p>
          <p className="font-semibold">{room?.bitrate_kbps ? `${room.bitrate_kbps} kbps` : '—'}</p>
        </div>
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">FPS</p>
          <p className="font-semibold">{room?.fps ? `${room.fps}` : '—'}</p>
        </div>
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">Resolution</p>
          <p className="font-semibold">{room?.resolution ?? '—'}</p>
        </div>
        <div>
          <p className="text-readable-subtle text-[10px] mb-0.5">Viewers</p>
          <p className="font-semibold">{room ? `${room.viewers}/${room.max_viewers}` : '—'}</p>
        </div>
      </div>

      {neko?.room && (
        <div className="text-[10px] text-readable-subtle font-mono glass rounded-lg px-3 py-2">
          Room: {neko.room.room_id} · {neko.room.codec}
        </div>
      )}

      {!neko?.online && neko?.error && (
        <p className="text-[11px] text-amber-300/90 glass rounded-lg px-3 py-2">
          {neko.error}. Run: <code className="text-sky-300">docker unpause nova-neko</code>
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onRefresh} className="flex-1 glass py-2 rounded-xl text-xs font-medium hover:bg-white/5">
          Refresh stream
        </button>
        <button onClick={onOpenNeko} className="flex-1 btn-primary py-2 rounded-xl text-xs font-medium text-white">
          Open Neko
        </button>
      </div>
    </div>
  );
}