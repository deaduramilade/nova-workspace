'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../../components/PageNav';
import { useRole } from '../../../contexts/RoleContext';
import { apiUrl, authHeaders } from '../../../lib/api';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource_type: string;
  resource_id?: number;
  target_user?: string;
  target_user_id?: number;
  details: string;
  timestamp: string;
  ip_address?: string;
  status: 'success' | 'failed';
}

interface AuditFilters {
  actionType: string;
  dateFrom: string;
  dateTo: string;
  searchUser: string;
}

// ────────────────────────────────────────────────────────────────
// Audit Log Row Component
// ────────────────────────────────────────────────────────────────

function AuditLogRow({ log }: { log: AuditLog }) {
  const timestamp = new Date(log.timestamp);
  const formattedDate = timestamp.toLocaleDateString();
  const formattedTime = timestamp.toLocaleTimeString();

  const statusBadge = log.status === 'success' ? (
    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300">
      ✓ Success
    </span>
  ) : (
    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-300">
      ✕ Failed
    </span>
  );

  const actionBadge = (
    <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-500/15 text-sky-300 capitalize">
      {log.action.replace(/_/g, ' ')}
    </span>
  );

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-none">
      <td className="p-4">
        {actionBadge}
      </td>
      <td className="p-4">
        <div className="font-medium text-sm">{log.username}</div>
        {log.ip_address && <div className="text-xs text-slate-500 mt-1">{log.ip_address}</div>}
      </td>
      <td className="p-4">
        {log.target_user ? (
          <div className="text-sm">{log.target_user}</div>
        ) : (
          <span className="text-slate-500 text-sm">—</span>
        )}
      </td>
      <td className="p-4">
        <div className="text-sm max-w-xs truncate" title={log.details}>
          {log.details || '—'}
        </div>
        {log.resource_type && (
          <div className="text-xs text-slate-500 mt-1">
            {log.resource_type}
            {log.resource_id && ` #${log.resource_id}`}
          </div>
        )}
      </td>
      <td className="p-4 text-right whitespace-nowrap">
        <div className="text-sm">{formattedDate}</div>
        <div className="text-xs text-slate-500 mt-1">{formattedTime}</div>
      </td>
      <td className="p-4 text-center">
        {statusBadge}
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page Component
// ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const router = useRouter();
  const { realIsAdmin } = useRole();

  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({
    actionType: '',
    dateFrom: '',
    dateTo: '',
    searchUser: '',
  });

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [pageIndex, setPageIndex] = useState(0);

  // ────────────────────────────────────────────────────────────────
  // Permission Check & Data Fetching
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Only admin can access
    if (!realIsAdmin) {
      toast.error('Admin access required');
      router.push('/');
      return;
    }

    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());

      if (filters.actionType) {
        params.append('action', filters.actionType);
      }
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo);
      }
      if (filters.searchUser) {
        params.append('username', filters.searchUser);
      }

      const res = await axios.get(
        `${apiUrl('/admin/audit-logs')}?${params.toString()}`,
        { headers: authHeaders() }
      );

      setLogs(res.data.logs || []);
      setPageIndex(offset / pageSize);
    } catch (error: any) {
      console.error('Failed to fetch audit logs:', error);
      toast.error(error?.response?.data?.detail || 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Filtering & Search
  // ────────────────────────────────────────────────────────────────

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPageIndex(0);
  };

  const handleApplyFilters = () => {
    fetchAuditLogs(0);
  };

  const handleClearFilters = () => {
    setFilters({
      actionType: '',
      dateFrom: '',
      dateTo: '',
      searchUser: '',
    });
    setPageIndex(0);
    // Refetch with cleared filters
    setTimeout(() => fetchAuditLogs(0), 50);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '10000'); // Export more records
      if (filters.actionType) params.append('action', filters.actionType);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.searchUser) params.append('username', filters.searchUser);

      const res = await axios.get(
        `${apiUrl('/admin/audit-logs')}?${params.toString()}`,
        { headers: authHeaders() }
      );

      // Create CSV
      const logs = res.data.logs || [];
      const headers = ['Action', 'User', 'Target User', 'Resource', 'Details', 'Timestamp', 'IP', 'Status'];
      const rows = logs.map((log: AuditLog) => [
        log.action,
        log.username,
        log.target_user || '',
        `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}`,
        log.details,
        new Date(log.timestamp).toISOString(),
        log.ip_address || '',
        log.status,
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Audit logs exported');
    } catch (error) {
      toast.error('Failed to export audit logs');
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  const actionTypes = useMemo(() => {
    const types = new Set<string>();
    logs.forEach((log) => types.add(log.action));
    return Array.from(types).sort();
  }, [logs]);

  return (
    <div className="nova-bg min-h-screen">
      <Toaster position="top-right" />
      <PageNav
        title="Audit Logs"
        subtitle="System activity and compliance tracking"
        backHref="/admin"
        backLabel="← Admin"
      />

      <main className="nova-content pt-24 pb-20">
        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
            <p className="text-slate-400">
              Track all system actions and user activities for compliance and debugging
            </p>
          </div>

          {/* Filters Section */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Action Type Filter */}
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">Action Type</label>
                <select
                  value={filters.actionType}
                  onChange={(e) => handleFilterChange('actionType', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                >
                  <option value="">All Actions</option>
                  {actionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                />
              </div>

              {/* User Search */}
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">Username</label>
                <input
                  type="text"
                  placeholder="Search user..."
                  value={filters.searchUser}
                  onChange={(e) => handleFilterChange('searchUser', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600"
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleApplyFilters}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-sm font-medium hover:bg-sky-500/30 transition-colors disabled:opacity-50"
              >
                🔍 Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-500/20 border border-slate-500/40 text-slate-300 text-sm font-medium hover:bg-slate-500/30 transition-colors"
              >
                ✕ Clear
              </button>
              <button
                onClick={handleExport}
                disabled={loading || logs.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div>
                  <div className="w-10 h-10 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Loading audit logs...</p>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-400 mb-4">No audit logs found</p>
                <button
                  onClick={() => handleClearFilters()}
                  className="text-xs text-sky-300 hover:text-sky-200"
                >
                  Try resetting filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left border-b border-white/10 sticky top-0">
                    <tr>
                      <th className="p-4 font-medium text-slate-300">Action</th>
                      <th className="p-4 font-medium text-slate-300">Performed By</th>
                      <th className="p-4 font-medium text-slate-300">Target User</th>
                      <th className="p-4 font-medium text-slate-300">Details</th>
                      <th className="p-4 font-medium text-slate-300">Timestamp</th>
                      <th className="p-4 font-medium text-slate-300 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <AuditLogRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Info */}
          {logs.length > 0 && (
            <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
              <p>
                Showing {logs.length} logs
                {filters.actionType && ` • Action: ${filters.actionType}`}
                {filters.searchUser && ` • User: ${filters.searchUser}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAuditLogs(Math.max(0, pageIndex * pageSize - pageSize))}
                  disabled={pageIndex === 0}
                  className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 disabled:opacity-50"
                >
                  ← Previous
                </button>
                <span className="px-3 py-1">Page {pageIndex + 1}</span>
                <button
                  onClick={() => fetchAuditLogs((pageIndex + 1) * pageSize)}
                  disabled={logs.length < pageSize}
                  className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
