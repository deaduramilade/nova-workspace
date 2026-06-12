export interface LWWEntry {
  value: unknown;
  ts: string;
  node: string;
}

export interface LWWMapData {
  [key: string]: LWWEntry;
}

export interface ORSetData {
  adds: Record<string, string[]>;
  removes: string[];
}

export interface CRDTOp {
  id?: string;
  type: 'lww_set' | 'feedback_add' | 'or_add' | 'or_remove';
  key?: string;
  value?: unknown;
  element?: string;
  tag?: string;
  payload?: Record<string, unknown>;
  node?: string;
  ts?: string;
}

export interface CRDTState {
  workspace_id: number;
  version: number;
  updated_at: string;
  lww: LWWMapData;
  lww_snapshot: Record<string, unknown>;
  feedback_ids: ORSetData;
  feedback_items: SupervisorFeedback[];
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
  read_at?: string;
}

export interface SyncQueueEntry {
  id: string;
  workspaceId: number;
  ops: CRDTOp[];
  createdAt: string;
  retries: number;
}

export interface SyncStatus {
  pending: number;
  lastSyncAt: string | null;
  version: number;
  syncing: boolean;
  offline: boolean;
}