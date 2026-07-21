interface Cached {
  buf: ArrayBuffer;
  lastModified: string | null;
  contentLength: number | null;
}

const DB_NAME = "chronocosmos";
const STORE = "binaries";
const DB_VERSION = 1;

export async function loadBuffer(
  url: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const meta = await headMeta(url).catch(() => null);
  const key = url;

  if (meta) {
    const cached = await get(key).catch(() => undefined);
    if (cached && sameMeta(cached, meta)) return cached.buf;
  }

  const buf = await fetchBuffer(url, onProgress);
  await put(key, {
    buf,
    lastModified: meta?.lastModified ?? null,
    contentLength: meta?.contentLength ?? null,
  }).catch(() => undefined);
  return buf;
}

function sameMeta(
  c: Cached,
  m: { lastModified: string | null; contentLength: number | null },
): boolean {
  return (
    c.lastModified === m.lastModified && c.contentLength === m.contentLength
  );
}

async function headMeta(
  url: string,
): Promise<{ lastModified: string | null; contentLength: number | null }> {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`HEAD ${res.status} sur ${url}`);
  return {
    lastModified: res.headers.get("Last-Modified"),
    contentLength: numberOrNull(res.headers.get("Content-Length")),
  };
}

async function fetchBuffer(
  url: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const total = numberOrNull(res.headers.get("Content-Length"));

  if (!res.body || !onProgress) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

function numberOrNull(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(key: string): Promise<Cached | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Cached | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function put(key: string, value: Cached): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
