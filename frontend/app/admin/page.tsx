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

interface AdminUser {
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface QuickStats {
  pending_approvals: number;
  total_users: number;
  active_sessions: number;
}

interface ActivityLog {
  id: number;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

interface ManagedUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

const ROLE_OPTIONS = ['user', 'supervisor', 'hr', 'lead', 'admin'];

export default function AdminDashboard() {
  const router = useRouter();
  const { realIsAdmin } = useRole();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roleRequests, setRoleRequests] = useState<any[]>([]);

  // User management state (for inline management)
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [creating, setCreating] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState<{ [key: number]: boolean }>({});

  // ────────────────────────────────────────────────────────────────
  // Fetch Data
  // ────────────────────────────────────────────────────────────────

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(apiUrl('/users/me'), { headers: authHeaders() });
      setCurrentUser(res.data);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchQuickStats = async () => {
    try {
      const res = await axios.get(apiUrl('/admin/quick-stats'), { headers: authHeaders() });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Set default stats on error
      setStats({ pending_approvals: 0, total_users: 0, active_sessions: 0 });
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const res = await axios.get(apiUrl('/admin/activity-logs?limit=6'), { headers: authHeaders() });
      setActivityLogs(res.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(apiUrl('/admin/users'), { headers: authHeaders() });
      setUsers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchRoleRequests = async () => {
    try {
      const res = await axios.get(apiUrl('/admin/role-requests?status=pending'), { headers: authHeaders() });
      setRoleRequests(res.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch role requests:', error);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Initialize & Load Data
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check role access
    if (!realIsAdmin) {
      toast.error('Admin access required');
      router.push('/');
      return;
    }

    // Fetch all data on mount
    setLoading(true);
    Promise.all([
      fetchCurrentUser(),
      fetchQuickStats(),
      fetchActivityLogs(),
      fetchUsers(),
      fetchRoleRequests(),
    ]).finally(() => setLoading(false));
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────────

  const handleRoleChange = async (userId: number, newRole: string) => {
    setUserActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await axios.patch(
        apiUrl(`/admin/users/${userId}`),
        { role: newRole },
        { headers: authHeaders() }
      );
      toast.success('Role updated');
      fetchUsers();
      fetchQuickStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to update role');
    } finally {
      setUserActionLoading((prev) => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    try {
      await axios.patch(
        apiUrl(`/admin/users/${user.id}`),
        { is_active: !user.is_active },
        { headers: authHeaders() }
      );
      toast.success(`${user.is_active ? 'Deactivated' : 'Activated'} ${user.username}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await axios.delete(apiUrl(`/admin/users/${user.id}`), { headers: authHeaders() });
      toast.success(`Deleted ${user.username}`);
      fetchUsers();
      fetchQuickStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error('Please fill username, email, and password');
      return;
    }
    setCreating(true);
    try {
      await axios.post(apiUrl('/admin/users'), newUser, { headers: authHeaders() });
      toast.success('User created successfully');
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      setShowCreate(false);
      fetchUsers();
      fetchQuickStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const navigateTo = (path: string) => router.push(path);

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="nova-bg min-h-screen">
      <Toaster position="top-right" />
      <PageNav
        title="Admin Dashboard"
        subtitle="User & role management hub"
        backHref="/"
      />

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
              {/* ── Welcome Header ── */}
              <section className="mb-12">
                <div className="glass-card p-8 rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/10 to-indigo-500/10">
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                        Welcome back, {currentUser?.display_name || currentUser?.username || 'Admin'}
                      </h1>
                      <p className="text-slate-300">
                        Manage users, roles, and system oversight from this hub.
                      </p>
                    </div>
                    <div className="text-5xl">🎛️</div>
                  </div>
                </div>
              </section>

              {/* ── Quick Stats ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">Quick Stats</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Pending Approvals */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-amber-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Pending Approvals</p>
                        <p className="text-4xl font-bold text-amber-300">
                          {stats?.pending_approvals || 0}
                        </p>
                      </div>
                      <span className="text-3xl opacity-50">⏳</span>
                    </div>
                    {(stats?.pending_approvals || 0) > 0 && (
                      <button
                        onClick={() => navigateTo('#role-requests')}
                        className="text-xs text-amber-300 hover:text-amber-200 font-medium mt-2"
                      >
                        Review now →
                      </button>
                    )}
                  </div>

                  {/* Total Users */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-sky-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Total Users</p>
                        <p className="text-4xl font-bold text-sky-300">
                          {stats?.total_users || users.length}
                        </p>
                      </div>
                      <span className="text-3xl opacity-50">👥</span>
                    </div>
                    <button
                      onClick={() => navigateTo('#manage-users')}
                      className="text-xs text-sky-300 hover:text-sky-200 font-medium mt-2"
                    >
                      View users →
                    </button>
                  </div>

                  {/* Active Sessions */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Active Sessions</p>
                        <p className="text-4xl font-bold text-emerald-300">
                          {stats?.active_sessions || 0}
                        </p>
                      </div>
                      <span className="text-3xl opacity-50">🔗</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Management Cards ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">Management Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Role Request Management Card */}
                  <button
                    onClick={() => navigateTo('#role-requests')}
                    className="glass-card p-7 rounded-2xl border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-4xl group-hover:scale-110 transition-transform">🔄</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-500/20 border border-violet-500/40 text-violet-300">
                        {roleRequests.length} pending
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1">Role Requests</h3>
                    <p className="text-sm text-slate-400">
                      Approve or reject pending role change requests
                    </p>
                  </button>

                  {/* User Management Card */}
                  <button
                    onClick={() => navigateTo('#manage-users')}
                    className="glass-card p-7 rounded-2xl border border-white/10 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-4xl group-hover:scale-110 transition-transform">👤</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-sky-500/20 border border-sky-500/40 text-sky-300">
                        {users.length} total
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1">User Management</h3>
                    <p className="text-sm text-slate-400">
                      Create, edit, delete, and manage user accounts
                    </p>
                  </button>

                  {/* Audit Logs Card */}
                  <button
                    onClick={() => navigateTo('/admin/audit')}
                    className="glass-card p-7 rounded-2xl border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-4xl group-hover:scale-110 transition-transform">📋</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                        View all
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1">Audit Logs</h3>
                    <p className="text-sm text-slate-400">
                      Track system actions and user activities
                    </p>
                  </button>

                  {/* System Reports Card */}
                  <button
                    onClick={() => navigateTo('#')}
                    className="glass-card p-7 rounded-2xl border border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-4xl group-hover:scale-110 transition-transform">📊</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                        Dashboard
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1">System Reports</h3>
                    <p className="text-sm text-slate-400">
                      View analytics and system performance metrics
                    </p>
                  </button>
                </div>
              </section>

              {/* ── Recent Activity Feed ── */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
                {activityLogs.length === 0 ? (
                  <div className="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <p className="text-slate-400">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="glass-card px-5 py-4 rounded-xl border border-white/10 hover:border-sky-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-sky-300">{log.action}</p>
                            <p className="text-xs text-slate-400 mt-1">{log.user}</p>
                            {log.details && (
                              <p className="text-xs text-slate-500 mt-2">{log.details}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── User Management Section (Inline) ── */}
              <section id="manage-users" className="mb-12">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-bold text-white">Manage Users</h2>
                  <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    {showCreate ? '✕ Cancel' : '+ Add User'}
                  </button>
                </div>

                {/* Create User Form */}
                {showCreate && (
                  <div className="glass-card p-6 rounded-2xl border border-white/10 mb-6">
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <input
                          type="text"
                          placeholder="Username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500"
                          required
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          className="md:col-span-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500"
                          required
                        />
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-6 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-sm font-medium hover:bg-sky-500/30 transition-colors disabled:opacity-50"
                      >
                        {creating ? 'Creating...' : 'Create User'}
                      </button>
                    </form>
                  </div>
                )}

                {/* User List */}
                {users.length === 0 ? (
                  <div className="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <p className="text-slate-400">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {users.slice(0, 10).map((user) => (
                      <div
                        key={user.id}
                        className="glass-card p-4 rounded-xl border border-white/10 hover:border-sky-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-semibold text-white">{user.username}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={userActionLoading[user.id]}
                            className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${
                              user.is_active
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-500/20 border border-slate-500/40 text-slate-300'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {users.length > 10 && (
                      <p className="text-xs text-slate-500 text-center mt-4">
                        Showing 10 of {users.length} users
                      </p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as any)}
            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <button onClick={fetchUsers} className="glass px-4 py-2 rounded-2xl text-sm">Refresh</button>
          <div className="ml-auto text-xs text-readable-subtle">{filteredUsers.length} / {users.length} users</div>
        </div>

        {/* Role Change Requests Management (from Testing Role Switcher) */}
        <section className="glass rounded-2xl p-5 border border-amber-400/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">🔔</span>
              <h3 className="font-semibold">Pending Role Change Requests</h3>
              <span className="text-xs text-amber-300/70">(submitted via Role Switcher — not permanent until approved here)</span>
            </div>
            <button
              onClick={fetchRoleRequests}
              disabled={loadingRequests}
              className="text-xs glass px-3 py-1 rounded-lg"
            >
              {loadingRequests ? 'Loading...' : 'Refresh Requests'}
            </button>
          </div>

          {loadingRequests ? (
            <div className="text-center py-4 text-readable-subtle">Loading requests...</div>
          ) : roleRequests.length === 0 ? (
            <div className="text-sm text-readable-subtle py-2">No pending role change requests.</div>
          ) : (
            <div className="space-y-2">
              {roleRequests.map((req: any) => (
                <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{req.username}</span> <span className="text-readable-subtle">({req.email})</span>
                    <div className="text-xs text-readable-muted mt-0.5">
                      Current: <span className="capitalize">{req.current_role}</span> → Requested:{' '}
                      <span className="capitalize font-medium text-amber-300">{req.requested_role}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Email OTP"
                        value={otpInputs[req.id] || ""}
                        onChange={(e) =>
                          setOtpInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5 w-20"
                        maxLength={6}
                      />
                      <button
                        onClick={async () => {
                          try {
                            await axios.post(
                              apiUrl("/admin/role-requests/send-otp"),
                              { request_id: req.id },
                              { headers: authHeaders() }
                            );
                            toast.success("OTP sent to your admin email");
                          } catch (e: any) {
                            toast.error(e?.response?.data?.detail || "Failed to send OTP");
                          }
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
                      >
                        Send Email OTP
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="TOTP (Authenticator)"
                        value={otpInputs[`totp-${req.id}`] || ""}
                        onChange={(e) =>
                          setOtpInputs((prev) => ({ ...prev, [`totp-${req.id}`]: e.target.value }))
                        }
                        className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5 w-20"
                        maxLength={6}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={!!actionLoading[`approve-${req.id}`]}
                        className="px-3 py-1 text-xs rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 disabled:opacity-50"
                      >
                        {actionLoading[`approve-${req.id}`] ? "Approving..." : "Approve & Apply"}
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={!!actionLoading[`reject-${req.id}`]}
                        className="px-3 py-1 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-50"
                      >
                        {actionLoading[`reject-${req.id}`] ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-readable-subtle mt-3">
            Approving will permanently update the user's role in the database. The user will see the change after refreshing their role (or logging in again).
          </p>
        </section>

        {/* User Management Table */}
        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          {loading ? (
            <div className="p-12 flex justify-center"><div className="nova-spinner" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left border-b border-white/10">
                <tr>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium hidden md:table-cell">Created</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-readable-muted">No users match your filters.</td>
                  </tr>
                )}
                {filteredUsers.map((user) => {
                  const isSelf = false; // Could compare to current user id if we fetch it
                  return (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 last:border-none">
                      <td className="p-4">
                        <div className="font-medium">{user.username}</div>
                        {user.display_name && <div className="text-xs text-readable-subtle">{user.display_name}</div>}
                      </td>
                      <td className="p-4 text-readable-muted">{user.email}</td>
                      <td className="p-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="p-4 text-xs text-readable-subtle hidden md:table-cell">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-xs px-3 py-1 rounded-xl border border-red-400/30 text-red-300 hover:bg-red-500/10"
                          disabled={isSelf}
                          title={isSelf ? "Cannot delete yourself" : "Delete user"}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-[10px] text-readable-subtle">
          All changes are applied immediately. Only administrators can access this page. Deleting the last admin or your own account is prevented on the backend.
        </p>
      </main>
    </div>
  );
}
