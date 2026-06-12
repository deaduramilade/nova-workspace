import { ORSetData } from './types';

export class ORSet {
  private adds: Record<string, Set<string>> = {};
  private removes = new Set<string>();

  add(element: string, tag?: string): string {
    const t = tag ?? crypto.randomUUID();
    if (!this.adds[element]) this.adds[element] = new Set();
    this.adds[element].add(t);
    return t;
  }

  remove(element: string): void {
    const tags = this.adds[element];
    if (tags) tags.forEach((t) => this.removes.add(t));
  }

  values(): string[] {
    return Object.keys(this.adds)
      .filter((e) => {
        const tags = this.adds[e];
        return [...tags].some((t) => !this.removes.has(t));
      })
      .sort();
  }

  toDict(): ORSetData {
    const adds: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(this.adds)) adds[k] = [...v];
    return { adds, removes: [...this.removes] };
  }

  merge(remote: ORSetData): void {
    for (const [element, tags] of Object.entries(remote.adds ?? {})) {
      if (!this.adds[element]) this.adds[element] = new Set();
      tags.forEach((t) => this.adds[element].add(t));
    }
    (remote.removes ?? []).forEach((t) => this.removes.add(t));
  }
}