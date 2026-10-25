/* Motion layer: floating neumorphic orbs with depth parallax, the hero dissolving upward as
   you scroll, 3D card tilt with a moving glare, magnetic buttons and a soft cursor light.
   One rAF loop drives it all with transform/opacity only, it idles when nothing moves,
   and reduced motion turns it off (the CSS shows everything at rest). */
(() => {
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- state ---------- */

  let W = innerWidth, H = innerHeight;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, gx: W / 2, gy: H / 2, tgx: W / 2, tgy: H / 2, seen: false };

  const orbs = [...document.querySelectorAll(".orb")].map((el) => ({
    el, x: parseFloat(el.dataset.x) || 0, y: parseFloat(el.dataset.y) || 0, d: parseFloat(el.dataset.depth) || 0.5, size: 0,
  }));
  const hero = document.getElementById("home");
  const heroText = hero && hero.querySelector(".hero-text");
  const heroPhoto = hero && hero.querySelector(".hero-photo");
  const photoBlend = hero && hero.querySelector(".photo-blend");
  const glow = document.querySelector(".cursor-glow");
  let heroH = hero ? hero.offsetHeight : 1;

  function measure() {
    W = innerWidth; H = innerHeight;
    orbs.forEach((o) => { o.size = o.el.offsetWidth || 120; });
    heroH = hero ? hero.offsetHeight : 1;
    dirty = true;
  }

  /* ---------- input ---------- */

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return; // fingers scroll; they don't steer the parallax
    ptr.tx = (e.clientX / W) * 2 - 1;
    ptr.ty = (e.clientY / H) * 2 - 1;
    ptr.tgx = e.clientX;
    ptr.tgy = e.clientY;
    if (!ptr.seen && glow) { ptr.seen = true; ptr.gx = e.clientX; ptr.gy = e.clientY; glow.classList.add("on"); }
    wake();
  }, { passive: true });
  const hideGlow = () => { if (glow) glow.classList.remove("on"); ptr.seen = false; ptr.tx = 0; ptr.ty = 0; wake(); };
  document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) hideGlow(); });
  addEventListener("blur", hideGlow);
  addEventListener("scroll", () => wake(), { passive: true });
  addEventListener("resize", () => { measure(); wake(); }, { passive: true });

  /* ---------- loop ---------- */

  let raf = 0, dirty = true, lastScroll = -1;
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }

  function frame() {
    raf = 0;
    ptr.x = lerp(ptr.x, ptr.tx, 0.07);
    ptr.y = lerp(ptr.y, ptr.ty, 0.07);
    if (ptr.seen) { ptr.gx = lerp(ptr.gx, ptr.tgx, 0.16); ptr.gy = lerp(ptr.gy, ptr.tgy, 0.16); }
    const sy = scrollY;
    const moving = Math.abs(ptr.x - ptr.tx) > 0.0008 || Math.abs(ptr.y - ptr.ty) > 0.0008 ||
      (ptr.seen && (Math.abs(ptr.gx - ptr.tgx) > 0.3 || Math.abs(ptr.gy - ptr.tgy) > 0.3));

    if (moving || sy !== lastScroll || dirty) {
      dirty = false;
      lastScroll = sy;

      // orbs drift past at their own depth and wrap around, so the dream never runs out
      for (const o of orbs) {
        const span = H + o.size * 2;
        let y = (o.y * H - sy * o.d * 0.5) % span;
        if (y < 0) y += span;
        y -= o.size;
        const x = o.x * W + ptr.x * 54 * o.d;
        o.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + (y + ptr.y * 40 * o.d).toFixed(1) + "px,0)";
      }

      // the hero floats up and dissolves as you scroll into the projects
      if (heroText && heroPhoto) {
        const p = clamp(sy / (heroH * 0.85), 0, 1);
        const e = p * p * (3 - 2 * p);
        heroText.style.translate = (ptr.x * 8).toFixed(1) + "px " + (-e * 120 + ptr.y * 6).toFixed(1) + "px";
        heroText.style.opacity = clamp(1 - e * 1.2, 0, 1).toFixed(3);
        heroPhoto.style.translate = (ptr.x * -18).toFixed(1) + "px " + (e * 90 + ptr.y * -12).toFixed(1) + "px";
        heroPhoto.style.scale = (1 - e * 0.16).toFixed(4);
        heroPhoto.style.rotate = (e * -10 + ptr.x * 2).toFixed(2) + "deg";
        if (photoBlend) photoBlend.style.opacity = clamp(1 - e * 0.9, 0, 1).toFixed(3);
      }

      if (glow && ptr.seen) glow.style.transform = "translate3d(" + ptr.gx.toFixed(1) + "px," + ptr.gy.toFixed(1) + "px,0)";
    }
    if (moving) wake();
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) { dirty = true; wake(); } });

  /* ---------- 3D card tilt + glare (fine pointers) ---------- */

  const grid = document.getElementById("projects-grid");
  if (fine && grid) {
    let active = null;
    const release = (c) => {
      c.classList.remove("tilting");
      c.style.rotate = "";
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
      const ax = (0.5 - ny) * 16; // degrees around X
      const ay = (nx - 0.5) * 18; // degrees around Y
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

  measure();
  wake();
  // clear the intro mist once the page is painting smoothly
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("awake")));
})();
