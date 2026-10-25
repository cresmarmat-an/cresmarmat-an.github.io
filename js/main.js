/* Projects come straight from GitHub. On every visit the visitor's browser asks the
   public GitHub API for github.com/cresmarmat-an's repos; there is no server in between.
   Every public repo that isn't a fork shows up automatically with its description,
   language, topics, stars, license and last push, so publishing (or editing a repo's
   description/topics on GitHub) is all it takes to update this page. Each card's name
   is the first heading of that repo's README, also read from GitHub.
   The last good response is kept in the browser only as a stand-in: it fills the grid
   while GitHub answers, and stays up if GitHub can't be reached or the visitor has used
   up GitHub's 60-requests-an-hour limit. FALLBACK is used only when there is neither. */

const USER = "cresmarmat-an";
const API = "https://api.github.com/users/" + USER + "/repos?type=owner&sort=pushed&per_page=100";
const CACHE_KEY = "cm-repos-v2";
const SKIP = new Set([".github", USER, USER + ".github.io"]);
const TITLES_KEY = "cm-titles-v1";

// snapshot of the repos (Sep 2026), same shape as the API
const FALLBACK = [
  { name: "roblox-studiowally-plugin", description: "A Roblox Studio plugin that lets you install and update Wally packages directly, without needing an external setup like Rojo.", language: "Lua", stargazers_count: 0, pushed_at: "2026-09-17T19:49:39Z" },
  { name: "roblox-compressor", description: "Binary serialization for Roblox.", language: "Lua", stargazers_count: 0, pushed_at: "2026-09-11T19:49:05Z", license: "MIT" },
  { name: "roblox-persistence", description: "Persistence is a DataStore wrapper that makes data saving easier in Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-09-11T14:03:40Z", license: "MIT" },
  { name: "roblox-pool", description: "A generic object pool for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-30T00:19:05Z", license: "MIT" },
  { name: "roblox-spark2d", description: "Spark2D makes ParticleEmitter-style effects work inside a ScreenGui.", language: "Luau", stargazers_count: 3, pushed_at: "2026-08-26T21:51:22Z", license: "MIT" },
  { name: "roblox-mimic", description: "Mimic is typed, immutable server to client state replication for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-25T07:18:45Z", license: "MIT" },
  { name: "roblox-signal", description: "A pure-Luau replacement for BindableEvent for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-24T13:06:51Z", license: "MIT" },
  { name: "roblox-remotes", description: "A lightweight remote management module for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-24T12:53:03Z", license: "MIT" },
  { name: "roblox-promise", description: "This is a modified version of the roblox-lua-promise library. I created this version to add specific features and optimizations not present in the original repository.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-24T12:44:30Z", license: "MIT" },
  { name: "roblox-loader", description: "A module bootstrapper for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-24T12:33:17Z", license: "MIT" },
  { name: "roblox-cleaner", description: "Cleaner is a resource management and lifecycle cleanup utility for Roblox.", language: "Luau", stargazers_count: 0, pushed_at: "2026-08-24T12:14:11Z", license: "MIT" },
];

const LANG_ICON = {
  Luau: "assets/img/icons/luau.svg",
  Lua: "assets/img/icons/lua-original.svg",
  JavaScript: "assets/img/icons/javascript-original.svg",
  TypeScript: "assets/img/icons/typescript-original.svg",
  Python: "assets/img/icons/python-original.svg",
  HTML: "assets/img/icons/html5-original.svg",
  CSS: "assets/img/icons/css3-original.svg",
  C: "assets/img/icons/c-original.svg",
  "C#": "assets/img/icons/csharp-original.svg",
  "C++": "assets/img/icons/cplusplus-original.svg",
  Rust: "assets/img/icons/rust-original.svg",
};
const MONO_ICONS = new Set(["Lua", "Rust"]); // dark glyphs that need lifting in dark mode

// Lucide icons (ISC)
const svg = (inner, size) =>
  '<svg width="' + (size || 15) + '" height="' + (size || 15) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
const ICON = {
  arrow: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', 18),
  star: svg('<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'),
  fork: svg('<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>'),
  scale: svg('<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 14),
};

const root = document.documentElement;
const calmMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.23,1,.32,1)";

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ---------- data ---------- */

