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

  return (
    <div className="min-h-screen text-readable pb-16">
      <Toaster position="top-center" />
      <PageNav
        title="Administrator Dashboard"
        subtitle="User management • Role control • System oversight"
        backLabel="← Dashboard"
        backHref="/"
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header + Stats */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Administrator Dashboard</h1>
            <p className="text-readable-muted mt-1">Manage all users, roles, and account status</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/admin/audit')}
              className="glass px-4 py-2 rounded-2xl text-sm"
            >
              View Audit Logs
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="btn-primary px-5 py-2 rounded-2xl text-sm"
            >
              {showCreate ? 'Cancel' : '+ Create New User'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats.total },
            { label: 'Active', value: stats.active, color: 'text-emerald-400' },
            { label: 'Admins', value: stats.admins, color: 'text-violet-400' },
            { label: 'Inactive', value: stats.inactive, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl p-5">
              <div className={`text-3xl font-bold tabular-nums ${s.color || ''}`}>{s.value}</div>
              <div className="text-xs uppercase tracking-widest text-readable-subtle mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create User Form */}
        {showCreate && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Create New User</h3>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="text-xs text-readable-subtle">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-readable-subtle">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-readable-subtle">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-readable-subtle">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-5 flex gap-3">
                <button type="submit" disabled={creating} className="btn-primary px-6 py-2 rounded-xl text-sm">
                  {creating ? 'Creating...' : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="glass px-5 py-2 rounded-xl text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search username, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm"
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((r) => (
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
