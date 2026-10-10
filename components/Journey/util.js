// Shared helpers for the scroll journey scenes.

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const expLerp = (a, b, t) => a * Math.pow(b / a, t);
export const easeInOut = (t) => t * t * (3 - 2 * t);

// Piecewise keyframe track: keys = [[t, value], ...], value a number or an
// array of numbers. `log` interpolates in log space (for distances).
export const track = (keys, t, { log = false } = {}) => {
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const [ta, va] = keys[i];
  const [tb, vb] = keys[i + 1];
  const u = easeInOut((t - ta) / (tb - ta));
  const mix = (a, b) => (log ? expLerp(a, b, u) : lerp(a, b, u));
  return Array.isArray(va) ? va.map((a, k) => mix(a, vb[k])) : mix(va, vb);
};

// Small deterministic PRNG (mulberry32) so the galaxies look the same each load.
export const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const gauss = (r) => {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Equatorial (RA hours, Dec degrees) -> scene direction in galactic coords,
// matching the ESO Milky Way panorama mapping: (cos b cos l, sin b, -cos b sin l).
const EQ2GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
export const eqToScene = (raHours, decDeg) => {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const e = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const g = EQ2GAL.map((row) => row[0] * e[0] + row[1] * e[1] + row[2] * e[2]);
  const l = Math.atan2(g[1], g[0]);
  const b = Math.asin(clamp(g[2], -1, 1));
  return [Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)];
};
export const galToScene = (lDeg, bDeg) => {
  const l = (lDeg * Math.PI) / 180;
  const b = (bDeg * Math.PI) / 180;
  return [Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)];
};

// Star colour from B-V (approximate black-body tint), linear RGB.
export const bvColor = (bv) => {
  const t = clamp((bv + 0.4) / 2.4, 0, 1);
  const r = t < 0.5 ? lerp(0.62, 1.0, t * 2) : 1.0;
  const g = t < 0.5 ? lerp(0.76, 0.98, t * 2) : lerp(0.98, 0.62, (t - 0.5) * 2);
  const b = t < 0.4 ? 1.0 : lerp(1.0, 0.35, (t - 0.4) / 0.6);
  return [r, g, b];
};

export const loadTexture = (THREE, url, { srgb = true, anisotropy = 8, wrap = false } = {}) =>
  new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anisotropy;
        if (wrap) t.wrapS = THREE.RepeatWrapping;
        resolve(t);
      },
      undefined,
      reject
    );
  });

// The Milky Way panorama and the star catalogue are used by five scenes;
// fetch, decode and upload each once.
const shared = {};
export const milkyWay = (THREE, tier) => {
  const url = tier === "h" ? "/space/milkyway_4k.jpg" : "/space/milkyway_2k.jpg";
  if (!shared[url])
    shared[url] = loadTexture(THREE, url, { anisotropy: 4 }).then((t) => {
      t.wrapS = THREE.RepeatWrapping;
      return t;
    });
  return shared[url];
};
export const starCatalogue = () => {
  if (!shared.stars) shared.stars = fetch("/space/stars.bin").then((r) => r.arrayBuffer());
  return shared.stars;
};

