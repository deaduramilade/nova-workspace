'use client';

import React from 'react';
import { useCalls } from '../contexts/CallContext';
import { CALL_TYPE_LABELS, CALL_TYPE_ICONS } from '../lib/callTypes';

export default function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useCalls();

  if (!incomingCall) return null;

  return (
    <div className="modal-overlay z-[70]">
      <div className="glass card-accent card-accent-sky rounded-2xl p-8 w-full max-w-sm mx-4 text-center animate-pulse-slow">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-3xl call-ring-animation">
          {CALL_TYPE_ICONS[incomingCall.call_type]}
        </div>
        <p className="text-xs text-readable-subtle uppercase tracking-wide mb-1">Incoming {CALL_TYPE_LABELS[incomingCall.call_type]}</p>
        <h3 className="text-xl font-semibold mb-1">{incomingCall.host_name}</h3>
        <p className="text-sm text-readable-muted mb-6">{incomingCall.title}</p>
        <div className="flex gap-3">
          <button
            onClick={() => rejectCall(incomingCall.id)}
            className="flex-1 py-3 glass rounded-xl text-sm font-medium border border-rose-500/30 text-rose-300"
          >
            Decline
          </button>
          <button
            onClick={() => acceptCall(incomingCall.id)}
            className="flex-1 py-3 btn-primary rounded-xl text-sm font-semibold text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}