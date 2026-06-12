'use client';

import React from 'react';
import { CALL_TYPE_ICONS, CALL_TYPE_LABELS, CallType } from '../lib/callTypes';
import { PresenceUser } from '../lib/presenceTypes';
import { canCallUser, formatLastSeen, presenceDotClass, presenceStatusLabel } from '../lib/presenceUtils';

interface PresenceUserRowProps {
  user: PresenceUser;
  onCall?: (type: CallType) => void;
  compact?: boolean;
}

export default function PresenceUserRow({ user, onCall, compact }: PresenceUserRowProps) {
  const callable = canCallUser(user);

  return (
    <div className={`glass rounded-xl p-4 flex items-center gap-3 ${!user.is_online ? 'opacity-70' : ''}`}>
      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${
          user.is_online
            ? 'bg-gradient-to-br from-sky-400 to-purple-500'
            : 'bg-slate-700/80 border border-white/10'
        }`}>
          {user.display_name.split(' ').map((n) => n[0]).join('')}
        </div>
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${presenceDotClass(user.status, user.is_online)}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.display_name}</p>
        <p className="text-xs text-readable-subtle capitalize">
          {presenceStatusLabel(user)}
          {!user.is_online && user.last_seen ? ` · ${formatLastSeen(user.last_seen)}` : ''}
        </p>
      </div>
      {onCall && !compact && (
        <div className="flex gap-1.5 shrink-0">
          {(['1on1', 'meeting'] as CallType[]).map((type) => (
            <button
              key={type}
              onClick={() => onCall(type)}
              disabled={!callable}
              className="glass px-2.5 py-1.5 rounded-lg text-[10px] font-medium hover:bg-white/5 disabled:opacity-40"
              title={callable ? CALL_TYPE_LABELS[type] : user.is_online ? 'User unavailable' : 'User is offline'}
            >
              {CALL_TYPE_ICONS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}