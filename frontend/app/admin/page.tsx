'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../components/PageNav';
import { usePhase3 } from '../../contexts/Phase3Context';
import { apiUrl, authHeaders } from '../../lib/api';

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

export default function AdministratorDashboard() {
  const router = useRouter();
  const { isAdmin } = usePhase3();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Create user form state
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(apiUrl('/admin/users'), { headers: authHeaders() });
      setUsers(res.data || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        toast.error('Administrator access required');
        router.push('/');
        return;
      }
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role gate
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-10 rounded-3xl text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-semibold mb-2">Administrator Access Only</h1>
          <p className="text-readable-muted mb-6">This dashboard is restricted to users with the admin role.</p>
          <button onClick={() => router.push('/')} className="btn-primary px-6 py-2 rounded-2xl text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q);
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && u.is_active) ||
        (activeFilter === 'inactive' && !u.is_active);
      return matchesSearch && matchesRole && matchesActive;
    })
    .sort((a, b) => a.username.localeCompare(b.username));

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === 'admin').length,
    inactive: users.filter((u) => !u.is_active).length,
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await axios.patch(
        apiUrl(`/admin/users/${userId}`),
        { role: newRole },
        { headers: authHeaders() }
      );
      toast.success('Role updated');
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to update role');
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
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

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
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary px-5 py-2 rounded-2xl text-sm"
          >
            {showCreate ? 'Cancel' : '+ Create New User'}
          </button>
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
