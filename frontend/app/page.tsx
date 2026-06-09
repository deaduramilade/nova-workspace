'use client';

import React from 'react';

export default function NovaDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white">
      {/* Top Navigation - Glassmorphism */}
      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Nova Workspace</h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="glass px-6 py-2.5 rounded-2xl text-sm font-medium hover:bg-white/10 transition-colors">
              New Workspace
            </button>
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-sm font-medium">
              SO
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-5xl font-bold tracking-tighter mb-3">
            Welcome back, Samuel
          </h2>
          <p className="text-xl text-white/70">
            Continue your AI-human collaboration sessions
          </p>
        </div>

        {/* Workspaces Grid - Glass Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-3xl p-8 group cursor-pointer">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-sm text-white/60 mb-1">Workspace {i}</div>
                  <h3 className="text-2xl font-semibold">AI Agent Collaboration</h3>
                </div>
                <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Active
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-white/70">
                <div>4 Humans</div>
                <div>•</div>
                <div>7 AI Agents</div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-sm text-white/50">
                Last synced moments ago
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-16">
          <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
          <div className="flex gap-4 flex-wrap">
            <button className="glass px-8 py-4 rounded-3xl hover:scale-105 transition-all flex items-center gap-3">
              <span>🚀</span>
              Start New Session
            </button>
            <button className="glass px-8 py-4 rounded-3xl hover:scale-105 transition-all flex items-center gap-3">
              <span>🤖</span>
              Invite AI Agent
            </button>
            <button className="glass px-8 py-4 rounded-3xl hover:scale-105 transition-all flex items-center gap-3">
              <span>📡</span>
              Join Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}