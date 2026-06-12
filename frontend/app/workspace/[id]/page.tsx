'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchStream = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8000/api/v1/streaming/join/${workspaceId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStreamUrl(response.data.stream_url);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [workspaceId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="nova-spinner" />
        <p className="text-readable-muted text-sm">Connecting to workspace {workspaceId}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-readable">
      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
        <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center text-base font-bold shadow-lg shadow-sky-500/20">
              N
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Workspace {workspaceId}</h1>
              <p className="text-xs text-readable-subtle flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {error ? 'Connection issue' : 'Live session'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="glass px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 pt-[60px] flex flex-col">
        {streamUrl ? (
          <div className="flex-1 relative">
            <div className="absolute inset-0 m-3 sm:m-4 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
              <iframe
                src={streamUrl}
                className="w-full h-full border-0 bg-slate-950"
                allow="camera; microphone; clipboard-write"
                title={`Workspace ${workspaceId} session`}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="glass rounded-2xl p-10 max-w-md text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
                ⚠
              </div>
              <h2 className="text-xl font-semibold mb-2">Unable to connect</h2>
              <p className="text-readable-muted text-sm leading-relaxed mb-6">
                The streaming session could not be started. Check that the backend is running and try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium text-white"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}