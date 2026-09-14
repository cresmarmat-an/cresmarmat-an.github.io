/* Projects load live from github.com/cresmarmat-an. FALLBACK is used offline or if the API limit is hit. */
const FALLBACK = [
  { title: "roblox-signal", desc: "A pure-Luau replacement for BindableEvent.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-signal" },
  { title: "roblox-promise", desc: "My take on the roblox-lua-promise library, with extra features and tweaks I needed.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-promise" },
  { title: "roblox-pool", desc: "A generic object pool. Reuse instances instead of creating and destroying them.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-pool" },
  { title: "roblox-remotes", desc: "A lightweight remote management module. Less boilerplate around RemoteEvents.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-remotes" },
  { title: "roblox-mimic", desc: "Typed, immutable server to client state replication.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-mimic" },
  { title: "roblox-loader", desc: "A module bootstrapper. One place to load everything in order.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-loader" },
  { title: "roblox-cleaner", desc: "Resource management and lifecycle cleanup. Connections and instances handled in one spot.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-cleaner" },
  { title: "roblox-compressor", desc: "Binary serialization for Roblox. Smaller payloads over remotes and datastores.", lang: "Lua", github: "https://github.com/cresmarmat-an/roblox-compressor" },
  { title: "roblox-persistence", desc: "A DataStore wrapper that makes saving data less painful.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-persistence" },
  { title: "roblox-spark2d", desc: "ParticleEmitter-style effects inside a ScreenGui.", lang: "Luau", github: "https://github.com/cresmarmat-an/roblox-spark2d" },
];

const LANG_ICON = {
  Luau: "assets/img/icons/lua-original.svg",
  Lua: "assets/img/icons/lua-original.svg",
  Python: "assets/img/icons/python-original.svg",
  "C++": "assets/img/icons/cplusplus-original.svg",
  Rust: "assets/img/icons/rust-original.svg",
  HTML: "assets/img/icons/html5-original.svg",
  CSS: "assets/img/icons/css3-original.svg",
  JavaScript: "assets/img/icons/javascript-original.svg",
  TypeScript: "assets/img/icons/javascript-original.svg",
  Git: "assets/img/icons/git-original.svg",
};

const grid = document.getElementById("projects-grid");
const modal = document.getElementById("project-modal");
const mTitle = document.getElementById("modal-title");
const mDesc = document.getElementById("modal-desc");
const mLang = document.getElementById("modal-lang");
const mLangIcon = document.getElementById("modal-lang-icon");
const mMeta = document.getElementById("modal-meta");
const mGithub = document.getElementById("modal-github");
const mLive = document.getElementById("modal-live");

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function langBadge(lang) {
  const src = LANG_ICON[lang];
  if (src) return '<span class="lang"><img src="' + src + '" alt="" loading="lazy">' + esc(lang) + "</span>";
  return '<span class="lang"><i class="dot"></i>' + esc(lang) + "</span>";
}

function renderProjects(list) {
  grid.innerHTML = "";
  list.forEach((p, i) => {
    const row = document.createElement("article");
    row.className = "proj-row reveal";
    row.style.transitionDelay = `${Math.min(i * 40, 280)}ms`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", p.title + ", open details");
    row.innerHTML =
      '<div class="proj-main"><h3>' + esc(p.title) + "</h3><p>" + esc(p.desc) + "</p></div>" +
      '<div class="proj-meta">' + langBadge(p.lang) +
      '<a class="icon-btn icon-sm" href="' + p.github + '" target="_blank" rel="noopener" aria-label="Open ' + esc(p.title) + ' on GitHub">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.93c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg></a></div>';
    row.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      openModal(p);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(p); }
    });
    grid.appendChild(row);
  });
  observeReveals();
}

async function loadProjects() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch("https://api.github.com/users/cresmarmat-an/repos?per_page=100&sort=updated", {
      signal: ctl.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("api");
    const data = await res.json();
    const live = data
      .filter((r) => !r.fork && r.name !== ".github")
      .slice(0, 12)
      .map((r) => ({
        title: r.name,
        desc: r.description || "No description yet.",
        lang: r.language || "Code",
        github: r.html_url,
        stars: r.stargazers_count,
        updated: r.pushed_at,
        homepage: r.homepage || "",
      }));
    renderProjects(live.length ? live : FALLBACK);
  } catch {
    renderProjects(FALLBACK);
  }
}

function openModal(p) {
  mTitle.textContent = p.title;
  mDesc.textContent = p.desc;
  mLang.textContent = p.lang;
  mLangIcon.src = LANG_ICON[p.lang] || "assets/img/icons/lua-original.svg";
  mLangIcon.alt = "";
  const bits = [];
  if (typeof p.stars === "number") bits.push((p.stars === 1 ? "1 star" : p.stars + " stars"));
  if (p.updated) {
    try {
      bits.push("Updated " + new Date(p.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    } catch { /* keep date out if it fails to parse */ }
  }
  mMeta.textContent = bits.join("  ·  ");
  mMeta.style.display = bits.length ? "" : "none";
  mGithub.href = p.github;
  if (p.homepage) { mLive.href = p.homepage; mLive.hidden = false; }
  else { mLive.hidden = true; }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeMenu(); } });

