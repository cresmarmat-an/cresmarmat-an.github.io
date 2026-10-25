/* Motion layer: inertial smooth scrolling, a custom cursor (a dot plus a trailing ring
   that grows over anything clickable), the hero text floating away as you scroll, 3D card
   tilt with a moving glare, and magnetic buttons. Transform/opacity only; reduced motion
   turns all of it off and the page behaves normally. */
(() => {
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- smooth scrolling ---------- */

  if (window.Lenis) {
    // anchors honour the CSS scroll-padding-top, so the sticky nav never covers a section heading
    const lenis = new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.95, anchors: true });
    window.__lenis = lenis;
    // "/" focuses search in main.js and scrolls it into view; keep Lenis in step with native jumps
    addEventListener("hashchange", () => lenis.resize());
  }

  /* ---------- custom cursor (fine pointers) ---------- */

  const cursor = document.querySelector(".cursor");
  const dot = cursor && cursor.querySelector(".cursor-dot");
  const ring = cursor && cursor.querySelector(".cursor-ring");
  if (fine && cursor && dot && ring) {
    root.classList.add("has-cursor");
    const c = { x: -100, y: -100, rx: -100, ry: -100, seen: false };
    let raf = 0;
    const tick = () => {
      raf = 0;
      c.rx = lerp(c.rx, c.x, 0.2);
      c.ry = lerp(c.ry, c.y, 0.2);
      dot.style.transform = "translate3d(" + c.x + "px," + c.y + "px,0)";
      ring.style.transform = "translate3d(" + c.rx.toFixed(1) + "px," + c.ry.toFixed(1) + "px,0)";
      if (Math.abs(c.rx - c.x) > 0.2 || Math.abs(c.ry - c.y) > 0.2) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      c.x = e.clientX; c.y = e.clientY;
      if (!c.seen) { c.seen = true; c.rx = c.x; c.ry = c.y; cursor.classList.add("on"); }
      const t = e.target;
      const text = t.closest && t.closest("input, textarea, [contenteditable]");
      const link = !text && t.closest && t.closest("a, button, label, [role=button], .proj-card");
      cursor.classList.toggle("is-text", !!text);
      cursor.classList.toggle("is-link", !!link);
      kick();
    }, { passive: true });
    addEventListener("pointerdown", () => cursor.classList.add("is-down"), { passive: true });
    addEventListener("pointerup", () => cursor.classList.remove("is-down"), { passive: true });
    document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) { cursor.classList.remove("on"); c.seen = false; } });
    addEventListener("blur", () => { cursor.classList.remove("on"); c.seen = false; });
  }

  /* ---------- hero text floats up and dissolves as you scroll ---------- */

  const hero = document.getElementById("home");
  const heroText = hero && hero.querySelector(".hero-text");
  if (heroText) {
    let heroH = hero.offsetHeight, ticking = false, last = -1;
    const update = () => {
      ticking = false;
      const sy = scrollY;
      if (sy === last) return;
      last = sy;
      const p = clamp(sy / (heroH * 0.8), 0, 1);
      const e = p * p * (3 - 2 * p);
      heroText.style.translate = "0 " + (-e * 120).toFixed(1) + "px";
      heroText.style.opacity = clamp(1 - e * 1.25, 0, 1).toFixed(3);
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", () => { heroH = hero.offsetHeight; last = -1; update(); }, { passive: true });
    update();
  }

  /* ---------- 3D card tilt + glare (fine pointers) ---------- */

  const grid = document.getElementById("projects-grid");
  if (fine && grid) {
    let active = null;
    const release = (card) => {
      card.classList.remove("tilting");
      card.style.rotate = "";
    };
    grid.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".proj-card:not(.skeleton)");
      if (card !== active) {
        if (active) release(active);
        active = card;
        if (card) card.classList.add("tilting");
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      const nx = clamp((e.clientX - r.left) / r.width, 0, 1);
      const ny = clamp((e.clientY - r.top) / r.height, 0, 1);
      const ax = (0.5 - ny) * 14;
      const ay = (nx - 0.5) * 16;
      const ang = Math.hypot(ax, ay);
      card.style.rotate = ang > 0.05 ? ax.toFixed(3) + " " + ay.toFixed(3) + " 0 " + ang.toFixed(2) + "deg" : "";
      card.style.setProperty("--gx", (nx * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (ny * 100).toFixed(1) + "%");
      card.style.setProperty("--ga", ((Math.atan2(ny - 0.5, nx - 0.5) * 180) / Math.PI + 90).toFixed(1) + "deg");
    });
    grid.addEventListener("pointerleave", () => {
      if (active) release(active);
      active = null;
    });
  }

  /* ---------- magnetic buttons (fine pointers) ---------- */

  if (fine) {
    document.querySelectorAll(".btn, .icon-btn").forEach((el) => {
      const pull = el.classList.contains("btn") ? 0.3 : 0.42;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.classList.add("mag");
        el.classList.remove("mag-out");
        el.style.translate = clamp(dx * pull, -12, 12).toFixed(1) + "px " + clamp(dy * pull, -10, 10).toFixed(1) + "px";
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("mag");
        el.classList.add("mag-out");
        el.style.translate = "";
      });
    });
  }
})();
