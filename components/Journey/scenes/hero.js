import { clamp, lerp, smoothstep, track } from "../util";
import { createCharacter } from "./character";

// Opening and closing stage: Om (built from primitives in character.js)
// standing on a grassy meadow. The sky, sun/moon and light follow the time
// of day in IST. His head follows the cursor. At t = 0 he stands right of
// centre (the hero copy sits on the left); as t grows he slides to the
// centre and the camera pushes in to his eye (t 0 → 1). The reverse stage
// runs the same path with 1 - t.

const NIGHT = {
  zenith: "#050817", mid: "#0b1430", horizon: "#1a2547", glow: "#8090ff", glowI: 0.12,
  grass: "#142a1c", light: "#b4c4ff", lightI: 0.8, envI: 0.22, emissive: 0.14, rimI: 0.25,
};
const PHASES = [
  { h: 0, ...NIGHT },
  { h: 4.8, ...NIGHT },
  { h: 5.6, zenith: "#101a42", mid: "#3a3f78", horizon: "#d9788a", glow: "#ff9a7a", glowI: 0.5, grass: "#1d3624", light: "#c9b4ff", lightI: 0.8, envI: 0.28, emissive: 0.15, rimI: 0.4 },
  { h: 6.3, zenith: "#3f63a8", mid: "#e3a27e", horizon: "#ffb56b", glow: "#ffb347", glowI: 1.2, grass: "#355f33", light: "#ffcf9e", lightI: 1.0, envI: 0.45, emissive: 0.18, rimI: 1.2 },
  { h: 7.5, zenith: "#5b9ae0", mid: "#a9cff0", horizon: "#ffe0b5", glow: "#fff0c8", glowI: 0.5, grass: "#4a8a40", light: "#fff0d8", lightI: 1.3, envI: 0.75, emissive: 0.26, rimI: 0.6 },
  { h: 10, zenith: "#3f8be0", mid: "#8fc2f0", horizon: "#d8ecff", glow: "#ffffff", glowI: 0.3, grass: "#4f9443", light: "#fff6e6", lightI: 1.45, envI: 0.85, emissive: 0.3, rimI: 0.3 },
  { h: 15.5, zenith: "#3f8be0", mid: "#8fc2f0", horizon: "#d8ecff", glow: "#ffffff", glowI: 0.3, grass: "#4f9443", light: "#fff6e6", lightI: 1.45, envI: 0.85, emissive: 0.3, rimI: 0.3 },
  { h: 17.3, zenith: "#4a7cc4", mid: "#f0c79a", horizon: "#ffc98a", glow: "#ffc06a", glowI: 0.8, grass: "#4a8238", light: "#ffd9a8", lightI: 1.3, envI: 0.7, emissive: 0.26, rimI: 0.9 },
  { h: 18.3, zenith: "#2e3f86", mid: "#e0726a", horizon: "#ff8a3d", glow: "#ff6a2a", glowI: 1.4, grass: "#345a2c", light: "#ffb07a", lightI: 1.0, envI: 0.45, emissive: 0.18, rimI: 1.4 },
  { h: 19, zenith: "#161d4a", mid: "#5b3f7a", horizon: "#c8607a", glow: "#ff6a6a", glowI: 0.5, grass: "#1f3a26", light: "#b9a8ff", lightI: 0.8, envI: 0.28, emissive: 0.15, rimI: 0.4 },
  { h: 19.8, ...NIGHT },
  { h: 24, ...NIGHT },
];
const SUNRISE = 6.2;
const SUNSET = 18.3;

// `?hour=18.3` previews another time of day.
const istHour = () => {
  const forced = parseFloat(new URLSearchParams(window.location.search).get("hour"));
  if (forced >= 0 && forced < 24) return forced;
  const now = new Date();
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
  return minutes / 60;
};

const discTexture = (THREE) => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.22, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.45)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const hillRing = (THREE, radius, base, amp, seed) => {
  const N = 256;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const h = base + amp * (0.55 * Math.sin(3 * a + seed) + 0.3 * Math.sin(7 * a + seed * 2.1) + 0.15 * Math.sin(17 * a + seed * 3.7));
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pos.push(x, -2, z, x, Math.max(h, 0.3), z);
    if (i < N) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
};

