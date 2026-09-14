/* Heavy reactive node field. Dense dots, webbed lines, cursor storms, click blasts.
   Speed is locked: one guarded loop plus delta-time physics, so it runs the same
   on 60Hz and 144Hz screens and never accelerates over time. */
(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#2563EB", "#7C3AED", "#06B6D4", "#60A5FA", "#A78BFA", "#38BDF8"];
  const BASE_VX = 0.7;   // base drift, px per 60fps frame
  const BASE_R = 1.7;    // max dot radius
  let W = 0, H = 0, parts = [], sparks = [], waves = [];
  const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, down: false };
  let running = true;
  let raf = 0;
  let last = 0;

  const isMobile = () => Math.min(W, H) < 700 || /Mobi|Android/i.test(navigator.userAgent);
  const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const targetCount = () => {
    const area = W * H;
    if (isMobile()) return Math.min(85, Math.floor(area / 15000));
    return Math.min(200, Math.floor(area / 6500));
  };

  function resize() {
    const DPR = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
    if (calm) drawOnce();
  }

  function seed() {
    const n = targetCount();
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * BASE_VX,
      vy: (Math.random() - 0.5) * BASE_VX,
      r: 1 + Math.random() * BASE_R,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2,
      ts: 0.015 + Math.random() * 0.04,
    }));
    sparks = [];
    waves = [];
  }

  function blast(x, y, big) {
    waves.push({ x, y, r: 10, max: big ? 460 : 300, a: 0.55 });
    const n = big ? 42 : 26;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * (big ? 7 : 5);
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1 + Math.random() * 2.4,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0.9 + Math.random() * 0.7,
      });
    }
  }

  function step(dt) {
    ctx.clearRect(0, 0, W, H);
    mouse.vx *= Math.pow(0.9, dt); mouse.vy *= Math.pow(0.9, dt);
    const mSpeed = Math.hypot(mouse.vx, mouse.vy);
    const linkDist = isMobile() ? 105 : 135;
    const lineBase = dark() ? "148,180,255" : "60,90,160";
    const linePeak = dark() ? 0.34 : 0.4;
    const damp = Math.pow(0.97, dt);

    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx > linkDist || dx < -linkDist || dy > linkDist || dy < -linkDist) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < linkDist * linkDist) {
          const alpha = (1 - Math.sqrt(d2) / linkDist) * linePeak;
          ctx.strokeStyle = "rgba(" + lineBase + "," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }

    const now = performance.now();
    for (const p of parts) {
      p.tw += p.ts * dt;
      p.vx += Math.sin((p.y + now * 0.00025) * 0.012) * 0.006 * dt;
      p.vy += Math.cos((p.x + now * 0.00025) * 0.012) * 0.006 * dt;

      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 230 && d > 0.5) {
        const grab = (1 - d / 230) * 0.6;
        ctx.strokeStyle = "rgba(96,165,250," + grab.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        if (mouse.down) {
          p.vx -= (dx / d) * 0.12 * dt;
          p.vy -= (dy / d) * 0.12 * dt;
        } else {
          const stir = Math.min(mSpeed * 0.05, 1);
          p.vx += ((dx / d) * (0.05 + stir * 0.16) + mouse.vx * 0.025) * dt;
          p.vy += ((dy / d) * (0.05 + stir * 0.16) + mouse.vy * 0.025) * dt;
          p.vx += (-dy / d) * 0.016 * dt;
          p.vy += (dx / d) * 0.016 * dt;
        }
      }

      for (const w of waves) {
        const wdx = p.x - w.x, wdy = p.y - w.y;
        const wd = Math.hypot(wdx, wdy);
        if (Math.abs(wd - w.r) < 60 && wd > 1) {
          const f = (1 - Math.abs(wd - w.r) / 60) * 2 * dt;
          p.vx += (wdx / wd) * f;
          p.vy += (wdy / wd) * f;
        }
      }

      p.vx *= damp; p.vy *= damp;
      p.vx = Math.max(-3.6, Math.min(3.6, p.vx));
      p.vy = Math.max(-3.6, Math.min(3.6, p.vy));
      if (Math.abs(p.vx) < 0.12) p.vx += (Math.random() - 0.5) * 0.03 * dt;
      if (Math.abs(p.vy) < 0.12) p.vy += (Math.random() - 0.5) * 0.03 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;

      ctx.globalAlpha = 0.55 + Math.sin(p.tw) * 0.4;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    sparks = sparks.filter((s) => s.life > 0);
    for (const s of sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= damp; s.vy *= damp; s.vy += 0.02 * dt;
      s.life -= 0.018 * dt;
      ctx.globalAlpha = Math.max(s.life, 0);
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    waves = waves.filter((w) => w.a > 0.02 && w.r < w.max);
    for (const w of waves) {
      w.r += 11 * dt; w.a *= Math.pow(0.94, dt);
      ctx.strokeStyle = dark() ? "rgba(147,197,253," + w.a.toFixed(3) + ")" : "rgba(37,99,235," + w.a.toFixed(3) + ")";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = dark() ? "rgba(167,139,250," + (w.a * 0.5).toFixed(3) + ")" : "rgba(124,58,237," + (w.a * 0.5).toFixed(3) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawOnce() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Single guarded loop: frame() only ever schedules one callback,
  // so tab switches and resizes can never stack extra loops.
  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(Math.max((now - last) / 16.667, 0.5), 2.5);
    last = now;
    step(dt);
    if (running) raf = requestAnimationFrame(frame);
  }
  function play() {
    if (calm || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  addEventListener("pointermove", (e) => {
    const nx = e.clientX, ny = e.clientY;
    if (mouse.x > -1000) { mouse.vx = nx - mouse.px; mouse.vy = ny - mouse.py; }
    mouse.px = nx; mouse.py = ny;
    mouse.x = nx; mouse.y = ny;
    if (!calm && Math.hypot(mouse.vx, mouse.vy) > 20 && sparks.length < 240) {
      sparks.push({
        x: nx, y: ny,
        vx: -mouse.vx * 0.03 + (Math.random() - 0.5),
        vy: -mouse.vy * 0.03 + (Math.random() - 0.5),
        r: 0.8 + Math.random() * 1.4,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0.55,
      });
    }
  }, { passive: true });
  addEventListener("pointerdown", (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener("pointerup", () => { mouse.down = false; });
  addEventListener("pointerleave", () => { mouse.x = -9999; mouse.y = -9999; });
  addEventListener("click", (e) => { if (!calm) blast(e.clientX, e.clientY, e.detail >= 2); });

  document.addEventListener("visibilitychange", () => {
    if (calm) return;
    if (document.hidden) stop();
    else { running = true; play(); }
  });

  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(resize, 150); });
  resize();
  play();
})();
