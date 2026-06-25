'use client';

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiUrl, authHeaders } from '../lib/api';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  status: HealthStatus;
  latency_ms?: number;
  active_connections?: number;
  active_workers?: number;
  details?: string;
}

export interface SystemHealth {
  database: ServiceHealth;
  redis: ServiceHealth;
  websocket: ServiceHealth;
  workers?: ServiceHealth;
  timestamp?: string;
}

export interface SystemHealthCardsProps {
  /** Refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Show compact or full view (default: false) */
  compact?: boolean;
  /** Callback when health data is updated */
  onHealthUpdate?: (health: SystemHealth) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  /** Show timestamp of last update (default: true) */
  showTimestamp?: boolean;
  /** Disable auto-refresh (default: false) */
  disableAutoRefresh?: boolean;
}

// ────────────────────────────────────────────────────────────────
// Status Color Helpers
// ────────────────────────────────────────────────────────────────

function getStatusColor(status: HealthStatus): {
  bg: string;
  border: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300',
        dot: 'bg-emerald-500',
      };
    case 'degraded':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        dot: 'bg-amber-500',
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-300',
        dot: 'bg-red-500',
      };
  }
}

function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '✓ Healthy';
    case 'degraded':
      return '⚠ Degraded';
    case 'unhealthy':
      return '✕ Unhealthy';
  }
}

// ────────────────────────────────────────────────────────────────
// Health Card Component
// ────────────────────────────────────────────────────────────────

interface HealthCardProps {
  icon: string;
  name: string;
  health: ServiceHealth;
  compact?: boolean;
}

function HealthCard({ icon, name, health, compact = false }: HealthCardProps) {
  const colors = getStatusColor(health.status);
  const statusLabel = getStatusLabel(health.status);

  if (compact) {
    return (
      <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{icon} {name}</p>
            <p className={`text-xs ${colors.text}`}>{statusLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-5 rounded-xl border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-sm text-white">{name}</h3>
            <p className={`text-xs ${colors.text} mt-0.5`}>{statusLabel}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-slate-400">
        {health.latency_ms !== undefined && (
          <div className="flex justify-between">
            <span>Response Time:</span>
            <span className={colors.text}>{health.latency_ms}ms</span>
          </div>
        )}
        {health.active_connections !== undefined && (
          <div className="flex justify-between">
            <span>Active Connections:</span>
            <span className={colors.text}>{health.active_connections}</span>
          </div>
        )}
        {health.active_workers !== undefined && (
          <div className="flex justify-between">
            <span>Active Workers:</span>
            <span className={colors.text}>{health.active_workers}</span>
          </div>
        )}
        {health.details && (
          <div className="pt-2 border-t border-white/10 mt-2">
            <p className="text-slate-500 italic">{health.details}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function SystemHealthCards({
  refreshInterval = 30000,
  compact = false,
  onHealthUpdate,
  onError,
  showTimestamp = true,
  disableAutoRefresh = false,
}: SystemHealthCardsProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ────────────────────────────────────────────────────────────────
  // Data Fetching
  // ────────────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await axios.get(apiUrl('/admin/system/health'), {
        headers: authHeaders(),
      });

      setHealth(res.data);
      setLastUpdate(new Date());
      setLoading(false);

      if (onHealthUpdate) {
        onHealthUpdate(res.data);
      }
    } catch (error: any) {
      const err = new Error(
        error?.response?.data?.detail || 'Failed to fetch system health'
      );

      if (onError) {
        onError(err);
      } else {
        console.error('System health fetch error:', err);
      }

      // Set error health state
      setHealth({
        database: { status: 'unhealthy', details: 'Connection error' },
        redis: { status: 'unhealthy', details: 'Connection error' },
        websocket: { status: 'unhealthy', details: 'Connection error' },
      });
      setLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [onHealthUpdate, onError]);

  // ────────────────────────────────────────────────────────────────
  // Effects
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Setup auto-refresh if not disabled
    if (disableAutoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      fetchHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchHealth, refreshInterval, disableAutoRefresh]);

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-500/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading system health...</p>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400">Unable to load system health</p>
        <button
          onClick={() => fetchHealth()}
          className="text-xs text-sky-300 hover:text-sky-200 mt-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <HealthCard icon="🗄️" name="Database" health={health.database} compact />
        <HealthCard icon="⚡" name="Redis" health={health.redis} compact />
        <HealthCard icon="🔌" name="WebSocket" health={health.websocket} compact />
        {health.workers && <HealthCard icon="🤖" name="Workers" health={health.workers} compact />}

        {showTimestamp && lastUpdate && (
          <div className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
            <span>Updated {formatRelativeTime(lastUpdate)}</span>
            {isRefreshing && <span className="inline-block w-1 h-1 bg-sky-400 rounded-full animate-pulse" />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard icon="🗄️" name="Database" health={health.database} />
        <HealthCard icon="⚡" name="Redis" health={health.redis} />
        <HealthCard icon="🔌" name="WebSocket" health={health.websocket} />
        {health.workers && <HealthCard icon="🤖" name="Workers" health={health.workers} />}
      </div>

      {showTimestamp && (
        <div className="mt-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
          <span>
            Last updated: {lastUpdate ? formatRelativeTime(lastUpdate) : 'never'}
          </span>
          {isRefreshing && (
            <span className="inline-block w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
          )}
          <button
            onClick={() => fetchHealth()}
            disabled={isRefreshing}
            className="text-sky-400 hover:text-sky-300 disabled:opacity-50 ml-1"
            title="Refresh now"
          >
            🔄
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}