// Ground texture: soil/grass mottling with a bit of large-scale variation.
const groundTexture = (THREE) => {
  const S = 512;
  const tex = document.createElement("canvas");
  tex.width = tex.height = S;
  const ctx = tex.getContext("2d");
  ctx.fillStyle = "#7a7a7a";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 24000; i++) {
    const g = 85 + Math.random() * 90;
    ctx.fillStyle = `rgba(${g},${g + 4},${g - 6},0.55)`;
    const s = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
  for (let i = 0; i < 60; i++) {
    const g = 100 + Math.random() * 60;
    const grad = ctx.createRadialGradient(Math.random() * S, Math.random() * S, 0, S / 2, S / 2, 40 + Math.random() * 80);
    grad.addColorStop(0, `rgba(${g},${g},${g},0.25)`);
    grad.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(tex);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.anisotropy = 8;
  return t;
};

// Wrap a modelled glTF avatar (public/models/om.glb, e.g. a Mixamo
// character merged by scripts/mixamo-to-glb.py) in the same interface as
// the primitive Om. Head/neck bones are found by name (mixamorig:Head or
// anything containing "head"/"neck"); the eye landmark is a mesh named
// "eye" if there is one, otherwise a point in front of the head bone.
const loadModelAvatar = (THREE, gltf, { reducedMotion }) => {
  const group = gltf.scene;
  let eyeMesh = null;
  let eyeBone = null;
  let head = null;
  let neck = null;
  const materials = [];
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        materials.push(m);
        if (m.map) m.map.anisotropy = 8;
      });
      // A single-eye mesh (left/right in the name) gives the landmark
      // directly; a combined "Eyes" mesh does not.
      if (/eye/i.test(o.name) && /left|right|_l\b|_r\b|\.l\b|\.r\b/i.test(o.name) && (!eyeMesh || /right|_r\b|\.r\b/i.test(o.name))) eyeMesh = o;
    } else {
      // Mixamo: mixamorig:RightEye is the character's right, the viewer's left.
      if (/righteye$/i.test(o.name) || (!eyeBone && /eye$/i.test(o.name))) eyeBone = o;
      if (!head && /head$/i.test(o.name)) head = o;
      if (!neck && /neck$/i.test(o.name)) neck = o;
    }
  });
  if (!head && !eyeMesh && !eyeBone) return null;
  // Feet on the ground, facing +z, metres.
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(group);
  const height = bb.max.y - bb.min.y;
  if (height > 10) group.scale.setScalar(0.01); // centimetre export
  else if (height < 0.3) group.scale.setScalar(100);
  group.updateMatrixWorld(true);
  bb.setFromObject(group);
  group.position.y -= bb.min.y;
  group.position.x -= (bb.min.x + bb.max.x) / 2;

  const mixer = new THREE.AnimationMixer(group);
  const clips = gltf.animations || [];
  const idleClip = clips.find((c) => /idle/i.test(c.name)) || clips[0];
  const waveClip = clips.find((c) => /wav/i.test(c.name));
  const idle = idleClip ? mixer.clipAction(idleClip) : null;
  const waveAct = waveClip ? mixer.clipAction(waveClip) : null;
  if (idle && !reducedMotion) idle.play();
  if (waveAct) {
    waveAct.setLoop(THREE.LoopOnce, 1);
    waveAct.clampWhenFinished = false;
  }
  let waving = false;
  mixer.addEventListener("finished", (e) => {
    if (e.action !== waveAct) return;
    waving = false;
    if (idle) {
      idle.enabled = true;
      idle.reset().play();
      waveAct.crossFadeTo(idle, 0.4, false);
    }
  });

  const headRest = head ? head.quaternion.clone() : null;
  const neckRest = neck ? neck.quaternion.clone() : null;
  const look = new THREE.Vector2();
  const target = new THREE.Vector2();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const landmarks = {
    eye: new THREE.Vector3(),
    face: new THREE.Vector3(),
    irisRadius: 0.0115,
    update: () => {
      if (eyeMesh) {
        box.setFromObject(eyeMesh);
        box.getCenter(landmarks.eye);
        box.getSize(v);
        landmarks.eye.z += v.z * 0.5;
        landmarks.irisRadius = Math.max(v.x, v.y) * 0.3;
      } else if (eyeBone) {
        // Eye joint sits at the eyeball centre; the cornea is ~1.2 cm in
        // front of it (the model faces +z). Human iris radius ~6 mm.
        eyeBone.getWorldPosition(landmarks.eye);
        landmarks.eye.z += 0.012;
        landmarks.irisRadius = 0.006;
      } else {
        head.getWorldPosition(landmarks.eye);
        landmarks.eye.add(v.set(0.031, 0.045, 0.1));
      }
      landmarks.face.copy(landmarks.eye);
      landmarks.face.x -= 0.031;
      landmarks.face.y -= 0.035;
    },
  };
  return {
    group,
    materials,
    landmarks,
    setLook: (x, y) => target.set(x, y),
    wave: () => {
      if (!waveAct || waving || reducedMotion) return;
      waving = true;
      waveAct.reset().play();
      if (idle) idle.crossFadeTo(waveAct, 0.35, false);
    },
    update: ({ dt, look: amp = 1 }) => {
      mixer.update(dt);
      look.lerp(target, 1 - Math.pow(0.004, dt));
      const yaw = look.x * 0.5 * amp;
      const pitch = look.y * 0.3 * amp;
      // Applied after the mixer so the clip's own head motion is kept.
      if (neck && neckRest) {
        e.set(-pitch * 0.35, yaw * 0.35, 0);
        neck.quaternion.multiply(q.setFromEuler(e));
      }
      if (head && headRest) {
        e.set(-pitch * 0.65, yaw * 0.65, 0);
        head.quaternion.multiply(q.setFromEuler(e));
      }
    },
    dispose: () => {
      mixer.stopAllAction();
      group.traverse((o) => o.geometry && o.geometry.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
};

// Download the avatar with byte progress. Phones on a weak link can stall
// mid-file: if no bytes arrive for STALL_MS the request is aborted.
const STALL_MS = 20000;
const fetchModel = async (url, onProgress) => {
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), STALL_MS);
  const poke = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), STALL_MS);
  };
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !res.body.getReader) {
      const buf = await res.arrayBuffer();
      onProgress(buf.byteLength, buf.byteLength);
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      poke();
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let o = 0;
    chunks.forEach((c) => {
      out.set(c, o);
      o += c.byteLength;
    });
    return out.buffer;
  } finally {
    clearTimeout(timer);
  }
};

