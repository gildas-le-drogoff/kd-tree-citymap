import type { KdNodeRecord, LangName, TextIndexRecord } from "./types.js";

const I32_MIN = -2147483648;

export interface ResultsView {
  results: TextIndexRecord[];
  truncated: boolean;
}

export function renderStats(
  el: HTMLElement,
  textIndex: { entryCount: number },
  kd: { nodeCount: number; rootOffset: number },
): void {
  el.textContent = "";
  el.appendChild(
    row("textindex", "entries", textIndex.entryCount.toLocaleString("fr-FR")),
  );
  el.appendChild(row("kdtree", "nodes", kd.nodeCount.toLocaleString("fr-FR")));
  el.appendChild(row("kdtree", "root offset", kd.rootOffset));
  el.appendChild(row("formats", "kdtree v4 / textindex v2", "OK"));
}

export function renderResults(
  el: HTMLElement,
  { results, truncated }: ResultsView,
  onSelect: (record: TextIndexRecord) => void,
): void {
  el.textContent = "";
  if (!results.length) {
    el.appendChild(empty("Aucun résultat."));
    return;
  }
  for (const r of results) el.appendChild(resultItem(r, onSelect));
  if (truncated) el.appendChild(truncatedNote());
}

function row(k: string, field: string, value: unknown): HTMLLIElement {
  const li = document.createElement("li");
  li.innerHTML = `<span class="kv-k">${k}</span> <span class="kv-f">${field}</span> <span class="kv-v">${escapeHtml(value)}</span>`;
  return li;
}

function resultItem(
  r: TextIndexRecord,
  onSelect: (r: TextIndexRecord) => void,
): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = "result";
  item.type = "button";
  item.innerHTML = `<span class="r-name">${escapeHtml(r.name)}</span>
    <span class="r-meta">pop ${r.population.toLocaleString("fr-FR")} · node @${r.nodeOffset}</span>`;
  item.addEventListener("click", () => onSelect(r));
  return item;
}

function truncatedNote(): HTMLLIElement {
  const note = document.createElement("li");
  note.className = "truncated";
  note.textContent = "Résultats tronqués — affinez la recherche.";
  return note;
}

export function renderDetail(
  el: HTMLElement,
  _record: TextIndexRecord | null,
  node: KdNodeRecord | null,
  onGoto: (lat: number, lng: number, label: string) => void,
): void {
  el.textContent = "";
  if (!node) {
    el.appendChild(empty("Sélectionnez une entrée."));
    return;
  }
  const c = node.city;
  el.appendChild(detailHeader(c, onGoto));
  el.appendChild(subtitle(c.asciiName, c.countryName, c.provinceName));
  el.appendChild(cityGrid(c));
  el.appendChild(section("Noms vernaculaires", c.vernacular));
  el.appendChild(
    section("Noms alternatifs", splitAlternates(c.alternatenames)),
  );
  el.appendChild(provinceBlock(c));
  el.appendChild(nodeBlock(node));
}

function detailHeader(
  c: KdNodeRecord["city"],
  onGoto: (lat: number, lng: number, label: string) => void,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "detail-head";
  wrap.appendChild(h2(c.name || `#${c.id}`));
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "goto";
  btn.textContent = "→ Aller à la carte";
  btn.addEventListener("click", () =>
    onGoto(c.lat, c.lng, c.name || `#${c.id}`),
  );
  wrap.appendChild(btn);
  return wrap;
}

function cityGrid(c: KdNodeRecord["city"]): HTMLDListElement {
  const grid = document.createElement("dl");
  grid.className = "grid";
  addGrid(grid, "geonameid", c.id);
  addGrid(grid, "lat / lng", `${fmtCoord(c.lat)} / ${fmtCoord(c.lng)}`);
  addGrid(grid, "population", c.population.toLocaleString("fr-FR"));
  addGrid(grid, "elevation", c.elevation != null ? `${c.elevation} m` : "—");
  addGrid(grid, "dem", c.dem);
  addGrid(grid, "feature", `${c.featureClass} / ${c.featureCode}`);
  addGrid(grid, "pays", `${c.countryName || "—"} (${c.countryCode || "—"})`);
  addGrid(grid, "cc2", c.cc2 || "—");
  addGrid(grid, "admin1", c.admin1 || "—");
  addGrid(grid, "admin2", c.admin2 || "—");
  addGrid(grid, "admin3", c.admin3 || "—");
  addGrid(grid, "admin4", c.admin4 || "—");
  addGrid(grid, "timezone", c.timezone || "—");
  addGrid(
    grid,
    "utc offset",
    c.utcOffsetUnknown ? "inconnu" : `${c.utcOffsetSeconds}s`,
  );
  addGrid(grid, "modifié le", c.modificationDate || "—");
  return grid;
}

function provinceBlock(c: KdNodeRecord["city"]): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "block";
  div.appendChild(h3("Province / région"));
  const dl = document.createElement("dl");
  dl.className = "grid";
  addGrid(dl, "province", c.provinceName || "—");
  addGrid(dl, "iso", c.provinceIsoCode || "—");
  addGrid(dl, "type", c.provinceType || "—");
  addGrid(dl, "wikidata", c.provinceWikidataId || "—");
  div.appendChild(dl);
  div.appendChild(section("Noms de province", c.provinceNames));
  return div;
}

function nodeBlock(node: KdNodeRecord): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "block";
  div.appendChild(h3("Nœud KD-tree"));
  const dl = document.createElement("dl");
  dl.className = "grid";
  addGrid(dl, "offset", node.offset);
  addGrid(dl, "type", node.nodeType === 1 ? "internal" : "leaf");
  addGrid(dl, "axis", node.axis === 0 ? "lat" : "lng");
  addGrid(dl, "split point", `${fmtCoord(node.lat)} / ${fmtCoord(node.lng)}`);
  addGrid(dl, "cityData len", `${node.cityDataLen} o`);
  if (node.nodeType === 1) {
    addGrid(dl, "fils gauche", node.left || "—");
    addGrid(dl, "fils droit", node.right || "—");
  }
  div.appendChild(dl);
  return div;
}

function section(
  title: string,
  items: readonly LangName[] | readonly string[],
): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "block";
  div.appendChild(h3(title));
  if (!items || !items.length) {
    div.appendChild(empty("—"));
    return div;
  }
  const ul = document.createElement("ul");
  ul.className = "tags";
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = typeof it === "string" ? it : `${it.lang}: ${it.name}`;
    ul.appendChild(li);
  }
  div.appendChild(ul);
  return div;
}

function splitAlternates(s: string): string[] {
  return s ? s.split(",").filter(Boolean) : [];
}

function addGrid(dl: HTMLDListElement, k: string, v: unknown): void {
  const dt = document.createElement("dt");
  dt.textContent = k;
  const dd = document.createElement("dd");
  dd.textContent = v == null ? "—" : String(v);
  dl.appendChild(dt);
  dl.appendChild(dd);
}

function h2(text: string): HTMLHeadingElement {
  const h = document.createElement("h2");
  h.textContent = text;
  return h;
}

function h3(text: string): HTMLHeadingElement {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function subtitle(
  ascii: string,
  country: string,
  province: string,
): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "subtitle";
  p.textContent = [ascii, province, country].filter(Boolean).join(" · ");
  return p;
}

function empty(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function fmtCoord(v: number): string {
  if (v == null || v === I32_MIN) return "—";
  return v.toFixed(4);
}

function escapeHtml(s: unknown): string {
  return String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch] as string,
  );
}
