'use client';

import React from 'react';
import { usePhase3 } from '../contexts/Phase3Context';
import { FEEDBACK_STYLES } from '../lib/supervisorTypes';

export default function SupervisorFeedbackToast() {
  const { incomingFeedback, markFeedbackRead, dismissFeedback } = usePhase3();

  if (incomingFeedback.length === 0) return null;

  return (
    <div className="supervisor-feedback-stack">
      {incomingFeedback.map((fb) => (
        <div
          key={fb.id}
          className={`supervisor-feedback-card glass border ${FEEDBACK_STYLES[fb.type]?.bg ?? 'border-white/10'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold capitalize ${FEEDBACK_STYLES[fb.type]?.color ?? ''}`}>
                {fb.type.replace('_', ' ')} from {fb.from}
              </p>
              <p className="text-sm text-readable mt-1">{fb.message}</p>
            </div>
            <button
              onClick={() => dismissFeedback(fb.id)}
              className="text-readable-subtle hover:text-readable text-xs shrink-0"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => markFeedbackRead(fb.id)}
            className="mt-2 text-[10px] text-sky-400 hover:text-sky-300"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}