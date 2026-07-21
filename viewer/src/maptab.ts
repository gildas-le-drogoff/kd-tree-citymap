import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { KdTree } from "./kdtree.js";
import { loadBuffer } from "./store.js";
import { searchCities, type TextIndex } from "./textindex.js";
import type { KdNodeRecord, TextIndexRecord } from "./types.js";

const KDTREE_URL =
  new URLSearchParams(location.search).get("kdtree") ??
  `${import.meta.env.BASE_URL}ma_base.kdtree.bin`;
const DEFAULT_K = 128;
const SUGGEST_LIMIT = 12;

const els = {
  map: byId("map"),
  status: byId("map-status"),
  info: byId("map-info"),
  k: byId<HTMLInputElement>("knn-k"),
  search: byId<HTMLInputElement>("map-search"),
  suggest: byId("map-suggest"),
};

let kd: KdTree;
let idx: TextIndex;
let map: any;
let layer: any;
let tiles: any;
let focusLayer: any;
let lastQuery: { lat: number; lng: number } | null = null;

export function setSearchIndex(index: TextIndex): void {
  idx = index;
}

export async function initMapTab(): Promise<void> {
  if (map) {
    map.invalidateSize();
    return;
  }

  setStatus("Téléchargement de ma_base.kdtree.bin…");
  const buf = await loadBuffer(KDTREE_URL, (loaded, total) =>
    setStatus(
      total
        ? `Téléchargement… ${pct(loaded, total)} %`
        : `Téléchargement… ${mb(loaded)}`,
    ),
  );
  kd = new KdTree(buf);
  setStatus(
    `KD-tree prêt — ${kd.nodeCount.toLocaleString("fr-FR")} nœuds. Cliquez sur la carte.`,
  );

  buildMap();
  els.k.value = String(DEFAULT_K);
  els.k.addEventListener("change", rerun);
  document.documentElement.addEventListener("themechange", swapTiles);
  setupSearch();
}

function buildMap(): void {
  map = L.map(els.map, { worldCopyJump: true }).setView([20, 0], 2);
  tiles = L.tileLayer(tileUrl(), {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  focusLayer = L.layerGroup().addTo(map);
  map.on("click", (e: { latlng: { lat: number; lng: number } }) =>
    query(e.latlng.lat, e.latlng.lng),
  );

  // Reflow on any container size change: tab switch, rotation, breakpoint.
  new ResizeObserver(() => map.invalidateSize()).observe(els.map);
  setTimeout(() => map.invalidateSize(), 0);
}

export async function focusOn(
  lat: number,
  lng: number,
  label: string,
): Promise<void> {
  await initMapTab();
  map.setView([lat, lng], 10);
  focusLayer.clearLayers();
  L.circleMarker([lat, lng], {
    radius: 8,
    color: "#f59e0b",
    weight: 3,
    fillOpacity: 0.9,
  })
    .bindPopup(label, { autoPan: false })
    .addTo(focusLayer)
    .openPopup();
  query(lat, lng);
}

function tileUrl(): string {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const style = dark ? "dark_all" : "light_all";
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
}

function swapTiles(): void {
  if (tiles) tiles.setUrl(tileUrl());
}

function setupSearch(): void {
  const run = debounce(onMapSearch, 120);
  els.search.addEventListener("input", run);
  els.search.addEventListener("focus", () => {
    if (els.search.value.trim()) onMapSearch();
  });
  els.search.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") hideSuggest();
  });
  els.search.addEventListener("blur", hideSuggest);
}

function onMapSearch(): void {
  if (!idx) return;
  renderSuggest(searchCities(idx, els.search.value).slice(0, SUGGEST_LIMIT));
}

function renderSuggest(records: TextIndexRecord[]): void {
  els.suggest.textContent = "";
  if (!records.length) {
    hideSuggest();
    return;
  }
  for (const r of records) {
    try {
      els.suggest.appendChild(suggestItem(r));
    } catch {}
  }
  els.suggest.hidden = false;
}

