import { bvColor, milkyWay, pointsMaterial, spriteTexture, starCatalogue } from "../util";

// Shared deep-sky background: ESO Milky Way panorama on a backside sphere plus
// the Yale Bright Star Catalogue as points, both in galactic coordinates.
export const createSky = async (THREE, { radius = 1000, tier, intensity = 0.55 }) => {
  const group = new THREE.Group();
  const [tex, buf] = await Promise.all([milkyWay(THREE, tier), starCatalogue()]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  mat.color.setScalar(intensity);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
  group.add(dome);

  const data = new Float32Array(buf);
  const n = data.length / 5;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y, z, mag, bv] = data.subarray(i * 5, i * 5 + 5);
    pos.set([x * radius * 0.98, y * radius * 0.98, z * radius * 0.98], i * 3);
    const c = bvColor(bv);
    const lum = Math.pow(10, -0.4 * (mag - 1.0));
    const b = Math.min(1.2, 0.25 + lum * 0.5);
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = radius * (0.004 + 0.006 * Math.min(1.5, Math.pow(lum, 0.4)));
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const pmat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.6 }), intensity: 1.0, minPx: 1.2, maxPx: 7 });
  const stars = new THREE.Points(geo, pmat);
  stars.frustumCulled = false;
  group.add(stars);
  return {
    group,
    setTime: (t) => (pmat.uniforms.time.value = t),
    setScale: (s) => (pmat.uniforms.scale.value = s),
    setIntensity: (v) => {
      mat.color.setScalar(v);
      pmat.uniforms.intensity.value = v / intensity;
    },
  };
};
