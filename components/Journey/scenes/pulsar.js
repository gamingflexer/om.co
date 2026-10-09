import { glareTexture, lerp, pointsMaterial, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";

// A pulsar: the neutron star left by the supernova. Two radio beams along a
// tilted magnetic axis sweep round as the star spins, so the beam flashes
// across the camera like a lighthouse, and rings of plasma pulse away from
// the poles up and down the spin axis. A faint wind nebula and dipole field
// lines sit around it. Units: star radius = 1.
export const createPulsar = async (THREE, { tier, small, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20000);
  const sky = await createSky(THREE, { radius: 9000, tier, intensity: 0.45 });
  sky.group.rotation.set(1.4, 0.6, 0.9);
  scene.add(sky.group);

  const spin = new THREE.Group(); // rotates about Y
  scene.add(spin);
  const mag = new THREE.Group(); // magnetic axis, tilted inside the spin frame
  mag.rotation.z = 0.62;
  spin.add(mag);

  // Neutron star: tiny, blazing blue-white.
  const star = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.2) }));
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

  // Pulse rings: travel out from the poles along the spin axis, up and down.
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
  const RINGS = 9;
  const rings = [];
  for (let i = 0; i < RINGS * 2; i++) {
    const m = ringMat.clone();
    m.uniforms = { fade: { value: 1 }, k: { value: (i % RINGS) / RINGS }, seed: { value: i * 0.37 }, time: { value: 0 } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    mesh.renderOrder = 2;
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    rings.push({ mesh, i: i % RINGS, dirY: i < RINGS ? 1 : -1 });
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
    // Rings: each travels from the pole outward, spreading and fading.
    rings.forEach(({ mesh, i, dirY }) => {
      const u = reducedMotion ? i / RINGS : (time * 0.4 + i / RINGS) % 1;
      const y = dirY * (1.5 + u * u * 34);
      mesh.position.set(0, y, 0);
      const s = 2.5 + u * 14;
      mesh.scale.set(s, s, 1);
      mesh.material.uniforms.time.value = time;
      mesh.material.uniforms.fade.value = smoothstep(0.0, 0.08, u) * (1 - smoothstep(0.5, 1.0, u)) * 0.7;
    });
    // Camera: start close above the equator, then pull back and rise so the
    // rings are seen stacking up and down the axis.
    const d = track([[0, 15], [0.5, 30], [1, 60]], t, { log: true });
    const az = lerp(0.4, 1.9, t);
    const el = track([[0, 0.12], [0.5, 0.2], [1, 0.38]], t);
    dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.copy(dir).multiplyScalar(d);
    camera.lookAt(0, lerp(0, 2, t), 0);
    camera.updateProjectionMatrix();
    // Flash: how directly either beam points at us.
    beamDir.set(0, 1, 0).applyQuaternion(mag.getWorldQuaternion(new THREE.Quaternion()));
    toCam.copy(camera.position).normalize();
    const align = Math.abs(beamDir.dot(toCam));
    const pulse = Math.pow(smoothstep(0.86, 0.995, align), 2.0);
    flash.material.opacity = pulse * 0.9;
    flash.scale.setScalar(lerp(10, 50, pulse) * (d / 20));
    glare.scale.setScalar(6 + 10 * pulse);
    beamUniforms.fade.value = 1;
    pmat.uniforms.scale.value = 500;
    pmat.uniforms.time.value = time;
    sky.setScale(600);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
