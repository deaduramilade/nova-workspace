'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../../components/PageNav';
import { useRole } from '../../../contexts/RoleContext';
import { apiUrl, authHeaders } from '../../../lib/api';

interface AuditLog {
  id: number;
  action: string;
  target_user_id: number | null;
  target_username: string | null;
  performed_by_id: number;
  performed_by_username: string;
  old_value: string | null;
  new_value: string | null;
  details: any;
  ip_address: string | null;
  timestamp: string;
}

export default function AuditLogViewer() {
  const router = useRouter();
  const { realIsAdmin } = useRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [limit] = useState(100);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit };
      if (filterAction) params.action = filterAction;
      const res = await axios.get(apiUrl('/admin/audit-logs'), {
        params,
        headers: authHeaders(),
      });
      setLogs(res.data.logs || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        toast.error('Administrator access required');
        router.push('/admin');
        return;
      }
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!realIsAdmin) {
      router.push('/admin');
      return;
    }
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, realIsAdmin]);

  if (!realIsAdmin) {
    return null; // Gate handled in effect + backend
  }

  const filteredLogs = logs; // server filtered for action

  return (
    <div className="min-h-screen text-readable">
      <Toaster position="top-center" />
      <PageNav
        title="Audit Log Viewer"
        subtitle="Role change and administrative action history"
        backLabel="← Back to Admin Dashboard"
        backHref="/admin"
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-readable-muted mt-1">
            View all recorded role changes and related admin actions. Logs are immutable and sourced from the database.
          </p>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center glass p-4 rounded-2xl">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm"
          >
            <option value="">All Actions</option>
            <option value="role_change_approved">Role Change Approved</option>
            <option value="role_change_rejected">Role Change Rejected</option>
            <option value="user_role_updated">Direct Role Update</option>
          </select>
          <button onClick={fetchAuditLogs} className="glass px-4 py-2 rounded-xl text-sm">
            Refresh
          </button>
          <div className="ml-auto text-xs text-readable-subtle">
            Showing {filteredLogs.length} entries (limit {limit})
          </div>
        </div>

        {/* Logs Table */}
        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          {loading ? (
            <div className="p-12 flex justify-center"><div className="nova-spinner" /></div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-readable-muted">No audit logs found for the selected filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left border-b border-white/10">
                <tr>
                  <th className="p-4 font-medium">Timestamp</th>
                  <th className="p-4 font-medium">Action</th>
                  <th className="p-4 font-medium">Target User</th>
                  <th className="p-4 font-medium">Performed By</th>
                  <th className="p-4 font-medium">Role Change</th>
                  <th className="p-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 text-xs text-readable-subtle tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        log.action.includes('approved') ? 'bg-emerald-500/15 text-emerald-300' :
                        log.action.includes('rejected') ? 'bg-red-500/15 text-red-300' :
                        'bg-amber-500/15 text-amber-300'
                      }`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {log.target_username ? (
                        <span>{log.target_username} <span className="text-xs text-readable-subtle">(#{log.target_user_id})</span></span>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      {log.performed_by_username} <span className="text-xs text-readable-subtle">(#{log.performed_by_id})</span>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {log.old_value && log.new_value ? (
                        <span>
                          {log.old_value} → <span className="font-semibold">{log.new_value}</span>
                        </span>
                      ) : log.new_value ? (
                        <span className="font-semibold">{log.new_value}</span>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-xs text-readable-subtle max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {log.details ? (
                        log.details.notes ? `Notes: ${log.details.notes}` : JSON.stringify(log.details).slice(0, 50)
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-[10px] text-readable-subtle">
          Audit logs are append-only and provide a tamper-evident history of role-related administrative actions.
          Use filters to narrow by action type.
        </p>
      </main>
    </div>
  );
}
