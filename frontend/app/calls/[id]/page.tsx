'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCalls } from '../../../contexts/CallContext';
import { CALL_TYPE_ICONS, CALL_TYPE_LABELS } from '../../../lib/callTypes';

export default function ActiveCallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;
  const {
    currentCall, activeCalls, endCall, startPresentation, stopPresentation,
    username, joinCallSilent,
  } = useCalls();

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const call = currentCall?.id === callId
    ? currentCall
    : activeCalls.find((c) => c.id === callId) ?? currentCall;

  useEffect(() => {
    if (call && !currentCall && (call.status === 'ongoing' || call.status === 'ringing')) {
      joinCallSilent(callId);
    }
  }, [call, callId, currentCall, joinCallSilent]);

  useEffect(() => {
    if (!call?.started_at) return;
    const start = new Date(call.started_at).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [call?.started_at]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isHost = call?.host === username;
  const isPresentation = call?.call_type === 'presentation' || call?.presentation_active;

  if (!call) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-10 text-center">
          <div className="nova-spinner mx-auto mb-4" />
          <p className="text-readable-muted text-sm">Connecting to call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-readable bg-black/40">
      {/* Top bar */}
      <div className="glass border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{CALL_TYPE_ICONS[call.call_type]}</span>
          <div>
            <h1 className="text-sm font-semibold">{call.title}</h1>
            <p className="text-xs text-readable-subtle">
              {CALL_TYPE_LABELS[call.call_type]} · {formatElapsed(elapsed)}
            </p>
          </div>
        </div>
        {call.presentation_active && (
          <span className="badge-busy px-3 py-1 rounded-full text-xs animate-pulse">Live Presentation</span>
        )}
        <span className="badge-active px-3 py-1 rounded-full text-xs capitalize">{call.status}</span>
      </div>

      {/* Video grid */}
      <div className="flex-1 p-4 lg:p-6">
        {call.presentation_active ? (
          <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 glass-dark rounded-2xl border border-sky-400/20 flex flex-col items-center justify-center min-h-[400px] relative">
              <div className="absolute top-4 left-4 badge-active px-3 py-1 rounded-full text-xs">
                Presenting: {call.host_name}
              </div>
              <div className="text-center">
                <span className="text-5xl mb-4 block">🖥</span>
                <p className="text-lg font-semibold">Live Demo Presentation</p>
                <p className="text-sm text-readable-muted mt-2">Screen share active — participants can view the demo</p>
              </div>
            </div>
            <div className="space-y-3 overflow-y-auto">
              {call.participants.filter((p) => p.status === 'joined').map((p) => (
                <div key={p.username} className="glass rounded-xl p-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-full flex items-center justify-center text-[10px] font-semibold">
                    {p.display_name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <span className="text-xs truncate">{p.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`grid gap-4 h-full ${
            call.participants.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
            call.participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'
          }`}>
            {call.participants.map((p) => (
              <div
                key={p.username}
                className={`call-video-tile glass-dark rounded-2xl flex flex-col items-center justify-center min-h-[200px] relative ${
                  p.username === username ? 'ring-2 ring-sky-400/40' : ''
                }`}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-lg font-semibold mb-3">
                  {p.display_name.split(' ').map((n) => n[0]).join('')}
                </div>
                <p className="text-sm font-medium">{p.display_name}{p.username === username ? ' (You)' : ''}</p>
                <p className="text-[10px] text-readable-subtle capitalize mt-1">{p.status}</p>
                {cameraOff && p.username === username && (
                  <span className="absolute top-3 right-3 text-[10px] badge-idle px-2 py-0.5 rounded-full">Camera off</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass border-t border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => setMuted((m) => !m)}
            className={`call-control-btn ${muted ? 'call-control-active' : ''}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🎤'}
          </button>
          <button
            onClick={() => setCameraOff((c) => !c)}
            className={`call-control-btn ${cameraOff ? 'call-control-active' : ''}`}
            title={cameraOff ? 'Camera on' : 'Camera off'}
          >
            {cameraOff ? '📷' : '📹'}
          </button>
          {isHost && isPresentation && (
            <button
              onClick={() => call.presentation_active ? stopPresentation(call.id) : startPresentation(call.id)}
              className={`call-control-btn ${call.presentation_active ? 'call-control-presenting' : ''}`}
            >
              {call.presentation_active ? 'Stop Share' : 'Share Screen'}
            </button>
          )}
          <button
            onClick={() => { endCall(call.id); router.push('/calls'); }}
            className="call-control-btn call-control-end"
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}