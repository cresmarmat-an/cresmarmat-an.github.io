/* A living coordinate field: scroll moves the grid through depth, the pointer bends
   nearby lines, and small signals travel along its circuits. All decoration is
   painted into one transparent canvas; the page keeps its native interactions. */
(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = matchMedia("(prefers-color-scheme: dark)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const CELL = 64;
  const FRAME = 1000 / 60;
  const TAU = Math.PI * 2;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, active: false };
  const rings = [];
  let width = 0, height = 0, pixelRatio = 1;
  let scrollTarget = window.scrollY || 0, scrollPosition = scrollTarget;
  let frameId = 0, previousTime = 0, lastDrawTime = 0, elapsed = 0;
  let gridRGB = "126, 119, 106", accentRGB = "189, 65, 41", dark = false;
  let secondaryRGB = "150, 94, 190", tertiaryRGB = "112, 141, 55";
  const iconSources = [...document.querySelectorAll(".tech-stack .tech-chip img")];
  const icons = [];
  const popups = [];
  let iconBag = [], nextPopupAt = 0.25, lastIcon = -1;

  // A seeded field stays in place through resize and theme changes.
  function noise(n) {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }
  const stars = Array.from({ length: 44 }, (_, i) => ({
    x: noise(i + 1), y: noise(i + 61), depth: 0.3 + noise(i + 121) * 0.7,
    phase: noise(i + 181) * TAU,
  }));
  const signals = Array.from({ length: 14 }, (_, i) => ({
    x: noise(i + 241), y: noise(i + 301),
    phase: noise(i + 361), speed: 25 + noise(i + 421) * 30,
    horizontal: i % 2 === 0,
  }));

  const rgba = (rgb, alpha) => "rgba(" + rgb + "," + alpha + ")";
  const wrap = (value, limit) => ((value % limit) + limit) % limit;
  const smoothstep = (value) => { const t = Math.max(0, Math.min(value, 1)); return t * t * (3 - 2 * t); };
  const channelColor = (index) => [accentRGB, secondaryRGB, tertiaryRGB][index % 3];

  function readColors() {
    const style = getComputedStyle(root);
    dark = root.dataset.theme === "dark" ||
      (root.dataset.theme !== "light" && darkScheme.matches);
    gridRGB = style.getPropertyValue("--grid-rgb").trim() || (dark ? "150, 146, 135" : "126, 119, 106");
    accentRGB = style.getPropertyValue("--accent-rgb").trim() || (dark ? "250, 128, 102" : "189, 65, 41");
    secondaryRGB = style.getPropertyValue("--secondary-rgb").trim() || (dark ? "190, 142, 228" : "150, 94, 190");
    tertiaryRGB = style.getPropertyValue("--tertiary-rgb").trim() || (dark ? "160, 194, 95" : "112, 141, 55");
    if (!isRunning()) draw();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    popups.length = 0;
    nextPopupAt = elapsed + 0.2;
    draw();
  }

  // Cache original SVG colors; only explicitly monochrome marks get a white
  // dark-theme variant. Colored technology logos never pass through a filter.
  function spriteFor(image, invert = false) {
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 96;
    const surface = sprite.getContext("2d");
    if (!surface) return image;
    if (invert) surface.filter = "invert(1)";
    const scale = Math.min(88 / image.naturalWidth, 88 / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    surface.drawImage(image, (96 - w) / 2, (96 - h) / 2, w, h);
    return sprite;
  }

  iconSources.forEach((source) => {
    const image = new Image();
    const entry = { ready: false, sprite: null, darkSprite: null, mono: source.classList.contains("icon-mono") };
    icons.push(entry);
    image.decoding = "async";
    image.onload = () => {
      entry.sprite = spriteFor(image);
      entry.darkSprite = entry.mono ? spriteFor(image, true) : entry.sprite;
      entry.ready = true;
    };
    image.src = source.currentSrc || source.src;
  });

  function nextIcon() {
    if (!iconBag.length) {
      iconBag = icons.map((icon, index) => icon.ready ? index : -1).filter((index) => index >= 0);
      for (let i = iconBag.length - 1; i > 0; i--) {
        const other = Math.floor(Math.random() * (i + 1));
        [iconBag[i], iconBag[other]] = [iconBag[other], iconBag[i]];
      }
      if (iconBag.length > 1 && iconBag[iconBag.length - 1] === lastIcon) {
        [iconBag[0], iconBag[iconBag.length - 1]] = [iconBag[iconBag.length - 1], iconBag[0]];
      }
    }
    if (!iconBag.length) return -1;
    lastIcon = iconBag.pop();
    return lastIcon;
  }

  function spawnPopup() {
    const index = nextIcon();
    if (index < 0) return;
    // Layout is read only when an icon spawns, not during the animation loop.
    const obstacles = [...document.querySelectorAll(".hero-text > *, .section-copy, .toolbar, .proj-card:not([hidden]), .sync, .portrait-stage, .nav, .footer")]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < height);
    const offsetX = wrap(-scrollPosition * 0.025, CELL);
    const offsetY = wrap(-scrollPosition * 0.18, CELL);
    let best = null, bestScore = -Infinity;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = Math.floor((40 + Math.random() * Math.max(1, width - 80) - offsetX) / CELL) * CELL + offsetX + CELL / 2;
      const y = Math.floor((112 + Math.random() * Math.max(1, height - 152) - offsetY) / CELL) * CELL + offsetY + CELL / 2;
      if (x < 40 || x > width - 40 || y < 100 || y > height - 40) continue;
      const column = Math.round((x - CELL / 2 + scrollPosition * 0.025) / CELL);
      const row = Math.round((y - CELL / 2 + scrollPosition * 0.18) / CELL);
      if (popups.some((popup) => popup.column === column && popup.row === row)) continue;
      const blocked = obstacles.some((box) => x > box.left - 30 && x < box.right + 30 && y > box.top - 30 && y < box.bottom + 30);
      const distance = popups.length ? Math.min(...popups.map((popup) => Math.hypot(x - (popup.x - scrollPosition * 0.025), y - (popup.y - scrollPosition * 0.18)))) : 220;
      const score = (blocked ? 0 : 1000) + Math.min(distance, 350) + Math.random() * 70;
      if (score > bestScore) { bestScore = score; best = { x, y, column, row, blocked }; }
    }
    if (!best) return;
    popups.push({
      icon: index, column: best.column, row: best.row,
      x: best.column * CELL + CELL / 2, y: best.row * CELL + CELL / 2,
      started: elapsed, duration: 5.6 + Math.random() * 2.8,
      size: (width < 700 ? 29 : 31) + Math.random() * 3,
      opacity: best.blocked ? 0.19 : (dark ? 0.8 : 0.73),
    });
  }

  function updatePopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const popup = popups[i], y = popup.y - scrollPosition * 0.18;
      if (elapsed - popup.started > popup.duration || y < -64 || y > height + 64) popups.splice(i, 1);
    }
    const limit = width < 700 ? 2 : width < 1100 ? 3 : 5;
    if (popups.length > limit) popups.splice(0, popups.length - limit);
    if (popups.length < limit && elapsed >= nextPopupAt) {
      spawnPopup();
      nextPopupAt = elapsed + 0.6 + Math.random() * 0.45;
    }
  }

  function drawPopups() {
    popups.forEach((popup) => {
      const age = elapsed - popup.started;
      const incoming = smoothstep(age / 1);
      const outgoing = smoothstep((popup.duration - age) / 1.4);
      const fade = Math.min(incoming, outgoing);
      const scale = 0.86 + incoming * 0.14;
      const size = popup.size * scale;
      const x = popup.column * CELL - scrollPosition * 0.025;
      const y = popup.row * CELL - scrollPosition * 0.18;
      const centerX = x + CELL / 2, centerY = y + CELL / 2;
      const p = bend(centerX, centerY);
      const hover = pointer.strength * Math.max(0, 1 - Math.hypot(centerX - pointer.x, centerY - pointer.y) / 180);
      const color = channelColor(popup.icon);
      ctx.save();
      ctx.globalAlpha = fade * (popup.opacity + hover * 0.1);
      // The eight samples use the grid's same corners and midpoints. The whole
      // 64px cell bends with the field while its icon remains safely in the middle.
      ctx.beginPath();
      point(x, y, true); point(x + CELL / 2, y, false); point(x + CELL, y, false);
      point(x + CELL, y + CELL / 2, false); point(x + CELL, y + CELL, false);
      point(x + CELL / 2, y + CELL, false); point(x, y + CELL, false);
      point(x, y + CELL / 2, false); ctx.closePath();
      ctx.fillStyle = rgba(color, 0.07 + hover * 0.06);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.3 + hover * 0.24);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      const glyph = icons[popup.icon];
      ctx.drawImage(dark ? glyph.darkSprite : glyph.sprite, p[0] - size / 2, p[1] - size / 2, size, size);
      const topLeft = bend(x + 1, y + 1), bottomRight = bend(x + CELL - 1, y + CELL - 1);
      ctx.strokeStyle = rgba(color, 0.65 + hover * 0.2);
      ctx.beginPath();
      ctx.moveTo(topLeft[0] + 7, topLeft[1]); ctx.lineTo(topLeft[0], topLeft[1]); ctx.lineTo(topLeft[0], topLeft[1] + 7);
      ctx.moveTo(bottomRight[0] - 7, bottomRight[1]); ctx.lineTo(bottomRight[0], bottomRight[1]); ctx.lineTo(bottomRight[0], bottomRight[1] - 7);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawLightSweeps() {
    const x = wrap(elapsed * 24 + width * 0.4, width + 1000) - 500;
    const sweep = ctx.createLinearGradient(x - 240, 0, x + 240, height * 0.55);
    sweep.addColorStop(0, rgba(accentRGB, 0));
    sweep.addColorStop(0.4, rgba(accentRGB, dark ? 0.018 : 0.012));
    sweep.addColorStop(0.5, rgba(accentRGB, dark ? 0.055 : 0.028));
    sweep.addColorStop(0.6, rgba(accentRGB, dark ? 0.018 : 0.012));
    sweep.addColorStop(1, rgba(accentRGB, 0));
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, width, height);
    const haloX = width * (0.66 + Math.sin(elapsed * 0.085) * 0.2);
    const haloY = height * (0.45 + Math.cos(elapsed * 0.11) * 0.28);
    const halo = ctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, Math.min(width, 850));
    halo.addColorStop(0, rgba(secondaryRGB, dark ? 0.04 : 0.022));
    halo.addColorStop(0.6, rgba(tertiaryRGB, dark ? 0.014 : 0.008));
    halo.addColorStop(1, rgba(secondaryRGB, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
  }

  function drawDepth() {
    const depthCell = CELL * 2;
    const offsetX = wrap(-scrollPosition * 0.012, depthCell);
    const offsetY = wrap(-scrollPosition * 0.075, depthCell);
    ctx.strokeStyle = rgba(gridRGB, dark ? 0.25 : 0.18);
    ctx.lineWidth = 0.85;
    ctx.setLineDash([1, 10]);
    ctx.lineDashOffset = -elapsed * 9;
    ctx.beginPath();
    for (let x = offsetX; x < width; x += depthCell) {
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += depthCell * 2) {
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // Displace samples radially for a soft local lens around the pointer.
  function bend(x, y) {
    if (pointer.strength < 0.002 || reduced.matches) return [x, y];
    const dx = x - pointer.x, dy = y - pointer.y;
    const distance = dx * dx + dy * dy;
    const influence = Math.exp(-distance / 22000) * 0.115 * pointer.strength;
    return [x + dx * influence, y + dy * influence];
  }

  function point(x, y, first) {
    const p = bend(x, y);
    if (first) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }

  function drawGrid(offsetX, offsetY) {
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = rgba(gridRGB, dark ? 0.18 : 0.15);
    ctx.beginPath();
    for (let x = offsetX - CELL; x < width + CELL; x += CELL) {
      for (let y = offsetY - CELL; y < height + CELL + 32; y += 32) point(x, y, y === offsetY - CELL);
    }
    for (let y = offsetY - CELL; y < height + CELL; y += CELL) {
      for (let x = offsetX - CELL; x < width + CELL + 32; x += 32) point(x, y, x === offsetX - CELL);
    }
    ctx.stroke();

    // Sparse registration marks anchor the field without making every cell busy.
    ctx.strokeStyle = rgba(gridRGB, dark ? 0.32 : 0.27);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const markX = wrap(-scrollPosition * 0.025, CELL * 4);
    const markY = wrap(-scrollPosition * 0.18, CELL * 4);
    for (let x = markX - CELL * 4; x < width + CELL; x += CELL * 4) {
      for (let y = markY - CELL * 4; y < height + CELL; y += CELL * 4) {
        const p = bend(x, y);
        ctx.moveTo(p[0] - 3, p[1]); ctx.lineTo(p[0] + 3, p[1]);
        ctx.moveTo(p[0], p[1] - 3); ctx.lineTo(p[0], p[1] + 3);
      }
    }
    ctx.stroke();
  }

  function drawStars(moving) {
    stars.forEach((star) => {
      const x = wrap(star.x * width + (moving ? elapsed * star.depth * 0.7 : 0), width);
      const y = wrap(star.y * height - scrollPosition * star.depth * 0.06, height);
      const pulse = moving ? Math.sin(elapsed * 0.55 + star.phase) * 0.07 : 0;
      ctx.fillStyle = rgba(gridRGB, 0.18 + star.depth * 0.15 + pulse);
      ctx.beginPath();
      ctx.arc(x, y, star.depth > 0.85 ? 1 : 0.65, 0, TAU);
      ctx.fill();
    });
  }

  function drawSignals() {
    const columns = Math.ceil(width / CELL), rows = Math.ceil(height / CELL);
    signals.forEach((signal, i) => {
      if (width < 700 && i > 7) return;
      const pathLength = CELL * (4 + i % 3);
      const color = channelColor(i);
      const head = wrap(elapsed * signal.speed + signal.phase * pathLength * 1.8, pathLength * 1.8);
      if (head > pathLength + 45) return;
      const x = wrap(Math.floor(signal.x * columns) * CELL - scrollPosition * 0.025 + CELL, (columns + 2) * CELL) - CELL;
      const y = wrap(Math.floor(signal.y * rows) * CELL - scrollPosition * 0.18 + CELL, (rows + 2) * CELL) - CELL;
      // A single elbow routes each signal through the coordinate field.
      const routePoint = (distance) => {
        const first = Math.min(distance, CELL * 2);
        const second = Math.max(0, distance - CELL * 2);
        return signal.horizontal ? [x + first, y + second] : [x + second, y + first];
      };
      for (let trail = 0; trail < 10; trail++) {
        const distance = head - trail * 6;
        if (distance < 0 || distance > pathLength) continue;
        const a = routePoint(Math.max(0, distance - 6));
        const b = routePoint(distance);
        ctx.strokeStyle = rgba(color, (1 - trail / 10) * (dark ? 0.48 : 0.32));
        ctx.lineWidth = trail === 0 ? 1.5 : 1;
        ctx.beginPath(); point(a[0], a[1], true); point(b[0], b[1], false); ctx.stroke();
      }
      if (head <= pathLength) {
        const p = routePoint(head), b = bend(p[0], p[1]);
        ctx.fillStyle = rgba(color, dark ? 0.7 : 0.55);
        ctx.fillRect(b[0] - 1.25, b[1] - 1.25, 2.5, 2.5);
      }
    });
  }

  function drawPointer(offsetX, offsetY) {
    if (pointer.strength < 0.01) return;
    const strength = pointer.strength;
    const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 210);
    glow.addColorStop(0, rgba(accentRGB, 0.035 * strength));
    glow.addColorStop(1, rgba(accentRGB, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(pointer.x - 210, pointer.y - 210, 420, 420);

    // Nearby intersections illuminate; the native cursor remains available.
    const nearestX = Math.round((pointer.x - offsetX) / CELL) * CELL + offsetX;
    const nearestY = Math.round((pointer.y - offsetY) / CELL) * CELL + offsetY;
    ctx.lineWidth = 1;
    for (let ix = -2; ix <= 2; ix++) {
      for (let iy = -2; iy <= 2; iy++) {
        const x = nearestX + ix * CELL, y = nearestY + iy * CELL;
        const distance = Math.hypot(x - pointer.x, y - pointer.y);
        if (distance > 170) continue;
        const p = bend(x, y);
        ctx.strokeStyle = rgba(accentRGB, (1 - distance / 170) * strength * 0.62);
        ctx.beginPath();
        ctx.moveTo(p[0] - 4, p[1]); ctx.lineTo(p[0] + 4, p[1]);
        ctx.moveTo(p[0], p[1] - 4); ctx.lineTo(p[0], p[1] + 4);
        ctx.stroke();
      }
    }
  }

  function drawRings() {
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i], age = elapsed - ring.started;
      if (age > 1.4) { rings.splice(i, 1); continue; }
      const progress = age / 1.4;
      ctx.strokeStyle = rgba(accentRGB, (1 - progress) * 0.3);
      ctx.lineWidth = 1 - progress * 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y - (scrollPosition - ring.scroll) * 0.18, 8 + progress * 160, 0, TAU);
      ctx.stroke();
    }
  }

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const moving = !reduced.matches;
    const offsetX = wrap(-scrollPosition * 0.025, CELL);
    const offsetY = wrap(-scrollPosition * 0.18, CELL);
    if (moving) { drawLightSweeps(); drawDepth(); }
    drawStars(moving);
    drawGrid(offsetX, offsetY);
    if (moving) {
      drawSignals();
      drawPopups();
      drawPointer(offsetX, offsetY);
      drawRings();
    }
  }

  function isRunning() { return !reduced.matches && !document.hidden; }

  function frame(time) {
    frameId = 0;
    if (!isRunning()) return;
    if (!previousTime) previousTime = time - FRAME;
    const difference = time - previousTime;
    if (difference >= FRAME - 0.05) {
      const dt = Math.min((lastDrawTime ? time - lastDrawTime : FRAME) / 1000, 0.08);
      lastDrawTime = time;
      // Preserve pacing on high-refresh displays; ignore sub-pixel clock error
      // at an exact 60Hz boundary instead of skipping an otherwise due frame.
      const remainder = difference % FRAME;
      previousTime = time - (remainder > FRAME - 0.05 ? 0 : remainder);
      elapsed += dt;
      const ease = 1 - Math.exp(-dt * 8);
      scrollPosition += (scrollTarget - scrollPosition) * ease;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, ease * 1.6);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, ease * 1.6);
      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * ease;
      updatePopups();
      draw();
    }
    frameId = requestAnimationFrame(frame);
  }

  function play() {
    if (!frameId && isRunning()) {
      previousTime = 0;
      lastDrawTime = 0;
      frameId = requestAnimationFrame(frame);
    }
  }
  function pause() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousTime = 0;
    lastDrawTime = 0;
  }
  function releasePointer() { pointer.active = false; }

  addEventListener("pointermove", (event) => {
    if (!finePointer.matches || event.pointerType === "touch" || reduced.matches) return;
    if (!pointer.active) { pointer.x = event.clientX; pointer.y = event.clientY; }
    pointer.tx = event.clientX; pointer.ty = event.clientY;
    pointer.active = true;
  }, { passive: true });
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) releasePointer();
  }, { passive: true });
  addEventListener("pointercancel", releasePointer, { passive: true });
  addEventListener("blur", releasePointer);
  finePointer.addEventListener("change", () => {
    if (!finePointer.matches) releasePointer();
  });
  addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") releasePointer();
  }, { passive: true });
  addEventListener("click", (event) => {
    if (!isRunning() || !event.detail || event.button !== 0) return;
    if (event.target.closest("input, textarea, select, label, [contenteditable]")) return;
    if (rings.length >= 5) rings.shift();
    rings.push({ x: event.clientX, y: event.clientY, scroll: scrollPosition, started: elapsed });
  }, { passive: true });
  addEventListener("scroll", () => { scrollTarget = window.scrollY || 0; }, { passive: true });
  addEventListener("resize", resize, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);

  new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  darkScheme.addEventListener("change", readColors);
  reduced.addEventListener("change", () => {
    pause();
    rings.length = 0;
    popups.length = 0;
    nextPopupAt = elapsed + 0.25;
    pointer.active = false;
    pointer.strength = 0;
    scrollPosition = scrollTarget;
    draw();
    play();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { pause(); releasePointer(); }
    else { scrollTarget = window.scrollY || 0; play(); }
  });

  readColors();
  resize();
  play();
})();
