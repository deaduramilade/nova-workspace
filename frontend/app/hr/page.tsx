'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../components/PageNav';
import { usePhase3 } from '../../contexts/Phase3Context';
import { apiUrl, authHeaders } from '../../lib/api';

interface WorkLog {
  id: string;
  username: string;
  display_name: string;
  date: string;
  seconds: number;
  hours: number;
  approved: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  source?: string;
  workspace_id?: number;
  started_at?: string;
}

interface EmployeeSummary {
  username: string;
  display_name: string;
  total_seconds: number;
  total_hours: number;
  logs: WorkLog[];
  pending_approvals: number;
}

interface HrOverview {
  total_employees_tracked: number;
  active_sessions: number;
  hours_today: number;
  pending_approvals: number;
  date: string;
}

export default function HRWorkspacePage() {
  const router = useRouter();
  const { isHR } = usePhase3();
  const [overview, setOverview] = useState<HrOverview | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'logs'>('overview');

  const fetchData = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (employeeFilter) params.employee = employeeFilter;
      if (approvedFilter === 'approved') params.approved = true;
      if (approvedFilter === 'pending') params.approved = false;

      const [ovRes, empRes] = await Promise.all([
        axios.get(apiUrl('/hr/overview'), { headers: authHeaders() }),
        axios.get(apiUrl('/hr/employees'), { params, headers: authHeaders() }),
      ]);

      setOverview(ovRes.data);

      const empData = empRes.data.employees || [];
      setEmployees(empData);

      // Also fetch flat logs for the detailed view
      const logsRes = await axios.get(apiUrl('/hr/logs'), { params, headers: authHeaders() });
      setLogs(logsRes.data.logs || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        toast.error('HR access required');
        router.push('/');
        return;
      }
      toast.error('Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isHR === false) {
      // Will be handled by role gate below too
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, employeeFilter, approvedFilter, isHR]);

  const handleApprove = async (username: string, date: string, approve: boolean) => {
    try {
      await axios.post(
        apiUrl('/hr/approve'),
        { username, date, approve },
        { headers: authHeaders() }
      );
      toast.success(`${approve ? 'Approved' : 'Unapproved'} hours for ${username} on ${date}`);
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Approval failed');
    }
  };

  const applyFilters = () => {
    fetchData();
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setEmployeeFilter('');
    setApprovedFilter('all');
    setSelectedEmployee(null);
  };

  // Role gate
  if (!isHR) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-10 rounded-3xl text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-semibold mb-2">Access Restricted</h1>
          <p className="text-readable-muted">This HR workspace is only available to users with the HR or Admin role.</p>
          <button onClick={() => router.push('/')} className="mt-6 btn-primary px-6 py-2 rounded-2xl text-sm">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredEmployees = selectedEmployee
    ? employees.filter((e) => e.username === selectedEmployee)
    : employees;

  const displayLogs = selectedEmployee
    ? logs.filter((l) => l.username === selectedEmployee)
    : logs;

  return (
    <div className="min-h-screen text-readable pb-16">
      <Toaster position="top-center" />
      <PageNav
        title="HR Workspace"
        subtitle="Employee work log tracking • Hours overview • Approvals"
        backLabel="← Dashboard"
        backHref="/"
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
            <p className="text-readable-muted mt-1">Dedicated workspace for employee hours, logs, and approvals</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-xl text-sm ${viewMode === 'overview' ? 'btn-primary' : 'glass'}`}
            >
              Employee Overview
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`px-4 py-2 rounded-xl text-sm ${viewMode === 'logs' ? 'btn-primary' : 'glass'}`}
            >
              Detailed Logs
            </button>
            <button onClick={fetchData} className="glass px-4 py-2 rounded-xl text-sm">↻ Refresh</button>
          </div>
        </header>

        {/* Overview cards */}
        {overview && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Employees Tracked', value: overview.total_employees_tracked },
              { label: 'Active Sessions', value: overview.active_sessions },
              { label: 'Hours Today', value: overview.hours_today },
              { label: 'Pending Approvals', value: overview.pending_approvals, highlight: true },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-2xl p-5">
                <div className={`text-3xl font-bold ${stat.highlight ? 'text-amber-400' : ''}`}>{stat.value}</div>
                <div className="text-xs text-readable-subtle mt-1 uppercase tracking-wider">{stat.label}</div>
                <div className="text-[10px] text-readable-subtle mt-2">{overview.date}</div>
              </div>
            ))}
          </section>
        )}

        {/* Filters */}
        <section className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-readable-subtle mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-readable-subtle mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-readable-subtle mb-1">Employee</label>
              <input
                type="text"
                placeholder="username or name"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-readable-subtle mb-1">Approval Status</label>
              <select
                value={approvedFilter}
                onChange={(e) => setApprovedFilter(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={applyFilters} className="btn-primary px-5 py-2 rounded-xl text-sm">Apply Filters</button>
              <button onClick={clearFilters} className="glass px-4 py-2 rounded-xl text-sm">Clear</button>
            </div>
          </div>
          <p className="text-[10px] text-readable-subtle mt-3">Filters apply to both overview and detailed logs. Data is live from active workspace sessions + daily totals.</p>
        </section>

        {/* Main content */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="nova-spinner" /></div>
        ) : viewMode === 'overview' ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Employee Hours Overview</h2>
              <div className="text-xs text-readable-subtle">{employees.length} employees shown</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEmployees.length === 0 && (
                <div className="glass p-8 rounded-2xl text-center col-span-full text-readable-muted">No employee data for the selected filters.</div>
              )}

              {filteredEmployees.map((emp) => (
                <div key={emp.username} className="glass rounded-2xl p-5 flex flex-col">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg">{emp.display_name}</div>
                      <div className="text-xs text-readable-subtle">@{emp.username}</div>
                    </div>
                    <div className={`text-right ${emp.pending_approvals > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      <div className="text-2xl font-bold tabular-nums">{emp.total_hours}</div>
                      <div className="text-[10px] uppercase tracking-widest -mt-1">hours</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center text-sm">
                    <div>
                      {emp.pending_approvals > 0 ? (
                        <span className="text-amber-400">{emp.pending_approvals} pending approval</span>
                      ) : (
                        <span className="text-emerald-400">All approved</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedEmployee(emp.username);
                        setViewMode('logs');
                      }}
                      className="glass px-3 py-1 rounded-xl text-xs"
                    >
                      View logs →
                    </button>
                  </div>

                  {/* Quick recent logs */}
                  {emp.logs.slice(0, 2).map((log, idx) => (
                    <div key={idx} className="mt-2 text-xs flex justify-between bg-white/5 rounded p-2">
                      <span>{log.date}</span>
                      <span className="font-medium tabular-nums">{log.hours}h</span>
                      {!log.approved && (
                        <button
                          onClick={() => handleApprove(log.username, log.date, true)}
                          className="text-emerald-400 hover:underline"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : (
          /* Detailed logs view */
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Work Logs</h2>
                {selectedEmployee && (
                  <button onClick={() => setSelectedEmployee(null)} className="text-xs ml-2 text-sky-400">Show all employees</button>
                )}
              </div>
              <div className="text-xs text-readable-subtle">{displayLogs.length} entries</div>
            </div>

            <div className="glass rounded-2xl overflow-hidden border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="p-3 font-medium">Employee</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium text-right">Hours</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Source / Workspace</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-readable-muted">No logs match the current filters.</td></tr>
                  )}
                  {displayLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-medium">{log.display_name}</div>
                        <div className="text-xs text-readable-subtle">@{log.username}</div>
                      </td>
                      <td className="p-3 tabular-nums">{log.date}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{log.hours}</td>
                      <td className="p-3">
                        {log.approved ? (
                          <span className="badge-active text-xs px-2 py-0.5">Approved {log.approved_by ? `by ${log.approved_by}` : ''}</span>
                        ) : (
                          <span className="badge-busy text-xs px-2 py-0.5">Pending Approval</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-readable-subtle">
                        {log.source} {log.workspace_id ? `• WS${log.workspace_id}` : ''}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleApprove(log.username, log.date, !log.approved)}
                          className={`px-3 py-1 rounded-xl text-xs ${log.approved ? 'glass' : 'btn-primary text-white'}`}
                        >
                          {log.approved ? 'Unapprove' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-readable-subtle mt-3">
              Approvals are stored in-memory for the demo (reset on server restart). Date/employee filters are applied server-side where possible.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
