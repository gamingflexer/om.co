import { lerp, makeGalaxy, smoothstep, spriteTexture, track } from "../util";

// The Milky Way. Units: 1 kpc = 1. The camera starts at the Sun's place in the
// Orion arm, rises out of the disc and pulls back to show the whole spiral,
// which keeps turning.
export const createGalaxy = async (THREE, { small, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 5000);
  const sprite = spriteTexture(THREE, { core: 0.5 });
  const mw = makeGalaxy(THREE, {
    count: small ? 70000 : 220000,
    radius: 15,
    arms: 4,
    pitch: 0.3,
    bulge: 0.14,
    thickness: 0.03,
    seed: 3,
    spin: reducedMotion ? 0 : 0.045,
    sprite,
    glowRes: small ? 768 : 1024,
    pointScale: 1.0,
  });
  scene.add(mw.group);

  // Satellite galaxies: the Magellanic Clouds as irregular blobs.
  const sat = (count, radius, seed, at, tint) => {
    const g = makeGalaxy(THREE, {
      count,
      radius,
      arms: 2,
      pitch: 0.6,
      bulge: 0.5,
      thickness: 0.3,
      seed,
      spin: 0,
      sprite,
      glowRes: 256,
      glowIntensity: 0.5,
      warm: tint,
      cool: tint,
      barred: false,
      pointScale: 1.6,
    });
    g.group.position.set(at[0], at[1], at[2]);
    g.group.rotation.set(seed * 0.7, seed * 1.3, seed * 0.4);
    return g;
  };
  const lmc = sat(small ? 2500 : 7000, 2.2, 11, [-14, -26, 42], [0.85, 0.85, 1.0]);
  const smc = sat(small ? 1500 : 4000, 1.3, 12, [-25, -41, 36], [0.9, 0.88, 1.0]);
  scene.add(lmc.group, smc.group);

  // Distant galaxies as faint smudges so the pull-back has depth.
  const far = new THREE.Group();
  const farMat = new THREE.SpriteMaterial({ map: sprite, color: 0xcfd6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 });
  for (let i = 0; i < 120; i++) {
    const s = new THREE.Sprite(farMat);
    const d = 400 + Math.random() * 1800;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    s.position.set(Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d, Math.sin(ph) * Math.sin(th) * d);
    s.scale.setScalar(6 + Math.random() * 20);
    far.add(s);
  }
  scene.add(far);

  const sunPos = new THREE.Vector3(8.2, 0.02, 0);
  const target = new THREE.Vector3();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    mw.setTime(time);
    // Inside the arm → above the disc → the full spiral from 60° → far.
    const p = track(
      [
        [0, [sunPos.x + 0.3, 0.05, 0.4]],
        [0.22, [11, 3.5, 5]],
        [0.5, [14, 26, 20]],
        [0.75, [6, 60, 36]],
        [1, [0, 180, 70]],
      ],
      t
    );
    const tg = track([[0, [2, 0, 0]], [0.3, [0, 0, 0]]], t);
    camera.position.set(p[0], p[1], p[2]);
    target.set(tg[0], tg[1], tg[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.fov = lerp(60, 40, smoothstep(0.1, 0.5, t));
    camera.updateProjectionMatrix();
    const scale = lerp(260, 500, smoothstep(0, 0.5, t));
    mw.setScale(scale);
    lmc.setScale(scale);
    smc.setScale(scale);
    // Bloom the glow plane down while the camera is inside the disc.
    mw.setFade(lerp(0.45, 1, smoothstep(0.1, 0.45, t)));
    farMat.opacity = 0.35 * smoothstep(0.6, 1, t);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
