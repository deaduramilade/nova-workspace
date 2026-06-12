'use client';

import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../components/PageNav';
import MemoryMatchGame from '../../components/MemoryMatchGame';

const LEADERBOARD = [
  { name: 'Alice Smith', score: 142, moves: 18 },
  { name: 'Michael Chen', score: 128, moves: 22 },
  { name: 'John Doe', score: 115, moves: 25 },
];

export default function TeamGamePage() {
  const [personalBest, setPersonalBest] = useState<{ moves: number; seconds: number } | null>(null);

  const handleWin = (stats: { moves: number; seconds: number }) => {
    const score = Math.max(0, 300 - stats.moves * 8 - stats.seconds);
    setPersonalBest((prev) => {
      if (!prev || stats.moves < prev.moves) return stats;
      return prev;
    });
    toast.success(`Great job! Score: ${score} pts`);
  };

  return (
    <div className="min-h-screen text-readable">
      <Toaster position="top-center" />
      <PageNav
        title="Light Team Game"
        subtitle="Memory Match — break-time team challenge"
        status={{ label: 'Break activity', active: true }}
      />

      <main className="pt-20 pb-12 px-6 lg:px-8 max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-2xl">
            🎮
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Memory Match</h2>
          <p className="text-readable-muted text-sm max-w-md mx-auto">
            Flip cards to find matching pairs. Compete with your team during break time — fewest moves wins.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 glass card-accent card-accent-violet rounded-2xl p-6 sm:p-8">
            <MemoryMatchGame onWin={handleWin} />
          </section>

          <aside className="space-y-6">
            {personalBest && (
              <section className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-3">Your Best</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-readable-subtle">Moves</span>
                  <span className="font-semibold">{personalBest.moves}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-readable-subtle">Time</span>
                  <span className="font-mono font-semibold">
                    {Math.floor(personalBest.seconds / 60)}:{(personalBest.seconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </section>
            )}

            <section className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4">Team Leaderboard</h3>
              <div className="space-y-3">
                {LEADERBOARD.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-3 p-2.5 rounded-lg stat-pill">
                    <span className="text-lg font-bold text-readable-subtle w-6">{i + 1}</span>
                    <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center text-[10px] font-semibold">
                      {entry.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      <p className="text-[11px] text-readable-subtle">{entry.moves} moves</p>
                    </div>
                    <span className="text-sm font-semibold text-sky-300">{entry.score}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-2">How to Play</h3>
              <ul className="text-xs text-readable-muted space-y-2 leading-relaxed">
                <li>Click cards to flip them and find matching emoji pairs.</li>
                <li>Complete the board in as few moves as possible.</li>
                <li>Scores are shared with your team on the leaderboard.</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}