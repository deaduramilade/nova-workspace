'use client';

import React from 'react';
import { usePhase3 } from '../contexts/Phase3Context';

export default function OfflineSyncBar() {
  const { syncStatus, syncNow, crdtState } = usePhase3();

  if (!syncStatus.offline && syncStatus.pending === 0 && !syncStatus.syncing) return null;

  return (
    <div className={`offline-sync-bar ${syncStatus.offline ? 'offline-sync-bar-offline' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          syncStatus.offline ? 'bg-amber-400' : syncStatus.syncing ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'
        }`} />
        <p className="text-xs truncate">
          {syncStatus.offline
            ? `Offline — ${syncStatus.pending} change${syncStatus.pending !== 1 ? 's' : ''} queued (CRDT)`
            : syncStatus.syncing
              ? 'Syncing offline changes...'
              : `${syncStatus.pending} pending sync`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {crdtState && (
          <span className="text-[10px] text-readable-subtle">v{crdtState.version}</span>
        )}
        {!syncStatus.offline && (
          <button
            onClick={syncNow}
            className="text-[10px] text-sky-400 hover:text-sky-300 font-medium"
          >
            Sync now
          </button>
        )}
      </div>
    </div>
  );
}