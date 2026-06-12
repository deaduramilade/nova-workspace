'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import PageNav from '../../components/PageNav';
import SupervisorLiveTools from '../../components/SupervisorLiveTools';
import WorkspaceLiveStatus from '../../components/WorkspaceLiveStatus';
import { usePhase3 } from '../../contexts/Phase3Context';
import { LiveStatusPayload } from '../../lib/workspaceTypes';

export default function SupervisorHubPage() {
  const router = useRouter();
  const { overview, syncStatus, crdtState, isSupervisor } = usePhase3();
  const [liveStatus, setLiveStatus] = useState<LiveStatusPayload | null>(null);
  const [workspaceId, setWorkspaceId] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }

    axios
      .get(`http://localhost:8000/api/v1/supervisor/workspaces/${workspaceId}/live`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setLiveStatus(res.data.live_status))
      .catch(() => {});
  }, [workspaceId, router]);

  return (
    <div className="min-h-screen text-readable pb-16">
      <PageNav title="Supervisor Hub" subtitle="Phase 3 · Live feedback & CRDT sync" />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Supervisor Hub</h1>
            <p className="text-sm text-readable-muted mt-1">
              Live oversight · offline-first CRDT · real-time feedback
            </p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((id) => (
              <button
                key={id}
                onClick={() => setWorkspaceId(id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  workspaceId === id ? 'btn-primary text-white' : 'glass'
                }`}
              >
                WS {id}
              </button>
            ))}
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Phase', value: overview?.phase ?? 3 },
            { label: 'Online', value: overview?.metrics.online_users ?? '—' },
            { label: 'CRDT v', value: crdtState?.version ?? syncStatus.version },
            { label: 'Pending sync', value: syncStatus.pending },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-4 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-readable-subtle mt-1">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold">Live team pulse — Workspace {workspaceId}</h2>
            </div>
            <WorkspaceLiveStatus live={liveStatus} />
          </div>
          <div className="glass rounded-2xl overflow-hidden card-accent card-accent-orange">
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold">Feedback tools</h2>
              {!isSupervisor && (
                <p className="text-[10px] text-readable-subtle">Demo mode enabled</p>
              )}
            </div>
            <SupervisorLiveTools workspaceId={workspaceId} />
          </div>
        </section>

        {overview?.integrations && (
          <section className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4">Phase 3 integrations</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(overview.integrations).map(([key, val]) => (
                <div key={key} className="stat-pill rounded-xl p-4 text-center">
                  <p className="text-[10px] text-readable-subtle uppercase">{key}</p>
                  <p className={`text-sm font-semibold capitalize mt-1 ${
                    val.status === 'connected' || val.status === 'ready' || val.status === 'active'
                      ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {val.status as string}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}