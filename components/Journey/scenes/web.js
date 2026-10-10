import { galToScene, gauss, lerp, pointsMaterial, rng, smoothstep, spriteTexture, strided, track } from "../util";

// Large-scale structure. Units: 1 Mpc = 1. Local Group at the origin, Virgo
// and the Laniakea filaments around it, then the whole observable universe as
// a fine-grained ball with the last-scattering glow at its edge.
export const createWeb = async (THREE, { small }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200000);
  const sprite = spriteTexture(THREE, { core: 0.6 });
  const r = rng(77);

  // Nodes (clusters) within 300 Mpc; Virgo and the Great Attractor fixed.
  const nodes = [];
  const virgo = galToScene(283.8, 74.4).map((v) => v * 16.5);
  const ga = galToScene(307, 9).map((v) => v * 70);
  nodes.push([0, 0, 0], virgo, ga);
  for (let i = 0; i < 420; i++) {
    const d = 12 + Math.pow(r(), 0.75) * 300;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    nodes.push([Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d, Math.sin(ph) * Math.sin(th) * d]);
  }
  // Filaments: each node links to its three nearest neighbours.
  // Each node links to its nearest neighbours; every filament bows a little
  // so the web looks woven rather than drawn with a ruler.
  const links = [];
  nodes.forEach((a, i) => {
    const ds = nodes.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), j]).filter((x) => x[1] !== i).sort((x, y) => x[0] - y[0]);
    const k = 2 + Math.floor(r() * 3);
    for (let q = 0; q < k; q++) if (ds[q] && ds[q][1] > i && ds[q][0] < 70) links.push([i, ds[q][1], ds[q][0]]);
  });
  const total = small ? 90000 : 260000;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const size = new Float32Array(total);
  const phase = new Float32Array(total);
  let n = 0;
  const put = (x, y, z, b, s, tint = [1, 0.95, 0.85]) => {
    if (n >= total) return;
    pos.set([x, y, z], n * 3);
    col.set([tint[0] * b, tint[1] * b, tint[2] * b], n * 3);
    size[n] = s;
    phase[n] = r() * 6.28;
    n++;
  };
  const totalLen = links.reduce((a, l) => a + l[2], 0);
  const filamentBudget = Math.floor(total * 0.6);
  links.forEach(([i, j, len]) => {
    const a = nodes[i];
    const b = nodes[j];
    const cnt = Math.max(16, Math.floor((len / totalLen) * filamentBudget));
    const bow = [gauss(r) * len * 0.12, gauss(r) * len * 0.12, gauss(r) * len * 0.12];
    const thick = 0.6 + r() * 1.2;
    for (let k = 0; k < cnt; k++) {
      const u = r();
      const s4 = 4 * u * (1 - u);
      // Denser towards the ends (clusters), thinner in the middle.
      const spread = (1.4 + 2.2 * Math.sin(u * Math.PI)) * thick;
      put(
        lerp(a[0], b[0], u) + bow[0] * s4 + gauss(r) * spread,
        lerp(a[1], b[1], u) + bow[1] * s4 + gauss(r) * spread,
        lerp(a[2], b[2], u) + bow[2] * s4 + gauss(r) * spread,
        0.3 + 0.5 * r(),
        0.5 + r() * 1.1
      );
    }
  });
  const clusterBudget = Math.floor(total * 0.32 / nodes.length);
  nodes.forEach((a, i) => {
    const big = i < 3;
    const cnt = big ? clusterBudget * 12 : clusterBudget;
    const sg = big ? 3.2 : 1.2 + r() * 1.6;
    for (let k = 0; k < cnt; k++) {
      put(a[0] + gauss(r) * sg, a[1] + gauss(r) * sg, a[2] + gauss(r) * sg, 0.35 + 0.45 * r(), 0.4 + r() * 0.9, big ? [1, 0.9, 0.75] : [0.9, 0.9, 1]);
    }
  });
  while (n < total) {
    const d = Math.pow(r(), 0.5) * 320;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    put(Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d, Math.sin(ph) * Math.sin(th) * d, 0.15 + 0.2 * r(), 0.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const webMat = pointsMaterial(THREE, { map: sprite, intensity: 1.7, minPx: 1, maxPx: 4 });
  const web = new THREE.Points(geo, webMat);
  // Pulled far back, the whole web lands on a few hundred pixels and every
  // point blends into the same ones; on phones a quarter of them reads the same.
  const FAR_STRIDE = small ? 4 : 1;
  const geoFar = FAR_STRIDE > 1 ? strided(THREE, geo, FAR_STRIDE) : geo;
  web.frustumCulled = false;
  scene.add(web);
  // Soft haze over the same structure so the filaments read as gas, not dots.
  const HAZE_STRIDE = small ? 6 : 1;
  const hazeMat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.0, falloff: 1.4 }), intensity: 0.22 * HAZE_STRIDE, minPx: 6, maxPx: 70 });
  const haze = new THREE.Points(HAZE_STRIDE > 1 ? strided(THREE, geo, HAZE_STRIDE) : geo, hazeMat);
  haze.frustumCulled = false;
  scene.add(haze);

  // The Local Group itself for the hand-off: Milky Way and Andromeda glows.
  const lgMat = new THREE.SpriteMaterial({ map: sprite, color: 0xfff0d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mwS = new THREE.Sprite(lgMat);
  mwS.scale.setScalar(0.12);
  const m31d = galToScene(121.17, -21.57);
  const m31S = new THREE.Sprite(lgMat);
  m31S.position.set(m31d[0] * 0.78, m31d[1] * 0.78, m31d[2] * 0.78);
  m31S.scale.setScalar(0.16);
  scene.add(mwS, m31S);

  // The observable universe: a uniform ball of faint points, radius 14,000 Mpc.
  const un = small ? 60000 : 140000;
  const upos = new Float32Array(un * 3);
  const ucol = new Float32Array(un * 3);
  const usize = new Float32Array(un);
  const uphase = new Float32Array(un);
  const R = 14000;
  for (let i = 0; i < un; i++) {
    const d = Math.cbrt(r()) * R;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    upos.set([Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d, Math.sin(ph) * Math.sin(th) * d], i * 3);
    const b = 0.5 + 0.6 * r();
    const warm = d / R;
    ucol.set([b, b * (0.95 - 0.1 * warm), b * (0.9 - 0.25 * warm)], i * 3);
    usize[i] = 260 + r() * 700;
    uphase[i] = r() * 6.28;
  }
  const ugeo = new THREE.BufferGeometry();
  ugeo.setAttribute("position", new THREE.BufferAttribute(upos, 3));
  ugeo.setAttribute("color", new THREE.BufferAttribute(ucol, 3));
  ugeo.setAttribute("size", new THREE.BufferAttribute(usize, 1));
  ugeo.setAttribute("phase", new THREE.BufferAttribute(uphase, 1));
  const uniMat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.15, falloff: 1.5 }), intensity: 0.8, minPx: 2, maxPx: 7 });
  const universe = new THREE.Points(ugeo, uniMat);
  universe.frustumCulled = false;
  scene.add(universe);
  // Last-scattering surface: a faint warm shell at the edge.
  const cmb = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.02, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: { fade: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        precision highp float; uniform float fade; varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float a = max(dot(normalize(vN), V), 0.0);
          float rim = pow(1.0 - a, 2.5) * 0.9 + 0.08;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.3) * rim * fade, rim * fade);
        }`,
    })
  );
  scene.add(cmb);

  const dir = new THREE.Vector3(0.5, 0.62, 0.6).normalize();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    webMat.uniforms.time.value = time;
    uniMat.uniforms.time.value = time;
    const d = track([[0, 4.2], [0.3, 120], [0.55, 700], [0.8, 20000], [1, 46000]], t, { log: true });
    const spin = t * 0.9;
    const dd = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spin);
    camera.position.copy(dd).multiplyScalar(d);
    camera.lookAt(0, 0, 0);
    camera.near = d * 0.002;
    camera.far = d * 40 + 40000;
    camera.updateProjectionMatrix();
    webMat.uniforms.scale.value = 900;
    webMat.uniforms.fade.value = 1 - smoothstep(0.62, 0.85, t);
    hazeMat.uniforms.scale.value = 2600;
    hazeMat.uniforms.time.value = time;
    hazeMat.uniforms.fade.value = (1 - smoothstep(0.55, 0.8, t)) * smoothstep(0.08, 0.3, t);
    uniMat.uniforms.scale.value = 700;
    uniMat.uniforms.fade.value = smoothstep(0.5, 0.75, t);
    cmb.material.uniforms.fade.value = smoothstep(0.7, 0.95, t);
    // Skip layers that are fully faded out.
    web.visible = webMat.uniforms.fade.value > 0;
    const far = t > 0.68;
    web.geometry = far ? geoFar : geo;
    webMat.uniforms.intensity.value = far ? 1.7 * FAR_STRIDE : 1.7;
    haze.visible = hazeMat.uniforms.fade.value > 0;
    universe.visible = uniMat.uniforms.fade.value > 0;
    cmb.visible = cmb.material.uniforms.fade.value > 0;
    lgMat.opacity = 1 - smoothstep(0.1, 0.3, t);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
