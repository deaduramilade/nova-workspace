import axios from 'axios';
import { CRDTOp, CRDTState, SyncQueueEntry, SyncStatus } from './types';
import { loadCRDTState, loadSyncQueue, persistQueueEntry, removeQueueEntry, saveCRDTState } from './storage';

const API = 'http://localhost:8000/api/v1/sync';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function nodeId(): string {
  let id = localStorage.getItem('nova_crdt_node');
  if (!id) {
    id = `node-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem('nova_crdt_node', id);
  }
  return id;
}

export class SyncEngine {
  private workspaceId: number;
  private version = 0;
  private lastSyncAt: string | null = null;
  private syncing = false;
  private listeners: Array<(status: SyncStatus) => void> = [];

  constructor(workspaceId: number) {
    this.workspaceId = workspaceId;
  }

  subscribe(fn: (status: SyncStatus) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  private emit(offline: boolean) {
    const status: SyncStatus = {
      pending: loadSyncQueue().length,
      lastSyncAt: this.lastSyncAt,
      version: this.version,
      syncing: this.syncing,
      offline,
    };
    this.listeners.forEach((l) => l(status));
  }

  async queueOp(op: CRDTOp): Promise<void> {
    const entry: SyncQueueEntry = {
      id: crypto.randomUUID(),
      workspaceId: this.workspaceId,
      ops: [{ ...op, node: nodeId(), ts: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    await persistQueueEntry(entry);
    this.emit(!navigator.onLine);
  }

  async setLocal(key: string, value: unknown): Promise<void> {
    await this.queueOp({ type: 'lww_set', key, value });
    if (navigator.onLine) await this.flush();
  }

  async pullState(): Promise<CRDTState | null> {
    try {
      const res = await axios.get(`${API}/${this.workspaceId}/state`, { headers: authHeaders() });
      const state = res.data as CRDTState;
      this.version = state.version;
      await saveCRDTState(this.workspaceId, state);
      this.lastSyncAt = new Date().toISOString();
      this.emit(false);
      return state;
    } catch {
      return loadCRDTState(this.workspaceId);
    }
  }

  async flush(): Promise<number> {
    if (this.syncing || !navigator.onLine) return 0;
    const token = localStorage.getItem('access_token');
    if (!token) return 0;

    this.syncing = true;
    this.emit(false);
    let flushed = 0;
    const queue = loadSyncQueue().filter((e) => e.workspaceId === this.workspaceId);

    for (const entry of queue) {
      try {
        const res = await axios.post(
          `${API}/${this.workspaceId}/push`,
          { ops: entry.ops, node: nodeId(), client_version: this.version },
          { headers: authHeaders() },
        );
        this.version = res.data.version ?? this.version;
        removeQueueEntry(entry.id);
        if (res.data.state) await saveCRDTState(this.workspaceId, res.data.state);
        flushed++;
      } catch {
        entry.retries += 1;
        break;
      }
    }

    this.syncing = false;
    this.lastSyncAt = new Date().toISOString();
    this.emit(false);
    return flushed;
  }

  async onReconnect(): Promise<void> {
    await this.flush();
    await this.pullState();
  }

  getStatus(offline: boolean): SyncStatus {
    return {
      pending: loadSyncQueue().filter((e) => e.workspaceId === this.workspaceId).length,
      lastSyncAt: this.lastSyncAt,
      version: this.version,
      syncing: this.syncing,
      offline,
    };
  }
}