/* nav */
const navMenu = document.getElementById("nav-menu");
const navToggle = document.getElementById("nav-toggle");
function closeMenu() { navMenu.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); }
navToggle.addEventListener("click", () => {
  const open = navMenu.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

/* scroll spy */
const links = [...document.querySelectorAll(".nav-link")];
const secs = ["home", "about", "projects"].map((id) => document.getElementById(id));
const spy = new IntersectionObserver((es) => {
  es.forEach((e) => {
    if (e.isIntersecting) {
      links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
    }
  });
}, { rootMargin: "-40% 0px -55% 0px" });
secs.forEach((s) => s && spy.observe(s));

/* reveal */
let revealObs;
function observeReveals() {
  if (!revealObs) {
    revealObs = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } });
    }, { threshold: 0.1 });
  }
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => revealObs.observe(el));
}

/* theme: auto follows system */
const root = document.documentElement;
const themeBtn = document.getElementById("theme-toggle");
function currentSystem() { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
function initTheme() {
  const saved = localStorage.getItem("cm-theme") || "auto";
  root.dataset.theme = saved;
  syncThemeBtn();
}
function syncThemeBtn() {
  const mode = root.dataset.theme;
  const effective = mode === "auto" ? currentSystem() : mode;
  themeBtn.title = mode === "auto" ? "Theme: system " + effective + ", click to change" : "Theme: " + effective + ", click to change";
}
themeBtn.addEventListener("click", () => {
  const order = ["auto", "light", "dark"];
  const next = order[(order.indexOf(root.dataset.theme) + 1) % order.length];
  root.dataset.theme = next;
  localStorage.setItem("cm-theme", next);
  syncThemeBtn();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeBtn);

document.getElementById("year").textContent = new Date().getFullYear();

/* photo tilt + scroll progress, motion only */
const finePointer = matchMedia("(hover:hover) and (pointer:fine)").matches;
const calmMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
const progress = document.getElementById("progress");
if (progress && !calmMotion) {
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? Math.min(scrollY / max, 1).toFixed(3) : 0) + ")";
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* tech chips: continuous flow, max 5 up at once. When one fades out,
   a new language pops in at a fresh spot with its own random lifetime. */
const chips = [...document.querySelectorAll(".tech-chip")];
if (chips.length && !calmMotion) {
  const MAX = 5, FADE = 450, GAP = 350, MAX_DELAY = 900, MIN_HOLD = 1800, HOLD_RANGE = 2200;
  const onScreen = () => chips.filter((c) => getComputedStyle(c).display !== "none");
  const stage = document.querySelector(".hero-photo");
  const centerOf = (c) => ({
    x: (parseFloat(c.style.left) || 0) + (c.offsetWidth || 90) / 2,
    y: (parseFloat(c.style.top) || 0) + (c.offsetHeight || 34) / 2,
  });
  // scatter one chip on a ring around the photo, kept clear of the ones already up
  const place = (c) => {
    if (!stage) return;
    const pw = stage.clientWidth, ph = stage.clientHeight;
    if (!pw || !ph) return;
    const w = c.offsetWidth || 90, h = c.offsetHeight || 34;
    const cx = pw / 2, cy = ph / 2;
    const others = [...document.querySelectorAll(".tech-chip.show")].filter((o) => o !== c).map(centerOf);
    let best = null, bestScore = -1;
    for (let t = 0; t < 24; t++) {
      const a = Math.random() * Math.PI * 2;
      const rx = pw * (0.36 + Math.random() * 0.1);
      const ry = ph * (0.36 + Math.random() * 0.1);
      const x = Math.max(2, Math.min(pw - w - 2, cx + Math.cos(a) * rx - w / 2));
      const y = Math.max(2, Math.min(ph - h - 2, cy + Math.sin(a) * ry - h / 2));
      const px = x + w / 2, py = y + h / 2;
      const score = others.length ? Math.min(...others.map((o) => Math.hypot(px - o.x, py - o.y))) : 1e9;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
      if (score > 120) break;
    }
    if (best) { c.style.left = best.x + "px"; c.style.top = best.y + "px"; }
  };
  addEventListener("resize", () => {
    document.querySelectorAll(".tech-chip.show").forEach((c) => place(c));
  });
  let cooldown = null;
  const visibleCount = () => document.querySelectorAll(".tech-chip.show").length;
  const showOne = () => {
    let pool = onScreen().filter((c) => !c.classList.contains("show") && c !== cooldown);
    if (!pool.length) pool = onScreen().filter((c) => !c.classList.contains("show"));
    if (!pool.length) return;
    const c = pool[(Math.random() * pool.length) | 0];
    place(c);
    const delay = Math.random() * MAX_DELAY;
    const hold = MIN_HOLD + Math.random() * HOLD_RANGE;
    c.style.transitionDelay = delay + "ms";
    c.style.transitionDuration = 350 + Math.random() * 250 + "ms";
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add("show")));
    setTimeout(() => {
      c.style.transitionDelay = "0ms";
      c.classList.remove("show");
      cooldown = c;
      setTimeout(() => { if (cooldown === c) cooldown = null; }, 4000);
      // freed slot fades out first, then a new language takes its place
      setTimeout(refill, FADE + GAP);
    }, delay + hold);
  };
  const refill = () => {
    if (visibleCount() < Math.min(MAX, onScreen().length)) showOne();
  };
  // fill the stage with a natural trickle instead of all at once
  for (let i = 0; i < MAX; i++) setTimeout(refill, i * 350);
} else {
  chips.forEach((c) => c.classList.add("show"));
}

initTheme();
loadProjects();
observeReveals();
