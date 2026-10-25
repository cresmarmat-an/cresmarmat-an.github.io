/* Particle morph: one field of points behind the page. On load it assembles into the
   portrait, then re-forms as you scroll: a spinning globe, a map of the Philippines, a
   ribbon flowing behind the projects and a vortex at the very end. The portrait is a
   crisp point cloud in the photo's own colours with real depth, so it reads as a 3D bust
   that turns gently and leans toward the cursor. Everywhere else the cursor scatters the
   points it touches, and clicks send a ripple through the field.
   Plain WebGL, no libraries. Every shape lives in [-1,1] space and is placed on screen
   each frame, so the portrait stays glued to its spot in the hero at any size.
   Reduced motion, or no WebGL, keeps the regular photo instead. */
(() => {
  const canvas = document.getElementById("morph");
  if (!canvas) return;
  const root = document.documentElement;
  const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMq.matches) return;
  const darkMq = matchMedia("(prefers-color-scheme: dark)");
  const conn = navigator.connection || {};
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!conn.saveData;
  const small = () => Math.min(innerWidth, innerHeight) < 700;
  const N = small() ? 16000 : weak ? 24000 : 40000; // heavy on purpose: a crisp face and dense shapes

  let gl = null;
  try {
    gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  } catch { gl = null; }
  if (!gl) { root.classList.add("no-morph"); return; }

  // Philippines, simplified from Natural Earth 1:50m (world-atlas, ISC). x,y in -1000..1000
  const PH = [[-92,891,9,846,36,850,51,873,67,869,74,850,55,814,51,758,63,726,83,708,86,690,101,683,49,551,1,536,-25,516,-29,501,-23,480,-52,431,-12,353,-20,328,-1,270,19,249,59,237,70,246,58,267,97,291,116,291,158,273,177,241,175,217,181,212,198,211,207,224,208,238,202,243,210,255,226,242,278,224,284,219,277,208,249,205,241,197,278,144,274,122,322,112,322,78,311,47,286,63,296,95,252,94,209,113,207,137,189,169,148,193,111,234,97,237,94,231,100,198,122,162,123,142,112,134,82,180,40,217,0,238,-38,224,-45,206,-59,197,-93,202,-115,213,-128,230,-143,233,-156,219,-158,273,-116,315,-114,337,-162,370,-168,353,-162,314,-182,310,-208,357,-231,365,-258,508,-274,527,-273,561,-265,571,-220,532,-192,541,-201,616,-186,659,-184,718,-193,754,-160,876,-131,889,-92,891],[576,-407,587,-415,602,-413,601,-434,617,-458,619,-473,595,-508,625,-523,627,-545,638,-563,635,-614,653,-636,655,-696,635,-729,602,-751,608,-768,601,-827,581,-752,551,-684,533,-694,491,-774,520,-805,531,-839,530,-873,501,-917,487,-926,472,-904,476,-866,471,-860,444,-888,429,-888,332,-838,313,-814,301,-732,329,-693,331,-675,299,-638,258,-616,234,-618,220,-674,191,-657,180,-633,165,-654,145,-657,138,-630,114,-624,95,-641,50,-738,34,-740,17,-720,20,-703,37,-680,49,-617,64,-599,83,-585,155,-569,166,-560,166,-541,180,-524,213,-511,226,-493,260,-504,283,-531,286,-565,269,-583,276,-584,330,-559,358,-507,388,-518,403,-512,410,-469,421,-455,459,-470,468,-448,507,-449,512,-432,495,-358,503,-346,559,-380,576,-407],[184,-442,166,-443,149,-407,107,-384,86,-354,85,-337,95,-317,128,-313,147,-300,142,-242,161,-214,164,-188,202,-173,236,-183,244,-203,189,-331,187,-367,210,-413,184,-442],[472,41,482,30,483,12,512,-6,501,-39,506,-89,522,-127,518,-139,535,-149,540,-165,525,-154,471,-152,432,-105,428,-94,439,-65,423,-64,395,-30,364,-11,347,24,343,47,380,41,460,47,472,41],[98,-87,114,-94,145,-89,157,-98,153,-111,188,-97,183,-132,169,-156,140,-174,135,-197,102,-215,57,-225,24,-250,26,-190,37,-159,45,-83,40,-71,16,-62,19,-53,34,-47,98,-87],[-608,-530,-621,-540,-620,-527,-603,-491,-530,-418,-499,-403,-375,-262,-348,-245,-336,-216,-343,-194,-337,-176,-310,-124,-303,-128,-307,-179,-285,-242,-297,-255,-328,-266,-352,-303,-408,-323,-409,-344,-455,-416,-496,-437,-516,-469,-608,-530],[-146,174,-117,177,-89,160,-78,167,-35,125,-41,97,-32,56,-52,9,-62,10,-74,-2,-90,3,-111,30,-120,57,-136,78,-138,103,-154,131,-173,143,-180,162,-196,165,-187,179,-146,174],[381,-124,391,-129,415,-116,430,-120,443,-143,441,-202,462,-223,476,-269,474,-275,460,-274,459,-285,438,-260,443,-307,409,-288,404,-251,412,-210,404,-189,393,-178,364,-183,345,-104,348,-98,354,-100,381,-124],[217,-389,212,-392,210,-383,219,-316,263,-246,308,-134,310,-230,304,-256,262,-294,234,-369,217,-389],[384,-342,352,-363,320,-368,294,-364,278,-337,327,-293,349,-290,382,-308,384,-342],[264,8,290,-9,309,-37,309,-67,265,-39,267,-32,231,-2,188,-43,203,23,199,49,243,29,264,8],[351,195,347,186,337,189,327,181,308,199,320,217,320,244,334,257,360,228,358,202,351,195],[43,-810,25,-812,4,-785,7,-778,38,-767,70,-781,75,-786,43,-810],[-229,-9,-216,-9,-211,-2,-196,-22,-199,-31,-241,-31,-260,-5,-258,9,-229,-9],[19,182,30,183,46,172,47,158,31,135,7,153,12,186,19,182],[-84,-860,-77,-870,-52,-870,-50,-879,-66,-888,-76,-878,-115,-885,-123,-877,-101,-857,-84,-860],[533,-324,507,-295,511,-269,530,-250,533,-324],[43,17,32,-18,20,14,30,51,50,58,43,17],[35,387,26,371,33,353,29,339,21,338,20,358,6,381,9,391,35,387],[-208,-974,-216,-986,-226,-980,-248,-999,-266,-1000,-265,-991,-220,-963,-208,-974],[119,-246,104,-252,104,-227,126,-208,131,-220,119,-246],[-237,-74,-250,-76,-261,-39,-254,-35,-237,-44,-232,-63,-237,-74],[386,-103,369,-104,352,-79,373,-76,388,-95,386,-103],[120,10,113,7,88,31,113,36,122,26,120,10],[584,-345,574,-334,586,-304,599,-340,584,-345],[205,87,217,65,163,112,161,122,173,123,205,87],[-254,-244,-270,-248,-274,-235,-262,-222,-241,-232,-254,-244],[262,-418,263,-433,251,-437,234,-425,256,-412,262,-418],[272,31,273,18,251,47,251,62,263,53,272,31],[-640,-607,-647,-618,-655,-606,-652,-584,-640,-581,-640,-607],[413,-432,409,-440,394,-433,392,-420,403,-417,413,-432],[546,-736,544,-744,532,-720,537,-705,546,-712,546,-736],[-205,212,-205,202,-228,216,-228,224,-205,212],[20,930,11,920,6,922,23,946,29,938,20,930],[477,-314,478,-321,461,-303,457,-290,471,-296,477,-314],[54,253,54,248,25,268,25,278,54,253],[-261,-99,-262,-118,-279,-112,-280,-106,-261,-99],[-35,995,-33,982,-55,994,-52,1000,-35,995]];

  const SCATTER = 0, PORTRAIT = 1, GLOBE = 2, MAP = 3, RIBBON = 4, VORTEX = 5;

  /* ---------- shaders ---------- */

  const VERT = `
precision highp float;
attribute vec3 aP;
attribute vec4 aC;
attribute vec2 aMap;
attribute vec4 aR;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uFrom;
uniform float uTo;
uniform float uT;
uniform vec4 uRectF;
uniform vec4 uRectT;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform vec2 uTilt;
uniform vec3 uRipple;
uniform float uSize;
uniform float uPSize;
varying vec4 vCol;
varying float vA;
varying float vMix;
varying float vTint;

vec3 shape(float id, float t){
  if(id < .5){ // scatter: a loose, slowly breathing cloud
    return vec3((aR.x*2.-1.)*1.1, (aR.y*2.-1.)*1.1, (aR.z-.5)*.8)
      + .03*vec3(sin(t*.4+aR.w*6.28), cos(t*.35+aR.x*6.28), 0.);
  }
  if(id < 1.5){ // portrait: the photo as a relief, face forward, edges curving back
    return aP + .0012*vec3(sin(t*1.3+aR.x*40.), cos(t*1.1+aR.y*40.), 0.);
  }
  if(id < 2.5){ // globe, spinning on a tilted axis
    float th = aR.x*6.2831853 + t*.22;
    float ph = acos(2.*aR.y-1.);
    vec3 p = vec3(sin(ph)*cos(th), cos(ph), sin(ph)*sin(th));
    float k = .38; // axial tilt
    return vec3(p.x, p.y*cos(k)-p.z*sin(k), p.y*sin(k)+p.z*cos(k));
  }
  if(id < 3.5){ // the Philippines
    return vec3(aMap, (aR.z-.5)*.05) + .003*vec3(sin(t+aR.x*30.), cos(t+aR.y*30.), 0.);
  }
  if(id < 4.5){ // ribbon: a twisting band flowing left to right
    float u = fract(aR.x + t*.025)*2.-1.;
    float v = aR.y*2.-1.;
    float tw = u*3.1 + t*.45;
    float wave = sin(u*2.3 + t*.5)*.32 + sin(u*5.1 - t*.3)*.05;
    return vec3(u*1.1, wave + cos(tw)*v*.17, sin(tw)*v*.17 + (aR.z-.5)*.03);
  }
  // vortex: three spiral arms winding inward
  float r = pow(aR.y, .55);
  float a = floor(aR.z*3.)*2.0944 + r*5.6 - t*(.5 + (1.-r)*1.1) + (aR.w-.5)*.55*(1.-r*.5);
  return vec3(cos(a)*r, sin(a)*r*.62, (aR.w-.5)*.1*(1.-r));
}

float glow(float id, vec3 p){ // per-shape point brightness
  if(id > .5 && id < 1.5) return aC.a;
  if(id < .5) return .45;
  if(id < 2.5) return .14 + 1.05*smoothstep(-1., 1., p.z); // far side of the globe fades away
  if(id > 3.5 && id < 4.5) return .3 + .75*smoothstep(-.17, .17, p.z); // ribbon twist catches the light
  return .62 + .38*aR.w;
}

float isP(float id){ return step(.5, id)*step(id, 1.5); }
float dotSize(float id){
  if(id > .5 && id < 1.5) return uPSize; // portrait dots overlap a little so the face stays solid
  return uSize*(.55 + aR.w*.9);
}

vec2 place(vec3 p, vec4 rect){
  // gentle 3D tilt toward the cursor, then perspective
  float cy = cos(uTilt.x), sy = sin(uTilt.x);
  p = vec3(p.x*cy + p.z*sy, p.y, -p.x*sy + p.z*cy);
  float cx = cos(uTilt.y), sx = sin(uTilt.y);
  p = vec3(p.x, p.y*cx - p.z*sx, p.y*sx + p.z*cx);
  float persp = 2.8/(2.8 - p.z);
  return rect.xy + vec2(p.x, -p.y)*rect.zw*persp;
}

void main(){
  // particles leave at slightly different moments, so the morph flows instead of snapping
  float st = clamp((uT - aR.z*.35)/.65, 0., 1.);
  st = st*st*(3.-2.*st);
  vec3 sa = shape(uFrom, uTime);
  vec3 sb = shape(uTo, uTime);
  vec2 pa = place(sa, uRectF);
  vec2 pb = place(sb, uRectT);
  vec2 pos = mix(pa, pb, st);
  vec2 dir = pb - pa;
  pos += vec2(-dir.y, dir.x)*sin(st*3.14159)*(aR.w-.5)*.45; // arc while in flight

  float pw = mix(isP(uFrom), isP(uTo), st); // how much of this point is still the photo

  // cursor: push everything nearby outward (only a soft dent on the face)
  vec2 d = pos - uMouse;
  float dl = length(d);
  float push = uMouseOn*smoothstep(130., 0., dl)*(1. - pw*.78);
  pos += d/max(dl, 1.)*push*push*78.;

  // click ripple: a ring travelling outward
  vec2 rd = pos - uRipple.xy;
  float rl = length(rd);
  float wave = exp(-uRipple.z*2.4)*smoothstep(55., 0., abs(rl - uRipple.z*720.));
  pos += rd/max(rl, 1.)*wave*34.;

  vec2 clip = pos/uRes*2. - 1.;
  gl_Position = vec4(clip.x, -clip.y, 0., 1.);
  float g = mix(glow(uFrom, sa), glow(uTo, sb), st);
  gl_PointSize = mix(dotSize(uFrom), dotSize(uTo), st)*uDpr*(1. + push*1.4 + wave*.8)*mix(.8 + g*.4, 1., pw);
  vA = g*(1. + push*.6);
  vMix = pw;
  vCol = aC;
  vTint = step(.84, fract(aR.w*7.31)) + push*.8;
}`;

  const FRAG = `
precision mediump float;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uAlpha;
varying vec4 vCol;
varying float vA;
varying float vMix;
varying float vTint;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, mix(.1, .44, vMix), d)*vA*mix(uAlpha, 1., vMix); // photo dots are near-solid and overlap, so no gaps show
  vec3 c = mix(mix(uColA, uColB, clamp(vTint, 0., 1.)), vCol.rgb, vMix);
  gl_FragColor = vec4(c*a, a);
}`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader");
    return sh;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch {
    root.classList.add("no-morph");
    return;
  }
  gl.useProgram(prog);
  const U = {};
  ["uRes", "uDpr", "uTime", "uFrom", "uTo", "uT", "uRectF", "uRectT", "uMouse", "uMouseOn", "uTilt", "uRipple", "uSize", "uPSize", "uColA", "uColB", "uAlpha"]
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  function attrib(name, data, size) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  /* ---------- sampling ---------- */

  const work = document.createElement("canvas");
  const wctx = work.getContext("2d", { willReadFrequently: true });

  // pick n indices with probability proportional to weight
  function pick(weights, n) {
    const cdf = new Float64Array(weights.length);
    let sum = 0;
    for (let i = 0; i < weights.length; i++) { sum += weights[i]; cdf[i] = sum; }
    const out = new Uint32Array(n);
    for (let k = 0; k < n; k++) {
      const r = Math.random() * sum;
      let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; }
      out[k] = lo;
    }
    return out;
  }

  // the photo as a regular grid of dots in its own colours, sized so the grid has about N dots
  let portraitGrid = 1;
  function samplePortrait(img) {
    const draw = (G) => {
      work.width = G; work.height = G;
      wctx.clearRect(0, 0, G, G);
      wctx.imageSmoothingQuality = "high";
      wctx.drawImage(img, 0, 0, G, G);
      return wctx.getImageData(0, 0, G, G).data;
    };
    // keep the real silhouette; only fade where the shirt runs off the bottom and sides of the photo
    const feather = (x, y, G) => {
      const xn = (x + 0.5) / G, yn = (y + 0.5) / G;
      const bottom = Math.min(1, Math.max(0, (0.98 - yn) / 0.24));
      const side = Math.min(1, Math.max(0, Math.min(xn, 1 - xn) / 0.14));
      return bottom * (yn > 0.55 ? side : 1);
    };
    const coverage = (px, G) => {
      let n = 0;
      for (let i = 0; i < G * G; i++) if ((px[i * 4 + 3] / 255) * feather(i % G, (i / G) | 0, G) > 0.12) n++;
      return n;
    };
    const lo = draw(64);
    let G = Math.max(60, Math.min(340, Math.floor(Math.sqrt(N / Math.max(0.05, coverage(lo, 64) / 4096)))));
    let px = draw(G);
    while (G > 60 && coverage(px, G) > N) px = draw(--G); // never more grid cells than dots: no holes
    portraitGrid = G;

    const M = new Float32Array(G * G), L = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) {
      M[i] = (px[i * 4 + 3] / 255) * feather(i % G, (i / G) | 0, G);
      L[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
    }
    // depth: blur the silhouette so the middle of the face swells forward and the edges fall away
    let H = M.slice();
    const R = Math.max(2, Math.round(G * 0.07));
    const tmp = new Float32Array(G * G);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < G; y++) {
        let acc = 0;
        for (let x = -R; x <= R; x++) acc += H[y * G + Math.min(G - 1, Math.max(0, x))];
        for (let x = 0; x < G; x++) {
          tmp[y * G + x] = acc / (2 * R + 1);
          acc += H[y * G + Math.min(G - 1, x + R + 1)] - H[y * G + Math.max(0, x - R)];
        }
      }
      for (let x = 0; x < G; x++) {
        let acc = 0;
        for (let y = -R; y <= R; y++) acc += tmp[Math.min(G - 1, Math.max(0, y)) * G + x];
        for (let y = 0; y < G; y++) {
          H[y * G + x] = acc / (2 * R + 1);
          acc += tmp[Math.min(G - 1, y + R + 1) * G + x] - tmp[Math.max(0, y - R) * G + x];
        }
      }
    }
    let hMax = 0;
    for (let i = 0; i < G * G; i++) hMax = Math.max(hMax, H[i]);

    const cells = [];
    for (let i = 0; i < G * G; i++) if (M[i] > 0.12) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }

    const pos = new Float32Array(N * 3), col = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) {
      const i = cells[k % cells.length], x = i % G, y = (i / G) | 0;
      const extra = k >= cells.length ? 0.35 : 0; // spare dots double up with a tiny offset
      pos[k * 3] = ((x + 0.5 + (Math.random() - 0.5) * extra) / G) * 2 - 1;
      pos[k * 3 + 1] = -(((y + 0.5 + (Math.random() - 0.5) * extra) / G) * 2 - 1);
      const h = hMax > 0 ? H[i] / hMax : 0;
      pos[k * 3 + 2] = (Math.pow(h, 0.7) - 0.4) * 0.62 + (L[i] - 0.5) * 0.06;
      col[k * 4] = px[i * 4] / 255;
      col[k * 4 + 1] = px[i * 4 + 1] / 255;
      col[k * 4 + 2] = px[i * 4 + 2] / 255;
      col[k * 4 + 3] = M[i];
    }
    return { pos, col };
  }

  // fill the islands, with a little extra density along the coastlines
  function sampleMap() {
    const W = 320, H = 320, k = 0.47;
    work.width = W; work.height = H;
    wctx.clearRect(0, 0, W, H);
    wctx.fillStyle = "#000";
    for (const ring of PH) {
      wctx.beginPath();
      for (let i = 0; i < ring.length; i += 2) {
        const x = W / 2 + (ring[i] / 1000) * W * k, y = H / 2 - (ring[i + 1] / 1000) * H * k;
        if (i) wctx.lineTo(x, y); else wctx.moveTo(x, y);
      }
      wctx.closePath();
      wctx.fill();
    }
    const a = wctx.getImageData(0, 0, W, H).data;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > 127;
    const w = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
        w[y * W + x] = edge ? 3.2 : 1;
      }
    }
    const idx = pick(w, N);
    const out = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = idx[i] % W, y = (idx[i] / W) | 0;
      out[i * 2] = (x + Math.random() - W / 2) / (W * k);
      out[i * 2 + 1] = -(y + Math.random() - H / 2) / (H * k);
    }
    return out;
  }

  /* ---------- layout: where each shape sits on screen ---------- */

  const hero = document.getElementById("home");
  const projects = document.getElementById("projects");
  const photo = hero && hero.querySelector(".photo-blend img");
  const interlude = document.querySelector(".interlude");
  const stage = interlude && interlude.querySelector(".interlude-stage");
  let vw = innerWidth, vh = innerHeight, dpr = 1;
  let photoBox = null, heroH = 0, projTop = 0, maxY = 0, iTop = 0, iH = 0;

  function measure() {
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (photo) {
      const r = photo.getBoundingClientRect();
      photoBox = { x: r.left + r.width / 2, y: r.top + scrollY + r.height / 2, w: r.width / 2, h: r.height / 2 };
    }
    heroH = hero ? hero.offsetHeight : vh;
    iTop = interlude ? interlude.getBoundingClientRect().top + scrollY : heroH;
    iH = interlude ? interlude.offsetHeight : 0;
    projTop = projects ? projects.getBoundingClientRect().top + scrollY : vh;
    maxY = Math.max(0, document.documentElement.scrollHeight - vh);
  }

  const center = (s) => [vw / 2, vh / 2, s, s];
  function rectFor(id, time) {
    const sm = small();
    if (id === PORTRAIT && photoBox) {
      return [photoBox.x, photoBox.y - scrollY + Math.sin(time * 0.9) * 6, photoBox.w, photoBox.h];
    }
    if ((id === GLOBE || id === MAP) && stage && iH > vh) {
      // inside the pinned porthole, wherever it currently is
      const r = stage.getBoundingClientRect();
      const s = (r.width / 2) * (id === GLOBE ? 0.74 : 0.84);
      return [r.left + r.width / 2, r.top + r.height / 2, s, s];
    }
    if (id === GLOBE) {
      const s = sm ? vw * 0.34 : Math.min(vw, vh) * 0.27;
      return [sm ? vw * 0.5 : vw * 0.7, sm ? vh * 0.4 : vh * 0.5, s, s];
    }
    if (id === MAP) {
      const s = sm ? vh * 0.26 : vh * 0.38;
      return [sm ? vw * 0.68 : vw * 0.74, sm ? vh * 0.6 : vh * 0.52, s, s];
    }
    if (id === RIBBON) return [vw * 0.5, vh * 0.55, vw * 0.56, vh * 0.4];
    if (id === VORTEX) { const s = Math.min(vw * 0.44, vh * 0.62); return [vw * 0.5, vh * 0.56, s, s]; }
    return [vw / 2, vh / 2, vw / 2, vh / 2];
  }

  // the morph sequence, keyed to scroll positions; on pages without a hero it is just the vortex
  function keys() {
    if (!hero) return [{ y: 0, id: VORTEX }];
    const roomy = iH > vh; // the interlude gives the globe and the map their own stretch of scroll
    // hold the portrait until it has scrolled most of the way up (on phones it starts below the fold)
    const hold = photoBox ? Math.max(0, photoBox.y - vh * 0.35) : 0;
    const k = [
      { y: 0, id: PORTRAIT },
      { y: hold, id: PORTRAIT },
      { y: roomy ? iTop + vh * 0.15 : heroH * 0.72, id: GLOBE },
      { y: roomy ? iTop + iH - vh * 1.1 : projTop - vh * 0.12, id: MAP },
      { y: projTop + vh * 0.6, id: RIBBON },
      { y: maxY, id: VORTEX },
    ];
    for (let i = 1; i < k.length; i++) k[i].y = Math.max(k[i].y, k[i - 1].y + 160);
    return k;
  }

  function state(time) {
    const ks = keys();
    const y = scrollY;
    if (ks.length === 1 || y <= ks[0].y) return { from: ks[0].id, to: ks[0].id, t: 0 };
    for (let i = 0; i < ks.length - 1; i++) {
      if (y < ks[i + 1].y || i === ks.length - 2) {
        const raw = Math.min(1, Math.max(0, (y - ks[i].y) / (ks[i + 1].y - ks[i].y)));
        return { from: ks[i].id, to: ks[i + 1].id, t: Math.min(1, Math.max(0, (raw - 0.12) / 0.76)) };
      }
    }
    return { from: ks[0].id, to: ks[0].id, t: 0 };
  }

  /* ---------- input ---------- */

  const mouse = { x: -9999, y: -9999, on: 0, ton: 0 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let steer = false; // true while a mouse is moving over the page
  const ripple = { x: -9999, y: -9999, start: -99 };
  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.ton = 1;
    if (e.pointerType === "mouse") { steer = true; tilt.tx = (e.clientX / vw - 0.5) * 0.7; tilt.ty = (e.clientY / vh - 0.5) * 0.4; }
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.ton = 1;
    ripple.x = e.clientX; ripple.y = e.clientY; ripple.start = clock;
  }, { passive: true });
  addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") mouse.ton = 0; }, { passive: true });
  addEventListener("pointercancel", () => { mouse.ton = 0; }, { passive: true });
  document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) { mouse.ton = 0; steer = false; } });
  addEventListener("blur", () => { mouse.ton = 0; });

  /* ---------- theme ---------- */

  const isDark = () => {
    const t = root.dataset.theme;
    return t === "dark" || (t !== "light" && darkMq.matches);
  };
  let dark = isDark() ? 1 : 0;
  const LIGHT = { a: [0.122, 0.118, 0.11], b: [0.45, 0.43, 0.4], alpha: 0.8 };
  const DARK = { a: [0.95, 0.94, 0.92], b: [0.7, 0.68, 0.64], alpha: 0.72 };

  /* ---------- loop ---------- */

  let clock = 0, last = 0, raf = 0, intro = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;

    mouse.on += (mouse.ton - mouse.on) * Math.min(1, dt * 6);
    if (!steer) { tilt.tx = Math.sin(clock * 0.42) * 0.3; tilt.ty = Math.sin(clock * 0.29) * 0.08; } // slow idle turn
    tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt * 3);
    tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt * 3);
    dark += ((isDark() ? 1 : 0) - dark) * Math.min(1, dt * 2.2);

    let s = state(clock);
    // intro: the scattered cloud assembles into the first shape, sped up if you scroll early
    if (intro < 1) {
      intro = Math.min(1, intro + dt / (scrollY > 40 ? 0.6 : 2.6));
      if (s.t === 0) s = { from: SCATTER, to: s.from, t: intro };
    }

    const pal = dark > 0.5 ? DARK : LIGHT;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniform2f(U.uRes, vw, vh);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, clock);
    gl.uniform1f(U.uFrom, s.from);
    gl.uniform1f(U.uTo, s.to);
    gl.uniform1f(U.uT, s.t);
    gl.uniform4fv(U.uRectF, rectFor(s.from, clock));
    gl.uniform4fv(U.uRectT, rectFor(s.to, clock));
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uMouseOn, mouse.on);
    gl.uniform2f(U.uTilt, tilt.x, tilt.y);
    gl.uniform3f(U.uRipple, ripple.x, ripple.y, clock - ripple.start);
    gl.uniform1f(U.uSize, small() ? 1.5 : 1.35);
    gl.uniform1f(U.uPSize, photoBox ? ((photoBox.w * 2) / portraitGrid) * 2.15 : 2);
    gl.uniform3fv(U.uColA, pal.a);
    gl.uniform3fv(U.uColB, pal.b);
    gl.uniform1f(U.uAlpha, pal.alpha);
    gl.drawArrays(gl.POINTS, 0, N);
  }
  function play() {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------- boot ---------- */

  async function boot() {
    let portrait = null;
    if (photo) {
      try {
        const img = new Image();
        img.src = photo.currentSrc || photo.src;
        await img.decode();
        portrait = samplePortrait(img);
      } catch { portrait = null; }
    }
    const blank = new Float32Array(N * 3);
    const rnd = new Float32Array(N * 4);
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    attrib("aP", portrait ? portrait.pos : blank, 3);
    attrib("aC", portrait ? portrait.col : new Float32Array(N * 4), 4);
    attrib("aMap", sampleMap(), 2);
    attrib("aR", rnd, 4);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);

    measure();
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
    addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else play(); });
    reduceMq.addEventListener("change", () => { if (reduceMq.matches) { pause(); root.classList.remove("morph-on"); canvas.style.display = "none"; } });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pause(); root.classList.remove("morph-on"); root.classList.add("no-morph"); });

    // the photo hands over to the particles only once they exist
    if (photo && portrait) root.classList.add("morph-on");
    else if (!photo) root.classList.add("morph-on");
    canvas.classList.add("ready");
    play();
  }
  boot();
})();
