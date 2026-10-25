/* Small touches layered on top of main.js: cards that tilt toward the cursor with a shine
   and an accent edge, buttons that lean toward the pointer, a nav that lifts once the page
   scrolls, a "/" hint on the search box, a spoken result count for screen readers, and a
   crossfade when the theme changes. Pointer effects are for mice and pens only, and
   anything that moves is skipped when the visitor prefers reduced motion. */

(() => {
  const calmMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const moving = finePointer && !calmMotion;

  /* ---------- nav: soft shadow once the page leaves the top ---------- */

  const nav = document.querySelector(".nav");
  if (nav) {
    const lift = () => nav.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", lift, { passive: true });
    lift();
  }

  /* ---------- project cards: tilt, shine and edge follow the cursor ---------- */

  const grid = document.getElementById("projects-grid");
  if (grid && moving) {
    const MAX = 5; // degrees
    let card = null, ev = null, frame = 0;

    const paint = () => {
      frame = 0;
      if (!card || !ev) return;
      const r = card.getBoundingClientRect();
      const px = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1) - 0.5;
      const py = Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1) - 0.5;
      card.style.setProperty("--gx", ((px + 0.5) * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", ((py + 0.5) * 100).toFixed(1) + "%");
      card.style.setProperty("--ga", (Math.atan2(px, -py) * 180 / Math.PI).toFixed(1) + "deg");
      // the side under the cursor rises a little toward it
      const ang = Math.min(Math.hypot(px, py) * 2, 1) * MAX;
      card.style.rotate = ang < 0.05 ? "" : py.toFixed(3) + " " + (-px).toFixed(3) + " 0 " + ang.toFixed(2) + "deg";
    };

    const release = (c) => {
      c.classList.remove("tilting");
      c.style.rotate = "";
    };

    grid.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const c = e.target.closest(".proj-card:not(.skeleton)");
      if (c !== card) {
        if (card) release(card);
        card = c;
        // wait for the entrance to finish so the tilt doesn't fight it
        if (card && card.classList.contains("in")) card.classList.add("tilting");
        else card = null;
      }
      ev = e;
      if (card && !frame) frame = requestAnimationFrame(paint);
    });
    grid.addEventListener("pointerleave", () => {
      if (card) release(card);
      card = null;
    });
  }

  /* ---------- buttons lean toward the pointer, then spring back ---------- */

  if (moving) {
    const PULL = 0.22, LIMIT = 7;
    document.querySelectorAll(".btn, .icon-btn").forEach((b) => {
      let box = null;
      b.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch") return;
        const r = b.getBoundingClientRect();
        box = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        b.classList.remove("mag-out");
        b.classList.add("mag");
      });
      b.addEventListener("pointermove", (e) => {
        if (!box) return;
        const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT, v * PULL));
        b.style.translate = clamp(e.clientX - box.x).toFixed(1) + "px " + clamp(e.clientY - box.y).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", () => {
        if (!box) return;
        box = null;
        b.classList.replace("mag", "mag-out");
        b.style.translate = "";
      });
    });
    // the centre is measured on enter; a scroll mid-hover would leave it stale
    addEventListener("scroll", () => {
      document.querySelectorAll(".mag").forEach((b) => b.dispatchEvent(new PointerEvent("pointerleave")));
    }, { passive: true });
  }

  /* ---------- search: "/" hint and a spoken result count ---------- */

  const search = document.getElementById("search");
  const clear = document.getElementById("search-clear");
  if (search && clear) {
    const kbd = document.createElement("kbd");
    kbd.className = "search-kbd";
    kbd.textContent = "/";
    kbd.title = "Press / to search";
    kbd.setAttribute("aria-hidden", "true");
    clear.after(kbd);
  }

  if (grid && search) {
    const live = document.createElement("p");
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    grid.after(live);
    let t;
    const announce = (wait) => {
      clearTimeout(t);
      t = setTimeout(() => {
        const n = grid.querySelectorAll(".proj-card:not(.skeleton):not([hidden])").length;
        const q = search.value.trim();
        live.textContent = !q ? n + (n === 1 ? " project" : " projects") + ", sorted by " + sortName()
          : n ? n + (n === 1 ? " project matches" : " projects match") + " “" + q + "”"
          : "No projects match “" + q + "”";
      }, wait);
    };
    const sortName = () => {
      const on = document.querySelector("input[name=sort]:checked");
      const label = on && document.querySelector('label[for="' + on.id + '"]');
      return label ? label.textContent.replace("–", " to ") : "recent";
    };
    search.addEventListener("input", () => announce(700));
    document.getElementById("sort")?.addEventListener("change", () => announce(150));
    clear.addEventListener("click", () => announce(150));
    document.getElementById("empty-clear")?.addEventListener("click", () => announce(150));
  }

  /* ---------- theme: crossfade instead of a hard cut ---------- */

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn && document.startViewTransition && !calmMotion) {
    let passing = false;
    // captured at the document so it runs before main.js's handler on the button,
    // then the click is replayed inside the transition
    document.addEventListener("click", (e) => {
      if (passing || !themeBtn.contains(e.target)) return;
      e.stopImmediatePropagation();
      document.startViewTransition(() => {
        passing = true;
        try { themeBtn.click(); } finally { passing = false; }
      });
    }, true);
  }
})();
