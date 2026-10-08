import { glareTexture, lerp, pointsMaterial, rng, smoothstep, spriteTexture, track } from "../util";
import { createSky } from "./sky";

// A core-collapse supernova. A blue supergiant brightens, the core gives way in
// a white flash, and an ejecta shell races outward: white-hot at first, then
// cooling to yellow, orange and the red/teal filaments of a remnant. A flat
// shock front sweeps the equatorial plane and lights up a ring of old
// circumstellar gas when it reaches it (as around SN 1987A).
// Units: progenitor radius = 1.
export const createSupernova = async (THREE, { tier, small, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20000);
  const sky = await createSky(THREE, { radius: 9000, tier, intensity: 0.5 });
  sky.group.rotation.set(0.7, 1.9, 0.2);
  scene.add(sky.group);

  // Progenitor: limb-darkened blue-white star.
  const starUniforms = { time: { value: 0 }, heat: { value: 0 } };
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vP; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        precision highp float; uniform float time, heat; varying vec3 vN; varying vec3 vW; varying vec3 vP;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float mu = max(dot(normalize(vN), V), 0.0);
          float limb = 0.35 + 0.65 * pow(mu, 0.6);
          float g = noise(vP * 6.0 + time * 0.05) * 0.6 + noise(vP * 18.0 - time * 0.08) * 0.4;
          vec3 col = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.98, 0.95), g);
          col *= limb * (2.2 + 6.0 * heat);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(star);
  const glareTex = glareTexture(THREE, 512, false);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTex, color: 0xdde8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(glare);
  // The flash: a huge soft sprite that whites the frame out for a moment.
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(THREE, { core: 1.0, falloff: 1.6 }), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(flash);

  // Ejecta shell: directions on a sphere, clumped by a low-frequency field,
  // with per-particle speed so the shell has thickness.
  const r = rng(42);
  const count = small ? 30000 : 90000;
  const dirs = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const seed = new Float32Array(count);
  const layer = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    dirs.set([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], i * 3);
    const outer = r() < 0.35;
    layer[i] = outer ? 1 : 0;
    speed[i] = outer ? 1.0 + 0.35 * r() : 0.45 + 0.5 * Math.pow(r(), 0.7);
    seed[i] = r();
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute("position", new THREE.BufferAttribute(dirs, 3));
  shellGeo.setAttribute("speed", new THREE.BufferAttribute(speed, 1));
  shellGeo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  shellGeo.setAttribute("layer", new THREE.BufferAttribute(layer, 1));
  const shellUniforms = {
    map: { value: spriteTexture(THREE, { core: 0.5 }) },
    R: { value: 0 }, // shell radius
    age: { value: 0 }, // 0 young → 1 old remnant
    fade: { value: 0 },
    scale: { value: 500 },
    time: { value: 0 },
    haze: { value: 0 },
  };
  const shellMat = new THREE.ShaderMaterial({
    uniforms: shellUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float speed; attribute float seed; attribute float layer;
      uniform float R, age, scale, time, haze;
      varying vec3 vColor; varying float vA;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(position);
        // Clumping: the shell breaks into knots and filaments as it ages.
        float n1 = noise(d * 4.0 + 3.0);
        float n2 = noise(d * 11.0 + 7.0);
        float rr = R * speed * (1.0 + 0.18 * (n1 - 0.5) * age);
        vec3 p = d * rr;
        // Rayleigh–Taylor fingers: radial streaks that grow with age.
        p += d * (n2 - 0.5) * R * 0.25 * age;
        p += vec3(noise(d * 7.0 + 11.0) - 0.5, noise(d * 7.0 + 23.0) - 0.5, noise(d * 7.0 + 37.0) - 0.5) * R * 0.22 * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float px = (0.6 + 1.6 * seed) * (0.08 + 0.05 * R) * scale / max(-mv.z, 0.0001);
        gl_PointSize = haze > 0.5 ? clamp(px * 9.0, 8.0, 90.0) : clamp(px, 1.0, 6.0);
        gl_Position = projectionMatrix * mv;
        // Colour: white → yellow → orange → red; the remnant adds Hα red
        // and O III teal knots.
        float hot = 1.0 - age;
        vec3 young = mix(vec3(1.0, 0.4, 0.12), vec3(1.0, 0.92, 0.78), hot * hot * hot);
        vec3 ha = vec3(1.0, 0.22, 0.12);
        vec3 oiii = vec3(0.25, 0.9, 0.85);
        vec3 old = mix(ha, oiii, step(0.62, n2) * 0.8);
        vColor = mix(young, old, smoothstep(0.45, 0.9, age)) * (0.5 + 0.8 * seed) * (layer > 0.5 ? 0.6 : 1.0);
        // Dimmer as the shell thins; knots survive longest.
        vA = (1.0 - 0.6 * age) * (0.4 + 0.6 * n1) * clamp(px / 1.0, 0.2, 1.0);
        if (haze > 0.5) vA *= 0.05 * (1.0 - 0.5 * age);
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float fade;
      varying vec3 vColor; varying float vA;
      void main(){
        float a = texture2D(map, gl_PointCoord).a;
        gl_FragColor = vec4(vColor * a * vA * fade * 0.7, a * fade * vA * 0.6);
      }`,
  });
  const shell = new THREE.Points(shellGeo, shellMat);
  shell.frustumCulled = false;
  scene.add(shell);
  // The same ejecta as a soft haze so the shell glows as gas rather than dots.
  const hazeMat = shellMat.clone();
  hazeMat.uniforms = { ...shellUniforms, haze: { value: 1 }, map: { value: spriteTexture(THREE, { core: 0.0, falloff: 1.4 }) } };
  const shellHaze = new THREE.Points(shellGeo, hazeMat);
  shellHaze.frustumCulled = false;
  scene.add(shellHaze);
  // Fireball: a hot core that fills the young shell and cools away.
  const fireball = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(THREE, { core: 0.6, falloff: 1.8 }), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(fireball);

  // Equatorial shock front and the circumstellar ring it lights up.
  const ringUniforms = { R: { value: 0 }, lit: { value: 0 }, fade: { value: 0 }, time: { value: 0 } };
  const ringMat = new THREE.ShaderMaterial({
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      precision highp float; uniform float R, lit, fade, time; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 q = (vUv - 0.5) * 2.0;
        float r = length(q) * 60.0;
        float ang = atan(q.y, q.x);
        // Expanding shock: a thin bright rim with a diffuse wake inside.
        float rim = exp(-pow((r - R) / (0.25 + 0.05 * R), 2.0)) * 0.22 * (0.4 + 0.9 * noise(vec2(ang * 13.0, 2.0)));
        float wake = smoothstep(R, R * 0.55, r) * 0.03 * smoothstep(0.0, 4.0, R);
        float shock = (rim + wake) * (0.7 + 0.5 * noise(vec2(ang * 7.0, R * 0.3)));
        vec3 sc = mix(vec3(1.0, 0.7, 0.4), vec3(0.8, 0.9, 1.0), smoothstep(0.0, 25.0, R));
        // Circumstellar ring at r = 24: pearls of gas that glow once hit.
        float pearls = 0.5 + 0.5 * noise(vec2(ang * 11.0, 1.0)) + 0.3 * noise(vec2(ang * 31.0, 3.0));
        float ring = exp(-pow((r - 24.0) / 0.5, 2.0)) * pearls * pearls * lit;
        vec3 rc = vec3(1.0, 0.5, 0.35) * 0.9;
        vec3 col = sc * shock + rc * ring;
        float a = clamp(shock + ring, 0.0, 1.0) * fade;
        gl_FragColor = vec4(col * fade, a);
      }`,
  });
  const ringPlane = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), ringMat);
  ringPlane.rotation.x = -Math.PI / 2 + 0.35;
  ringPlane.rotation.y = 0.25;
  scene.add(ringPlane);

  // Faint distant stars of the host arm so the pull-back has depth.
  const fn = small ? 3000 : 8000;
  const fpos = new Float32Array(fn * 3);
  const fcol = new Float32Array(fn * 3);
  const fsize = new Float32Array(fn);
  const fphase = new Float32Array(fn);
  for (let i = 0; i < fn; i++) {
    const d = 80 + Math.pow(r(), 0.5) * 900;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(2 * r() - 1);
    fpos.set([Math.sin(ph) * Math.cos(th) * d, Math.cos(ph) * d * 0.5, Math.sin(ph) * Math.sin(th) * d], i * 3);
    const b = 0.3 + 0.7 * Math.pow(r(), 2.5);
    fcol.set([b, b * 0.95, b * (0.8 + 0.3 * r())], i * 3);
    fsize[i] = 0.3 + Math.pow(r(), 3) * 1.5;
    fphase[i] = r() * 6.28;
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  fgeo.setAttribute("size", new THREE.BufferAttribute(fsize, 1));
  fgeo.setAttribute("phase", new THREE.BufferAttribute(fphase, 1));
  const fillMat = pointsMaterial(THREE, { map: spriteTexture(THREE, { core: 0.6 }), intensity: 0.9, minPx: 1, maxPx: 6 });
  const filler = new THREE.Points(fgeo, fillMat);
  filler.frustumCulled = false;
  scene.add(filler);

  const dir = new THREE.Vector3();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    sky.setTime(time);
    starUniforms.time.value = time;
    // Timeline: 0–0.22 the star swells and brightens, 0.22–0.3 flash,
    // 0.3–1 the shell expands and cools.
    const blow = smoothstep(0.22, 0.3, t);
    const heat = smoothstep(0.05, 0.24, t) * (1 - blow);
    starUniforms.heat.value = heat;
    const swell = 1 + 0.6 * smoothstep(0.1, 0.25, t);
    star.scale.setScalar(swell * (1 - blow) + 0.001);
    star.visible = blow < 1;
    glare.scale.setScalar(lerp(3.2, 6.0, heat) * (1 - blow) + 0.001);
    glare.material.opacity = 1 - blow;
    const flashI = Math.exp(-Math.pow((t - 0.265) / 0.035, 2.0));
    flash.material.opacity = flashI;
    flash.scale.setScalar(lerp(14, 160, smoothstep(0.22, 0.34, t)));
    // Ejecta: radius grows fast then decelerates as it sweeps up gas.
    const e = smoothstep(0.24, 1.0, t);
    const R = 46 * Math.pow(e, 0.7);
    shellUniforms.R.value = R;
    shellUniforms.age.value = smoothstep(0.42, 1.0, t);
    shellUniforms.fade.value = smoothstep(0.25, 0.32, t);
    shellUniforms.time.value = time;
    const age = shellUniforms.age.value;
    fireball.scale.setScalar(Math.max(0.01, R * 1.25));
    fireball.material.opacity = shellUniforms.fade.value * lerp(0.85, 0.0, smoothstep(0.0, 0.9, age));
    fireball.material.color.setRGB(1.0, lerp(0.95, 0.35, age), lerp(0.85, 0.1, age));
    ringUniforms.R.value = 44 * Math.pow(smoothstep(0.26, 1.0, t), 0.75);
    ringUniforms.lit.value = smoothstep(21, 26, ringUniforms.R.value) * (1 - 0.5 * smoothstep(30, 44, ringUniforms.R.value));
    ringUniforms.fade.value = smoothstep(0.27, 0.34, t);
    ringUniforms.time.value = time;
    // Camera: close on the star, pull back as the shell grows, slow orbit.
    const d = track([[0, 9], [0.24, 7.5], [0.5, 70], [1, 150]], t, { log: true });
    const az = lerp(0.3, 1.1, t) + (reducedMotion ? 0 : time * 0.01);
    const el = lerp(0.25, 0.42, t);
    dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.copy(dir).multiplyScalar(d);
    camera.lookAt(0, 0, 0);
    camera.fov = lerp(42, 48, smoothstep(0.24, 0.3, t));
    camera.updateProjectionMatrix();
    shellUniforms.scale.value = 500;
    fillMat.uniforms.scale.value = 500;
    fillMat.uniforms.time.value = time;
    sky.setScale(600);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
