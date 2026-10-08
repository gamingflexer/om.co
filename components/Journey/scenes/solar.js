import { glareTexture, lerp, loadTexture, pointsMaterial, rng, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";

// Solar system. Units: 1 AU = 10. Planet and Sun radii are exaggerated so
// they read as discs; positions follow today's mean longitudes.

const PLANETS = [
  { name: "Mercury", a: 0.387, L0: 252.25, n: 4.0923, r: 0.035, color: 0x9c9a95 },
  { name: "Venus", a: 0.723, L0: 181.98, n: 1.6021, r: 0.07, color: 0xe6cf9a },
  { name: "Earth", a: 1.0, L0: 100.46, n: 0.9856, r: 0.072, color: 0xffffff, earth: true },
  { name: "Mars", a: 1.524, L0: 355.45, n: 0.524, r: 0.045, color: 0xc1663c },
  { name: "Jupiter", a: 5.203, L0: 34.4, n: 0.0831, r: 0.5, color: 0xd8b48c, bands: true },
  { name: "Saturn", a: 9.537, L0: 49.94, n: 0.0335, r: 0.42, color: 0xe3cf9c, rings: true },
  { name: "Uranus", a: 19.19, L0: 313.23, n: 0.0117, r: 0.25, color: 0xa9d9e3 },
  { name: "Neptune", a: 30.07, L0: 304.88, n: 0.006, r: 0.24, color: 0x4a6fd6 },
];
const AU = 10;

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
  const [earthTex, sky] = await Promise.all([
    loadTexture(THREE, "/space/earth_day_2k.jpg"),
    createSky(THREE, { radius: 9000, tier, intensity: 0.5 }),
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
        vec3 centre = vec3(1.0, 0.9, 0.7);
        vec3 edge = vec3(1.0, 0.6, 0.25);
        vec3 col = mix(edge, centre, smoothstep(0.0, 0.7, mu));
        col *= gran * spot + fac;
        col *= ld;
        gl_FragColor = vec4(col * 1.35, 1.0);
      }`,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.6, 128, 96), sunMat);
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
          vec3 col = vec3(1.0, 0.92, 0.78) * (streamers + inner) + vec3(1.0, 0.3, 0.2) * prom * 1.8;
          float a = clamp(streamers + inner + prom, 0.0, 1.0);
          gl_FragColor = vec4(col * fade, a * fade);
        }`,
    })
  );
  coronaPlane.scale.setScalar(0.6 * 16);
  scene.add(coronaPlane);
  // Soft wide glow so the Sun still reads from far out (no lens cross).
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTexture(THREE, 512, false), color: 0xffe3b8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  scene.add(corona);

  const sunLight = new THREE.PointLight(0xfff2dc, 3.2, 0, 0);
  scene.add(sunLight, new THREE.AmbientLight(0xffffff, 0.015));

  // Planets.
  const days = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const planets = [];
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x6f86b8, transparent: true, opacity: 0.22, depthWrite: false });
  PLANETS.forEach((p) => {
    const ang = (((p.L0 + p.n * days) % 360) * Math.PI) / 180;
    const pos = new THREE.Vector3(Math.cos(ang) * p.a * AU, 0, -Math.sin(ang) * p.a * AU);
    const mat = p.earth
      ? new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.9, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.95, metalness: 0 });
    if (p.bands) {
      const c = document.createElement("canvas");
      c.width = 8; c.height = 128;
      const g = c.getContext("2d");
      for (let i = 0; i < 128; i++) {
        const k = Math.sin(i * 0.35) * 0.5 + 0.5;
        const sh = Math.sin(i * 1.7 + 2.0) * 0.1;
        g.fillStyle = `rgb(${Math.round(190 + 40 * k + 30 * sh)},${Math.round(150 + 40 * k)},${Math.round(110 + 35 * k)})`;
        g.fillRect(0, i, 8, 1);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      mat.map = t;
      mat.color.set(0xffffff);
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 48, 32), mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    if (p.rings) {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 4;
      const g = c.getContext("2d");
      for (let i = 0; i < 256; i++) {
        const x = i / 256;
        let a = smoothstep(0.0, 0.08, x) * (1 - smoothstep(0.92, 1, x));
        a *= 0.55 + 0.45 * Math.sin(x * 60) * Math.sin(x * 17 + 1.0);
        if (x > 0.62 && x < 0.68) a *= 0.15; // Cassini division
        const v = Math.round(215 + 25 * Math.sin(x * 30));
        g.fillStyle = `rgba(${v},${v - 20},${v - 50},${Math.max(0, a)})`;
        g.fillRect(i, 0, 1, 4);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const ringGeo = new THREE.RingGeometry(p.r * 1.25, p.r * 2.3, 128, 1);
      // Map u along the radius.
      const uv = ringGeo.attributes.uv;
      const ps = ringGeo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const rr = Math.hypot(ps.getX(i), ps.getY(i));
        uv.setXY(i, (rr - p.r * 1.25) / (p.r * 1.05), 0.5);
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2 + 0.47;
      ring.rotation.y = 0.2;
      mesh.add(ring);
    }
    const seg = 256;
    const op = new Float32Array((seg + 1) * 3);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      op.set([Math.cos(a) * p.a * AU, 0, Math.sin(a) * p.a * AU], i * 3);
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute("position", new THREE.BufferAttribute(op, 3));
    scene.add(new THREE.Line(og, orbitMat));
    planets.push({ ...p, mesh, pos });
  });
  const earthPos = planets.find((p) => p.earth).pos.clone();

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
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    sunUniforms.time.value = time;
    sky.setTime(time);
    planets.forEach((p) => (p.mesh.rotation.y = time * 0.2));
    // From a dot of Earth to the whole system seen from above the ecliptic.
    // From Earth, fall in for a close pass of the Sun, then pull back to the
    // whole system seen from above the ecliptic.
    const d = track([[0, 10], [0.14, 4.2], [0.3, 4.8], [0.5, 90], [0.72, 320], [1, 1000]], t, { log: true });
    const dv = track([[0, [0.15, 0.2, 1]], [0.2, [0.6, 0.12, 0.8]], [0.55, [0.3, 0.75, 0.7]], [1, [0.1, 0.9, 0.45]]], t);
    dir.set(dv[0], dv[1], dv[2]).normalize();
    target.copy(earthPos).lerp(new THREE.Vector3(0, 0, 0), smoothstep(0.03, 0.16, t));
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    // The streamer corona faces the camera and fades out when the Sun is
    // only a dot; the soft glow scales with distance so it never vanishes.
    const cd = camera.position.length();
    coronaPlane.quaternion.copy(camera.quaternion);
    coronaUniforms.time.value = time;
    coronaUniforms.fade.value = 1 - smoothstep(120, 400, cd);
    corona.scale.setScalar(Math.max(2.4, cd * 0.045));
    corona.material.opacity = lerp(0.12, 0.9, smoothstep(8, 300, cd));
    asteroids.material.uniforms.scale.value = 300;
    kuiper.material.uniforms.scale.value = 300;
    sky.setScale(600);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
