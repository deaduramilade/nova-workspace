export interface FeedbackTool {
  type: string;
  label: string;
  icon: string;
  description: string;
}

export interface SupervisorOverview {
  updated_at: string;
  phase: number;
  role: string;
  is_supervisor: boolean;
  integrations: Record<string, { status: string; [key: string]: unknown }>;
  metrics: {
    online_users: number;
    total_users: number;
    active_workspaces: number;
    hours_tracked_today: number;
    pending_feedback: number;
  };
}

export interface SupervisorFeedback {
  id: string;
  type: string;
  message: string;
  from: string;
  to?: string | null;
  workspace_id: number;
  priority: string;
  created_at: string;
  delivered?: boolean;
  read?: boolean;
}

export const FEEDBACK_STYLES: Record<string, { color: string; bg: string }> = {
  nudge: { color: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-400/25' },
  praise: { color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-400/25' },
  flag: { color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-400/25' },
  broadcast: { color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-400/25' },
  check_in: { color: 'text-indigo-300', bg: 'bg-indigo-500/10 border-indigo-400/25' },
};