import { galToScene, lerp, makeGalaxy, rng, smoothstep, spriteTexture, track } from "../util";

// The Local Group. Units: 10 kpc = 1. Milky Way at the origin, Andromeda and
// Triangulum at their real directions and distances, dwarfs scattered around.
export const createLocal = async (THREE, { small, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
  const sprite = spriteTexture(THREE, { core: 0.5 });
  const spin = reducedMotion ? 0 : 0.045;

  const galaxy = (opts, at, rot) => {
    const g = makeGalaxy(THREE, { sprite, glowRes: 512, ...opts });
    g.group.position.set(at[0], at[1], at[2]);
    g.group.rotation.set(rot[0], rot[1], rot[2]);
    scene.add(g.group);
    return g;
  };
  const mw = galaxy({ count: small ? 25000 : 60000, radius: 1.5, arms: 4, pitch: 0.3, bulge: 0.14, thickness: 0.03, seed: 3, spin, pointScale: 1.2 }, [0, 0, 0], [0, 0, 0]);
  const m31dir = galToScene(121.17, -21.57);
  const m31 = galaxy({ count: small ? 30000 : 70000, radius: 2.2, arms: 2, pitch: 0.22, bulge: 0.2, thickness: 0.03, seed: 5, spin: spin * 0.7, pointScale: 1.2, warm: [1.0, 0.85, 0.65] }, m31dir.map((v) => v * 78), [1.35, 0.4, 0.6]);
  const m33dir = galToScene(133.61, -31.33);
  const m33 = galaxy({ count: small ? 8000 : 20000, radius: 0.9, arms: 2, pitch: 0.45, bulge: 0.08, thickness: 0.04, seed: 8, spin: spin * 0.9, pointScale: 1.4, cool: [0.6, 0.8, 1.0] }, m33dir.map((v) => v * 85), [0.9, 0.2, 0.3]);
  const lmcDir = galToScene(280.47, -32.89);
  const smcDir = galToScene(302.8, -44.3);
  const dwarf = (count, radius, seed, at, scale) =>
    galaxy({ count, radius, arms: 2, pitch: 0.6, bulge: 0.5, thickness: 0.3, seed, spin: 0, glowRes: 128, glowIntensity: 0.4, barred: false, pointScale: scale }, at, [seed * 0.7, seed * 1.3, seed * 0.4]);
  dwarf(small ? 1500 : 4000, 0.22, 11, lmcDir.map((v) => v * 5), 2.2);
  dwarf(small ? 900 : 2500, 0.13, 12, smcDir.map((v) => v * 6.1), 2.2);
  const r = rng(21);
  for (let i = 0; i < 30; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    const d = 8 + r() * 120;
    const near = r() < 0.5 ? [0, 0, 0] : m31dir.map((v) => v * 78);
    const at = [near[0] + Math.sin(ph) * Math.cos(th) * d, near[1] + Math.cos(ph) * d, near[2] + Math.sin(ph) * Math.sin(th) * d];
    dwarf(small ? 150 : 400, 0.08 + r() * 0.12, 100 + i, at, 2.5);
  }

  // Far-field galaxies for depth.
  const farMat = new THREE.SpriteMaterial({ map: sprite, color: 0xd8dcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.12 });
  for (let i = 0; i < 300; i++) {
    const s = new THREE.Sprite(farMat);
    const d = 1500 + r() * 9000;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    s.position.set(Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d, Math.sin(ph) * Math.sin(th) * d);
    s.scale.setScalar(d * 0.004 * (0.5 + r()));
    scene.add(s);
  }

  const gals = [mw, m31, m33];
  const center = new THREE.Vector3(m31dir[0] * 39, m31dir[1] * 39, m31dir[2] * 39);
  const target = new THREE.Vector3();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    gals.forEach((g) => g.setTime(time));
    const d = track([[0, 19], [0.5, 90], [1, 240]], t, { log: true });
    const dv = track([[0, [0, 0.93, 0.37]], [0.5, [0.45, 0.75, 0.5]], [1, [0.7, 0.45, 0.55]]], t);
    const dir = new THREE.Vector3(dv[0], dv[1], dv[2]).normalize();
    target.set(0, 0, 0).lerp(center, smoothstep(0.25, 0.8, t));
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    const scale = 500;
    gals.forEach((g) => g.setScale(scale));
    scene.traverse((o) => {
      if (o.isPoints && o.material.uniforms && o.material.uniforms.scale) o.material.uniforms.scale.value = scale;
    });
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
