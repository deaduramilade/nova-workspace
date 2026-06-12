'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../../components/PageNav';
import { BreakoutRoom, getBreakoutRoom, parseDurationMinutes } from '../../../lib/breakoutRooms';

const MOCK_MESSAGES = [
  { user: 'John Doe', text: 'Ready to discuss the sprint goals?', time: '2m ago' },
  { user: 'Alice Smith', text: 'I have the design mockups to share.', time: '1m ago' },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BreakoutRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [room, setRoom] = useState<BreakoutRoom | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getBreakoutRoom(roomId);
    if (!stored) {
      setLoading(false);
      return;
    }
    setRoom(stored);
    setTimeLeft(parseDurationMinutes(stored.duration) * 60);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && room) {
      toast('Session time ended', { icon: '⏱' });
    }
  }, [timeLeft, room]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setMessages((prev) => [
      ...prev,
      { user: 'You', text: message.trim(), time: 'Just now' },
    ]);
    setMessage('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="nova-spinner" />
        <p className="text-readable-muted text-sm">Loading breakout room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen text-readable">
        <PageNav title="Breakout Room" subtitle="Room not found" status={{ label: 'Unavailable', active: false }} />
        <div className="pt-24 flex items-center justify-center p-8">
          <div className="glass rounded-2xl p-10 max-w-md text-center">
            <h2 className="text-xl font-semibold mb-2">Room not found</h2>
            <p className="text-readable-muted text-sm mb-6">
              This breakout room doesn&apos;t exist or has expired. Create a new one from the dashboard.
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium text-white"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-readable">
      <Toaster position="top-center" />
      <PageNav
        title={room.name}
        status={{ label: timeLeft > 0 ? `${formatTime(timeLeft)} remaining` : 'Session ended', active: timeLeft > 0 }}
      />

      <main className="pt-20 pb-8 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-readable-muted text-sm">{room.topic}</p>
            <p className="text-xs text-readable-subtle mt-1 font-mono">{room.id}</p>
          </div>
          <div className="flex gap-3">
            <span className="badge-active px-3 py-1 rounded-full text-xs font-medium">
              {room.members.length} members
            </span>
            <span className="stat-pill px-3 py-1 rounded-full text-xs">{room.duration} session</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main collaboration area */}
          <div className="lg:col-span-2 space-y-6">
            <section className="glass rounded-2xl p-6 min-h-[320px]">
              <h3 className="text-sm font-semibold mb-4 text-readable-muted uppercase tracking-wide">
                Discussion Space
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {room.members.slice(0, 6).map((member) => (
                  <div key={member} className="stat-pill rounded-xl p-4 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-sm font-semibold">
                      {member.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <p className="text-sm font-medium truncate">{member}</p>
                    <p className="text-[10px] text-emerald-400 mt-1">Connected</p>
                  </div>
                ))}
              </div>
              <div className="glass-dark rounded-xl p-8 text-center border border-dashed border-white/10">
                <p className="text-readable-muted text-sm">
                  Video & screen-share stream connects here when the streaming backend is available.
                </p>
              </div>
            </section>

            {/* Chat */}
            <section className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-4 text-readable-muted uppercase tracking-wide">Team Chat</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-full flex items-center justify-center text-[10px] font-semibold">
                      {msg.user.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{msg.user}</span>
                        <span className="text-[10px] text-readable-subtle">{msg.time}</span>
                      </div>
                      <p className="text-sm text-readable-muted">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-sm"
                />
                <button type="submit" className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium text-white">
                  Send
                </button>
              </form>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-4">Session Timer</h3>
              <p className="text-4xl font-mono font-semibold text-center mb-2">
                {formatTime(Math.max(0, timeLeft))}
              </p>
              <p className="text-xs text-readable-subtle text-center">
                {timeLeft > 0 ? 'Time remaining in this breakout' : 'Session complete'}
              </p>
            </section>

            <section className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-4">Participants</h3>
              <div className="space-y-2">
                {room.members.map((member) => (
                  <div key={member} className="flex items-center gap-3 p-2 rounded-lg stat-pill">
                    <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-[10px] font-semibold">
                      {member.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <span className="text-sm">{member}</span>
                    <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                ))}
              </div>
            </section>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 glass rounded-xl text-sm font-medium hover:bg-white/5 border border-amber-500/20 text-amber-300"
            >
              Leave Room
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}