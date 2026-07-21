import { Cursor } from "./binary.js";
import type { CityData, KdNode, KdNodeRecord, LangName } from "./types.js";

const MAGIC = 0x4b445452;
const VERSION = 4;

const I32_MIN = -2147483648;

export class KdTree {
  private readonly buffer: ArrayBuffer;
  private readonly view: DataView;
  readonly nodeCount: number;
  readonly rootOffset: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    const magic = this.view.getUint32(0, true);
    const version = this.view.getUint32(4, true);
    if (magic !== MAGIC) throw badMagic(magic, MAGIC);
    if (version !== VERSION) throw badVersion(version, VERSION);
    this.nodeCount = this.view.getUint32(8, true);
    this.rootOffset = this.view.getUint32(12, true);
  }

  node(offset: number): KdNode {
    const v = this.view;
    const nodeType = v.getUint8(offset);
    const cityDataLen = v.getUint32(offset + 10, true);
    const cityDataOffset = offset + 14;
    const node: KdNode = {
      offset,
      nodeType,
      lat: v.getFloat32(offset + 1, true),
      lng: v.getFloat32(offset + 5, true),
      axis: v.getUint8(offset + 9),
      cityDataLen,
      cityDataOffset,
      left: 0,
      right: 0,
    };
    if (nodeType === 1) {
      node.left = v.getUint32(cityDataOffset + cityDataLen, true);
      node.right = v.getUint32(cityDataOffset + cityDataLen + 4, true);
    }
    return node;
  }

  read(offset: number): KdNodeRecord {
    const node = this.node(offset);
    return {
      ...node,
      city: this.readCity(node.cityDataOffset, node.cityDataLen),
    };
  }

  knn(lat: number, lng: number, k: number): KdNodeRecord[] {
    const heap = new NeighborHeap(k);
    this.knnSearch(this.rootOffset, lat, lng, heap);
    return heap.sorted().map((h) => this.read(h.offset));
  }

  private knnSearch(
    offset: number,
    qLat: number,
    qLng: number,
    heap: NeighborHeap,
  ): void {
    if (offset === 0) return;
    const node = this.node(offset);
    heap.push(offset, sq(node.lat - qLat) + sq(node.lng - qLng));
    if (node.nodeType !== 1) return;

    const split = node.axis === 0 ? node.lat : node.lng;
    const q = node.axis === 0 ? qLat : qLng;
    const delta = q - split;
    const [near, far] =
      delta < 0 ? [node.left, node.right] : [node.right, node.left];
    this.knnSearch(near, qLat, qLng, heap);
    if (delta * delta <= heap.worst) this.knnSearch(far, qLat, qLng, heap);
  }

  private readCity(byteOffset: number, byteLength: number): CityData {
    const c = new Cursor(this.buffer, byteOffset, byteLength);
    const id = c.u32();
    const lat = c.f32();
    const lng = c.f32();
    const population = c.u32();
    const elevation = c.i32();
    const dem = c.i32();
    const name = c.string();
    const asciiName = c.string();
    const alternatenames = c.string();
    const featureClass = c.string();
    const featureCode = c.string();
    const countryCode = c.string();
    const cc2 = c.string();
    const admin1 = c.string();
    const admin2 = c.string();
    const admin3 = c.string();
    const admin4 = c.string();
    const timezone = c.string();
    const modificationDate = c.string();
    const vernacular = readLangNames(c, c.u16());
    const provinceName = c.string();
    const countryName = c.string();
    const utcOffsetSeconds = c.i32();
    const provinceIsoCode = c.string();
    const provinceType = c.string();
    const provinceWikidataId = c.string();
    const provinceNames = readLangNames(c, c.u16());
    return {
      id,
      lat,
      lng,
      population,
      elevation,
      dem,
      name,
      asciiName,
      alternatenames,
      featureClass,
      featureCode,
      countryCode,
      cc2,
      admin1,
      admin2,
      admin3,
      admin4,
      timezone,
      modificationDate,
      vernacular,
      provinceName,
      countryName,
      utcOffsetSeconds,
      utcOffsetUnknown: utcOffsetSeconds === I32_MIN,
      provinceIsoCode,
      provinceType,
      provinceWikidataId,
      provinceNames,
    };
  }
}

function readLangNames(cursor: Cursor, count: number): LangName[] {
  const out: LangName[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ lang: cursor.string(), name: cursor.string() });
  }
  return out;
}

function sq(x: number): number {
  return x * x;
}

class NeighborHeap {
  private readonly k: number;
  private readonly items: { offset: number; d2: number }[] = [];

  constructor(k: number) {
    this.k = Math.max(1, k | 0);
  }

  get worst(): number {
    return this.items.length < this.k ? Infinity : this.items[0].d2;
  }

  push(offset: number, d2: number): void {
    if (this.items.length < this.k) {
      this.items.push({ offset, d2 });
      this.siftUp(this.items.length - 1);
    } else if (d2 < this.items[0].d2) {
      this.items[0] = { offset, d2 };
      this.siftDown(0);
    }
  }

  sorted(): { offset: number; d2: number }[] {
    return [...this.items].sort((a, b) => a.d2 - b.d2);
  }

  private siftUp(i: number): void {
    for (
      let p = (i - 1) >>> 1;
      i > 0 && this.items[i].d2 > this.items[p].d2;
      i = p, p = (i - 1) >>> 1
    ) {
      this.swap(i, p);
    }
  }

  private siftDown(i: number): void {
    for (let half = this.items.length >>> 1; i < half;) {
      let c = (i << 1) + 1;
      const r = c + 1;
      if (r < this.items.length && this.items[r].d2 > this.items[c].d2) c = r;
      if (this.items[c].d2 <= this.items[i].d2) break;
      this.swap(i, c);
      i = c;
    }
  }

  private swap(a: number, b: number): void {
    const t = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = t;
  }
}

function badMagic(got: number, want: number): Error {
  return new Error(
    `kdtree: bad magic 0x${got.toString(16)} (expected 0x${want.toString(16)})`,
  );
}

function badVersion(got: number, want: number): Error {
  return new Error(`kdtree: unsupported version ${got} (expected ${want})`);
}
