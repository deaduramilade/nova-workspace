'use client';

import React, { useCallback, useEffect, useState } from 'react';

const EMOJIS = ['🚀', '🧠', '⚡', '🎯', '🔮', '💡'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  return pairs
    .sort(() => Math.random() - 0.5)
    .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

interface MemoryMatchGameProps {
  onWin?: (stats: { moves: number; seconds: number }) => void;
}

export default function MemoryMatchGame({ onWin }: MemoryMatchGameProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [won, setWon] = useState(false);

  const initGame = useCallback(() => {
    setCards(buildDeck());
    setFlippedIds([]);
    setMoves(0);
    setSeconds(0);
    setPlaying(true);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (!playing || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [playing, won]);

  useEffect(() => {
    if (flippedIds.length !== 2) return;

    const [a, b] = flippedIds;
    const cardA = cards.find((c) => c.id === a);
    const cardB = cards.find((c) => c.id === b);

    if (cardA && cardB && cardA.emoji === cardB.emoji) {
      setCards((prev) =>
        prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true, flipped: true } : c))
      );
      setFlippedIds([]);
      setMoves((m) => m + 1);
    } else {
      const timeout = setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c))
        );
        setFlippedIds([]);
        setMoves((m) => m + 1);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [flippedIds, cards]);

  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.matched)) {
      setWon(true);
      setPlaying(false);
      onWin?.({ moves, seconds });
    }
  }, [cards, moves, seconds, onWin]);

  const handleFlip = (id: number) => {
    if (!playing || won || flippedIds.length >= 2) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlippedIds((prev) => [...prev, id]);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-readable-subtle">Moves</p>
            <p className="text-xl font-semibold">{moves}</p>
          </div>
          <div>
            <p className="text-xs text-readable-subtle">Time</p>
            <p className="text-xl font-semibold font-mono">{formatTime(seconds)}</p>
          </div>
        </div>
        <button onClick={initGame} className="glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5">
          New Game
        </button>
      </div>

      {won && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center">
          <p className="text-emerald-300 font-semibold">All pairs matched!</p>
          <p className="text-sm text-readable-muted mt-1">
            {moves} moves in {formatTime(seconds)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleFlip(card.id)}
            disabled={card.matched}
            className={`aspect-square rounded-xl text-2xl font-bold transition-all duration-300 ${
              card.flipped || card.matched
                ? 'glass-card bg-sky-500/10 border-sky-400/30 scale-100'
                : 'glass hover:bg-white/10 hover:border-sky-400/20 hover:scale-105'
            } ${card.matched ? 'opacity-50' : ''}`}
          >
            {card.flipped || card.matched ? card.emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}