'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const PRESETS = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '45 min', seconds: 45 * 60 },
];

interface BreakTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BreakTimerModal({ isOpen, onClose, onComplete }: BreakTimerModalProps) {
  const [duration, setDuration] = useState(45 * 60);
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [binauralOn, setBinauralOn] = useState(true);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  const stopBinaural = useCallback(() => {
    oscillatorsRef.current.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    oscillatorsRef.current = [];
    if (audioRef.current) {
      audioRef.current.close().catch(() => {});
      audioRef.current = null;
    }
  }, []);

  const startBinaural = useCallback(() => {
    stopBinaural();
    try {
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      gain.connect(ctx.destination);

      [200, 210].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        oscillatorsRef.current.push(osc);
      });
    } catch {
      /* audio unavailable */
    }
  }, [stopBinaural]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setStarted(false);
    setTimeLeft(duration);
    stopBinaural();
  }, [duration, stopBinaural]);

  useEffect(() => {
    if (!isOpen) {
      resetTimer();
    }
  }, [isOpen, resetTimer]);

  useEffect(() => {
    if (!isRunning || isPaused || timeLeft <= 0) return;

    const id = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, isPaused, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && started) {
      setIsRunning(false);
      stopBinaural();
      onComplete();
      onClose();
    }
  }, [timeLeft, started, stopBinaural, onComplete, onClose]);

  useEffect(() => {
    if (isRunning && !isPaused && binauralOn) {
      startBinaural();
    } else {
      stopBinaural();
    }
    return () => stopBinaural();
  }, [isRunning, isPaused, binauralOn, startBinaural, stopBinaural]);

  const handleStart = () => {
    setTimeLeft(duration);
    setIsRunning(true);
    setIsPaused(false);
    setStarted(true);
  };

  const handlePreset = (seconds: number) => {
    if (started) return;
    setDuration(seconds);
    setTimeLeft(seconds);
  };

  const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass card-accent card-accent-emerald rounded-2xl p-8 w-full max-w-md mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-readable-subtle hover:text-readable transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl">
            ☕
          </div>
          <h3 className="text-xl font-semibold">Break Timer</h3>
          <p className="text-readable-muted text-sm mt-1">Step away and recharge</p>
        </div>

        {/* Timer ring */}
        <div className="relative w-44 h-44 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="url(#breakGradient)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.64} 264`}
            />
            <defs>
              <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-semibold tracking-tight">{formatTime(timeLeft)}</span>
            <span className="text-xs text-readable-subtle mt-1">
              {isPaused ? 'Paused' : isRunning ? 'On break' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Presets */}
        {!started && (
          <div className="flex gap-2 justify-center mb-6">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p.seconds)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  duration === p.seconds
                    ? 'bg-sky-500/20 border border-sky-400/40 text-sky-300'
                    : 'glass text-readable-muted hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Binaural toggle */}
        <label className="flex items-center justify-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={binauralOn}
            onChange={(e) => setBinauralOn(e.target.checked)}
            className="w-4 h-4 rounded accent-sky-400"
          />
          <span className="text-sm text-readable-muted">Binaural relaxation audio</span>
        </label>

        {/* Controls */}
        <div className="flex gap-3">
          {!started ? (
            <button onClick={handleStart} className="flex-1 py-2.5 btn-primary rounded-xl text-sm font-semibold text-white">
              Start Break
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsPaused((p) => !p)}
                className="flex-1 py-2.5 glass rounded-xl text-sm font-medium hover:bg-white/5"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => { resetTimer(); onClose(); }}
                className="flex-1 py-2.5 glass rounded-xl text-sm font-medium hover:bg-white/5 border border-amber-500/30 text-amber-300"
              >
                End Early
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}