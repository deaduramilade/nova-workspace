'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamGame() {
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);

  const startGame = () => {
    setGameActive(true);
    setScore(0);
  };

  const addPoint = () => setScore(score + 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.push('/')}
          className="glass px-6 py-3 rounded-2xl text-sm font-medium mb-8 hover:bg-white/10 transition-all"
        >
          ← Back to Dashboard
        </button>

        <div className="glass rounded-3xl p-12 text-center">
          <h1 className="text-4xl font-semibold mb-4">Team Break Game</h1>
          <p className="text-white/70 mb-10 max-w-md mx-auto">
            Memory Match Game — Light brain exercise for break time
          </p>

          {!gameActive ? (
            <button 
              onClick={startGame}
              className="glass px-10 py-4 rounded-2xl text-lg font-medium hover:bg-white/10 transition-all"
            >
              Start Memory Match Game
            </button>
          ) : (
            <div>
              <div className="text-6xl font-mono mb-8">Score: {score}</div>
              <div className="text-white/60 mb-8">Match pairs to increase team score</div>
              <button 
                onClick={addPoint}
                className="glass px-8 py-3 rounded-2xl text-sm font-medium mr-4"
              >
                Match Pair (+10)
              </button>
              <button 
                onClick={() => {
                  setGameActive(false);
                  alert(`Game completed! Final score: ${score}`);
                }}
                className="glass px-8 py-3 rounded-2xl text-sm font-medium"
              >
                End Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}