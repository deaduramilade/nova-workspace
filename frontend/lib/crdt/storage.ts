import { CRDTState, SyncQueueEntry } from './types';

const DB_NAME = 'nova_crdt';
const DB_VERSION = 1;
const QUEUE_KEY = 'nova_sync_queue';
const STATE_PREFIX = 'nova_crdt_state_';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('states')) db.createObjectStore('states');
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCRDTState(workspaceId: number, state: CRDTState): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('states', 'readwrite');
      tx.objectStore('states').put(state, String(workspaceId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    localStorage.setItem(`${STATE_PREFIX}${workspaceId}`, JSON.stringify(state));
  }
}

export async function loadCRDTState(workspaceId: number): Promise<CRDTState | null> {
  try {
    const db = await openDB();
    const state = await new Promise<CRDTState | null>((resolve, reject) => {
      const tx = db.transaction('states', 'readonly');
      const req = tx.objectStore('states').get(String(workspaceId));
      req.onsuccess = () => resolve((req.result as CRDTState) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return state;
  } catch {
    const raw = localStorage.getItem(`${STATE_PREFIX}${workspaceId}`);
    return raw ? JSON.parse(raw) : null;
  }
}

export function loadSyncQueue(): SyncQueueEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: SyncQueueEntry[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function persistQueueEntry(entry: SyncQueueEntry): Promise<void> {
  const queue = loadSyncQueue();
  queue.push(entry);
  saveSyncQueue(queue);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* localStorage fallback already saved */ }
}

export function removeQueueEntry(id: string): void {
  saveSyncQueue(loadSyncQueue().filter((e) => e.id !== id));
}