// Every `stride`-th point of a Points geometry, sharing its attributes. Soft
// haze layers draw large overlapping sprites, so a subset (brightened by the
// stride) looks the same at a fraction of the fill cost.
export const strided = (THREE, geo, stride) => {
  const g = new THREE.BufferGeometry();
  Object.entries(geo.attributes).forEach(([k, a]) => g.setAttribute(k, a));
  const n = Math.ceil(geo.attributes.position.count / stride);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i * stride;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

// Soft round particle sprite.
export const spriteTexture = (THREE, { core = 0.1, falloff = 2.2, size = 128 } = {}) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      let a = Math.exp(-Math.pow(d / 0.55, falloff)) * (1 - smoothstep(0.85, 1, d));
      a += core * Math.exp(-Math.pow(d / 0.12, 2));
      const v = Math.round(clamp(a, 0, 1) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
};

// Glare/lens texture for suns and bright stars: soft disc plus faint spikes.
export const glareTexture = (THREE, size = 256, spikes = true) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      let a = Math.exp(-d * d * 18) * 1.0 + Math.exp(-d * 4.5) * 0.35;
      if (spikes) {
        const sx = Math.exp(-Math.abs(dy) * 90) * Math.exp(-Math.abs(dx) * 3.2) * 0.5;
        const sy = Math.exp(-Math.abs(dx) * 90) * Math.exp(-Math.abs(dy) * 3.2) * 0.5;
        a += sx + sy;
      }
      a *= 1 - smoothstep(0.9, 1, d);
      const v = Math.round(clamp(a, 0, 1) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
};

// Additive point-sprite material with per-point colour/size, optional rigid
// spin about Y (galaxy rotation) and a gentle twinkle.
export const pointsMaterial = (THREE, { map, intensity = 1, minPx = 1, maxPx = 48, spin = 0 } = {}) =>
  new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      time: { value: 0 },
      intensity: { value: intensity },
      scale: { value: 600 },
      spin: { value: spin },
      minPx: { value: minPx },
      maxPx: { value: maxPx },
      fade: { value: 1 },
    },
    vertexShader: `
      attribute float size; attribute vec3 color; attribute float phase;
      uniform float time; uniform float scale; uniform float spin; uniform float minPx; uniform float maxPx;
      varying vec3 vColor; varying float vTw;
      void main(){
        float a = time * spin;
        float c = cos(a), s = sin(a);
        vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float px = size * scale / max(-mv.z, 0.0001);
        gl_PointSize = clamp(px, minPx, maxPx);
        // Keep the energy roughly constant when clamped so distant points dim.
        vTw = (0.8 + 0.2 * sin(time * 1.7 + phase)) * clamp(px / minPx, 0.15, 1.0);
        gl_Position = projectionMatrix * mv;
        vColor = color;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float intensity; uniform float fade;
      varying vec3 vColor; varying float vTw;
      void main(){
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(vColor * a * vTw * intensity * fade, a * fade);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });

// Procedural disc galaxy: particles (stars, HII regions, bulge) plus a soft
// glow plane rasterised from the same density so dust gaps match.
export const makeGalaxy = (
  THREE,
  {
    count = 60000,
    radius = 15,
    arms = 4,
    pitch = 0.28,
    bulge = 0.12,
    thickness = 0.035,
    seed = 1,
    spin = 0.03,
    sprite,
    warm = [1.0, 0.84, 0.6],
    cool = [0.6, 0.72, 1.0],
    pink = [1.0, 0.5, 0.62],
    glowRes = 1024,
    glowIntensity = 1,
    pointScale = 1,
    barred = true,
  } = {}
) => {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  // Density raster for the glow plane.
  const G = glowRes;
  const grid = new Float32Array(G * G * 3);

  for (let i = 0; i < count; i++) {
    let x, z, y, rr;
    const u = r();
    const inBulge = u < bulge;
    let c;
    if (inBulge) {
      // Triaxial bulge / bar.
      const s = Math.abs(gauss(r)) * radius * 0.09;
      const a = r() * Math.PI * 2;
      const e = Math.acos(2 * r() - 1);
      x = Math.sin(e) * Math.cos(a) * s * (barred ? 2.4 : 1);
      z = Math.sin(e) * Math.sin(a) * s;
      y = Math.cos(e) * s * 0.55;
      rr = Math.hypot(x, z);
      c = [warm[0], warm[1] * 0.95, warm[2] * 0.8];
    } else {
      // Exponential disc with logarithmic arms and a dust lane along the
      // inner edge of each arm (particles there are rejected).
      let dTheta, spread, theta;
      for (let tries = 0; tries < 6; tries++) {
        rr = -Math.log(1 - r() * 0.985) * radius * 0.3 + radius * 0.04;
        if (rr > radius * 1.15) rr = radius * (0.5 + r() * 0.6);
        const arm = Math.floor(r() * arms);
        theta = Math.log(rr / (radius * 0.07) + 1) / pitch + (arm / arms) * Math.PI * 2;
        spread = 0.12 + 0.35 * (rr / radius);
        dTheta = gauss(r) * spread;
        const inLane = dTheta > 0.12 * spread && dTheta < 0.5 * spread && rr > radius * 0.1;
        if (!inLane || r() > 0.88) break;
      }
      const onArm = Math.abs(dTheta) < spread * 0.7;
      const ang = theta + dTheta;
      x = Math.cos(ang) * rr;
      z = Math.sin(ang) * rr;
      y = gauss(r) * thickness * radius * (0.6 + 1.5 * (rr / radius)) * 0.5;
      const ageMix = onArm ? r() : 0.2 * r();
      const pinkish = onArm && r() < 0.05;
      const outer = clamp((rr / radius - 0.15) / 0.6, 0, 1);
      const base = pinkish ? pink : ageMix > 0.35 || r() < outer * 0.6 ? cool : warm;
      const w = 0.55 + 0.45 * r();
      c = [base[0] * w, base[1] * w, base[2] * w];
      if (pinkish) c = [pink[0] * 1.3, pink[1] * 1.3, pink[2] * 1.3];
    }
    pos.set([x, y, z], i * 3);
    col.set(c, i * 3);
    size[i] = (inBulge ? 0.012 : 0.009 + 0.028 * Math.pow(r(), 5)) * radius * pointScale;
    phase[i] = r() * Math.PI * 2;
    // Splat into the glow raster.
    const gx = Math.floor(((x / radius) * 0.5 + 0.5) * G);
    const gz = Math.floor(((z / radius) * 0.5 + 0.5) * G);
    if (gx >= 0 && gx < G && gz >= 0 && gz < G) {
      const k = (gz * G + gx) * 3;
      grid[k] += c[0];
      grid[k + 1] += c[1];
      grid[k + 2] += c[2];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const mat = pointsMaterial(THREE, { map: sprite, intensity: 0.95, spin, minPx: 1, maxPx: 16 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // Blur the raster (3 box passes ≈ gaussian) and turn it into a glow texture.
  const blur = (src, rad) => {
    const dst = new Float32Array(src.length);
    const tmp = new Float32Array(src.length);
    for (let ch = 0; ch < 3; ch++) {
      for (let yy = 0; yy < G; yy++) {
        let acc = 0;
        for (let xx = -rad; xx <= rad; xx++) acc += src[(yy * G + clamp(xx, 0, G - 1)) * 3 + ch];
        for (let xx = 0; xx < G; xx++) {
          tmp[(yy * G + xx) * 3 + ch] = acc / (2 * rad + 1);
          const out = clamp(xx - rad, 0, G - 1);
          const inn = clamp(xx + rad + 1, 0, G - 1);
          acc += src[(yy * G + inn) * 3 + ch] - src[(yy * G + out) * 3 + ch];
        }
      }
      for (let xx = 0; xx < G; xx++) {
        let acc = 0;
        for (let yy = -rad; yy <= rad; yy++) acc += tmp[(clamp(yy, 0, G - 1) * G + xx) * 3 + ch];
        for (let yy = 0; yy < G; yy++) {
          dst[(yy * G + xx) * 3 + ch] = acc / (2 * rad + 1);
          const out = clamp(yy - rad, 0, G - 1);
          const inn = clamp(yy + rad + 1, 0, G - 1);
          acc += tmp[(inn * G + xx) * 3 + ch] - tmp[(out * G + xx) * 3 + ch];
        }
      }
    }
    return dst;
  };
  let g1 = blur(grid, Math.max(2, Math.round(G / 256)));
  g1 = blur(g1, Math.max(2, Math.round(G / 256)));
  const g2 = blur(blur(grid, Math.round(G / 40)), Math.round(G / 40));
  const g3 = blur(blur(grid, Math.round(G / 12)), Math.round(G / 12));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = G;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(G, G);
  let peak = 0;
  for (let i = 0; i < G * G; i++) peak = Math.max(peak, g1[i * 3] + g1[i * 3 + 1] + g1[i * 3 + 2]);
  const norm = 1 / (peak * 0.12);
  for (let i = 0; i < G * G; i++) {
    for (let ch = 0; ch < 3; ch++) {
      const v = (g1[i * 3 + ch] * 0.5 + g2[i * 3 + ch] * 0.9 + g3[i * 3 + ch] * 1.4) * norm;
      img.data[i * 4 + ch] = Math.round(clamp(Math.sqrt(clamp(v, 0, 1)), 0, 1) * 255);
    }
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 1,
    })
  );
  glow.material.color.setScalar(1.25 * glowIntensity);
  glow.rotation.x = -Math.PI / 2;
  // Raster row = z, column = x; plane uv v runs opposite to z after the rotation.
  glow.rotation.z = 0;
  glow.scale.y = -1;

  const group = new THREE.Group();
  group.add(points, glow);
  return {
    group,
    points,
    glow,
    setTime: (t) => {
      mat.uniforms.time.value = t;
      glow.rotation.z = -t * spin;
    },
    setFade: (f) => {
      mat.uniforms.fade.value = f;
      glow.material.opacity = f;
    },
    setScale: (s) => {
      mat.uniforms.scale.value = s;
    },
  };
};
