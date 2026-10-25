/* Dream sky: a slow, liquid pastel aurora rendered with WebGL behind the whole page.
   Domain-warped noise gives the flowing, cloud-like motion. The cursor bends it like a
   lens, clicks send a ripple through it, scrolling makes it swirl faster and drifts the
   palette from dawn to dusk, and the theme toggle crossfades between light and dark.
   It is soft by nature, so it renders at a fraction of screen resolution; it pauses when
   the tab is hidden, holds a single still frame with reduced motion, and falls back to a
   CSS gradient when WebGL isn't available. */
(() => {
  const canvas = document.getElementById("dream");
  if (!canvas) return;
  const root = document.documentElement;
  const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
  const darkMq = matchMedia("(prefers-color-scheme: dark)");
  const conn = navigator.connection || {};
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!conn.saveData;

  let gl = null;
  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "low-power" });
  } catch { gl = null; }
  if (!gl) { root.classList.add("no-webgl"); return; }

  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const frag = (octaves) => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define OCT ${octaves}
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uScroll;
uniform float uDark;
uniform vec3 uRipple;

float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.;float a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<OCT;i++){v+=a*noise(p);p=m*p;a*=.5;}
  return v;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 p=vec2((uv.x-.5)*asp,uv.y-.5);

  // cursor: a soft lens that swells and swirls the flow around the pointer
  vec2 m=vec2((uMouse.x-.5)*asp,uMouse.y-.5);
  vec2 d=p-m;
  float lens=exp(-length(d)*4.2)*uMouseOn;
  p+=d*.22*lens;
  float sw=lens*1.1;
  p=m+mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*(p-m);

  // click ripple: a ring that travels outward and fades
  vec2 rc=vec2((uRipple.x-.5)*asp,uRipple.y-.5);
  float rd=length(p-rc);
  float age=uRipple.z;
  float ring=sin(rd*34.-age*9.)*exp(-abs(rd-age*.55)*9.)*exp(-age*1.6);
  p+=normalize(p-rc+1e-4)*ring*.035;

  float t=uTime;
  vec2 q=vec2(fbm(p*1.3+vec2(0.,t*.05)),fbm(p*1.3+vec2(5.2,1.3)-t*.04));
  vec2 r=vec2(fbm(p*1.5+3.2*q+vec2(1.7,9.2)+t*.06),fbm(p*1.5+3.2*q+vec2(8.3,2.8)-t*.05));
  float f=fbm(p*1.1+2.6*r+vec2(uScroll*1.8,-uScroll));
  float s=uScroll;

  // light: pastel dawn that warms toward dusk as you scroll
  vec3 baseL=vec3(.878,.898,.925);
  vec3 lav=vec3(.78,.73,.99), sky=vec3(.66,.83,1.), pink=vec3(1.,.79,.88), mint=vec3(.69,.95,.9), gold=vec3(1.,.9,.76);
  vec3 L=baseL;
  L=mix(L,lav,smoothstep(.25,.85,f)*.62);
  L=mix(L,mix(sky,pink,s),smoothstep(.2,.95,length(q))*.5);
  L=mix(L,mix(mint,lav,s),smoothstep(.45,1.,r.x)*.44);
  L=mix(L,mix(gold,pink,s*.6),smoothstep(.6,1.,r.y*f*1.7)*.42);

  // dark: deep nebula, cooler at the top of the page, magenta lower down
  vec3 baseD=vec3(.133,.149,.184);
  vec3 ind=vec3(.24,.19,.56), mag=vec3(.45,.14,.44), dsky=vec3(.1,.27,.58), teal=vec3(.04,.36,.4), plum=vec3(.33,.2,.42);
  vec3 D=baseD;
  D=mix(D,ind,smoothstep(.25,.85,f)*.6);
  D=mix(D,mix(dsky,mag,s),smoothstep(.2,.95,length(q))*.46);
  D=mix(D,mix(teal,ind,s),smoothstep(.45,1.,r.x)*.4);
  D=mix(D,plum,smoothstep(.6,1.,r.y*f*1.7)*.4);

  vec3 col=mix(L,D,uDark);
  vec3 base=mix(baseL,baseD,uDark);

  // silk: soft glowing ribbons drifting through the flow
  float silk=smoothstep(.11,0.,abs(f-.56-.04*sin(t*.35)));
  silk=silk*silk+smoothstep(.1,0.,abs(length(r)-.92))*.35;
  col+=silk*mix(vec3(.11,.1,.14),vec3(.08,.11,.22),uDark);

  // a little extra light under the cursor and in the ripple
  col+=lens*mix(vec3(.07,.06,.09),vec3(.07,.09,.16),uDark);
  col+=max(ring,0.)*.05;

  // settle toward the plain neumorphic base at the edges so the UI stays calm
  float vig=smoothstep(1.3,.2,length((uv-.5)*vec2(asp*.9,1.15)));
  col=mix(base,col,.5+.5*vig);

  // dither away gradient banding
  col+=(hash(gl_FragCoord.xy+fract(t))-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader");
    return sh;
  }

  let prog, loc;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag(weak ? 4 : 5)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch {
    root.classList.add("no-webgl");
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the screen
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  loc = {};
  ["uRes", "uTime", "uMouse", "uMouseOn", "uScroll", "uDark", "uRipple"].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });

  /* ---------- state ---------- */

  const isDark = () => {
    const t = root.dataset.theme;
    return t === "dark" || (t !== "light" && darkMq.matches);
  };
  let dark = isDark() ? 1 : 0;
  let scale = weak || Math.min(innerWidth, innerHeight) < 700 ? 0.34 : 0.5;
  const mouse = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, on: 0, ton: 0 };
  const ripple = { x: 0.5, y: 0.5, start: -100 };
  let flow = 12.0; // dream time; runs faster while scrolling
  let scrollP = 0, lastY = scrollY, scrollVel = 0;
  let W = 0, H = 0;

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    if (!running()) draw(0);
  }

  function scrollProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(scrollY / max, 1) : 0;
  }

  function draw(now) {
    gl.uniform2f(loc.uRes, W, H);
    gl.uniform1f(loc.uTime, flow);
    gl.uniform2f(loc.uMouse, mouse.x, mouse.y);
    gl.uniform1f(loc.uMouseOn, mouse.on);
    gl.uniform1f(loc.uScroll, scrollP);
    gl.uniform1f(loc.uDark, dark);
    gl.uniform3f(loc.uRipple, ripple.x, ripple.y, Math.max(0, (now - ripple.start) / 1000));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- loop ---------- */

  const running = () => !reduceMq.matches && !document.hidden;
  let raf = 0, last = 0, slowFrames = 0, frames = 0;
  const minGap = weak || Math.min(innerWidth, innerHeight) < 700 ? 1000 / 32 : 0; // ~30fps on phones and weaker machines
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const gap = now - last;
    if (gap < minGap) return;
    const dt = Math.min(gap, 100) / 1000;
    last = now;

    const y = scrollY;
    scrollVel = scrollVel * 0.9 + Math.abs(y - lastY) * 0.1;
    lastY = y;
    flow += dt * (1 + Math.min(scrollVel * 0.06, 5)); // scrolling stirs the dream
    scrollP += (scrollProgress() - scrollP) * Math.min(1, dt * 3);
    const k = Math.min(1, dt * 4);
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    mouse.on += (mouse.ton - mouse.on) * Math.min(1, dt * 2.5);
    dark += ((isDark() ? 1 : 0) - dark) * Math.min(1, dt * 5);

    draw(now);

    // keep it smooth on slower GPUs: drop resolution if frames keep running long
    if (gap > 34 && minGap === 0) slowFrames++;
    if (++frames % 90 === 0) {
      if (slowFrames > 30 && scale > 0.26) { scale *= 0.78; W = 0; resize(); }
      slowFrames = 0;
    }
  }
  function play() {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------- input ---------- */

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mouse.tx = e.clientX / innerWidth;
    mouse.ty = 1 - e.clientY / innerHeight;
    mouse.ton = 1;
  }, { passive: true });
  document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) mouse.ton = 0; });
  addEventListener("blur", () => { mouse.ton = 0; });
  addEventListener("pointerdown", (e) => {
    if (!running()) return;
    ripple.x = e.clientX / innerWidth;
    ripple.y = 1 - e.clientY / innerHeight;
    ripple.start = performance.now();
  }, { passive: true });

  /* ---------- environment ---------- */

  const retheme = () => { if (!running()) { dark = isDark() ? 1 : 0; draw(0); } };
  new MutationObserver(retheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  darkMq.addEventListener("change", retheme);
  reduceMq.addEventListener("change", () => { if (reduceMq.matches) { pause(); draw(0); } else play(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else play(); });
  addEventListener("scroll", () => { if (!running()) { scrollP = scrollProgress(); draw(0); } }, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pause(); root.classList.add("no-webgl"); });

  scrollP = scrollProgress();
  resize();
  draw(0);
  canvas.classList.add("ready");
  play();
})();
