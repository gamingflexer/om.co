import { glareTexture, lerp, pointsMaterial, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";
import { makeEjecta } from "./supernova";

// A pulsar: the neutron star left by the supernova, at the centre of its
// remnant (like the Crab). The stage opens where the supernova stage ends,
// outside the remnant's filaments, flies through them to the star, then
// backs far away until the remnant is a smudge with a blinking point in it,
// ready for the Milky Way.
// Physics, slowed down to be watchable (a young pulsar like the Crab spins
// 30 times a second): two beams along a magnetic axis tilted from the spin
// axis sweep round like a lighthouse, so we see a flash each time one
// crosses us; the dipole field co-rotates; the pulsar wind blows an
// equatorial torus whose wisps ripple outward, and two jets run along the
// spin axis. Units: star radius = 1 (the remnant is not to scale).
export const createPulsar = async (THREE, { tier, small, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20000);
  const sky = await createSky(THREE, { radius: 9000, tier, intensity: 0.45 });
  // Same patch of sky as the supernova stage: it is the same place.
  sky.group.rotation.set(0.7, 1.9, 0.2);
  scene.add(sky.group);

  const spin = new THREE.Group(); // rotates about Y
  scene.add(spin);
  const mag = new THREE.Group(); // magnetic axis, tilted inside the spin frame
  mag.rotation.z = 0.62;
  spin.add(mag);

  // Neutron star: tiny, blazing blue-white, mostly seen as its glare.
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.45, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.2) }));
  scene.add(star);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTexture(THREE, 512), color: 0xcfe0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glare.scale.setScalar(6);
  scene.add(glare);

  // Beams: open cones along ±magnetic axis with streaky, animated emission.
  const beamUniforms = { time: { value: 0 }, fade: { value: 1 } };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp float; uniform float time, fade; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float edge = pow(1.0 - abs(dot(normalize(vN), V)), 1.2); // brighter through the thick middle
        float along = vUv.y; // 0 at the pole, 1 at the far end
        float streak = noise(vec2(vUv.x * 10.0, along * 5.0 - time * 1.2)) * 0.6 + noise(vec2(vUv.x * 30.0 + 3.0, along * 14.0 - time * 2.2)) * 0.4;
        // Smooth fall-off along the beam and soft edges; the streaks only
        // modulate gently so the beam reads as a glow, not a striped tube.
        float a = pow(1.0 - along, 1.6) * (0.2 + 0.8 * edge) * (0.7 + 0.3 * streak);
        a *= smoothstep(0.0, 0.08, along);
        vec3 col = mix(vec3(0.6, 0.78, 1.0), vec3(0.92, 0.96, 1.0), streak);
        gl_FragColor = vec4(col * a * 0.45 * fade, a * fade * 0.4);
      }`,
  });
  const beamGeo = new THREE.CylinderGeometry(0.3, 1.6, 60, 48, 1, true);
  beamGeo.translate(0, 30, 0);
  const beamUp = new THREE.Mesh(beamGeo, beamMat);
  const beamDown = new THREE.Mesh(beamGeo, beamMat);
  beamDown.rotation.z = Math.PI;
  mag.add(beamUp, beamDown);
  // Core of each beam: a thin bright column.
  const coreGeo = new THREE.CylinderGeometry(0.08, 0.4, 60, 24, 1, true);
  coreGeo.translate(0, 30, 0);
  const coreMat = beamMat.clone();
  coreMat.uniforms = beamUniforms;
  const coreUp = new THREE.Mesh(coreGeo, coreMat);
  const coreDown = new THREE.Mesh(coreGeo, coreMat);
  coreDown.rotation.z = Math.PI;
  mag.add(coreUp, coreDown);

  // Polar jets along the spin axis (fixed, not spinning with the beams).
  const jetUniforms = { time: beamUniforms.time, fade: { value: 0.55 } };
  const jetMat = beamMat.clone();
  jetMat.uniforms = jetUniforms;
  const jetGeo = new THREE.CylinderGeometry(0.12, 0.9, 26, 24, 1, true);
  jetGeo.translate(0, 13, 0);
  const jetUp = new THREE.Mesh(jetGeo, jetMat);
  const jetDown = new THREE.Mesh(jetGeo, jetMat);
  jetDown.rotation.z = Math.PI;
  scene.add(jetUp, jetDown);

  // The supernova remnant around it, matching the end of the previous stage
  // (shell radius 46 seen from 150 there; ×8.7 here).
  const REM = 400;
  const remnant = makeEjecta(THREE, { count: small ? 20000 : 60000, hazeStride: small ? 4 : 1 });
  remnant.uniforms.R.value = REM;
  remnant.uniforms.age.value = 1;
  remnant.uniforms.fade.value = 1;
  scene.add(remnant.group);

  // Wisps: rings of the pulsar wind that ripple outward in the equatorial
  // plane, through the torus.
  const ringUniforms = { fade: { value: 1 } };
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { ...ringUniforms, k: { value: 0 }, seed: { value: 0 }, time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      precision highp float; uniform float fade, k, seed, time; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 q = (vUv - 0.5) * 2.0; float r = length(q);
        float ang = atan(q.y, q.x);
        // A thin, slightly wobbly filament of plasma whose brightness varies
        // round the ring, inside a much fainter wide halo.
        float wob = (noise(vec2(ang * 1.6 + seed * 7.0, time * 0.3)) - 0.5) * 0.04;
        float r0 = 0.8 + wob;
        float bright = 0.45 + 0.55 * noise(vec2(ang * 3.0 + seed * 11.0, seed));
        float core = exp(-pow((r - r0) / 0.018, 2.0)) * bright;
        float halo = 0.18 * exp(-pow((r - r0) / 0.09, 2.0)) + 0.05 * exp(-pow((r - r0) / 0.25, 2.0));
        float ring = core + halo;
        vec3 col = mix(vec3(0.55, 0.78, 1.0), vec3(0.9, 0.94, 1.0), k * 0.6 + core * 0.4);
        gl_FragColor = vec4(col * ring * fade * 1.3, ring * fade);
      }`,
  });
  const RINGS = 8;
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const m = ringMat.clone();
    m.uniforms = { fade: { value: 1 }, k: { value: (i % RINGS) / RINGS }, seed: { value: i * 0.37 }, time: { value: 0 } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    mesh.renderOrder = 2;
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    rings.push({ mesh, i });
  }

  // Dipole field lines in the magnetic frame: r = L sin²θ.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5a86d8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let L = 2.2; L <= 7; L += 1.6) {
    for (let a = 0; a < 6; a++) {
      const pts = [];
      for (let k = 0; k <= 64; k++) {
        const th = 0.12 + (k / 64) * (Math.PI - 0.24);
        const rr = L * Math.sin(th) * Math.sin(th);
        if (rr < 1.02) continue;
        const az = (a / 6) * Math.PI * 2;
        pts.push(new THREE.Vector3(rr * Math.sin(th) * Math.cos(az), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(az)));
      }
      mag.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
  }

  // Pulsar wind nebula: an equatorial torus of faint blue haze plus a soft
  // bubble, as particles.
  const pn = small ? 9000 : 24000;
  const ppos = new Float32Array(pn * 3);
  const pcol = new Float32Array(pn * 3);
  const psize = new Float32Array(pn);
  const pphase = new Float32Array(pn);
  for (let i = 0; i < pn; i++) {
    const torus = i < pn * 0.6;
    let x, y, z;
    if (torus) {
      const a = Math.random() * Math.PI * 2;
      const rr = 6 + Math.random() * 6;
      x = Math.cos(a) * rr;
      z = Math.sin(a) * rr;
      y = (Math.random() - 0.5) * 2.2 * (rr / 8);
    } else {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const d = 8 + Math.pow(Math.random(), 0.6) * 24;
      x = Math.sin(ph) * Math.cos(th) * d;
      y = Math.cos(ph) * d;
      z = Math.sin(ph) * Math.sin(th) * d;
    }
    ppos.set([x, y, z], i * 3);
    const b = torus ? 0.5 + 0.5 * Math.random() : 0.2 + 0.3 * Math.random();
    pcol.set([b * 0.45, b * 0.65, b], i * 3);
    psize[i] = 0.4 + Math.random() * 1.2;
    pphase[i] = Math.random() * 6.28;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  pgeo.setAttribute("color", new THREE.BufferAttribute(pcol, 3));
  pgeo.setAttribute("size", new THREE.BufferAttribute(psize, 1));
  pgeo.setAttribute("phase", new THREE.BufferAttribute(pphase, 1));
  const pmat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.0, falloff: 1.6 }), intensity: 0.1, minPx: 1, maxPx: 7 });
  const nebula = new THREE.Points(pgeo, pmat);
  nebula.frustumCulled = false;
  scene.add(nebula);
  // The diffuse synchrotron glow of the wind nebula: a flattened soft haze
  // round the equator, in place of the big blue blobs.
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(THREE, { core: 0.0, falloff: 1.3, size: 256 }), color: 0x3b5a9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.16 }));
  haze.scale.set(22, 11, 1);
  scene.add(haze);

  // Lighthouse flash when a beam points at the camera.
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(THREE, { core: 1.0, falloff: 1.5 }), color: 0xe8f0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(flash);

  const dir = new THREE.Vector3();
  const beamDir = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    sky.setTime(time);
    beamUniforms.time.value = time;
    spin.rotation.y = reducedMotion ? 0.5 : time * 3.4; // ~0.54 rev/s
    // Wisps: each grows from just outside the star to past the torus,
    // fading as it goes (the ring's radius is 0.4 of the plane's size).
    rings.forEach(({ mesh, i }) => {
      const u = reducedMotion ? i / RINGS : (time * 0.25 + i / RINGS) % 1;
      const s = 7 + u * 60;
      mesh.scale.set(s, s, 1);
      mesh.material.uniforms.time.value = time;
      // Faint: the Crab's wisps are ripples in the wind, not solid rings.
      mesh.material.uniforms.fade.value = smoothstep(0.0, 0.08, u) * (1 - smoothstep(0.35, 1.0, u)) * 0.22;
    });
    // Camera: from outside the remnant (where the supernova stage left us),
    // through its filaments to the star, a slow pass round it while the
    // beams sweep, then far back out until the remnant is a smudge.
    const d = track([[0, 1300], [0.1, 1100], [0.4, 26], [0.52, 16], [0.66, 18], [0.8, 400], [1, 7000]], t, { log: true });
    const az = lerp(1.1, 2.6, t);
    const el = track([[0, 0.42], [0.4, 0.14], [0.66, 0.2], [1, 0.5]], t);
    dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.copy(dir).multiplyScalar(d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    sky.group.position.copy(camera.position);
    remnant.uniforms.time.value = time;
    remnant.uniforms.scale.value = 500;
    // Flash: how directly either beam points at us.
    beamDir.set(0, 1, 0).applyQuaternion(mag.getWorldQuaternion(new THREE.Quaternion()));
    toCam.copy(camera.position).normalize();
    const align = Math.abs(beamDir.dot(toCam));
    const pulse = Math.pow(smoothstep(0.86, 0.995, align), 2.0);
    flash.material.opacity = pulse * 0.9;
    // Close in the flash fills the view; from far off it stays a blink.
    flash.scale.setScalar(lerp(10, 50, pulse) * Math.min(d / 20, 1 + d * 0.0015));
    // Far off the star is a point that blinks: keep the glare a few pixels.
    glare.scale.setScalar(Math.max(6, d * 0.012) + (10 + d * 0.03) * pulse);
    beamUniforms.fade.value = 1;
    pmat.uniforms.scale.value = 500;
    pmat.uniforms.time.value = time;
    sky.setScale(600);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
