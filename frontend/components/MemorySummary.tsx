'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Decision {
  id: number;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface ActionItem {
  id: number;
  description: string;
  assigned_to: string | null;
  status: string;
  due_date: string | null;
  days_overdue?: number;
}

interface TeamInsights {
  total_items: number;
  status_breakdown: Record<string, number>;
  upcoming_items_3days: number;
}

interface MemorySummaryData {
  recent_decisions: Decision[];
  overdue_action_items: ActionItem[];
  team_insights: TeamInsights | null;
}

interface MemorySummaryProps {
  workspaceId: number;
  className?: string;
  compact?: boolean;
}

export function MemorySummary({
  workspaceId,
  className = '',
  compact = false,
}: MemorySummaryProps) {
  const { authToken, user } = useAuth();
  const [summary, setSummary] = useState<MemorySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!authToken) return;

      try {
        setLoading(true);
        const response = await fetch(
          `/api/v1/memory/dashboard-summary?workspace_id=${workspaceId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch memory summary');
        }

        const data = await response.json();
        setSummary(data.summary);
        setError(null);
      } catch (err) {
        console.error('Error fetching memory summary:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [workspaceId, authToken]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-40 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const hasOverdueItems = summary.overdue_action_items.length > 0;
  const hasRecentDecisions = summary.recent_decisions.length > 0;
  const hasTeamInsights = summary.team_insights && user?.role === 'supervisor';

  if (!hasOverdueItems && !hasRecentDecisions && !hasTeamInsights) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4 text-gray-900">Memory Summary</h2>

      {/* Overdue Action Items - Most Important */}
      {hasOverdueItems && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-red-700 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 rounded-full text-xs font-semibold">
                ⚠️
              </span>
              Overdue Action Items
            </h3>
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {summary.overdue_action_items.length}
            </span>
          </div>
          <div className={`space-y-2 ${compact ? 'max-h-32 overflow-y-auto' : ''}`}>
            {summary.overdue_action_items.slice(0, compact ? 3 : 5).map((item) => (
              <div
                key={item.id}
                className="text-sm p-2 bg-red-50 rounded border border-red-100"
              >
                <p className="text-gray-800 font-medium line-clamp-2">
                  {item.description}
                </p>
                <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                  <span>{item.assigned_to || 'Unassigned'}</span>
                  <span className="text-red-600 font-semibold">
                    {item.days_overdue} days overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Decisions */}
      {hasRecentDecisions && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h3 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
            <span>📋</span>
            Recent Decisions
          </h3>
          <div className={`space-y-2 ${compact ? 'max-h-40 overflow-y-auto' : ''}`}>
            {summary.recent_decisions.slice(0, compact ? 2 : 3).map((decision) => (
              <div
                key={decision.id}
                className="text-sm p-2 bg-blue-50 rounded border border-blue-100"
              >
                <p className="text-gray-800 line-clamp-2">{decision.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(decision.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Insights (for Supervisors) */}
      {hasTeamInsights && summary.team_insights && (
        <div className="mb-3">
          <h3 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
            <span>👥</span>
            Team Insights
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
              <p className="text-lg font-bold text-gray-900">
                {summary.team_insights.total_items}
              </p>
              <p className="text-xs text-gray-600">Total Items</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded border border-green-200">
              <p className="text-lg font-bold text-green-700">
                {summary.team_insights.status_breakdown.completed || 0}
              </p>
              <p className="text-xs text-green-600">Completed</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-lg font-bold text-yellow-700">
                {summary.team_insights.upcoming_items_3days}
              </p>
              <p className="text-xs text-yellow-600">Due in 3d</p>
            </div>
          </div>
        </div>
      )}

      {/* View All Link */}
      <Link
        href={`/memory?workspace_id=${workspaceId}`}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-3 inline-block"
      >
        View all memory →
      </Link>
    </div>
  );
}
