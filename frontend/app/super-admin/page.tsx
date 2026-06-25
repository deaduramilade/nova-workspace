'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../components/PageNav';
import { useRole } from '../../contexts/RoleContext';
import { apiUrl, authHeaders } from '../../lib/api';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface SystemStats {
  total_users: number;
  active_workspaces: number;
  pending_role_requests: number;
  total_meetings: number;
}

interface RoleRequest {
  id: number;
  user_id: number;
  username: string;
  requested_role: string;
  reason?: string;
  created_at: string;
  status: string;
}

interface HealthStatus {
  database: {
    status: 'healthy' | 'degraded' | 'offline';
    latency_ms: number;
    last_check: string;
  };
  redis: {
    status: 'healthy' | 'degraded' | 'offline';
    latency_ms: number;
    last_check: string;
  };
  websocket: {
    status: 'healthy' | 'degraded' | 'offline';
    active_connections: number;
    last_check: string;
  };
}

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource_type: string;
  resource_id?: number;
  details: string;
  timestamp: string;
  ip_address?: string;
}

// ────────────────────────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color = 'sky' }: { label: string; value: string | number; icon: string; color?: string }) {
  const colorClass = {
    sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  }[color];

  return (
    <div className={`glass-card bg-gradient-to-br ${colorClass} p-6 rounded-2xl border`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <span className="text-3xl opacity-50">{icon}</span>
      </div>
    </div>
  );
}

