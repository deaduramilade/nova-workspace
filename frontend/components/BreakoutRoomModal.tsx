'use client';

import React, { useState } from 'react';

interface OnlineUser {
  name: string;
  status: string;
  location: string;
}

interface BreakoutRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsers: OnlineUser[];
  onRoomCreated?: (room: { id: string; name: string; members: string[] }) => void;
}

const DURATIONS = ['15 min', '30 min', '45 min', '60 min'];

function generateRoomId() {
  return `br-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BreakoutRoomModal({
  isOpen,
  onClose,
  onlineUsers,
  onRoomCreated,
}: BreakoutRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('30 min');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; name: string; members: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleMember = (name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleCreate = () => {
    if (!roomName.trim()) return;
    const room = {
      id: generateRoomId(),
      name: roomName.trim(),
      members: selectedMembers.length > 0 ? selectedMembers : onlineUsers.map((u) => u.name),
    };
    setCreatedRoom(room);
    onRoomCreated?.(room);
  };

  const handleClose = () => {
    setRoomName('');
    setTopic('');
    setDuration('30 min');
    setSelectedMembers([]);
    setCreatedRoom(null);
    setCopied(false);
    onClose();
  };

  const copyLink = () => {
    if (!createdRoom) return;
    const link = `${window.location.origin}/workspace/breakout-${createdRoom.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="glass card-accent card-accent-sky rounded-2xl p-7 w-full max-w-lg mx-4 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-readable-subtle hover:text-readable transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {!createdRoom ? (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 mb-3 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-xl">
                🚪
              </div>
              <h3 className="text-xl font-semibold">Create Breakout Room</h3>
              <p className="text-readable-muted text-sm mt-1">
                Spin up a focused space for team discussion and planning
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-readable-muted uppercase tracking-wide mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Sprint Planning"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-sm text-readable placeholder:text-readable-subtle"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-readable-muted uppercase tracking-wide mb-1.5">
                  Topic / Purpose
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What will this room focus on?"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-sm text-readable placeholder:text-readable-subtle"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-readable-muted uppercase tracking-wide mb-1.5">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        duration === d
                          ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300'
                          : 'stat-pill text-readable-muted hover:bg-white/5'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-readable-muted uppercase tracking-wide mb-2">
                  Invite Members ({selectedMembers.length || 'all'} selected)
                </label>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {onlineUsers.map((user) => (
                    <label
                      key={user.name}
                      className="flex items-center gap-3 p-2.5 rounded-lg stat-pill cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(user.name)}
                        onChange={() => toggleMember(user.name)}
                        className="w-4 h-4 rounded accent-sky-400"
                      />
                      <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {user.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-[11px] text-readable-subtle">{user.location}</p>
                      </div>
                      <span className="text-[10px] badge-active px-2 py-0.5 rounded-full shrink-0">
                        {user.status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 glass rounded-xl text-sm font-medium hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!roomName.trim()}
                className="flex-1 py-2.5 btn-primary rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              >
                Create Room
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl">
              ✓
            </div>
            <h3 className="text-xl font-semibold mb-1">Room Created</h3>
            <p className="text-readable-muted text-sm mb-6">
              <span className="text-sky-300 font-medium">{createdRoom.name}</span> is ready for your team
            </p>

            <div className="stat-pill rounded-xl p-4 mb-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-readable-subtle">Room ID</span>
                <span className="font-mono text-sky-300">{createdRoom.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-readable-subtle">Duration</span>
                <span>{duration}</span>
              </div>
              <div className="text-sm">
                <span className="text-readable-subtle">Members: </span>
                <span>{createdRoom.members.join(', ')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 py-2.5 glass rounded-xl text-sm font-medium hover:bg-white/5"
              >
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 btn-primary rounded-xl text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}