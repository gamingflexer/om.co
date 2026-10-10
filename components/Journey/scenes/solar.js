import { glareTexture, lerp, loadTexture, pointsMaterial, rng, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";

// Solar system. Units: 1 AU = 10. Planet and Sun radii are exaggerated so
// they read as discs; positions follow today's mean longitudes.
//
// r is the radius seen up close. As the camera pulls back each body is
// scaled up with its distance from the camera (see displayScale), so the
// planets stay legible in the wide shots instead of shrinking to dots. cap
// bounds that growth so no body reaches a neighbouring orbit, the asteroid
// or Kuiper belt, or (for Mercury) the Sun.
// tilt: axial tilt in degrees; az: direction the pole leans ("sun": towards
// the Sun, so the sunlit face of Saturn's rings is the one seen from above
// the ecliptic); spin: rad/s.
// rim/rimColor: atmospheric limb; limb: limb darkening; wrap: terminator
// softness; bands: extra procedural banding on top of the texture.
const PLANETS = [
  { name: "Mercury", tex: "mercury", a: 0.387, L0: 252.25, n: 4.0923, r: 0.07, cap: 0.45, tilt: 0.03, az: 0, spin: 0.03, rim: 0, wrap: 0, limb: 0.15 },
  { name: "Venus", tex: "venus", a: 0.723, L0: 181.98, n: 1.6021, r: 0.13, cap: 0.95, tilt: 177.4, az: 1.0, spin: 0.05, rim: 0.5, rimColor: [1.0, 0.85, 0.55], wrap: 0.18, limb: 0.35, halo: 0.35 },
  { name: "Earth", a: 1.0, L0: 100.46, n: 0.9856, r: 0.135, cap: 0.95, tilt: 23.44, az: 0.6, spin: 0.2, earth: true, rim: 0.5, rimColor: [0.45, 0.7, 1.0], wrap: 0.04, limb: 0.1, halo: 0.3 },
  { name: "Mars", tex: "mars", a: 1.524, L0: 355.45, n: 0.524, r: 0.095, cap: 0.8, tilt: 25.19, az: 2.2, spin: 0.19, rim: 0.25, rimColor: [1.0, 0.6, 0.45], wrap: 0.03, limb: 0.1 },
  { name: "Jupiter", tex: "jupiter", a: 5.203, L0: 34.4, n: 0.0831, r: 0.5, cap: 6, tilt: 3.13, az: 0.3, spin: 0.45, rim: 0.35, rimColor: [1.0, 0.88, 0.7], wrap: 0.08, limb: 0.45, halo: 0.3 },
  { name: "Saturn", tex: "saturn", a: 9.537, L0: 49.94, n: 0.0335, r: 0.42, cap: 5, tilt: 26.73, az: "sun", spin: 0.42, rim: 0.35, rimColor: [1.0, 0.9, 0.65], wrap: 0.08, limb: 0.45, halo: 0.3, rings: true },
  { name: "Uranus", tex: "uranus", a: 19.19, L0: 313.23, n: 0.0117, r: 0.26, cap: 7, tilt: 97.77, az: 4.0, spin: 0.28, rim: 0.6, rimColor: [0.6, 0.95, 1.0], wrap: 0.1, limb: 0.4, halo: 0.45, bands: 0.035 },
  { name: "Neptune", tex: "neptune", a: 30.07, L0: 304.88, n: 0.006, r: 0.25, cap: 7, tilt: 28.32, az: 5.1, spin: 0.3, rim: 0.6, rimColor: [0.45, 0.65, 1.0], wrap: 0.1, limb: 0.4, halo: 0.45, bands: 0.05 },
];
const AU = 10;
const SUN_R = 0.6;
const SUN_CAP = 1.7;
// Saturn's ring texture spans 1.11-2.33 planet radii (C ring to A ring).
const RING_IN = 1.11;
const RING_OUT = 2.33;
// Display scale: 1 within D0 of the camera, then growing as distance^P, so
// apparent size falls off as distance^(P-1) rather than 1/distance.
const D0 = 20;
const P = 0.7;
const displayScale = (dist) => Math.pow(Math.max(1, dist / D0), P);

// Shading for the textured planets: sunlight from the origin with a soft
// terminator, limb darkening, a lit atmospheric rim, and (for Saturn) the
// rings' shadow on the globe.
const PLANET_VS = `
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const PLANET_FS = `
  precision highp float;
  uniform sampler2D map, ringMap;
  uniform vec3 center, ringN, rimColor;
  uniform float radius, rim, limb, wrap, bands, hasRing;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(-vW);
    vec3 tex = texture2D(map, vUv).rgb;
    float lat = vUv.y * 2.0 - 1.0;
    tex *= 1.0 + bands * sin(lat * 34.0 + sin(lat * 7.0) * 1.6);
    float NdL = dot(N, L);
    float mu = max(dot(N, V), 0.0);
    float diff = clamp((NdL + wrap) / (1.0 + wrap), 0.0, 1.0);
    diff *= mix(1.0, pow(mu, 0.35), limb);
    float shade = 1.0;
    if (hasRing > 0.5) {
      float dn = dot(L, ringN);
      if (abs(dn) > 1e-4) {
        float tt = dot(center - vW, ringN) / dn;
        if (tt > 0.0) {
          float u = (length(vW + L * tt - center) / radius - ${RING_IN.toFixed(2)}) / ${(RING_OUT - RING_IN).toFixed(2)};
          if (u > 0.0 && u < 1.0) shade = 1.0 - 0.85 * texture2D(ringMap, vec2(u, 0.5)).a;
        }
      }
    }
    vec3 sunCol = vec3(1.0, 0.95, 0.88);
    vec3 col = tex * sunCol * 1.08 * diff * shade + tex * 0.012;
    // Atmosphere: brightens the sunlit limb, reddens a little at the terminator.
    float fr = pow(1.0 - mu, 3.0);
    col += rimColor * rim * fr * smoothstep(-0.2, 0.4, NdL);
    col *= mix(vec3(1.0), vec3(1.0, 0.82, 0.7), wrap * 3.0 * (1.0 - smoothstep(0.0, 0.3, NdL)) * smoothstep(-0.25, -0.05, NdL));
    gl_FragColor = vec4(col, 1.0);
  }`;
// Thin halo just outside the limb of planets with thick atmospheres.
const HALO_FS = `
  precision highp float;
  uniform vec3 rimColor; uniform float strength;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(-vW);
    float mu = abs(dot(N, V));
    // The shell is 4% larger than the globe: mu runs from 0 at its edge to
    // about 0.28 where it meets the planet's limb.
    float a = pow(smoothstep(0.0, 0.28, mu), 2.0) * smoothstep(-0.3, 0.3, dot(N, L));
    gl_FragColor = vec4(rimColor * a * strength, 1.0);
  }`;
// Saturn's rings: radial profile from the texture, lit side brighter than
// the side facing away from the Sun, and the globe's shadow across them.
const RING_VS = `
  varying float vR; varying vec3 vN; varying vec3 vW;
  void main(){
    vR = length(position.xy); vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const RING_FS = `
  precision highp float;
  uniform sampler2D ringMap; uniform vec3 center; uniform float radius;
  varying float vR; varying vec3 vN; varying vec3 vW;
  void main(){
    float u = (vR - ${RING_IN.toFixed(2)}) / ${(RING_OUT - RING_IN).toFixed(2)};
    vec4 t = texture2D(ringMap, vec2(clamp(u, 0.0, 1.0), 0.5));
    vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(-vW);
    vec3 oc = center - vW; float tt = dot(oc, L);
    float sh = tt > 0.0 ? smoothstep(radius * 0.97, radius * 1.02, length(oc - L * tt)) : 1.0;
    float sameSide = step(0.0, dot(N, L) * dot(N, V));
    // Unlit side: only light scattered through the thinner parts.
    float light = mix(0.1 + 0.4 * (1.0 - t.a), 1.0, sameSide);
    vec3 col = t.rgb * vec3(1.0, 0.95, 0.88) * 2.4 * light * sh + t.rgb * 0.02;
    gl_FragColor = vec4(col, t.a * 0.92);
  }`;

const SUN_NOISE = `
  vec3 hash3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    float n = 0.0;
    for (int dz = 0; dz < 2; dz++) for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++){
      vec3 o = vec3(dx, dy, dz);
      float h = hash3(i + o).x;
      vec3 w = mix(1.0 - f, f, o);
      n += h * w.x * w.y * w.z;
    }
    return n;
  }
  float fbm(vec3 p){ float v = 0.0; float a = 0.5; for (int k = 0; k < 5; k++){ v += a * noise(p); p = p * 2.1 + 7.0; a *= 0.5; } return v; }
`;

export const createSolar = async (THREE, { tier, small }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 20000);
  // Planet maps are 1k: no planet ever covers more than a couple of hundred
  // pixels, so larger maps would only add download.
  const [earthTex, sky, ringTex, ...planetTex] = await Promise.all([
    loadTexture(THREE, "/space/earth_day_2k.jpg"),
    createSky(THREE, { radius: 9000, tier, intensity: 0.5 }),
    loadTexture(THREE, "/space/saturn_ring.png", { anisotropy: 4 }),
    ...PLANETS.map((p) => (p.tex ? loadTexture(THREE, `/space/${p.tex}_1k.jpg`, { anisotropy: 4 }) : null)),
  ]);
  sky.group.rotation.set(1.1, 0.4, 0.3);
  scene.add(sky.group);

  // Sun. Modelled on white-light and eclipse photographs: a granulated
  // photosphere with dark intergranular lanes, strong limb darkening, a few
  // sunspots with penumbrae, bright faculae near the limb, a thin pink
  // chromosphere just off the limb, and a corona of radial streamers with
  // prominence loops at the edge.
  const sunUniforms = { time: { value: 0 } };
  const sunMat = new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp float; uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      ${SUN_NOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float mu = max(dot(normalize(vN), V), 0.0);
        vec3 q = vP / 0.6; // unit sphere
        // Granulation: bright cells about 1/60 of the radius, drifting slowly,
        // separated by dark lanes.
        float c1 = noise(q * 42.0 + time * 0.02);
        float c2 = noise(q * 84.0 - time * 0.03 + 5.0);
        float cells = smoothstep(0.25, 0.75, 0.6 * c1 + 0.4 * c2);
        float lanes = pow(1.0 - abs(noise(q * 64.0 + time * 0.015 + 9.0) * 2.0 - 1.0), 4.0);
        float gran = (0.86 + 0.22 * cells) * (1.0 - 0.3 * lanes);
        // Supergranulation / large-scale mottling.
        gran *= 0.95 + 0.1 * fbm(q * 6.0);
        // Sunspots in two belts, umbra inside penumbra.
        float lat = abs(q.y);
        float belt = smoothstep(0.08, 0.2, lat) * (1.0 - smoothstep(0.45, 0.6, lat));
        float sp = fbm(q * 3.5 + 13.0) * belt;
        float penumbra = smoothstep(0.62, 0.7, sp);
        float umbra = smoothstep(0.7, 0.76, sp);
        float spotFil = 0.6 + 0.4 * noise(q * 120.0);
        float spot = 1.0 - penumbra * (0.55 * spotFil) - umbra * 0.9;
        // Faculae: bright lacework that only shows near the limb.
        float fac = smoothstep(0.55, 0.8, fbm(q * 14.0 + 21.0)) * pow(1.0 - mu, 1.5) * 0.35;
        // Limb darkening (visible light): I/I0 = 0.3 + 0.93mu - 0.23mu^2.
        float ld = 0.3 + 0.93 * mu - 0.23 * mu * mu;
        vec3 centre = vec3(1.0, 0.8, 0.5);
        vec3 edge = vec3(1.0, 0.45, 0.12);
        vec3 col = mix(edge, centre, smoothstep(0.0, 0.7, mu));
        col *= gran * spot + fac;
        col *= ld;
        gl_FragColor = vec4(col * 1.35, 1.0);
      }`,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 128, 96), sunMat);
  scene.add(sun);
  // Chromosphere: a thin pink-red rim just outside the limb.
  const chromo = new THREE.Mesh(
    new THREE.SphereGeometry(0.612, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        precision highp float; varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float mu = max(dot(normalize(vN), V), 0.0);
          float rim = pow(1.0 - mu, 6.0);
          gl_FragColor = vec4(vec3(1.0, 0.35, 0.3) * rim * 1.6, rim);
        }`,
    })
  );
  scene.add(chromo);
  // Corona: a camera-facing plane with radial streamers (denser at the
  // equator, as at solar minimum), a bright inner K-corona, and a few
  // prominence loops hugging the limb.
  const coronaUniforms = { time: { value: 0 }, fade: { value: 1 } };
  const coronaPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: coronaUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        precision highp float; uniform float time, fade; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.1 + 3.7; a *= 0.5; } return v; }
        #define PI 3.14159265
        void main(){
          // r = 1 at the limb; the plane spans 8 solar radii.
          vec2 q = (vUv - 0.5) * 16.0;
          float r = length(q);
          float ang = atan(q.y, q.x);
          if (r < 0.98) discard;
          // Streamers: narrow radial rays that drift very slowly.
          float ray = fbm(vec2(ang * 9.0 + 0.4 * sin(time * 0.02), log(r) * 1.2)) * 0.7 + fbm(vec2(ang * 28.0 + 7.0, log(r) * 2.5 + time * 0.01)) * 0.3;
          ray = pow(smoothstep(0.25, 0.9, ray), 1.2);
          float equatorial = 0.45 + 0.55 * pow(abs(cos(ang)), 0.8);
          float streamers = ray * equatorial * pow(1.0 / r, 2.5) * 1.0;
          // Inner K-corona: smooth, bright, falls off fast.
          float inner = exp(-(r - 1.0) * 7.0) * 0.6;
          // Prominences: a few loops of cooler red plasma at the limb.
          float prom = 0.0;
          for (int k = 0; k < 4; k++) {
            float a0 = float(k) * 1.7 + 0.4;
            float da = abs(mod(ang - a0 + PI, 2.0 * PI) - PI);
            float loop = exp(-pow((r - (1.04 + 0.05 * sin(float(k) * 2.0 + time * 0.05))) / 0.035, 2.0)) * smoothstep(0.22, 0.0, da);
            loop *= 0.6 + 0.6 * noise(vec2(ang * 40.0, r * 30.0 + time * 0.1));
            prom += loop;
          }
          vec3 col = vec3(1.0, 0.82, 0.58) * (streamers + inner) + vec3(1.0, 0.3, 0.2) * prom * 1.8;
          float a = clamp(streamers + inner + prom, 0.0, 1.0);
          gl_FragColor = vec4(col * fade, a * fade);
        }`,
    })
  );
    scene.add(coronaPlane);
  // Soft wide glow so the Sun still reads from far out (no lens cross).
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTexture(THREE, 512, false), color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  scene.add(corona);

  // Planets. They light themselves from the Sun at the origin (PLANET_FS),
  // so the scene needs no three.js lights.
  const days = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const planets = [];
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x6f86b8, transparent: true, opacity: 0.22, depthWrite: false });
  // Unit spheres; each planet's group carries position, axial tilt and the
  // display radius as its scale, and the globe spins inside it (so the
  // rings, also in the group, keep their orientation).
  const sphereGeo = small ? new THREE.SphereGeometry(1, 40, 28) : new THREE.SphereGeometry(1, 64, 44);
  const haloGeo = new THREE.SphereGeometry(1.04, small ? 32 : 48, small ? 20 : 32);
  PLANETS.forEach((p, i) => {
    const ang = (((p.L0 + p.n * days) % 360) * Math.PI) / 180;
    const pos = new THREE.Vector3(Math.cos(ang) * p.a * AU, 0, -Math.sin(ang) * p.a * AU);
    const group = new THREE.Group();
    // Rotation Ry(az)·Rx(tilt) leans the pole towards (sin az, 0, cos az).
    const az = p.az === "sun" ? Math.atan2(-Math.cos(ang), Math.sin(ang)) : p.az;
    group.rotation.set((p.tilt * Math.PI) / 180, az, 0, "YXZ");
    group.position.copy(pos);
    scene.add(group);
    const uniforms = {
      map: { value: p.earth ? earthTex : planetTex[i] },
      ringMap: { value: ringTex },
      center: { value: new THREE.Vector3() },
      ringN: { value: new THREE.Vector3(0, 1, 0) },
      radius: { value: p.r },
      rim: { value: p.rim },
      rimColor: { value: new THREE.Vector3(...(p.rimColor || [1, 1, 1])) },
      limb: { value: p.limb },
      wrap: { value: p.wrap },
      bands: { value: p.bands || 0 },
      hasRing: { value: p.rings ? 1 : 0 },
    };
    const mesh = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VS, fragmentShader: PLANET_FS }));
    group.add(mesh);
    if (p.halo) {
      const halo = new THREE.Mesh(
        haloGeo,
        new THREE.ShaderMaterial({
          uniforms: { rimColor: uniforms.rimColor, strength: { value: p.halo } },
          vertexShader: PLANET_VS,
          fragmentShader: HALO_FS,
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      group.add(halo);
    }
    if (p.rings) {
      const ringUniforms = { ringMap: { value: ringTex }, center: uniforms.center, radius: uniforms.radius };
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(RING_IN, RING_OUT, small ? 128 : 256, 1),
        new THREE.ShaderMaterial({
          uniforms: ringUniforms,
          vertexShader: RING_VS,
          fragmentShader: RING_FS,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    }
    const seg = 256;
    const op = new Float32Array((seg + 1) * 3);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      op.set([Math.cos(a) * p.a * AU, 0, Math.sin(a) * p.a * AU], k * 3);
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute("position", new THREE.BufferAttribute(op, 3));
    scene.add(new THREE.Line(og, orbitMat));
    planets.push({ ...p, group, mesh, pos, ang, uniforms });
  });
  const earthPos = planets.find((p) => p.earth).pos.clone();
  // Orbit lines read as stray straight lines when seen edge-on; fade them
  // in as the camera climbs above the ecliptic.
  const setOrbitVisibility = (elev) => (orbitMat.opacity = 0.22 * smoothstep(0.12, 0.5, elev));

  // Asteroid belt and Kuiper belt as faint point clouds.
  const belt = (count, r0, r1, spread, seed, bright) => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const rr = lerp(r0, r1, Math.pow(r(), 0.8)) * AU;
      const a = r() * Math.PI * 2;
      pos.set([Math.cos(a) * rr, (r() - 0.5) * spread * AU, Math.sin(a) * rr], i * 3);
      const b = bright * (0.5 + r());
      col.set([b, b * 0.95, b * 0.85], i * 3);
      size[i] = 0.5 + r();
      phase[i] = r() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    const pts = new THREE.Points(g, pointsMaterial(THREE, { map: spriteTexture(THREE), intensity: 0.6, minPx: 1, maxPx: 3 }));
    pts.frustumCulled = false;
    return pts;
  };
  const asteroids = belt(small ? 6000 : 16000, 2.1, 3.4, 0.25, 7, 0.5);
  const kuiper = belt(small ? 8000 : 22000, 32, 50, 2.5, 9, 0.35);
  scene.add(asteroids, kuiper);

  const target = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const look = new THREE.Vector2();
  const setPointer = (x, y) => pointer.set(x, y);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ringN = new THREE.Vector3();
  const update = ({ t, dt, time }) => {
    sunUniforms.time.value = time;
    sky.setTime(time);
    // Scrolling carries the planets round their orbits (inner ones faster,
    // per Kepler), on top of a slow drift with time. Earth is pinned until
    // the camera has left it so the opening shot stays put.
    const sweep = smoothstep(0.08, 0.3, t) * (t * 2.2 + time * 0.004);
    planets.forEach((p) => {
      const a = p.ang + sweep / Math.sqrt(p.a * p.a * p.a);
      p.pos.set(Math.cos(a) * p.a * AU, 0, -Math.sin(a) * p.a * AU);
      p.group.position.copy(p.pos);
      p.mesh.rotation.y = time * p.spin;
    });
    look.lerp(pointer, 1 - Math.pow(0.01, dt || 0.016));
    // From Earth, fall in for a close pass of the Sun, then pull back to the
    // whole system seen from above the ecliptic.
    const d = track([[0, 10], [0.14, 4.2], [0.3, 4.8], [0.5, 90], [0.72, 320], [1, 1000]], t, { log: true });
    const dv = track([[0, [0.15, 0.2, 1]], [0.2, [0.6, 0.12, 0.8]], [0.55, [0.3, 0.75, 0.7]], [1, [0.1, 0.9, 0.45]]], t);
    dir.set(dv[0], dv[1], dv[2]).normalize();
    // Moving the pointer left or right swings the viewpoint round the Sun.
    dir.applyAxisAngle(yAxis, -look.x * 0.35 * smoothstep(0.1, 0.3, t));
    setOrbitVisibility(dir.y);
    target.copy(earthPos).lerp(new THREE.Vector3(0, 0, 0), smoothstep(0.03, 0.16, t));
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    // Display sizes. Earth starts at the size the Earth stage hands over and
    // grows to its solar-system size once the camera has left it.
    planets.forEach((p) => {
      const base = p.earth ? lerp(0.072, p.r, smoothstep(0.02, 0.15, t)) : p.r;
      const R = Math.min(p.cap, base * displayScale(camera.position.distanceTo(p.pos)));
      p.group.scale.setScalar(R);
      p.uniforms.center.value.copy(p.pos);
      p.uniforms.radius.value = R;
      if (p.rings) p.uniforms.ringN.value.copy(ringN.set(0, 1, 0).applyQuaternion(p.group.quaternion));
    });
    // The streamer corona faces the camera and fades out when the Sun is
    // only a dot; the soft glow scales with distance so it never vanishes.
    const cd = camera.position.length();
    const sunScale = Math.min(SUN_CAP / SUN_R, displayScale(cd));
    sun.scale.setScalar(sunScale);
    chromo.scale.setScalar(sunScale);
    coronaPlane.scale.setScalar(SUN_R * 16 * sunScale);
    coronaPlane.quaternion.copy(camera.quaternion);
    coronaUniforms.time.value = time;
    coronaUniforms.fade.value = 1 - smoothstep(120, 400, cd);
    // In the wide shots the glow widens so the Sun still reads as the
    // largest body next to the enlarged giants.
    corona.scale.setScalar(Math.max(2.4, cd * lerp(0.045, 0.075, smoothstep(60, 300, cd))));
    corona.material.opacity = lerp(0.12, 1.0, smoothstep(8, 300, cd));
    // From afar the glow is drawn over everything: an inner planet passing in
    // front of it would otherwise punch a black dot in it. Up close the
    // depth test keeps it off the face of the Sun.
    corona.material.depthTest = cd < 30;
    asteroids.material.uniforms.scale.value = 300;
    kuiper.material.uniforms.scale.value = 300;
    sky.setScale(600);
  };
  return { scene, camera, update, resize, setPointer, ready: Promise.resolve(), dispose: () => {} };
};