function HealthCard({
  title,
  status,
  latency,
  details,
}: {
  title: string;
  status: 'healthy' | 'degraded' | 'offline';
  latency?: number;
  details?: string | number;
}) {
  const statusColor = {
    healthy: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    degraded: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    offline: 'bg-red-500/20 border-red-500/40 text-red-300',
  }[status];

  const statusDot = {
    healthy: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    offline: 'bg-red-400',
  }[status];

  return (
    <div className={`glass-card p-5 rounded-xl border ${statusColor}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${statusDot} animate-pulse`} />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs text-slate-300 mb-2 capitalize">{status}</p>
      {latency !== undefined && <p className="text-xs text-slate-400">{latency}ms latency</p>}
      {details !== undefined && <p className="text-xs text-slate-400">{details}</p>}
    </div>
  );
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const timestamp = new Date(log.timestamp).toLocaleString();

  return (
    <div className="glass-card px-5 py-4 rounded-xl border border-white/10 hover:border-sky-500/30 transition-colors">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-sky-300">{log.action}</p>
          <p className="text-xs text-slate-400 mt-1">
            {log.username} • {log.resource_type}
            {log.resource_id && ` #${log.resource_id}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{timestamp}</p>
          {log.ip_address && <p className="text-xs text-slate-600 mt-1">{log.ip_address}</p>}
        </div>
      </div>
      {log.details && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{log.details}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page Component
// ────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const router = useRouter();
  const { realIsAdmin, realIsSuperAdmin, effectiveRole } = useRole();

  // State
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  // ────────────────────────────────────────────────────────────────
  // Permission Check & Data Fetching
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Only super_admin can access
    if (!realIsSuperAdmin) {
      toast.error('Super Admin access required');
      router.push('/');
      return;
    }

    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const baseUrl = apiUrl('');

      // Fetch all data in parallel
      const [statsRes, healthRes, requestsRes, logsRes] = await Promise.allSettled([
        axios.get(`${baseUrl}/admin/system/stats`, { headers }),
        axios.get(`${baseUrl}/admin/system/health`, { headers }),
        axios.get(`${baseUrl}/admin/role-requests?status=pending`, { headers }),
        axios.get(`${baseUrl}/admin/audit-logs?limit=10`, { headers }),
      ]);

      // Handle results
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        toast.error('Failed to load system stats');
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data);
      } else {
        toast.error('Failed to load system health');
      }

      if (requestsRes.status === 'fulfilled') {
        setRoleRequests(requestsRes.value.data.requests || []);
      } else {
        toast.error('Failed to load role requests');
      }

      if (logsRes.status === 'fulfilled') {
        setAuditLogs(logsRes.value.data.logs || []);
      } else {
        toast.error('Failed to load audit logs');
      }
    } catch (error) {
      console.error('Error fetching super admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────────

  const handleApproveRequest = async (id: number) => {
    const key = `approve-${id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));

    try {
      await axios.post(
        apiUrl(`/admin/role-requests/${id}/approve`),
        { notes: 'Approved by super admin' },
        { headers: authHeaders() }
      );
      toast.success('Role request approved');
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to approve request');
    } finally {
      setActionLoading((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleRejectRequest = async (id: number) => {
    const key = `reject-${id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));

    try {
      await axios.post(
        apiUrl(`/admin/role-requests/${id}/reject`),
        { notes: 'Rejected by super admin' },
        { headers: authHeaders() }
      );
      toast.success('Role request rejected');
      await fetchAllData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to reject request');
    } finally {
      setActionLoading((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleQuickAction = (action: string) => {
    const routes: { [key: string]: string } = {
      users: '/admin',
      workspaces: '/admin',
      settings: '/settings',
    };
    if (routes[action]) {
      router.push(routes[action]);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="nova-bg min-h-screen">
      <Toaster position="top-right" />
      <PageNav title="Super Admin Dashboard" subtitle="System Management & Oversight" backHref="/" />

      <main className="nova-content pt-24 pb-20">
        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Section 1: System Overview Stats ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">📊</span> System Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <StatCard label="Total Users" value={stats?.total_users || 0} icon="👥" color="sky" />
                  <StatCard label="Active Workspaces" value={stats?.active_workspaces || 0} icon="🏢" color="emerald" />
                  <StatCard label="Pending Requests" value={stats?.pending_role_requests || 0} icon="⏳" color="amber" />
                  <StatCard label="Total Meetings" value={stats?.total_meetings || 0} icon="📞" color="violet" />
                </div>
              </section>

              {/* ── Section 2: Recent Role Change Requests ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">🔄</span> Role Change Requests
                </h2>
                {roleRequests.length === 0 ? (
                  <div className="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <p className="text-slate-400">No pending role requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roleRequests.map((req) => (
                      <div
                        key={req.id}
                        className="glass-card p-5 rounded-xl border border-white/10 hover:border-sky-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-[250px]">
                            <p className="font-semibold text-white">{req.username}</p>
                            <p className="text-sm text-slate-400 mt-1">
                              Requesting{' '}
                              <span className="text-sky-300 font-medium">{req.requested_role}</span>
                            </p>
                            {req.reason && (
                              <p className="text-xs text-slate-500 mt-2 line-clamp-2">{req.reason}</p>
                            )}
                            <p className="text-xs text-slate-600 mt-2">
                              {new Date(req.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              disabled={actionLoading[`approve-${req.id}`]}
                              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                            >
                              {actionLoading[`approve-${req.id}`] ? '...' : '✓ Approve'}
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req.id)}
                              disabled={actionLoading[`reject-${req.id}`]}
                              className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                              {actionLoading[`reject-${req.id}`] ? '...' : '✕ Reject'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 3: System Health Status ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">💚</span> System Health
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {health ? (
                    <>
                      <HealthCard
                        title="Database"
                        status={health.database.status}
                        latency={health.database.latency_ms}
                      />
                      <HealthCard
                        title="Redis Cache"
                        status={health.redis.status}
                        latency={health.redis.latency_ms}
                      />
                      <HealthCard
                        title="WebSocket"
                        status={health.websocket.status}
                        details={`${health.websocket.active_connections} active`}
                      />
                    </>
                  ) : (
                    <div className="col-span-full text-center py-8 text-slate-400">
                      Health check unavailable
                    </div>
                  )}
                </div>
              </section>

              {/* ── Section 4: Recent Audit Logs ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Recent Audit Logs
                </h2>
                {auditLogs.length === 0 ? (
                  <div className="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <p className="text-slate-400">No audit logs available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <AuditLogRow key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 5: Quick Actions ── */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">⚡</span> Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleQuickAction('users')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-left group"
                  >
                    <p className="text-3xl mb-3 group-hover:scale-110 transition-transform">👤</p>
                    <p className="font-semibold text-white">Manage Users</p>
                    <p className="text-sm text-slate-400 mt-2">View, create, and edit users</p>
                  </button>

                  <button
                    onClick={() => handleQuickAction('workspaces')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left group"
                  >
                    <p className="text-3xl mb-3 group-hover:scale-110 transition-transform">🏢</p>
                    <p className="font-semibold text-white">View Workspaces</p>
                    <p className="text-sm text-slate-400 mt-2">Monitor all active workspaces</p>
                  </button>

                  <button
                    onClick={() => handleQuickAction('settings')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-left group"
                  >
                    <p className="text-3xl mb-3 group-hover:scale-110 transition-transform">⚙️</p>
                    <p className="font-semibold text-white">Settings</p>
                    <p className="text-sm text-slate-400 mt-2">Configure system preferences</p>
                  </button>
                </div>
              </section>

              {/* Refresh Button */}
              <div className="mt-12 flex justify-center">
                <button
                  onClick={fetchAllData}
                  disabled={loading}
                  className="glass px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  🔄 Refresh Data
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
