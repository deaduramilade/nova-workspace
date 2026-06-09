'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NovaDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center text-xl font-bold">
              N
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Nova Workspace</h1>
              <p className="text-xs text-white/60 -mt-1">AI-Native Collaborative Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="glass px-6 py-3 rounded-2xl text-sm font-medium hover:bg-white/10 transition-all">
              New Workspace
            </button>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium">Samuel Okunribido</div>
                <div className="text-xs text-white/60">@oceanfi</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-purple-500 rounded-full flex items-center justify-center font-semibold text-lg">
                SO
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-8 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-4xl font-bold tracking-tight mb-3">
            Welcome back, Samuel
          </h2>
          <p className="text-xl text-white/70">
            Continue your AI-human collaboration sessions
          </p>
        </div>

        {/* Workspaces */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold mb-6 text-white/90">Your Workspaces</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-3xl p-8 cursor-pointer hover:shadow-2xl">
                <div className="flex justify-between items-start mb-6">
                  <h4 className="text-xl font-semibold">AI Agent Collaboration {i}</h4>
                  <span className="px-4 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">Active</span>
                </div>
                <div className="space-y-3 text-sm text-white/70">
                  <div>4 Humans • 7 AI Agents</div>
                  <div>Last synced moments ago</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-6 text-white/90">Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button className="glass px-8 py-4 rounded-3xl hover:scale-[1.02] transition-all text-base font-medium">
              Start New Session
            </button>
            <button className="glass px-8 py-4 rounded-3xl hover:scale-[1.02] transition-all text-base font-medium">
              Invite AI Agent
            </button>
            <button className="glass px-8 py-4 rounded-3xl hover:scale-[1.02] transition-all text-base font-medium">
              Join Session
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}