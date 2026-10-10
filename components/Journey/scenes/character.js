// Om, built from three.js primitives (no model file): a stylised, clay-shaded
// figure modelled on the reference render — big dark curly hair, thick brows,
// large brown eyes, moustache, lavender raglan tee with white shoulder
// stripes and a chest badge, cream trousers. Feet at y = 0, about 1.8 m tall
// including the hair. Everything is rigged with plain Groups so the body can
// breathe, shift its weight, blink, follow the cursor and wave.

const COL = {
  skin: 0xb86f3f,
  skinDark: 0x9e5b31,
  hair: 0x17131c,
  brow: 0x1b1512,
  tee: 0xf2b5ac,
  teeLight: 0xffcac4,
  stripe: 0xfaf7f5,
  badge: 0x332f3c,
  trousers: 0xeae2d1,
  trousersDark: 0xd8cfbb,
  shoe: 0xf4f1ea,
  sole: 0x3a3238,
  sclera: 0xf6f3ee,
  iris: 0x5a3416,
  irisLight: 0x8b5424,
  pupil: 0x0a0604,
  mouth: 0x6e3a3c,
  outline: 0x1a1419,
};

export const createCharacter = (THREE, { reducedMotion = false } = {}) => {
  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...opts });
  const M = {
    skin: mat(COL.skin),
    skinDark: mat(COL.skinDark),
    hair: mat(COL.hair, { roughness: 0.55 }),
    brow: mat(COL.brow, { roughness: 0.7 }),
    tee: mat(COL.tee),
    teeLight: mat(COL.teeLight),
    stripe: mat(COL.stripe, { roughness: 0.7 }),
    badge: mat(COL.badge, { roughness: 0.3, metalness: 0.6 }),
    trousers: mat(COL.trousers),
    shoe: mat(COL.shoe, { roughness: 0.6 }),
    sole: mat(COL.sole),
    sclera: mat(COL.sclera, { roughness: 0.25 }),
    iris: mat(COL.iris, { roughness: 0.35 }),
    pupil: mat(COL.pupil, { roughness: 0.3 }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: mat(COL.mouth),
    outline: new THREE.MeshBasicMaterial({ color: COL.outline, side: THREE.BackSide }),
  };
  const materials = Object.values(M);

  const root = new THREE.Group();
  root.name = "om";

  // Mesh helper with an optional inverted-hull outline (the cel look).
  const mesh = (geo, material, { outline = 0, shadow = true } = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow;
    m.receiveShadow = false;
    m.frustumCulled = false;
    if (outline > 0) {
      const o = new THREE.Mesh(geo, M.outline);
      o.scale.setScalar(1 + outline);
      o.frustumCulled = false;
      m.add(o);
    }
    return m;
  };
  const capsule = (r, len, radial = 12, caps = 6) => new THREE.CapsuleGeometry(r, len, caps, radial);
  const sphere = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);

  // ---------- Legs and shoes ----------
  const hips = new THREE.Group();
  hips.position.set(0, 0.9, 0);
  root.add(hips);

  const legs = [];
  [-1, 1].forEach((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.085, 0, 0);
    // Trouser leg: a capsule hanging from the hip, slight flare at the hem.
    const thigh = mesh(capsule(0.082, 0.36, 14), M.trousers, { outline: 0.03 });
    thigh.position.y = -0.24;
    const shin = mesh(capsule(0.076, 0.34, 14), M.trousers, { outline: 0.03 });
    shin.position.set(side * 0.006, -0.6, 0.01);
    const shoe = mesh(sphere(0.085, 20, 14), M.shoe, { outline: 0.03 });
    shoe.scale.set(0.95, 0.5, 1.55);
    shoe.position.set(side * 0.01, -0.86, 0.045);
    const sole = mesh(sphere(0.086, 20, 14), M.sole, { shadow: false });
    sole.scale.set(0.97, 0.3, 1.58);
    sole.position.set(side * 0.01, -0.875, 0.045);
    leg.add(thigh, shin, shoe, sole);
    hips.add(leg);
    legs.push(leg);
  });
  // Waist block so the hem of the tee has something behind it.
  const waist = mesh(new THREE.CylinderGeometry(0.17, 0.175, 0.16, 24), M.trousers);
  waist.scale.z = 0.66;
  waist.position.y = 0.02;
  hips.add(waist);

  // ---------- Torso ----------
  const torso = new THREE.Group();
  torso.position.set(0, 0.0, 0);
  hips.add(torso);
  // Tee: lathe profile from the hem up to the shoulders, flattened in z.
  const prof = [
    [0.0, -0.06], [0.2, -0.06], [0.205, -0.03], [0.19, 0.08], [0.185, 0.2], [0.195, 0.32],
    [0.205, 0.38], [0.19, 0.44], [0.14, 0.48], [0.07, 0.5], [0.0, 0.505],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tee = mesh(new THREE.LatheGeometry(prof, 40), M.tee, { outline: 0.025 });
  tee.scale.z = 0.64;
  torso.add(tee);
  // Collar rim.
  const collar = mesh(new THREE.TorusGeometry(0.068, 0.012, 10, 32), M.teeLight, { shadow: false });
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.8;
  collar.position.y = 0.49;
  torso.add(collar);
  // Chest badge.
  const badge = mesh(sphere(0.02, 18, 12), M.badge, { shadow: false });
  badge.scale.z = 0.45;
  badge.position.set(0.085, 0.3, 0.128);
  torso.add(badge);

  // ---------- Arms ----------
  const arms = {};
  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.15, 0.42, 0);
    torso.add(shoulder);
    // Raglan sleeve: angled out from the collar, lighter than the body.
    const sleeve = mesh(capsule(0.066, 0.16, 14), M.teeLight, { outline: 0.03 });
    sleeve.position.set(side * 0.035, -0.1, 0);
    sleeve.rotation.z = -side * 0.2;
    shoulder.add(sleeve);
    // White stripe along the top of the sleeve.
    const stripe = mesh(capsule(0.01, 0.2, 8, 4), M.stripe, { shadow: false });
    stripe.position.set(side * 0.048, -0.075, 0.0);
    stripe.rotation.z = -side * 0.3;
    shoulder.add(stripe);
    const elbow = new THREE.Group();
    elbow.position.set(side * 0.07, -0.23, 0);
    shoulder.add(elbow);
    const forearm = mesh(capsule(0.042, 0.18, 12), M.skin, { outline: 0.045 });
    forearm.position.y = -0.11;
    elbow.add(forearm);
    const hand = mesh(sphere(0.052, 18, 14), M.skin, { outline: 0.04 });
    hand.scale.set(0.8, 1.1, 0.55);
    hand.position.set(side * 0.004, -0.235, 0.01);
    elbow.add(hand);
    // Thumb.
    const thumb = mesh(capsule(0.014, 0.03, 8, 4), M.skin, { shadow: false });
    thumb.position.set(-side * 0.03, -0.215, 0.03);
    thumb.rotation.z = side * 0.6;
    elbow.add(thumb);
    arms[side] = { shoulder, elbow };
  });

  // ---------- Neck and head ----------
  const neck = new THREE.Group();
  neck.position.set(0, 0.5, 0);
  torso.add(neck);
  const neckMesh = mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.14, 20), M.skinDark);
  neckMesh.position.y = 0.04;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.1, 0);
  neck.add(head);
  const HEAD_R = 0.135;
  const headMesh = mesh(sphere(HEAD_R, 40, 30), M.skin, { outline: 0.022 });
  headMesh.scale.set(1, 1.1, 0.95);
  headMesh.position.y = 0.13;
  head.add(headMesh);
  // Jaw: a lower sphere that narrows the chin.
  const jaw = mesh(sphere(0.11, 32, 24), M.skin);
  jaw.scale.set(0.95, 0.85, 0.9);
  jaw.position.set(0, 0.06, 0.012);
  head.add(jaw);
  // Ears.
  [-1, 1].forEach((side) => {
    const ear = mesh(sphere(0.036, 18, 12), M.skin, { outline: 0.05 });
    ear.scale.set(0.5, 1, 0.7);
    ear.position.set(side * 0.133, 0.12, -0.01);
    head.add(ear);
    const inner = mesh(sphere(0.02, 12, 8), M.skinDark, { shadow: false });
    inner.scale.set(0.35, 0.9, 0.6);
    inner.position.set(side * 0.145, 0.12, -0.005);
    head.add(inner);
  });

  // Eyes: big sclera, domed brown iris, pupil, a wet highlight, and an
  // upper lid that swings down for blinks.
  const EYE_R = 0.03;
  const IRIS_R = 0.0165;
  const eyes = [];
  [-1, 1].forEach((side) => {
    const eye = new THREE.Group();
    eye.position.set(side * 0.052, 0.155, 0.1);
    head.add(eye);
    const white = mesh(sphere(EYE_R, 24, 18), M.sclera, { shadow: false });
    white.scale.set(1, 1.12, 0.8);
    eye.add(white);
    const iris = mesh(sphere(IRIS_R, 20, 14), M.iris, { shadow: false });
    iris.scale.set(1, 1, 0.5);
    iris.position.z = EYE_R * 0.8 - 0.004;
    eye.add(iris);
    const ring = mesh(new THREE.TorusGeometry(IRIS_R * 0.78, IRIS_R * 0.16, 8, 24), M.pupil, { shadow: false });
    ring.position.z = EYE_R * 0.8 + 0.0035;
    eye.add(ring);
    const pupil = mesh(sphere(IRIS_R * 0.5, 16, 12), M.pupil, { shadow: false });
    pupil.scale.z = 0.4;
    pupil.position.z = EYE_R * 0.8 + 0.004;
    eye.add(pupil);
    const hl = mesh(sphere(0.0045, 10, 8), M.highlight, { shadow: false });
    hl.position.set(-0.006 * side + (side < 0 ? -0.001 : 0.001), 0.0065, EYE_R * 0.8 + 0.009);
    eye.add(hl);
    const hl2 = mesh(sphere(0.002, 8, 6), M.highlight, { shadow: false });
    hl2.position.set(0.006, -0.006, EYE_R * 0.8 + 0.009);
    eye.add(hl2);
    // Lid: a cap slightly bigger than the eye, hinged at the eye centre.
    const lid = new THREE.Group();
    const lidMesh = mesh(new THREE.SphereGeometry(EYE_R * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.skin, { shadow: false });
    lidMesh.scale.set(1.02, 1.12, 0.84);
    lid.add(lidMesh);
    lid.rotation.x = -0.55; // resting: the lid sits above the eye, just visible
    eye.add(lid);
    // Lower lid shadow line.
    const lower = mesh(new THREE.TorusGeometry(EYE_R * 0.95, 0.003, 6, 24, Math.PI * 0.9), M.skinDark, { shadow: false });
    lower.rotation.z = Math.PI + Math.PI * 0.05;
    lower.position.z = EYE_R * 0.62;
    lower.scale.set(1, 0.8, 1);
    eye.add(lower);
    eyes.push({ group: eye, lid, iris });
  });
  // Brows: thick, straight with a slight arch.
  [-1, 1].forEach((side) => {
    const brow = mesh(capsule(0.012, 0.06, 10, 4), M.brow, { shadow: false });
    brow.rotation.z = Math.PI / 2 + side * 0.18;
    brow.position.set(side * 0.056, 0.2, 0.113);
    head.add(brow);
  });
  // Nose.
  const nose = mesh(sphere(0.019, 18, 12), M.skinDark, { shadow: false });
  nose.scale.set(0.85, 1.05, 0.9);
  nose.position.set(0, 0.125, 0.14);
  head.add(nose);
  // Moustache: two strokes dipping outward from the centre.
  [-1, 1].forEach((side) => {
    const m = mesh(capsule(0.0095, 0.034, 10, 4), M.brow, { shadow: false });
    m.rotation.z = Math.PI / 2 + side * 0.38;
    m.position.set(side * 0.023, 0.084, 0.131);
    head.add(m);
  });
  // Mouth: a thin smile.
  const mouth = mesh(new THREE.TorusGeometry(0.022, 0.0035, 8, 24, Math.PI * 0.75), M.mouth, { shadow: false });
  mouth.rotation.z = Math.PI + Math.PI * 0.125;
  mouth.position.set(0, 0.075, 0.126);
  mouth.scale.set(1, 0.6, 1);
  head.add(mouth);
  // Stubble shadow on the chin.
  const stubble = mesh(sphere(0.075, 24, 16), new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false }), { shadow: false });
  stubble.scale.set(1.05, 0.55, 0.9);
  stubble.position.set(0, 0.045, 0.045);
  head.add(stubble);

  // Hair: a base cap plus a cloud of curls on the upper half of the head.
  const hair = new THREE.Group();
  hair.position.set(0, 0.2, -0.01);
  head.add(hair);
  const cap = mesh(new THREE.SphereGeometry(HEAD_R * 1.1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair, { outline: 0.02 });
  cap.scale.set(1.06, 0.92, 1.0);
  cap.position.y = -0.02;
  hair.add(cap);
  const curlGeo = sphere(1, 16, 12);
  // Deterministic placement so the hair looks the same on every load.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const curls = [];
  const CURLS = 110;
  for (let i = 0; i < CURLS; i++) {
    // Direction on the upper hemisphere, biased toward the top and sides.
    const u = rnd();
    const v = rnd();
    const theta = u * Math.PI * 2;
    const y = 0.08 + v * 0.92; // 0.08 keeps the hairline above the ears
    const rxz = Math.sqrt(1 - y * y);
    const dir = new THREE.Vector3(Math.cos(theta) * rxz, y, Math.sin(theta) * rxz);
    // Keep the forehead clear: curls at the front sit higher.
    if (dir.z > 0.55 && y < 0.5) {
      dir.y += 0.45;
      dir.normalize();
    }
    const r = HEAD_R * (1.12 + rnd() * 0.2) + (dir.y > 0.75 ? 0.02 : 0);
    const size = 0.034 + rnd() * 0.03 + (dir.y > 0.6 ? 0.012 : 0);
    const c = mesh(curlGeo, M.hair, { shadow: i % 3 === 0 });
    c.position.copy(dir).multiplyScalar(r).add(new THREE.Vector3(0, -0.03, 0));
    c.position.x *= 1.1;
    c.scale.set(size * (0.9 + rnd() * 0.3), size, size * (0.9 + rnd() * 0.3));
    c.rotation.set(rnd() * 3, rnd() * 3, 0);
    hair.add(c);
    curls.push({ mesh: c, phase: rnd() * Math.PI * 2, base: c.position.clone() });
  }

  // ---------- Animation state ----------
  const state = {
    look: new THREE.Vector2(0, 0),
    lookTarget: new THREE.Vector2(0, 0),
    blink: 0, // 0 open → 1 closed
    nextBlink: 2 + Math.random() * 3,
    wave: 0, // 0 → 1 over a wave
    waving: false,
    idle: 1, // amplitude of idle motion (faded out for the close-up)
  };
  const setLook = (x, y) => state.lookTarget.set(x, y);
  const wave = () => {
    if (!state.waving) {
      state.waving = true;
      state.wave = 0;
    }
  };

  const ease = (x) => x * x * (3 - 2 * x);
  const update = ({ time, dt, idle = 1, look = 1 }) => {
    const motion = reducedMotion ? 0 : 1;
    state.idle += (idle - state.idle) * (1 - Math.pow(0.02, dt));
    const a = state.idle * motion;

    // Breathing and weight shift.
    const breath = Math.sin(time * 1.6) * 0.5 + 0.5;
    torso.position.y = breath * 0.006 * a;
    torso.scale.set(1 + breath * 0.012 * a, 1 + breath * 0.008 * a, 1 + breath * 0.02 * a);
    hips.rotation.z = Math.sin(time * 0.55) * 0.012 * a;
    hips.position.x = Math.sin(time * 0.55) * 0.008 * a;
    hips.rotation.y = Math.sin(time * 0.37) * 0.03 * a;
    legs[0].rotation.z = -hips.rotation.z * 0.5;
    legs[1].rotation.z = -hips.rotation.z * 0.5;
    legs[0].rotation.x = Math.sin(time * 0.55 + 1) * 0.01 * a;

    // Head look: the cursor target, with a soft overshoot. The amplitude
    // fades as the camera comes in so the eye holds still.
    state.look.lerp(state.lookTarget, 1 - Math.pow(0.004, dt));
    const yaw = state.look.x * 0.55 * look;
    const pitch = state.look.y * 0.3 * look;
    neck.rotation.set(pitch * 0.35, yaw * 0.35, 0);
    head.rotation.set(pitch * 0.65 + Math.sin(time * 0.9) * 0.012 * a, yaw * 0.65 + Math.sin(time * 0.7) * 0.02 * a, -yaw * 0.08 + Math.sin(time * 0.45) * 0.015 * a);
    // Eyes lead the head a little.
    eyes.forEach(({ group }) => {
      group.rotation.set(-pitch * 0.25, yaw * 0.35, 0);
    });

    // Blink.
    state.nextBlink -= dt;
    if (state.nextBlink <= 0) {
      state.blink = 0.0001;
      state.nextBlink = 2.5 + Math.random() * 4;
    }
    if (state.blink > 0) {
      state.blink += dt * 7;
      if (state.blink >= 2) state.blink = 0;
    }
    const closed = state.blink > 0 ? Math.sin(Math.min(state.blink, 2) * Math.PI * 0.5) : 0;
    eyes.forEach(({ lid }) => {
      lid.rotation.x = -0.55 + ease(Math.min(closed, 1)) * 1.6;
    });

    // Arms: hang with a little sway; the right arm waves on request.
    const sway = Math.sin(time * 0.8) * 0.03 * a;
    arms[-1].shoulder.rotation.set(sway, 0, 0.12 + Math.sin(time * 0.6) * 0.015 * a);
    arms[-1].elbow.rotation.set(0.1, 0, 0.05);
    let rz = -0.12 - Math.sin(time * 0.6 + 1) * 0.015 * a;
    let rx = -sway;
    let ez = -0.05;
    let ex = 0.1;
    if (state.waving) {
      state.wave += dt / 2.2;
      const w = state.wave;
      const up = ease(Math.min(w / 0.22, 1)) * (1 - ease(Math.max(0, (w - 0.78) / 0.22)));
      rz = rz * (1 - up) + -2.55 * up;
      rx = rx * (1 - up) + -0.25 * up;
      ex = ex * (1 - up) + 0.1 * up;
      ez = ez * (1 - up) + (-0.9 + Math.sin(w * Math.PI * 8) * 0.55) * up;
      head.rotation.z += 0.12 * up;
      if (w >= 1) state.waving = false;
    }
    arms[1].shoulder.rotation.set(rx, 0, rz);
    arms[1].elbow.rotation.set(ex, 0, ez);

    // Hair: curls jiggle slightly with the head.
    curls.forEach(({ mesh: c, phase, base }, i) => {
      if (i % 2) return;
      c.position.x = base.x + Math.sin(time * 2.1 + phase) * 0.0015 * a;
      c.position.y = base.y + Math.sin(time * 1.7 + phase * 1.3) * 0.0015 * a;
    });
  };

  // World-space landmarks for the camera, read after updateMatrixWorld.
  const v = new THREE.Vector3();
  const landmarks = {
    eye: new THREE.Vector3(),
    face: new THREE.Vector3(),
    irisRadius: IRIS_R,
    headTop: new THREE.Vector3(),
    update: () => {
      // The viewer's left eye (character's right), iris surface.
      const e = eyes[1];
      v.set(0, 0, EYE_R * 0.8 + 0.006);
      e.group.localToWorld(v);
      landmarks.eye.copy(v);
      v.set(0, 0.13, 0.13);
      head.localToWorld(v);
      landmarks.face.copy(v);
      v.set(0, 0.42, 0);
      head.localToWorld(v);
      landmarks.headTop.copy(v);
    },
  };

  const dispose = () => {
    root.traverse((o) => o.geometry && o.geometry.dispose());
    materials.forEach((m) => m.dispose());
  };

  return { group: root, head, neck, eyes, update, setLook, wave, landmarks, dispose, materials };
};
