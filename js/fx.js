/* Pointer-driven light, tactile controls, and accessible search feedback.
   A single scheduled frame batches pointer writes; idle pages do no motion work. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const nav = document.querySelector(".nav");
  const navInner = nav?.querySelector(".nav-inner");
  const navLinks = nav?.querySelector(".nav-links");
  const grid = document.getElementById("projects-grid");
  root.classList.toggle("motion-paused", document.hidden);
  let frame = 0;
  let point = null;
  let card = null;
  let button = null;
  let buttonBox = null;
  let scrollDirty = true;
  let navScrolled = scrollY > 56;
  let navDirty = true;
  let scrollSpeed = 0;
  let scrollDirection = 0;
  let lastScrollY = scrollY;
  let lastScrollTime = performance.now();
  let scrollTimer;
  const impacts = new Map();

  const canMove = () => fine.matches && !reduce.matches && !document.hidden;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  // The track follows the existing active link, so scroll spy and keyboard
  // navigation continue to own selection. Observe links only, never this track.
  const navTrack = navLinks ? document.createElement("span") : null;
  if (navTrack) {
    navTrack.className = "nav-track";
    navTrack.setAttribute("aria-hidden", "true");
    navLinks.append(navTrack);
    const changed = () => { navDirty = true; schedule(); };
    const activeObserver = new MutationObserver(changed);
    navLinks.querySelectorAll(".nav-link").forEach((link) => {
      activeObserver.observe(link, { attributes: true, attributeFilter: ["class", "aria-current"] });
    });
    if ("ResizeObserver" in window) new ResizeObserver(changed).observe(navLinks);
    navInner?.addEventListener("animationend", (event) => {
      if (event.target === navInner && event.animationName === "dock-arrive") changed();
    });
    document.fonts?.ready.then(changed);
  }

  function releaseCard() {
    if (!card) return;
    card.classList.remove("tilting");
    card.style.removeProperty("rotate");
    card.style.removeProperty("--gx");
    card.style.removeProperty("--gy");
    card.style.removeProperty("--ga");
    card = null;
  }

  function releaseButton() {
    if (!button) return;
    button.classList.remove("mag");
    button.classList.add("mag-out");
    button.style.removeProperty("translate");
    button = null;
    buttonBox = null;
  }

  function resetPointer() {
    point = null;
    releaseCard();
    releaseButton();
    root.style.setProperty("--pointer-active", "0");
    root.style.removeProperty("--pointer-x");
    root.style.removeProperty("--pointer-y");
  }

  function paint() {
    frame = 0;
    if (scrollDirty) {
      // Keep the transition stable while momentum or touch scrolling settles
      // near the top; the dock opens and closes at different thresholds.
      if (scrollY > 56) navScrolled = true;
      else if (scrollY < 16) navScrolled = false;
      nav?.classList.toggle("scrolled", navScrolled);
      root.style.setProperty("--scroll-speed", scrollSpeed.toFixed(3));
      root.style.setProperty("--scroll-direction", String(scrollDirection));
      scrollDirty = false;
    }
    if (navDirty && navTrack) {
      const active = navLinks.querySelector(".nav-link.active") || navLinks.querySelector('.nav-link[aria-current="true"]');
      if (active) {
        // Layout offsets ignore the dock's entrance scale and translation.
        navLinks.style.setProperty("--nav-x", active.offsetLeft.toFixed(2) + "px");
        navLinks.style.setProperty("--nav-width", active.offsetWidth.toFixed(2) + "px");
        navTrack.classList.add("ready");
      }
      navDirty = false;
    }
    if (!point || !canMove()) return;

    root.style.setProperty("--pointer-x", point.x.toFixed(1) + "px");
    root.style.setProperty("--pointer-y", point.y.toFixed(1) + "px");
    root.style.setProperty("--pointer-active", "1");

    if (card && card.isConnected && card.classList.contains("in")) {
      const box = card.getBoundingClientRect();
      if (box.width && box.height) {
        const x = clamp((point.x - box.left) / box.width, 0, 1) - 0.5;
        const y = clamp((point.y - box.top) / box.height, 0, 1) - 0.5;
        card.classList.add("tilting");
        card.style.setProperty("--gx", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--gy", ((y + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--ga", (Math.atan2(x, -y) * 180 / Math.PI).toFixed(1) + "deg");
        const angle = Math.min(Math.hypot(x, y) * 2, 1) * 1.6;
        card.style.rotate = angle < 0.05 ? "" : y.toFixed(3) + " " + (-x).toFixed(3) + " 0 " + angle.toFixed(2) + "deg";
      }
    }

    if (button && buttonBox && button.isConnected) {
      button.classList.remove("mag-out");
      button.classList.add("mag");
      button.style.translate = clamp((point.x - buttonBox.x) * 0.12, -2.5, 2.5).toFixed(1) + "px "
        + clamp((point.y - buttonBox.y) * 0.12, -2.5, 2.5).toFixed(1) + "px";
    }
  }

  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
  }

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || !canMove()) return;
    point = { x: event.clientX, y: event.clientY };
    const target = event.target instanceof Element ? event.target : null;
    const nextCard = target?.closest(".proj-card:not(.skeleton)") || null;
    if (nextCard !== card) {
      releaseCard();
      card = nextCard;
    }
    const nextButton = target?.closest(".btn, .icon-btn") || null;
    if (nextButton !== button) {
      releaseButton();
      button = nextButton;
      if (button) {
        const box = button.getBoundingClientRect();
        buttonBox = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }
    }
    schedule();
  }, { passive: true });

  addEventListener("scroll", () => {
    // A scroll moves controls away from their cached pointer coordinates.
    resetPointer();
    const now = performance.now();
    const distance = scrollY - lastScrollY;
    const elapsed = clamp(now - lastScrollTime, 8, 64);
    scrollSpeed = reduce.matches ? 0 : clamp(Math.abs(distance) / elapsed / 2.6, 0, 1);
    scrollDirection = reduce.matches ? 0 : Math.sign(distance);
    lastScrollY = scrollY;
    lastScrollTime = now;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollSpeed = 0;
      scrollDirection = 0;
      scrollDirty = true;
      schedule();
    }, 180);
    scrollDirty = true;
    schedule();
  }, { passive: true });
  addEventListener("resize", () => {
    resetPointer();
    navDirty = true;
    schedule();
  }, { passive: true });
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) resetPointer();
  }, { passive: true });
  document.addEventListener("pointercancel", resetPointer, { passive: true });
  addEventListener("blur", resetPointer);

  function environmentChanged() {
    root.classList.toggle("motion-paused", document.hidden);
    resetPointer();
    impacts.forEach((cleanup) => cleanup());
    clearTimeout(scrollTimer);
    scrollSpeed = 0;
    scrollDirection = 0;
    root.style.setProperty("--scroll-speed", "0");
    root.style.setProperty("--scroll-direction", "0");
    lastScrollY = scrollY;
    lastScrollTime = performance.now();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!document.hidden) {
      scrollDirty = true;
      navDirty = true;
      schedule();
    }
  }
  reduce.addEventListener("change", environmentChanged);
  fine.addEventListener("change", environmentChanged);
  document.addEventListener("visibilitychange", environmentChanged);
  addEventListener("pagehide", environmentChanged);
  schedule();

  // Decoration is added after the native click; navigation, focus, and button
  // handlers remain untouched. Touch and keyboard activation get the same cue.
  document.addEventListener("click", (event) => {
    if (reduce.matches || document.hidden || !(event.target instanceof Element)) return;
    const control = event.target.closest(".btn, .icon-btn, .nav-link")
      || event.target.closest(".proj-card:not(.skeleton)");
    if (!control || control.disabled) return;
    const box = control.getBoundingClientRect();
    if (!box.width || !box.height) return;
    impacts.get(control)?.();
    // Bound retained decorations even during rapid clicking across a long grid.
    if (impacts.size >= 8) impacts.values().next().value();
    const x = event.detail ? clamp(event.clientX - box.left, 0, box.width) : box.width / 2;
    const y = event.detail ? clamp(event.clientY - box.top, 0, box.height) : box.height / 2;
    const size = 2 * Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
    const ripple = document.createElement("span");
    ripple.className = "control-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.setProperty("--ripple-x", x.toFixed(1) + "px");
    ripple.style.setProperty("--ripple-y", y.toFixed(1) + "px");
    ripple.style.setProperty("--ripple-size", size.toFixed(1) + "px");
    let cleanupTimer;
    const cleanup = () => {
      clearTimeout(cleanupTimer);
      ripple.remove();
      control.classList.remove("impact");
      impacts.delete(control);
    };
    impacts.set(control, cleanup);
    ripple.addEventListener("animationend", cleanup, { once: true });
    control.classList.add("impact");
    control.append(ripple);
    cleanupTimer = setTimeout(cleanup, 1400);
  });

  /* Search remains useful with keyboard navigation and screen readers. */
  const search = document.getElementById("search");
  const clear = document.getElementById("search-clear");
  if (search && clear) {
    const hint = document.createElement("kbd");
    hint.className = "search-kbd";
    hint.textContent = "/";
    hint.title = "Press / to search";
    hint.setAttribute("aria-hidden", "true");
    clear.after(hint);
  }

  if (grid && search) {
    const live = document.createElement("p");
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    grid.after(live);
    let announceTimer;
    const sortName = () => {
      const selected = document.querySelector("input[name=sort]:checked");
      const label = selected && document.querySelector('label[for="' + selected.id + '"]');
      return label ? label.textContent.replace("–", " to ") : "recent";
    };
    const announce = (wait) => {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        if (grid.getAttribute("aria-busy") === "true") return;
        const count = grid.querySelectorAll(".proj-card:not(.skeleton):not([hidden])").length;
        const query = search.value.trim();
        live.textContent = !query
          ? count + (count === 1 ? " project" : " projects") + ", sorted by " + sortName()
          : count
            ? count + (count === 1 ? " project matches" : " projects match") + " “" + query + "”"
            : "No projects match “" + query + "”";
      }, wait);
    };
    search.addEventListener("input", () => announce(700));
    search.addEventListener("keydown", (event) => { if (event.key === "Escape") announce(150); });
    document.getElementById("sort")?.addEventListener("change", () => announce(150));
    clear?.addEventListener("click", () => announce(150));
    document.getElementById("empty-clear")?.addEventListener("click", () => announce(150));
    new MutationObserver(() => announce(200)).observe(grid, { childList: true });
    announce(200);
  }
})();
