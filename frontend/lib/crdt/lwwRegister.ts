import { LWWEntry, LWWMapData } from './types';

function mergeEntry(a: LWWEntry | undefined, b: LWWEntry): LWWEntry {
  if (!a) return b;
  if (a.ts > b.ts) return a;
  if (b.ts > a.ts) return b;
  return a.node >= b.node ? a : b;
}

export class LWWMap {
  private data: LWWMapData = {};

  set(key: string, value: unknown, node: string, ts?: string): LWWEntry {
    const entry: LWWEntry = { value, ts: ts ?? new Date().toISOString(), node };
    this.data[key] = mergeEntry(this.data[key], entry);
    return this.data[key];
  }

  get<T = unknown>(key: string, fallback?: T): T | undefined {
    const entry = this.data[key];
    return (entry?.value as T) ?? fallback;
  }

  merge(remote: LWWMapData): void {
    for (const [key, remoteEntry] of Object.entries(remote)) {
      this.data[key] = mergeEntry(this.data[key], remoteEntry);
    }
  }

  toDict(): LWWMapData {
    return { ...this.data };
  }

  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.data)) out[k] = v.value;
    return out;
  }
}