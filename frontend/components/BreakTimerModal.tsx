'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BinauralEngine, BinauralPreset, BINAURAL_PRESETS } from '../lib/binauralAudio';

const TIMER_PRESETS = [
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
  const [binauralPreset, setBinauralPreset] = useState<BinauralPreset>('alpha');
  const [volume, setVolume] = useState(0.04);
  const [started, setStarted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const engineRef = useRef<BinauralEngine | null>(null);

  const stopBinaural = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const startBinaural = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new BinauralEngine();
    }
    engineRef.current.setPreset(binauralPreset);
    await engineRef.current.start(volume);
  }, [binauralPreset, volume]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setStarted(false);
    setMinimized(false);
    setTimeLeft(duration);
    stopBinaural();
  }, [duration, stopBinaural]);

  useEffect(() => {
    if (!isOpen) resetTimer();
  }, [isOpen, resetTimer]);

  useEffect(() => {
    if (!isRunning || isPaused || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
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

  useEffect(() => {
    if (engineRef.current?.isPlaying()) {
      engineRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (engineRef.current?.isPlaying()) {
      engineRef.current.setPreset(binauralPreset);
    }
  }, [binauralPreset]);

  const handleStart = () => {
    setTimeLeft(duration);
    setIsRunning(true);
    setIsPaused(false);
    setStarted(true);
    setMinimized(false);
  };

  const handlePreset = (seconds: number) => {
    if (started) return;
    setDuration(seconds);
    setTimeLeft(seconds);
  };

  const handleClose = () => {
    resetTimer();
    onClose();
  };

  const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;

  if (!isOpen) return null;

  if (minimized && started) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] glass card-accent card-accent-emerald rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl shadow-black/40">
        <div className="text-center">
          <p className="text-[10px] text-readable-subtle uppercase tracking-wide">On break</p>
          <p className="text-xl font-mono font-semibold">{formatTime(timeLeft)}</p>
        </div>
        {binauralOn && (
          <span className="text-[10px] badge-active px-2 py-0.5 rounded-full">♫ Binaural</span>
        )}
        <button
          onClick={() => setMinimized(false)}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          Expand
        </button>
        <button
          onClick={() => setIsPaused((p) => !p)}
          className="text-xs glass px-2.5 py-1 rounded-lg"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="glass card-accent card-accent-emerald rounded-2xl p-8 w-full max-w-md mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-readable-subtle hover:text-readable transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {started && (
          <button
            onClick={() => setMinimized(true)}
            className="absolute top-4 left-4 text-xs text-readable-subtle hover:text-readable glass px-2 py-1 rounded-lg"
          >
            Minimize
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl">
            ☕
          </div>
          <h3 className="text-xl font-semibold">Break Timer</h3>
          <p className="text-readable-muted text-sm mt-1">Step away and recharge</p>
        </div>

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

        {!started && (
          <div className="flex gap-2 justify-center mb-6">
            {TIMER_PRESETS.map((p) => (
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

        <div className="mb-5 p-4 rounded-xl stat-pill space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-readable-muted">Binaural beats</span>
            <input
              type="checkbox"
              checked={binauralOn}
              onChange={(e) => setBinauralOn(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-400"
            />
          </label>

          {binauralOn && (
            <>
              <select
                value={binauralPreset}
                onChange={(e) => setBinauralPreset(e.target.value as BinauralPreset)}
                disabled={started && isRunning && !isPaused}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-readable focus:outline-none focus:border-sky-400/60"
              >
                {(Object.keys(BINAURAL_PRESETS) as BinauralPreset[]).map((key) => (
                  <option key={key} value={key} className="bg-slate-900">
                    {BINAURAL_PRESETS[key].label}
                  </option>
                ))}
              </select>

              <div>
                <div className="flex justify-between text-xs text-readable-subtle mb-1">
                  <span>Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.12"
                  step="0.005"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              <p className="text-[11px] text-readable-subtle leading-relaxed">
                Stereo tones create a {BINAURAL_PRESETS[binauralPreset].beat} Hz beat — use headphones for best effect.
              </p>
            </>
          )}
        </div>

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
                onClick={handleClose}
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