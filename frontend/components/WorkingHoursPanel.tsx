'use client';

import React from 'react';
import { TeamHoursMember, WorkingHoursStatus } from '../lib/workspaceTypes';
import { formatHoursDecimal, formatHoursMinutes } from '../lib/workingHours';

interface WorkingHoursPanelProps {
  mine: WorkingHoursStatus | null;
  team: TeamHoursMember[];
  teamTotal: number;
  sessionElapsed: number;
  localToday: number;
}

function HoursBar({ seconds, max, label }: { seconds: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (seconds / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="truncate">{label}</span>
        <span className="text-readable-subtle shrink-0 ml-2">{formatHoursDecimal(seconds)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function WorkingHoursPanel({
  mine, team, teamTotal, sessionElapsed, localToday,
}: WorkingHoursPanelProps) {
  const maxTeam = Math.max(...team.map((t) => t.today_seconds), 1);
  const todayTotal = Math.max(mine?.today_seconds ?? 0, localToday);

  return (
    <div className="p-4 space-y-4">
      <div className="glass rounded-xl p-4 card-accent card-accent-sky">
        <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Your session</p>
        <p className="text-2xl font-bold text-sky-300">{formatHoursMinutes(sessionElapsed)}</p>
        <p className="text-xs text-readable-subtle mt-1">
          Today total: <span className="text-readable font-medium">{formatHoursDecimal(todayTotal)}</span>
        </p>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[10px] text-readable-subtle uppercase tracking-wide">Team today</p>
          <span className="text-sm font-semibold text-emerald-400">{formatHoursDecimal(teamTotal)}</span>
        </div>
        <div className="space-y-3">
          {team.map((member) => (
            <HoursBar
              key={member.username}
              seconds={member.today_seconds}
              max={maxTeam}
              label={`${member.display_name}${member.active_in_workspace ? ' · here' : ''}${member.simulated ? ' · demo' : ''}`}
            />
          ))}
        </div>
      </div>

      <p className="text-[10px] text-readable-subtle text-center">
        Hours tracked while workspace stream is active
      </p>
    </div>
  );
}