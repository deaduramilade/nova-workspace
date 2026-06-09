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

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchStream = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/v1/streaming/join/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStreamUrl(response.data.stream_url);
      } catch (error) {
        console.error("Failed to join streaming session", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [workspaceId, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Connecting to workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center text-xl font-bold">
              N
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspace {workspaceId}</h1>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="glass px-6 py-3 rounded-2xl text-sm font-medium hover:bg-white/10 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="pt-24 h-screen">
        {streamUrl ? (
          <iframe
            src={streamUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; clipboard-write"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/70">
            Unable to connect to streaming session. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}