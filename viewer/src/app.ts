import { KdTree } from "./kdtree.js";
import { focusOn, initMapTab, setSearchIndex } from "./maptab.js";
import { TextIndex, queryBytes, rankByPopulation } from "./textindex.js";
import { setupTheme } from "./theme.js";
import type { TextIndexRecord } from "./types.js";
import * as ui from "./ui.js";

const PAGE = 50;
const SEARCH_LIMIT = 100;

const params = new URLSearchParams(location.search);
const KDTREE_URL =
  params.get("kdtree") ?? `${import.meta.env.BASE_URL}ma_base.kdtree.bin`;
const TEXTINDEX_URL =
  params.get("textindex") ?? `${import.meta.env.BASE_URL}ma_base.textindex.bin`;

const els = {
  status: byId("status"),
  search: byId<HTMLInputElement>("search"),
  stats: byId("stats"),
  results: byId("results"),
  detail: byId("detail"),
  browsePrev: byId<HTMLButtonElement>("browse-prev"),
  browseNext: byId<HTMLButtonElement>("browse-next"),
  browseInfo: byId("browse-info"),
};

let textIndex: TextIndex;
let kd: KdTree;
let browseFrom = 0;

void init().catch(fail);
setupTheme();

async function init(): Promise<void> {
  setStatus("Chargement des binaires…");
  const [textBuf, kdBuf] = await Promise.all([
    fetchBuf(TEXTINDEX_URL),
    fetchBuf(KDTREE_URL),
  ]);
  textIndex = new TextIndex(textBuf);
  kd = new KdTree(kdBuf);
  setSearchIndex(textIndex);

  ui.renderStats(els.stats, textIndex, kd);
  setStatus(
    `Prêt — ${textIndex.entryCount.toLocaleString("fr-FR")} entrées indexées.`,
  );
  els.search.disabled = false;
  els.search.focus();
  renderBrowse();

  els.search.addEventListener("input", debounce(onSearch, 120));
  els.browsePrev.addEventListener("click", () => page(-1));
  els.browseNext.addEventListener("click", () => page(1));

  setupTabs();
}

function setupTabs(): void {
  document
    .querySelectorAll<HTMLButtonElement>(".tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => showTab(tab.dataset.tab ?? "search")),
    );
}

function setActiveTab(id: string): void {
  document
    .querySelectorAll<HTMLButtonElement>(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
  document
    .querySelectorAll<HTMLElement>(".tabview")
    .forEach((v) => v.classList.toggle("active", v.id === `tab-${id}`));
}

function showTab(id: string): void {
  setActiveTab(id);
  if (id === "map") initMapTab().catch(fail);
}

function gotoMap(lat: number, lng: number, label: string): void {
  setActiveTab("map");
  void focusOn(lat, lng, label).catch(fail);
}

function onSearch(): void {
  const q = els.search.value.trim();
  if (!q) {
    renderBrowse();
    return;
  }
  const ranked = rankByPopulation(textIndex.prefixMatches(queryBytes(q)));
  const truncated = ranked.length > SEARCH_LIMIT;
  ui.renderResults(
    els.results,
    { results: ranked.slice(0, SEARCH_LIMIT), truncated },
    select,
  );
  els.browseInfo.textContent = `${ranked.length.toLocaleString("fr-FR")} ville(s)${truncated ? ` (top ${SEARCH_LIMIT})` : ""}`;
  els.browsePrev.disabled = true;
  els.browseNext.disabled = true;
}

function page(dir: number): void {
  const last = textIndex.uniqueByPopulation().length;
  browseFrom = Math.max(
    0,
    Math.min(browseFrom + dir * PAGE, Math.max(0, last - PAGE)),
  );
  renderBrowse();
}

function renderBrowse(): void {
  const all = textIndex.uniqueByPopulation();
  const to = Math.min(browseFrom + PAGE, all.length);
  ui.renderResults(
    els.results,
    { results: all.slice(browseFrom, to), truncated: to < all.length },
    select,
  );
  els.browseInfo.textContent = `${browseFrom + 1}–${to} / ${all.length.toLocaleString("fr-FR")}`;
  els.browsePrev.disabled = browseFrom === 0;
  els.browseNext.disabled = to >= all.length;
}

function select(record: TextIndexRecord): void {
  try {
    ui.renderDetail(els.detail, record, kd.read(record.nodeOffset), gotoMap);
  } catch (e) {
    ui.renderDetail(els.detail, record, null, gotoMap);
    fail(e as Error);
  }
  if (window.matchMedia("(max-width: 820px)").matches) {
    els.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function fetchBuf(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.arrayBuffer();
}

function setStatus(t: string): void {
  els.status.textContent = t;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} manquant`);
  return el as T;
}

function fail(e: Error): void {
  console.error(e);
  setStatus(`Erreur : ${e.message}`);
  els.status.classList.add("error");
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