export const createHero = (THREE, { renderer, small, reducedMotion, deps, onModelProgress = () => {} }) => {
  const { RoomEnvironment } = deps;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 8, 42);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const skyUniforms = {
    zenith: { value: new THREE.Color() },
    mid: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    glowColor: { value: new THREE.Color() },
    glowI: { value: 0 },
    sunDir: { value: new THREE.Vector3(0, 0.1, -1) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: "varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon;
        uniform vec3 glowColor; uniform float glowI; uniform vec3 sunDir;
        varying vec3 vPos;
        void main(){
          vec3 d = normalize(vPos);
          float y = max(d.y, 0.0);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, y));
          col = mix(col, zenith, smoothstep(0.18, 0.85, y));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          float band = 1.0 - smoothstep(0.0, 0.35, y);
          col += glowColor * glowI * (pow(s, 5.0) * (0.35 + 0.45 * band) + pow(s, 48.0) * 0.6);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1200 * 3);
  for (let i = 0; i < 1200; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.lerp(0.08, 1, Math.random()));
    starPos.set([80 * Math.sin(phi) * Math.cos(theta), 80 * Math.cos(phi), 80 * Math.sin(phi) * Math.sin(theta)], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  const disc = discTexture(THREE);
  const sunMat = new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, transparent: true, toneMapped: false });
  const sun = new THREE.Sprite(sunMat);
  sun.renderOrder = -1;
  scene.add(sun);
  const moonMat = new THREE.SpriteMaterial({ map: disc, color: 0xe6ebff, fog: false, depthWrite: false, transparent: true, toneMapped: false });
  const moon = new THREE.Sprite(moonMat);
  moon.renderOrder = -1;
  scene.add(moon);

  const farHillMat = new THREE.MeshBasicMaterial({ fog: false });
  const nearHillMat = new THREE.MeshBasicMaterial({ fog: false });
  scene.add(new THREE.Mesh(hillRing(THREE, 62, 2.2, 2.6, 1.3), farHillMat));
  scene.add(new THREE.Mesh(hillRing(THREE, 48, 1.1, 1.8, 4.2), nearHillMat));

  const hemi = new THREE.HemisphereLight(0xffffff, 0x335533, 0.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 20 });
  key.shadow.radius = 5;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-1, 1.6, 4);
  scene.add(fill);

  const groundMat = new THREE.MeshLambertMaterial({ map: groundTexture(THREE) });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grass: instanced blades with a slight bend, colour gradient from a dark
  // base to a lighter tip, and layered wind (gusts + flutter).
  const bladeGeo = new THREE.BufferGeometry();
  const bladePts = [];
  const bladeIdx = [];
  const SEGS = 4;
  for (let s = 0; s <= SEGS; s++) {
    const y = s / SEGS;
    const w = 0.02 * (1 - y * y * 0.9);
    const bend = y * y * 0.12;
    bladePts.push(-w, y, bend, w, y, bend);
  }
  for (let s = 0; s < SEGS; s++) {
    const k = s * 2;
    bladeIdx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
  }
  bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute(bladePts, 3));
  bladeGeo.setIndex(bladeIdx);
  bladeGeo.computeVertexNormals();
  const grassUniforms = { time: { value: 0 }, sway: { value: reducedMotion ? 0 : 1 } };
  const bladeMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  bladeMat.onBeforeCompile = (shader) => {
    shader.uniforms.time = grassUniforms.time;
    shader.uniforms.sway = grassUniforms.sway;
    shader.vertexShader =
      "uniform float time; uniform float sway; varying float vH;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float k = position.y * position.y;
        vH = position.y;
        float gust = sin(time * 0.9 + wp.x * 0.35 + wp.z * 0.25) * 0.5 + 0.5;
        transformed.x += sway * k * (0.08 + 0.1 * gust) * sin(time * 1.6 + wp.x * 0.7 + wp.z * 0.5);
        transformed.z += sway * k * 0.05 * cos(time * 1.3 + wp.x * 0.4 + wp.z * 0.9);
        transformed.x += sway * k * 0.015 * sin(time * 6.0 + wp.z * 4.0 + wp.x * 3.0);`
      );
    shader.fragmentShader =
      "varying float vH;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n diffuseColor.rgb *= mix(0.45, 1.15, smoothstep(0.0, 1.0, vH));"
      );
  };
  const count = small ? 14000 : 42000;
  const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
  grass.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const tilt = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const r = 0.3 + Math.pow(Math.random(), 1.6) * 11;
    const a = Math.random() * Math.PI * 2;
    const z = Math.sin(a) * r;
    const h = (0.07 + Math.random() * 0.12) * (z > 0.6 ? 0.45 : 1);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * Math.PI * 2);
    tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.5);
    q.multiply(tilt);
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0, z), q, new THREE.Vector3(1, h, 1));
    grass.setMatrixAt(i, m);
    c.setHSL(0.25 + Math.random() * 0.08, 0.45 + Math.random() * 0.25, 0.3 + Math.random() * 0.16);
    grass.setColorAt(i, c);
  }
  scene.add(grass);

  // ---------- Om ----------
  // Placeholder figure from primitives (character.js). If a modelled avatar
  // is dropped in at public/models/om.glb it replaces the placeholder: the
  // code looks for a mesh whose name contains "eye" (the camera dives into
  // it), objects named "head"/"neck" (cursor follow) and an optional
  // "idle" clip. Feet must be at y = 0, about 1.75 m tall, facing +z.
  let om = createCharacter(THREE, { reducedMotion });
  scene.add(om.group);
  const ready = (async () => {
    try {
      // The model is meshopt-compressed (scripts/mixamo-to-glb.py).
      const loaderMod = Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/libs/meshopt_decoder.module.js")]);
      // One retry after a stall; if that stalls too, the placeholder stays
      // so the page still opens.
      let buf = null;
      for (let attempt = 0; attempt < 2 && !buf; attempt++) {
        try {
          buf = await fetchModel("/models/om.glb", onModelProgress);
          if (!buf) return;
        } catch (e) {
          if (attempt === 1) throw e;
          console.warn("om.glb retry", e);
        }
      }
      const [{ GLTFLoader }, { MeshoptDecoder }] = await loaderMod;
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buf, "/models/");
      const model = loadModelAvatar(THREE, gltf, { reducedMotion });
      if (!model) return;
      scene.remove(om.group);
      om.dispose();
      om = model;
      scene.add(om.group);
      applyTime();
    } catch (e) {
      console.warn("om.glb", e);
    }
  })();

  // ---------- Camera ----------
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 200);
  let wideDist = 4.6;
  let heroShift = 0; // world-x offset of the target so Om sits right of centre
  let heroLift = 0; // target-y offset on narrow screens so Om sits low
  const resize = (w, h) => {
    const aspect = w / h;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(30) / 2);
    wideDist = Math.max(2.7 / (2 * halfTan), 1.8 / (2 * halfTan * aspect));
    const halfW = wideDist * halfTan * aspect;
    const wide = clamp((aspect - 0.95) / 0.5, 0, 1);
    heroShift = -halfW * 0.5 * wide;
    // Phones: the copy takes the top half, so the target rises (Om drops)
    // and the camera pulls back a little.
    heroLift = 1.05 * (1 - wide);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const ca = new THREE.Color();
  const cb = new THREE.Color();

  const applyTime = () => {
    const hr = istHour();
    let i = 0;
    while (i < PHASES.length - 2 && PHASES[i + 1].h <= hr) i++;
    const A = PHASES[i];
    const B = PHASES[i + 1];
    const t = (hr - A.h) / (B.h - A.h);
    const col = (k) => ca.set(A[k]).lerp(cb.set(B[k]), t).clone();
    const num = (k) => A[k] + (B[k] - A[k]) * t;

    const horizon = col("horizon");
    const grassCol = col("grass");
    skyUniforms.zenith.value.copy(col("zenith"));
    skyUniforms.mid.value.copy(col("mid"));
    skyUniforms.horizon.value.copy(horizon);
    skyUniforms.glowColor.value.copy(col("glow"));
    skyUniforms.glowI.value = num("glowI");
    groundMat.color.copy(grassCol).multiplyScalar(0.9);
    bladeMat.color.set(0xffffff).lerp(grassCol, 0.35);
    nearHillMat.color.copy(grassCol).multiplyScalar(0.55).lerp(horizon, 0.38);
    farHillMat.color.copy(grassCol).multiplyScalar(0.55).lerp(horizon, 0.62);
    scene.fog.color.copy(nearHillMat.color);
    hemi.color.copy(skyUniforms.zenith.value).lerp(new THREE.Color(0xffffff), 0.5);
    hemi.groundColor.copy(grassCol);
    hemi.intensity = 0.35 + num("envI") * 0.4;
    key.color.copy(col("light"));
    key.intensity = num("lightI");
    scene.environmentIntensity = num("envI");
    // Om has no texture to glow; lift his materials a little after dark.
    const glow = Math.max(0, num("emissive") - 0.18) * 1.2;
    om.materials.forEach((mat) => {
      if (!mat.emissive) return;
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = glow;
    });
    starMat.opacity = 0.85 * clamp((0.5 - num("envI")) / 0.3, 0, 1);

    const p = (hr - SUNRISE) / (SUNSET - SUNRISE);
    const up = p > -0.06 && p < 1.06;
    const elev = Math.sin(clamp(p, 0, 1) * Math.PI);
    sunDir.set(lerp(-0.2, 0.2, p), elev * 0.9 - 0.015, -1).normalize();
    skyUniforms.sunDir.value.copy(sunDir);
    sun.visible = up;
    sun.position.copy(sunDir).multiplyScalar(80);
    const low = 1 - clamp(elev / 0.35, 0, 1);
    sun.scale.setScalar(14 + low * 8);
    sunMat.color.copy(col("glow")).lerp(new THREE.Color(0xffffff), 0.35 * (1 - low));

    const nightLen = 24 - (SUNSET - SUNRISE);
    const qn = ((hr - SUNSET + 24) % 24) / nightLen;
    moonDir.set(lerp(-0.22, 0.22, qn), 0.07 + Math.sin(qn * Math.PI) * 0.16, -1).normalize();
    moon.visible = !up;
    moon.position.copy(moonDir).multiplyScalar(80);
    moon.scale.setScalar(9);

    key.position.set(sunDir.x * 2 + 0.6, 4.5, 3);
    rim.position.copy(up ? sunDir : moonDir).multiplyScalar(8);
    rim.color.copy(up ? col("glow") : new THREE.Color("#aab8ff"));
    rim.intensity = num("rimI");
  };
  applyTime();
  const timeTimer = setInterval(applyTime, 60000);

  const setPointer = (x, y) => om.setLook(x, y);

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const update = ({ t, dt, time, reverse }) => {
    grassUniforms.time.value = time;
    // Idle motion fades out as the camera closes in so the eye holds still.
    const idle = 1 - smoothstep(0.3, 0.6, t);
    om.update({ time, dt, idle, look: 1 - smoothstep(0.4, 0.75, t) });
    om.group.updateMatrixWorld(true);
    om.landmarks.update();
    const { eye, face, irisRadius } = om.landmarks;

    // Camera: hero (Om right of centre) → centred → chest → face → eye.
    // The reverse stage ends right of centre too, leaving room for the
    // footer copy.
    const shift = heroShift;
    const lift = heroLift;
    const heroCam = [0, 1.15 + lift * 0.3, wideDist * (1 + lift * 0.12)];
    const heroTgt = [shift, 0.95 + lift, 0];
    const centreCam = [0, 1.15, wideDist * 0.9];
    const centreTgt = [0, 0.98, 0];
    const chestCam = [0, 1.45, 2.2];
    const chestTgt = [0, 1.4, 0];
    const faceCam = [face.x, face.y + 0.01, face.z + 0.5];
    const faceTgt = [face.x, face.y, face.z];
    // The iris must fill the same share of the screen as the iris stage's
    // first frame: radius = 0.62 of the half height at fov 34.
    const eyeDist = irisRadius / (0.62 * Math.tan(THREE.MathUtils.degToRad(34) / 2));
    const eyeCam = [eye.x, eye.y, eye.z + eyeDist];
    const eyeTgt = [eye.x, eye.y, eye.z];
    const p = track([[0, heroCam], [0.3, centreCam], [0.48, chestCam], [0.72, faceCam], [0.9, eyeCam], [1, eyeCam]], t);
    const tg = track([[0, heroTgt], [0.3, centreTgt], [0.48, chestTgt], [0.72, faceTgt], [0.9, eyeTgt], [1, eyeTgt]], t);
    camPos.set(p[0], p[1], p[2]);
    camTarget.set(tg[0], tg[1], tg[2]);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.fov = lerp(30, 34, smoothstep(0.72, 0.9, t));
    camera.near = lerp(0.1, 0.01, smoothstep(0.6, 1, t));
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    clearInterval(timeTimer);
    pmrem.dispose();
    disc.dispose();
    om.dispose();
  };

  return { scene, camera, update, resize, ready, dispose, setPointer, get om() { return om; }, get landmarks() { return om.landmarks; } };
};
