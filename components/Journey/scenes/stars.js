import { bvColor, eqToScene, glareTexture, lerp, pointsMaterial, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";

// The solar neighbourhood: real nearby stars (RA h, Dec °, light-years, V, B-V)
// around the Sun, with the bright-star sky behind. Units: 1 ly = 1.
const NEARBY = [
  ["Proxima Centauri", 14.495, -62.68, 4.24, 11.1, 1.8],
  ["Alpha Centauri A", 14.66, -60.83, 4.37, 0.0, 0.7],
  ["Alpha Centauri B", 14.661, -60.84, 4.37, 1.33, 0.9],
  ["Barnard's Star", 17.96, 4.69, 5.96, 9.5, 1.7],
  ["Wolf 359", 10.94, 7.01, 7.86, 13.5, 2.0],
  ["Lalande 21185", 11.05, 35.97, 8.31, 7.5, 1.5],
  ["Sirius", 6.75, -16.72, 8.6, -1.46, 0.0],
  ["Luyten 726-8", 1.65, -17.95, 8.73, 12.5, 1.9],
  ["Ross 154", 18.83, -23.84, 9.7, 10.4, 1.7],
  ["Ross 248", 23.7, 44.17, 10.3, 12.3, 1.9],
  ["Epsilon Eridani", 3.55, -9.46, 10.5, 3.7, 0.9],
  ["Lacaille 9352", 23.1, -35.85, 10.7, 7.3, 1.5],
  ["Ross 128", 11.79, 0.8, 11.0, 11.1, 1.7],
  ["EZ Aquarii", 22.64, -15.3, 11.1, 13.3, 1.9],
  ["Procyon", 7.65, 5.22, 11.4, 0.34, 0.4],
  ["61 Cygni", 21.11, 38.75, 11.4, 5.2, 1.1],
  ["Struve 2398", 18.71, 59.63, 11.5, 8.9, 1.5],
  ["Groombridge 34", 0.31, 44.02, 11.6, 8.1, 1.6],
  ["Epsilon Indi", 22.06, -56.78, 11.8, 4.7, 1.0],
  ["DX Cancri", 8.49, 26.78, 11.8, 14.8, 2.0],
  ["Tau Ceti", 1.73, -15.94, 11.9, 3.5, 0.7],
  ["Gliese 1061", 3.6, -44.51, 12.0, 13.0, 1.9],
  ["YZ Ceti", 1.21, -16.99, 12.1, 12.1, 1.8],
  ["Luyten's Star", 7.46, 5.23, 12.4, 9.9, 1.6],
  ["Teegarden's Star", 2.89, 16.88, 12.5, 15.1, 2.0],
  ["Kapteyn's Star", 5.19, -45.02, 12.8, 8.9, 1.5],
  ["Lacaille 8760", 21.28, -38.87, 12.9, 6.7, 1.4],
  ["Kruger 60", 22.47, 57.7, 13.1, 9.8, 1.6],
  ["Wolf 1061", 16.51, -12.66, 14.0, 10.1, 1.6],
  ["Van Maanen's Star", 0.82, 5.39, 14.1, 12.4, 0.6],
  ["Gliese 1", 0.09, -37.36, 14.2, 8.6, 1.5],
  ["Wolf 424", 12.56, 9.02, 14.3, 13.1, 1.9],
  ["TZ Arietis", 2.0, 13.05, 14.5, 12.3, 1.8],
  ["Gliese 687", 17.61, 68.34, 14.8, 9.2, 1.5],
  ["Gliese 674", 17.48, -46.9, 14.8, 9.4, 1.6],
  ["Gliese 876", 22.89, -14.26, 15.2, 10.2, 1.6],
  ["Altair", 19.85, 8.87, 16.7, 0.77, 0.2],
  ["Vega", 18.62, 38.78, 25.0, 0.03, 0.0],
  ["Fomalhaut", 22.96, -29.62, 25.1, 1.16, 0.1],
  ["Pollux", 7.76, 28.03, 33.8, 1.14, 1.0],
  ["Arcturus", 14.26, 19.18, 36.7, -0.05, 1.2],
  ["Capella", 5.28, 45.99, 42.9, 0.08, 0.8],
  ["Castor", 7.58, 31.89, 51, 1.58, 0.0],
  ["Aldebaran", 4.6, 16.51, 65, 0.85, 1.5],
  ["Regulus", 10.14, 11.97, 79, 1.35, -0.1],
  ["Achernar", 1.63, -57.24, 139, 0.46, -0.2],
  ["Spica", 13.42, -11.16, 250, 1.0, -0.2],
];

export const createStars = async (THREE, { tier, small }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 50000);
  const sky = await createSky(THREE, { radius: 20000, tier, intensity: 0.5 });
  scene.add(sky.group);

  const n = NEARBY.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  NEARBY.forEach((s, i) => {
    const [, ra, dec, d, mag, bv] = s;
    const dir = eqToScene(ra, dec);
    pos.set([dir[0] * d, dir[1] * d, dir[2] * d], i * 3);
    const c = bvColor(bv);
    const absM = mag - 5 * Math.log10(d / 3.2616 / 10);
    const lum = Math.pow(10, -0.4 * (absM - 4.8)); // relative to the Sun
    const b = 0.5 + 0.5 * Math.min(1.5, Math.pow(lum, 0.35));
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = 0.12 + 0.3 * Math.min(2, Math.pow(lum, 0.3)) * 0.4;
    phase[i] = Math.random() * 6.28;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const starMat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.8 }), intensity: 1.4, minPx: 2, maxPx: 26 });
  const near = new THREE.Points(geo, starMat);
  near.frustumCulled = false;
  scene.add(near);

  // Filler stars of the Orion arm so the field thickens as we pull back.
  const fn = small ? 6000 : 16000;
  const fpos = new Float32Array(fn * 3);
  const fcol = new Float32Array(fn * 3);
  const fsize = new Float32Array(fn);
  const fphase = new Float32Array(fn);
  for (let i = 0; i < fn; i++) {
    const d = 18 + Math.pow(Math.random(), 0.5) * 900;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const y = Math.cos(ph) * d * 0.35; // flattened like the disc
    fpos.set([Math.sin(ph) * Math.cos(th) * d, y, Math.sin(ph) * Math.sin(th) * d], i * 3);
    const c = bvColor(-0.2 + Math.random() * 1.8);
    const b = 0.35 + 0.65 * Math.pow(Math.random(), 2.5);
    fcol.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    fsize[i] = 0.15 + Math.pow(Math.random(), 3) * 0.9;
    fphase[i] = Math.random() * 6.28;
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  fgeo.setAttribute("size", new THREE.BufferAttribute(fsize, 1));
  fgeo.setAttribute("phase", new THREE.BufferAttribute(fphase, 1));
  const fillMat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.6 }), intensity: 1.0, minPx: 1, maxPx: 10 });
  const filler = new THREE.Points(fgeo, fillMat);
  filler.frustumCulled = false;
  scene.add(filler);

  // The Sun itself.
  const sunGlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTexture(THREE, 512), color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sunGlare);

  const dir = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    sky.setTime(time);
    const d = track([[0, 0.02], [0.5, 12], [1, 320]], t, { log: true });
    camera.position.copy(dir).multiplyScalar(d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    sunGlare.scale.setScalar(Math.max(0.01, d * 0.14 * lerp(1, 0.35, smoothstep(0.5, 1, t))));
    starMat.uniforms.scale.value = 400;
    fillMat.uniforms.scale.value = 400;
    sky.setScale(600);
    // Nearby stars appear once the Sun's glare no longer swamps them.
    starMat.uniforms.fade.value = smoothstep(0.05, 0.3, t);
    fillMat.uniforms.fade.value = smoothstep(0.35, 0.7, t);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
