import { clamp, lerp, smoothstep, track } from "../util";

// Om (public/models/om.glb, static pose) standing on a grassy meadow. The sky,
// sun/moon and light follow the time of day in IST. His head follows the
// cursor. The camera path runs from a wide shot down into one eye (t 0 → 1);
// the reverse stage uses the same path with 1 - t.

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

export const createMeadow = (THREE, { renderer, small, reducedMotion, deps }) => {
  const { GLTFLoader, MeshoptDecoder, RoomEnvironment } = deps;
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

  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 200);
  const wideTarget = new THREE.Vector3(0, 0.95, 0);
  let wideDist = 4.5;
  const resize = (w, h) => {
    const aspect = w / h;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(30) / 2);
    wideDist = Math.max(2.4 / (2 * halfTan), 1.6 / (2 * halfTan * aspect));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };

  const charMats = [];
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
    charMats.forEach((mat) => { mat.emissiveIntensity = num("emissive"); });
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

  // Head/neck turn, recomputed from the rest pose every frame.
  let head, neck, headRest, neckRest, headParentQ, neckParentQ;
  const qWorld = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const turn = (bone, rest, parentQ, yaw, pitch) => {
    euler.set(pitch, yaw, 0);
    qWorld.setFromEuler(euler);
    qLocal.copy(parentQ).invert().multiply(qWorld).multiply(parentQ);
    bone.quaternion.copy(qLocal).multiply(rest);
  };

  // Landmarks found from the mesh once it loads (world space, rest pose).
  const eye = new THREE.Vector3(0.03, 1.62, 0.1);
  const face = new THREE.Vector3(0, 1.58, 0.08);
  let character = null;
  let skinned = null;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ready = new Promise((resolve) => {
    loader.load("/models/om.glb", (gltf) => {
      character = gltf.scene;
      character.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          o.material.emissive = new THREE.Color(0xffffff);
          o.material.emissiveMap = o.material.map;
          if (o.material.map) o.material.map.anisotropy = 8;
          // The atlas is a front/back projection, so the sides of the head
          // and neck pick up dark hair/background texels. A per-vertex skin
          // mask (set below) lets the shader pull those texels back to skin.
          o.material.onBeforeCompile = (shader) => {
            shader.vertexShader =
              "attribute float skinMask; varying float vSkin;\n" +
              shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vSkin = skinMask;");
            shader.fragmentShader =
              "varying float vSkin;\nvec3 fixSkin(vec3 c){ float lum = dot(c, vec3(0.3, 0.59, 0.11)); float dark = 1.0 - smoothstep(0.045, 0.16, lum); return mix(c, vec3(0.5, 0.2, 0.11), dark * vSkin); }\n" +
              shader.fragmentShader
                .replace("#include <map_fragment>", "#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D(map, vMapUv);\n sampledDiffuseColor.rgb = fixSkin(sampledDiffuseColor.rgb);\n diffuseColor *= sampledDiffuseColor;\n#endif")
                .replace("#include <emissivemap_fragment>", "#ifdef USE_EMISSIVEMAP\n vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);\n emissiveColor.rgb = fixSkin(emissiveColor.rgb);\n totalEmissiveRadiance *= emissiveColor.rgb;\n#endif");
          };
          o.material.needsUpdate = true;
          charMats.push(o.material);
          skinned = o;
        }
      });
      scene.add(character);
      const mixer = new THREE.AnimationMixer(character);
      const pose = THREE.AnimationClip.findByName(gltf.animations, "pose");
      if (pose) {
        mixer.clipAction(pose).play();
        mixer.update(0);
      }
      character.updateMatrixWorld(true);
      head = character.getObjectByName("head");
      neck = character.getObjectByName("neck");
      headRest = head.quaternion.clone();
      neckRest = neck.quaternion.clone();
      headParentQ = head.parent.getWorldQuaternion(new THREE.Quaternion());
      neckParentQ = neck.parent.getWorldQuaternion(new THREE.Quaternion());

      // Locate the eye and the face centre from the atlas UVs (the texture is
      // a front projection, so the iris pixels map to the eye vertices).
      if (skinned && skinned.geometry.attributes.uv) {
        // Bone matrices are only filled on render; compute them now so the
        // skinned vertex positions reflect the pose.
        if (skinned.skeleton) skinned.skeleton.update();
        const uv = skinned.geometry.attributes.uv;
        const v = new THREE.Vector3();
        const findUv = (cu, cv, rad) => {
          const acc = new THREE.Vector3();
          let n = 0;
          for (let i = 0; i < uv.count; i++) {
            const du = uv.getX(i) - cu;
            const dv = uv.getY(i) - cv;
            if (du * du + dv * dv < rad * rad) {
              skinned.getVertexPosition(i, v);
              skinned.localToWorld(v);
              acc.add(v);
              n++;
            }
          }
          return n ? acc.multiplyScalar(1 / n) : null;
        };
        // glTF UVs have their origin at the top-left of the atlas.
        // Skin mask: sides of the face below the hairline, the ears and the
        // neck (never the front, where brows, moustache and stubble live).
        const mask = new Float32Array(uv.count);
        for (let i = 0; i < uv.count; i++) {
          skinned.getVertexPosition(i, v);
          skinned.localToWorld(v);
          const side = Math.abs(v.x) > 0.048 && v.y > 1.36 && v.y < 1.58;
          const neck = v.y > 1.3 && v.y < 1.44 && Math.abs(v.x) < 0.1 && v.z > -0.08;
          const front = v.z > 0.035 && Math.abs(v.x) < 0.07 && v.y > 1.44;
          mask[i] = (side || neck) && !front ? 1 : 0;
        }
        skinned.geometry.setAttribute("skinMask", new THREE.BufferAttribute(mask, 1));
        const e1 = findUv(0.2344, 0.1503, 0.006);
        const e2 = findUv(0.2668, 0.1483, 0.006);
        const nose = findUv(0.2505, 0.175, 0.006);
        if (e1) eye.copy(e1);
        if (e1 && e2 && nose) face.copy(e1).add(e2).add(nose).multiplyScalar(1 / 3);
        else if (e1 && e2) face.copy(e1).add(e2).multiplyScalar(0.5);
      }
      applyTime();
      resolve();
    }, undefined, () => resolve());
  });

  const pointer = new THREE.Vector2(0, 0);
  const look = new THREE.Vector2(0, 0);
  const setPointer = (x, y) => pointer.set(x, y);

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const update = ({ t, dt, time, reverse }) => {
    grassUniforms.time.value = time;
    // Head follows the cursor; the amplitude fades as the camera closes in.
    if (head && neck) {
      look.lerp(pointer, 1 - Math.pow(0.004, dt));
      const amp = 1 - smoothstep(0.3, 0.7, t);
      const yaw = look.x * 0.5 * amp;
      const pitch = look.y * 0.3 * amp;
      turn(neck, neckRest, neckParentQ, yaw * 0.35, pitch * 0.35);
      turn(head, headRest, headParentQ, yaw * 0.65, pitch * 0.65);
    }
    // Camera: wide → chest → face → eye.
    // On the way back out, Om drifts to the right so the footer text has room.
    const wideShift = 0.95 * clamp((camera.aspect - 0.6) / 1.0, 0, 1);
    const shift = reverse ? -wideShift * (1 - smoothstep(0.0, 0.35, t)) : 0;
    const wide = [shift, 1.25, wideDist];
    const chest = [0, 1.42, 2.3];
    const faceCam = [face.x, face.y + 0.01, face.z + 0.5];
    const eyeCam = [eye.x, eye.y, eye.z + 0.06];
    // The last stretch holds on the eye so the iris cross-fade lands on it.
    const p = track([[0, wide], [0.38, chest], [0.7, faceCam], [0.9, eyeCam], [1, eyeCam]], t);
    const wt = [wideTarget.x + shift, wideTarget.y, wideTarget.z];
    const eyeT = [eye.x, eye.y, eye.z];
    const tg = track([[0, wt], [0.38, [0, 1.35, 0]], [0.7, [face.x, face.y, face.z]], [0.9, eyeT], [1, eyeT]], t);
    camPos.set(p[0], p[1], p[2]);
    camTarget.set(tg[0], tg[1], tg[2]);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.fov = lerp(30, 34, smoothstep(0.7, 0.9, t));
    camera.near = lerp(0.1, 0.01, smoothstep(0.6, 1, t));
    camera.updateProjectionMatrix();
    tmp.copy(camPos);
  };

  const dispose = () => {
    clearInterval(timeTimer);
    pmrem.dispose();
    disc.dispose();
  };

  return { scene, camera, update, resize, ready, dispose, setPointer, landmarks: { eye, face } };
};