// keep only the fields the page uses, in the same shape the cache and FALLBACK use
function lite(r) {
  return {
    name: r.name,
    description: r.description || "",
    language: r.language || "",
    stargazers_count: r.stargazers_count || 0,
    forks_count: r.forks_count || 0,
    pushed_at: r.pushed_at || "",
    homepage: r.homepage || "",
    topics: Array.isArray(r.topics) ? r.topics : [],
    license: r.license && typeof r.license === "object" ? r.license.spdx_id || "" : r.license || "",
    archived: !!r.archived,
  };
}

// used until (or if) the README has no usable heading: "roblox-spark2d" -> "Spark2D"
function prettyName(repo) {
  return repo
    .replace(/^roblox-/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/(\d)d\b/g, "$1D");
}

function safeHome(url, repo) {
  if (!url) return "";
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(url) ? url : "https://" + url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (u.hostname === "github.com" && u.pathname.replace(/\/+$/, "").toLowerCase() === ("/" + USER + "/" + repo).toLowerCase()) return "";
    return u.href;
  } catch {
    return "";
  }
}

function toProject(r) {
  const license = r.license && r.license !== "NOASSERTION" && r.license !== "other" ? r.license : "";
  return {
    repo: r.name,
    name: titleFor(r) || prettyName(r.name),
    desc: r.description.trim(),
    lang: r.language,
    url: "https://github.com/" + USER + "/" + encodeURIComponent(r.name),
    home: safeHome(r.homepage, r.name),
    stars: r.stargazers_count,
    forks: r.forks_count || 0,
    license,
    topics: (r.topics || []).slice(0, 4),
    pushed: Date.parse(r.pushed_at) || 0,
    archived: !!r.archived,
  };
}

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && typeof c.at === "number" && Array.isArray(c.repos) && c.repos.length) return c;
  } catch { /* storage blocked or corrupt: just refetch */ }
  return null;
}
function writeCache(repos) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos })); } catch { /* private mode */ }
}

/* names: first heading of each README, re-read only after that repo gets a new push */

let titles = {};
try { titles = JSON.parse(localStorage.getItem(TITLES_KEY)) || {}; } catch { titles = {}; }

function titleFor(r) {
  const t = titles[r.name];
  return t && t.t ? t.t : "";
}

