import type { TextIndexRecord } from "./types.js";

const MAGIC = 0x54455849;
const VERSION = 2;
const HEADER_SIZE = 16;

export class TextIndex {
  private readonly view: DataView;
  private readonly decoder = new TextDecoder("utf-8");
  readonly entryCount: number;

  private rankedCache?: TextIndexRecord[];

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    const magic = this.view.getUint32(0, true);
    const version = this.view.getUint32(4, true);
    if (magic !== MAGIC) throw badMagic("textindex", magic, MAGIC);
    if (version !== VERSION) throw badVersion("textindex", version, VERSION);
    this.entryCount = this.view.getUint32(8, true);
  }

  recordOffset(i: number): number {
    return this.view.getUint32(HEADER_SIZE + i * 4, true);
  }

  record(i: number): TextIndexRecord {
    const off = this.recordOffset(i);
    const len = this.view.getUint16(off, true);
    const name = this.decoder.decode(
      new Uint8Array(this.view.buffer, off + 2, len),
    );
    const nodeOffset = this.view.getUint32(off + 2 + len, true);
    const population = this.view.getUint32(off + 2 + len + 4, true);
    return { index: i, name, nodeOffset, population };
  }

  lowerBound(queryBytes: Uint8Array): number {
    let lo = 0;
    let hi = this.entryCount;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.compareName(mid, queryBytes) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private compareName(i: number, queryBytes: Uint8Array): number {
    const off = this.recordOffset(i);
    const len = this.view.getUint16(off, true);
    const n = Math.min(len, queryBytes.length);
    for (let k = 0; k < n; k++) {
      const a = this.view.getUint8(off + 2 + k);
      if (a !== queryBytes[k]) return a < queryBytes[k] ? -1 : 1;
    }
    return len - queryBytes.length;
  }

  private startsAt(i: number, queryBytes: Uint8Array): boolean {
    const off = this.recordOffset(i);
    const len = this.view.getUint16(off, true);
    if (len < queryBytes.length) return false;
    for (let k = 0; k < queryBytes.length; k++) {
      if (this.view.getUint8(off + 2 + k) !== queryBytes[k]) return false;
    }
    return true;
  }

  prefixMatches(queryBytes: Uint8Array): TextIndexRecord[] {
    const out: TextIndexRecord[] = [];
    let i = this.lowerBound(queryBytes);
    while (i < this.entryCount && this.startsAt(i, queryBytes)) {
      out.push(this.record(i));
      i++;
    }
    return out;
  }

  uniqueByPopulation(): TextIndexRecord[] {
    if (this.rankedCache) return this.rankedCache;
    const all: TextIndexRecord[] = [];
    for (let i = 0; i < this.entryCount; i++) all.push(this.record(i));
    this.rankedCache = rankByPopulation(all);
    return this.rankedCache;
  }
}

export function rankByPopulation(
  records: TextIndexRecord[],
): TextIndexRecord[] {
  const byNode = new Map<number, TextIndexRecord>();
  for (const r of records)
    if (!byNode.has(r.nodeOffset)) byNode.set(r.nodeOffset, r);
  return [...byNode.values()].sort((a, b) => b.population - a.population);
}

function badMagic(what: string, got: number, want: number): Error {
  return new Error(
    `${what}: bad magic 0x${got.toString(16)} (expected 0x${want.toString(16)})`,
  );
}

function badVersion(what: string, got: number, want: number): Error {
  return new Error(`${what}: unsupported version ${got} (expected ${want})`);
}

export function queryBytes(query: string): Uint8Array {
  return new TextEncoder().encode(query.toLowerCase());
}

export function searchCities(
  index: TextIndex,
  query: string,
): TextIndexRecord[] {
  const q = query.trim();
  if (!q) return [];
  return rankByPopulation(index.prefixMatches(queryBytes(q)));
}
