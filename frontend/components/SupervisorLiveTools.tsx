'use client';

import React, { useState } from 'react';
import { usePhase3 } from '../contexts/Phase3Context';
import { usePresence } from '../contexts/RealtimeContext';
import { FEEDBACK_STYLES } from '../lib/supervisorTypes';

interface SupervisorLiveToolsProps {
  workspaceId?: number;
  compact?: boolean;
}

export default function SupervisorLiveTools({ workspaceId, compact }: SupervisorLiveToolsProps) {
  const {
    feedbackTools, isSupervisor, sendFeedback, recentFeedback, overview,
  } = usePhase3();
  const { onlineUsers } = usePresence();

  const [selectedType, setSelectedType] = useState('nudge');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('');
  const [sending, setSending] = useState(false);

  const tools = feedbackTools.length > 0 ? feedbackTools : [
    { type: 'nudge', label: 'Nudge', icon: '👋', description: 'Gentle reminder' },
    { type: 'praise', label: 'Praise', icon: '⭐', description: 'Recognize work' },
    { type: 'flag', label: 'Flag', icon: '🚩', description: 'Flag concern' },
    { type: 'broadcast', label: 'Broadcast', icon: '📢', description: 'Team message' },
    { type: 'check_in', label: 'Check-in', icon: '✅', description: 'Status request' },
  ];

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    await sendFeedback(selectedType, message.trim(), target || undefined);
    setMessage('');
    setSending(false);
  };

  const quickMessages: Record<string, string> = {
    nudge: 'Please refocus on the current task.',
    praise: 'Great work on this session — keep it up!',
    flag: 'Needs attention — please check in when you can.',
    broadcast: 'Team update: please review the shared workspace.',
    check_in: 'Quick check-in — share your current status.',
  };

  return (
    <div className={`space-y-4 ${compact ? 'p-3' : 'p-4'}`}>
      {!compact && overview && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(overview.integrations ?? {}).map(([key, val]) => (
            <div key={key} className="glass rounded-lg px-3 py-2">
              <p className="text-[9px] text-readable-subtle uppercase">{key.replace('_', ' ')}</p>
              <p className={`text-xs font-medium capitalize ${
                val.status === 'connected' || val.status === 'ready' || val.status === 'active'
                  ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {val.status as string}
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Live feedback tools</p>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <button
              key={tool.type}
              onClick={() => {
                setSelectedType(tool.type);
                if (!message) setMessage(quickMessages[tool.type] ?? '');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                selectedType === tool.type
                  ? FEEDBACK_STYLES[tool.type]?.bg ?? 'bg-sky-500/10 border-sky-400/30'
                  : 'glass border-white/10'
              }`}
              title={tool.description}
            >
              {tool.icon} {tool.label}
            </button>
          ))}
        </div>
      </div>

      {selectedType !== 'broadcast' && (
        <div>
          <label className="text-[10px] text-readable-subtle">Target (optional)</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full mt-1 glass rounded-lg px-3 py-2 text-xs bg-transparent border border-white/10"
          >
            <option value="">All online teammates</option>
            {onlineUsers.map((u) => (
              <option key={u.username} value={u.username}>{u.display_name || u.username}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-[10px] text-readable-subtle">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder={quickMessages[selectedType]}
          className="w-full mt-1 glass rounded-xl px-3 py-2 text-xs bg-transparent border border-white/10 resize-none"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="w-full btn-primary py-2.5 rounded-xl text-xs font-medium text-white disabled:opacity-50"
      >
        {sending ? 'Sending...' : `Send ${selectedType}`}
      </button>

      {!isSupervisor && (
        <p className="text-[10px] text-readable-subtle text-center">
          Demo mode — feedback tools available to all users
        </p>
      )}

      {recentFeedback.length > 0 && (
        <div>
          <p className="text-[10px] text-readable-subtle uppercase tracking-wide mb-2">Recent feedback</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentFeedback.slice(0, 5).map((fb) => (
              <div
                key={fb.id}
                className={`glass rounded-lg px-3 py-2 border text-[10px] ${
                  FEEDBACK_STYLES[fb.type]?.bg ?? 'border-white/10'
                }`}
              >
                <span className={FEEDBACK_STYLES[fb.type]?.color ?? 'text-readable'}>
                  {fb.type}
                </span>
                <span className="text-readable-subtle"> · {fb.from}</span>
                <p className="text-readable mt-0.5 truncate">{fb.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {workspaceId && (
        <p className="text-[9px] text-readable-subtle text-center">
          Workspace {workspaceId} · Phase 3 live oversight
        </p>
      )}
    </div>
  );
}