function parseTitle(md) {
  const head = md.split(/^\s*(?:```|~~~)/m)[0]; // ignore anything from the first code block on
  const m = head.match(/^ {0,3}#[ \t]+(.+?)[ \t#]*$/m) || head.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return "";
  const t = m[1]
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // badges and images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= 40 ? t : "";
}

async function fetchTitle(repo) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch("https://raw.githubusercontent.com/" + USER + "/" + encodeURIComponent(repo) + "/HEAD/README.md", { signal: ctl.signal });
    return res.ok ? parseTitle((await res.text()).slice(0, 6000)) : "";
  } finally {
    clearTimeout(timer);
  }
}

async function syncTitles(repos) {
  const stale = repos.filter((r) => !titles[r.name] || titles[r.name].at !== r.pushed_at);
  if (!stale.length) return;
  const got = await Promise.allSettled(stale.map((r) => fetchTitle(r.name)));
  got.forEach((g, i) => {
    // a failed request is retried next visit; a README without a heading is remembered
    if (g.status === "fulfilled") titles[stale[i].name] = { t: g.value, at: stale[i].pushed_at };
  });
  const keep = new Set(repos.map((r) => r.name));
  Object.keys(titles).forEach((k) => { if (!keep.has(k)) delete titles[k]; });
  try { localStorage.setItem(TITLES_KEY, JSON.stringify(titles)); } catch { /* private mode */ }
  renameCards(repos);
}

// swap names on the cards already on screen instead of rebuilding them
function renameCards(repos) {
  let changed = false;
  repos.forEach((r) => {
    const p = projects.find((x) => x.repo === r.name);
    const name = titleFor(r) || prettyName(r.name);
    if (!p || p.name === name) return;
    p.name = name;
    const a = cards.get(p.repo).querySelector("h3 a");
    a.firstChild.textContent = name;
    changed = true;
  });
  if (!changed) return;
  if (sortBy === "name" || query) applyView(true);
  updateLatest();
}

async function fetchRepos() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    // no-cache: always check with GitHub rather than reusing the browser's copy
    const res = await fetch(API, { signal: ctl.signal, cache: "no-cache", headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) {
      const err = new Error("http " + res.status);
      if (res.headers.get("x-ratelimit-remaining") === "0") err.resetAt = Number(res.headers.get("x-ratelimit-reset")) * 1000 || 1;
      throw err;
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("shape");
    return data.filter((r) => r && !r.fork && !r.private && !SKIP.has(r.name)).map(lite);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- time ---------- */

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
function ago(t) {
  if (!t) return "";
  const s = (t - Date.now()) / 1000;
  for (const [unit, sec] of UNITS) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
  return "just now";
}
function fullDate(t) {
  return new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ---------- projects ---------- */

const grid = document.getElementById("projects-grid");
const empty = document.getElementById("empty");
const emptyQ = document.getElementById("empty-q");
const search = document.getElementById("search");
const searchClear = document.getElementById("search-clear");
const sortSet = document.getElementById("sort");
const sync = document.getElementById("sync");
const syncText = document.getElementById("sync-text");
const syncRetry = document.getElementById("sync-retry");

let projects = [];
let cards = new Map();
let sortBy = "recent";
let query = "";
let lastData = "";

function langBadge(lang) {
  const b = el("span", "lang-badge");
  const src = LANG_ICON[lang];
  if (src) {
    const img = el("img", MONO_ICONS.has(lang) ? "icon-mono" : null);
    img.src = src;
    img.alt = "";
    img.width = 16;
    img.height = 16;
    img.loading = "lazy";
    b.append(img);
  } else {
    b.append(el("i", "lang-dot"));
  }
  b.append(lang || "Code");
  return b;
}

function metaItem(icon, text, title) {
  const li = el("li");
  li.innerHTML = icon;
  li.append(text);
  if (title) li.title = title;
  return li;
}

function buildCard(p) {
  const card = el("article", "proj-card reveal" + (p.archived ? " archived" : ""));
  card.dataset.repo = p.repo;

  const top = el("div", "proj-top");
  const go = el("span", "proj-go");
  go.innerHTML = ICON.arrow;
  top.append(langBadge(p.lang), go);

  const h3 = el("h3");
  const a = el("a", null, p.name);
  a.href = p.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.append(el("span", "sr-only", " (opens on GitHub)"));
  h3.append(a);

  card.append(top, h3, el("p", "proj-repo", p.repo), el("p", "proj-desc", p.desc || "No description yet."));

  const tags = p.archived ? ["archived", ...p.topics] : p.topics;
  if (tags.length) {
    const ul = el("ul", "proj-topics");
    ul.setAttribute("aria-label", "Topics");
    tags.forEach((t) => ul.append(el("li", null, t)));
    card.append(ul);
  }

  const meta = el("ul", "proj-meta");
  if (p.stars > 0) meta.append(metaItem(ICON.star, String(p.stars), p.stars === 1 ? "1 star" : p.stars + " stars"));
  if (p.forks > 0) meta.append(metaItem(ICON.fork, String(p.forks), p.forks === 1 ? "1 fork" : p.forks + " forks"));
  if (p.pushed) meta.append(metaItem(ICON.clock, "Updated " + ago(p.pushed), "Last push " + fullDate(p.pushed)));
  if (p.license) meta.append(metaItem(ICON.scale, p.license, p.license + " license"));
  if (p.home) {
    const li = el("li");
    const home = el("a", "home-link");
    home.href = p.home;
    home.target = "_blank";
    home.rel = "noopener";
    home.innerHTML = ICON.link;
    home.append("Website");
    home.setAttribute("aria-label", p.name + " website");
    li.append(home);
    li.style.marginLeft = "auto";
    meta.append(li);
  }
  if (meta.children.length) card.append(meta);
  return card;
}

function matches(p, words) {
  if (!words.length) return true;
  const hay = [p.name, p.repo, p.desc, p.lang, ...p.topics].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

const SORTS = {
  recent: (a, b) => b.pushed - a.pushed,
  stars: (a, b) => b.stars - a.stars || b.pushed - a.pushed,
  name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
};

// reorder/filter the existing cards; FLIP so they glide to their new spots
function applyView(animate) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sorted = projects.slice().sort((a, b) => (a.archived - b.archived) || SORTS[sortBy](a, b));
  const shown = sorted.filter((p) => matches(p, words));
  const hidden = sorted.filter((p) => !shown.includes(p));

  const canFlip = animate && !calmMotion && typeof Element.prototype.animate === "function";
  const before = new Map();
  if (canFlip) cards.forEach((c, k) => { if (!c.hidden) before.set(k, c.getBoundingClientRect()); });

  const frag = document.createDocumentFragment();
  shown.forEach((p) => { const c = cards.get(p.repo); c.hidden = false; frag.append(c); });
  hidden.forEach((p) => { const c = cards.get(p.repo); c.hidden = true; frag.append(c); });
  grid.append(frag);

  if (canFlip) {
    shown.forEach((p) => {
      const c = cards.get(p.repo);
      if (!c.classList.contains("in")) return;
      const was = before.get(p.repo);
      if (!was) {
        c.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE });
        return;
      }
      const now = c.getBoundingClientRect();
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      c.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 420, easing: EASE });
    });
  }

  empty.hidden = shown.length > 0 || !projects.length;
  emptyQ.textContent = "“" + query.trim() + "”";
}

function render(repos) {
  const key = JSON.stringify(repos);
  if (key === lastData) return;
  const firstPaint = !lastData;
  lastData = key;

  projects = repos.map(toProject);
  const next = new Map();
  projects.forEach((p) => {
    const c = buildCard(p);
    // a refresh after the list is already on screen shouldn't replay the entrance
    if (!firstPaint) c.classList.add("in");
    next.set(p.repo, c);
  });
  grid.replaceChildren();
  cards = next;
  applyView(false);
  grid.setAttribute("aria-busy", "false");

  if (firstPaint) {
    [...grid.children].filter((c) => !c.hidden).forEach((c, i) => { c.style.transitionDelay = Math.min(i * 50, 300) + "ms"; });
  }
  observeReveals();
  updateLatest();
}

function setSync(state, at, resetAt) {
  sync.dataset.state = state;
  const n = projects.length;
  const count = n === 1 ? "1 project" : n + " projects";
  syncRetry.hidden = state === "live" || state === "syncing";
  sync.title = state === "live" ? "Fetched from GitHub at " + new Date(at).toLocaleTimeString() : at ? "Saved copy from " + new Date(at).toLocaleString() : "";
  const copy = at ? "showing the copy from " + ago(at) : "showing a saved copy";
  if (state === "syncing") syncText.textContent = "Checking GitHub…";
  else if (state === "live") syncText.textContent = "Live from GitHub · " + count;
  else if (state === "limited") {
    const mins = resetAt > 1 ? Math.max(1, Math.ceil((resetAt - Date.now()) / 60000)) : 0;
    syncText.textContent = "GitHub's hourly limit reached" + (mins ? ", try again in " + mins + " min" : "") + " · " + copy;
  }
  else if (state === "cached") syncText.textContent = "Couldn't reach GitHub · " + copy;
  else syncText.textContent = "Couldn't reach GitHub · showing a built-in list";
}

let lastFetch = 0;
let inFlight = null;
function syncProjects() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const cached = readCache();
    // stand-in while GitHub answers, never a substitute for asking
    if (cached && !projects.length) render(cached.repos);
    if (!lastFetch) setSync("syncing");
    try {
      const repos = await fetchRepos();
      if (!repos.length) throw new Error("empty");
      lastFetch = Date.now();
      writeCache(repos);
      render(repos);
      setSync("live", lastFetch);
      syncTitles(repos).catch(() => { /* names fall back to the repo name */ });
    } catch (err) {
      if (projects.length) {
        setSync(err.resetAt ? "limited" : "cached", lastFetch || (cached && cached.at), err.resetAt);
      } else {
        render(FALLBACK.map(lite));
        setSync("offline");
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

syncRetry.addEventListener("click", () => syncProjects());
// coming back to the tab picks up anything published in the meantime
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastFetch > 60000) syncProjects();
});

/* search + sort */
search.addEventListener("input", () => {
  query = search.value;
  searchClear.hidden = !query;
  applyView(true);
});
function clearSearch() {
  search.value = "";
  query = "";
  searchClear.hidden = true;
  applyView(true);
  search.focus();
}
searchClear.addEventListener("click", clearSearch);
document.getElementById("empty-clear").addEventListener("click", clearSearch);
search.addEventListener("keydown", (e) => { if (e.key === "Escape" && search.value) { e.stopPropagation(); clearSearch(); } });
// "/" jumps to search, like on GitHub
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  e.preventDefault();
  search.focus({ preventScroll: true });
  search.scrollIntoView({ block: "center", behavior: calmMotion ? "auto" : "smooth" });
});

sortSet.addEventListener("change", (e) => {
  const input = e.target.closest("input[name=sort]");
  if (!input) return;
  sortBy = input.value;
  sortSet.dataset.i = String(["recent", "stars", "name"].indexOf(sortBy));
  applyView(true);
});

/* hero: most recent push, straight from the synced data */
const latest = document.getElementById("latest");
function updateLatest() {
  const p = projects.filter((x) => !x.archived && x.pushed).sort(SORTS.recent)[0];
  if (!p) return;
  latest.href = p.url;
  document.getElementById("latest-name").textContent = p.name;
  document.getElementById("latest-when").textContent = "· " + ago(p.pushed);
  latest.title = p.name + ", last push " + fullDate(p.pushed);
  latest.hidden = false;
}

/* ---------- reveal ---------- */

let revealObs;
function observeReveals() {
  const pending = document.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { pending.forEach((e) => e.classList.add("in")); return; }
  if (!revealObs) {
    revealObs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const t = e.target;
        t.classList.add("in");
        revealObs.unobserve(t);
        // drop the stagger once it has played, so later hovers and filters respond instantly
        if (t.style.transitionDelay) setTimeout(() => { t.style.transitionDelay = ""; }, 800);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
  }
  pending.forEach((e) => revealObs.observe(e));
}

/* ---------- nav: scroll spy ---------- */

const links = [...document.querySelectorAll(".nav-link")];
function setActive(id) {
  links.forEach((l) => {
    const on = l.getAttribute("href") === "#" + id;
    l.classList.toggle("active", on);
    if (on) l.setAttribute("aria-current", "true");
    else l.removeAttribute("aria-current");
  });
}
const sectionIds = ["home", "projects"];
function spy() {
  // the active section is the last one whose top has passed a line 40% down the viewport
  const line = innerHeight * 0.4;
  let current = sectionIds[0];
  for (const id of sectionIds) {
    const s = document.getElementById(id);
    if (s && s.getBoundingClientRect().top <= line) current = id;
  }
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = sectionIds[sectionIds.length - 1];
  setActive(current);
}

/* ---------- theme: system -> light -> dark ---------- */

const themeBtn = document.getElementById("theme-toggle");
const darkMq = matchMedia("(prefers-color-scheme: dark)");
const THEME_LABEL = { auto: "System", light: "Light", dark: "Dark" };
const THEME_ORDER = ["auto", "light", "dark"];
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({ m, content: m.content, media: m.media }));
function syncTheme() {
  const mode = THEME_ORDER.includes(root.dataset.theme) ? root.dataset.theme : "auto";
  const effective = mode === "auto" ? (darkMq.matches ? "dark" : "light") : mode;
  const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];
  themeBtn.setAttribute("aria-label", "Color theme: " + THEME_LABEL[mode] + (mode === "auto" ? " (" + effective + ")" : "") + ". Switch to " + THEME_LABEL[next].toLowerCase());
  themeBtn.title = "Theme: " + THEME_LABEL[mode] + (mode === "auto" ? " (" + effective + ")" : "");
  // keep the browser UI colour in step with a forced theme
  themeMetas.forEach(({ m, content, media }) => {
    if (mode === "auto") { m.content = content; m.media = media; }
    else { m.content = effective === "dark" ? "#22262F" : "#E0E5EC"; m.removeAttribute("media"); }
  });
}
themeBtn.addEventListener("click", () => {
  const mode = THEME_ORDER.includes(root.dataset.theme) ? root.dataset.theme : "auto";
  const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];
  root.dataset.theme = next;
  try { localStorage.setItem("cm-theme", next); } catch { /* not persisted, still applied */ }
  syncTheme();
});
darkMq.addEventListener("change", syncTheme);

/* ---------- scroll: progress bar + spy, one rAF per frame ---------- */

const progress = document.getElementById("progress");
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    spy();
    if (progress && !calmMotion) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(scrollY / max, 1).toFixed(4) : 0) + ")";
    }
  });
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll, { passive: true });

/* ---------- portrait tilt (fine pointers only) ---------- */

const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const photoImg = document.querySelector(".photo-blend img");
const heroPhoto = document.querySelector(".hero-photo");
if (finePointer && !calmMotion && photoImg && heroPhoto) {
  heroPhoto.addEventListener("pointermove", (e) => {
    const r = heroPhoto.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    photoImg.style.setProperty("--ry", (px * 14).toFixed(2) + "deg");
    photoImg.style.setProperty("--rx", (-py * 12).toFixed(2) + "deg");
  });
  heroPhoto.addEventListener("pointerleave", () => {
    photoImg.style.setProperty("--rx", "0deg");
    photoImg.style.setProperty("--ry", "0deg");
  });
}

/* ---------- tech chips: a few at a time, each at a fresh spot around the portrait ---------- */

const chips = [...document.querySelectorAll(".tech-chip")];
if (chips.length && heroPhoto) {
  const FADE = 450, GAP = 350, MAX_DELAY = 800, MIN_HOLD = 1900, HOLD_RANGE = 2200;
  const maxUp = () => (heroPhoto.clientWidth < 420 ? 3 : heroPhoto.clientWidth < 520 ? 4 : 5);
  const up = () => chips.filter((c) => c.classList.contains("show"));
  const centerOf = (c) => ({ x: c._x + c.offsetWidth / 2, y: c._y + c.offsetHeight / 2 });

  // pick the spot on a ring around the photo that is furthest from the chips already up
  const place = (c) => {
    const pw = heroPhoto.clientWidth, ph = heroPhoto.clientHeight;
    if (!pw || !ph) return;
    const w = c.offsetWidth, h = c.offsetHeight;
    const others = up().filter((o) => o !== c && o._x != null).map(centerOf);
    let best = null, bestScore = -1;
    for (let t = 0; t < 28; t++) {
      // skip the arc straight above the portrait so a chip never sits on the face
      const a = -Math.PI / 3 + Math.random() * (Math.PI * 5 / 3);
      const rx = pw * (0.34 + Math.random() * 0.1);
      const ry = ph * (0.36 + Math.random() * 0.1);
      const x = Math.max(2, Math.min(pw - w - 2, pw / 2 + Math.cos(a) * rx - w / 2));
      const y = Math.max(2, Math.min(ph - h - 2, ph / 2 + Math.sin(a) * ry - h / 2));
      const score = others.length ? Math.min(...others.map((o) => Math.hypot(x + w / 2 - o.x, y + h / 2 - o.y))) : 1e9;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
      if (score > Math.max(w, 110)) break;
    }
    c._x = best.x; c._y = best.y;
    c.style.left = best.x + "px";
    c.style.top = best.y + "px";
  };

  if (calmMotion) {
    // no cycling: show a fixed handful, spaced out once
    chips.slice(0, maxUp()).forEach((c) => { place(c); c.classList.add("show"); });
  } else {
    let cooldown = null;
    const showOne = () => {
      const pool = chips.filter((c) => !c.classList.contains("show") && !c._fading && c !== cooldown);
      if (!pool.length) return;
      const c = pool[(Math.random() * pool.length) | 0];
      place(c);
      const delay = Math.random() * MAX_DELAY;
      const hold = MIN_HOLD + Math.random() * HOLD_RANGE;
      c.style.transitionDelay = delay + "ms";
      c.style.animationDelay = -Math.random() * 5 + "s";
      c.classList.add("show");
      setTimeout(() => {
        c.style.transitionDelay = "0ms";
        c.classList.remove("show");
        c._fading = true; // don't move it while it is still fading out
        cooldown = c;
        setTimeout(() => { c._fading = false; refill(); }, FADE + GAP);
      }, delay + hold);
    };
    const refill = () => { if (!document.hidden && up().length < maxUp()) showOne(); };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) for (let i = 0; i < maxUp(); i++) setTimeout(refill, i * 300); });
    for (let i = 0; i < maxUp(); i++) setTimeout(refill, 400 + i * 350);
  }
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      up().slice(maxUp()).forEach((c) => c.classList.remove("show"));
      up().forEach(place);
    }, 120);
  });
}

/* ---------- boot ---------- */

document.getElementById("year").textContent = new Date().getFullYear();
syncTheme();
observeReveals();
spy();
onScroll();
syncProjects();
