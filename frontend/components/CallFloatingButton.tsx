'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCalls } from '../contexts/CallContext';

export default function CallFloatingButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, callLogs, incomingCall, activeCalls } = useCalls();

  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/calls/')) {
    return null;
  }

  const missedCount = callLogs.filter((l) => l.status === 'missed').length;
  const ongoingCount = activeCalls.length;

  return (
    <div className="call-floating-root">
      <button
        onClick={() => router.push('/calls')}
        className={`call-fab ${incomingCall ? 'call-fab-pulse' : ''}`}
        aria-label="Open calls and meetings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>

        {missedCount > 0 && (
          <span className="call-fab-badge">{missedCount > 9 ? '9+' : missedCount}</span>
        )}

        {!missedCount && ongoingCount > 0 && (
          <span className="call-fab-badge">{ongoingCount}</span>
        )}

        <span className={`chat-fab-status ${connected ? 'chat-fab-status-live' : ''}`} />
      </button>
    </div>
  );
}