function suggestItem(r: TextIndexRecord): HTMLLIElement {
  const c = kd.read(r.nodeOffset).city;
  const li = document.createElement("li");
  li.innerHTML =
    `<span class="s-name">${esc(c.name)}</span>` +
    `<span class="s-meta">${esc(countryBits(c))} · pop ${c.population.toLocaleString("fr-FR")}</span>`;

  li.addEventListener("mousedown", (e) => {
    e.preventDefault();
    pickCity(c);
  });
  return li;
}

function pickCity(c: KdNodeRecord["city"]): void {
  els.search.value = c.name;
  hideSuggest();
  void focusOn(c.lat, c.lng, c.name);
}

function hideSuggest(): void {
  els.suggest.hidden = true;
}

function debounce<A extends unknown[]>(
  fn: (...a: A) => void,
  ms: number,
): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function rerun(): void {
  if (lastQuery) query(lastQuery.lat, lastQuery.lng);
}

function query(lat: number, lng: number): void {
  lastQuery = { lat, lng };
  const k = clampK(Number(els.k.value));
  const records = kd.knn(lat, lng, k);
  drawNeighbors(records, lat, lng);
  renderNeighbors(els.info, records, lat, lng);
}

function drawNeighbors(
  records: KdNodeRecord[],
  lat: number,
  lng: number,
): void {
  layer.clearLayers();
  L.circleMarker([lat, lng], {
    radius: 5,
    color: "#f87171",
    fillOpacity: 0.9,
    weight: 2,
  })
    .bindPopup("Point cliqué")
    .addTo(layer);
  records.forEach((r, i) => {
    const near = i === 0;
    L.circleMarker([r.city.lat, r.city.lng], {
      radius: near ? 9 : 6,
      color: near ? "#4ade80" : "#6ea8fe",
      weight: near ? 3 : 2,
      fillOpacity: 0.8,
    })
      .bindPopup(popup(r))
      .addTo(layer);
  });
}

function popup(r: KdNodeRecord): string {
  const c = r.city;
  return `<b>${esc(c.name)}</b><br>${esc(c.countryName || c.countryCode)} · pop ${c.population.toLocaleString("fr-FR")}`;
}

function renderNeighbors(
  el: HTMLElement,
  records: KdNodeRecord[],
  lat: number,
  lng: number,
): void {
  el.textContent = "";
  el.appendChild(h3(`${records.length} ville(s) la plus(s) proche(s)`));
  for (const r of records) el.appendChild(neighborCard(r, lat, lng));
}

function neighborCard(
  r: KdNodeRecord,
  lat: number,
  lng: number,
): HTMLButtonElement {
  const c = r.city;
  const km = haversineKm(lat, lng, c.lat, c.lng);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "result";
  btn.innerHTML =
    `<span class="r-name">${esc(c.name)}</span>` +
    `<span class="r-meta">${esc(countryBits(c))} · pop ${c.population.toLocaleString("fr-FR")} · ${km.toFixed(1)} km · ${fmt(c.lat)}, ${fmt(c.lng)}</span>`;
  btn.addEventListener("click", () => map.panTo([c.lat, c.lng]));
  return btn;
}

function countryBits(c: KdNodeRecord["city"]): string {
  return [c.provinceName, c.countryName || c.countryCode]
    .filter(Boolean)
    .join(" · ");
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

function clampK(v: number): number {
  return Math.max(
    1,
    Math.min(512, Number.isFinite(v) ? Math.floor(v) : DEFAULT_K),
  );
}

function pct(loaded: number, total: number): string {
  return Math.round((loaded / total) * 100).toString();
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function fmt(v: number): string {
  return v.toFixed(4);
}

function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (ch) => mapCh[ch] as string);
}

const mapCh: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function h3(text: string): HTMLHeadingElement {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function setStatus(t: string): void {
  els.status.textContent = t;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} manquant`);
  return el as T;
}
