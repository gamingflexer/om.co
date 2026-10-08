import React, { useEffect, useRef } from "react";

// Full-screen scene: Om (public/models/om.glb, static pose) standing on a
// grassy meadow. The sky, sun/moon and light follow the time of day in IST.
// His head follows the cursor (or the arrow keys).

const NIGHT = {
  zenith: "#050817", mid: "#0b1430", horizon: "#1a2547", glow: "#8090ff", glowI: 0.12,
  grass: "#142a1c", light: "#b4c4ff", lightI: 0.8, envI: 0.22, emissive: 0.14, rimI: 0.25,
};
// Sky/light keyframes over the IST day (hour → palette), blended linearly.
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

// Soft radial disc used for the sun and moon.
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

// A ring of low hills on the horizon; heights from a few sine waves.
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

const Meadow = ({ className = "" }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = Math.min(window.innerWidth, window.innerHeight) < 700;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "3D character of Om Surve standing on a grassy meadow");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xffffff, 8, 42);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      // Sky dome: zenith → mid → horizon gradient plus a glow around the sun.
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

      // Stars, faded in at night.
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(1000 * 3);
      for (let i = 0; i < 1000; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.lerp(0.08, 1, Math.random()));
        starPos.set([80 * Math.sin(phi) * Math.cos(theta), 80 * Math.cos(phi), 80 * Math.sin(phi) * Math.sin(theta)], i * 3);
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, fog: false, depthWrite: false });
      scene.add(new THREE.Points(starGeo, starMat));

      // Sun and moon discs (sprites), drawn behind the hills.
      const disc = discTexture(THREE);
      const sunMat = new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, transparent: true, toneMapped: false });
      const sun = new THREE.Sprite(sunMat);
      sun.renderOrder = -1;
      scene.add(sun);
      const moonMat = new THREE.SpriteMaterial({ map: disc, color: 0xe6ebff, fog: false, depthWrite: false, transparent: true, toneMapped: false });
      const moon = new THREE.Sprite(moonMat);
      moon.renderOrder = -1;
      scene.add(moon);

      // Two rings of distant hills hide the ground's edge and give depth.
      const farHillMat = new THREE.MeshBasicMaterial({ fog: false });
      const nearHillMat = new THREE.MeshBasicMaterial({ fog: false });
      scene.add(new THREE.Mesh(hillRing(THREE, 62, 2.2, 2.6, 1.3), farHillMat));
      scene.add(new THREE.Mesh(hillRing(THREE, 48, 1.1, 1.8, 4.2), nearHillMat));

      const hemi = new THREE.HemisphereLight(0xffffff, 0x335533, 0.6);
      scene.add(hemi);
      // Key light stays in front so the face is always lit; the rim light
      // comes from the sun/moon behind him.
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 20 });
      key.shadow.radius = 5;
      key.shadow.bias = -0.0005;
      scene.add(key, key.target);
      const rim = new THREE.DirectionalLight(0xffffff, 0.5);
      scene.add(rim, rim.target);
      const fill = new THREE.DirectionalLight(0xffffff, 0.3);
      fill.position.set(-1, 1.6, 4);
      scene.add(fill);

      // Ground with a soft noise texture.
      const tex = document.createElement("canvas");
      tex.width = tex.height = 256;
      const ctx = tex.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5000; i++) {
        const g = 100 + Math.random() * 70;
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      const groundTex = new THREE.CanvasTexture(tex);
      groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(40, 40);
      const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Grass blades, instanced, with a gentle wind sway.
      const bladeGeo = new THREE.BufferGeometry();
      bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.018, 0, 0, 0.018, 0, 0, -0.012, 0.5, 0, 0.012, 0.5, 0, 0, 1, 0], 3));
      bladeGeo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
      bladeGeo.computeVertexNormals();
      const grassUniforms = { time: { value: 0 }, sway: { value: reducedMotion ? 0 : 1 } };
      const bladeMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
      bladeMat.onBeforeCompile = (shader) => {
        shader.uniforms.time = grassUniforms.time;
        shader.uniforms.sway = grassUniforms.sway;
        shader.vertexShader = "uniform float time; uniform float sway;\n" + shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);\nfloat k = position.y * position.y;\ntransformed.x += sway * k * 0.12 * sin(time * 1.6 + wp.x * 0.7 + wp.z * 0.5);\ntransformed.z += sway * k * 0.05 * cos(time * 1.3 + wp.x * 0.4);"
        );
      };
      const count = small ? 9000 : 22000;
      const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        // Denser near the character, thinning out towards the fog; the strip
        // in front of the camera stays low so his feet are visible.
        const r = 0.3 + Math.pow(Math.random(), 1.6) * 11;
        const a = Math.random() * Math.PI * 2;
        const z = Math.sin(a) * r;
        const h = (0.07 + Math.random() * 0.1) * (z > 0.6 ? 0.45 : 1);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * Math.PI);
        m.compose(new THREE.Vector3(Math.cos(a) * r, 0, z), q, new THREE.Vector3(1, h, 1));
        grass.setMatrixAt(i, m);
        c.setHSL(0.27 + Math.random() * 0.06, 0.45 + Math.random() * 0.2, 0.32 + Math.random() * 0.14);
        grass.setColorAt(i, c);
      }
      scene.add(grass);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
      const target = new THREE.Vector3(0, 0.95, 0);
      const resize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        const aspect = w / h;
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const dist = Math.max(2.4 / (2 * halfTan), 1.6 / (2 * halfTan * aspect));
        camera.aspect = aspect;
        camera.position.set(0, 1.25, dist);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      const charMats = [];
      const sunDir = new THREE.Vector3();
      const moonDir = new THREE.Vector3();
      const ca = new THREE.Color();
      const cb = new THREE.Color();

      // Apply the current IST phase to sky, sun/moon, light and materials.
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
        groundMat.color.copy(grassCol);
        bladeMat.color.set(0xffffff).lerp(grassCol, 0.35);
        nearHillMat.color.copy(grassCol).multiplyScalar(0.55).lerp(horizon, 0.38);
        farHillMat.color.copy(grassCol).multiplyScalar(0.55).lerp(horizon, 0.62);
        // Distant ground fades into the near hills, not the bright horizon.
        scene.fog.color.copy(nearHillMat.color);
        hemi.color.copy(skyUniforms.zenith.value).lerp(new THREE.Color(0xffffff), 0.5);
        hemi.groundColor.copy(grassCol);
        hemi.intensity = 0.35 + num("envI") * 0.4;
        key.color.copy(col("light"));
        key.intensity = num("lightI");
        scene.environmentIntensity = num("envI");
        charMats.forEach((mat) => { mat.emissiveIntensity = num("emissive"); });
        starMat.opacity = 0.85 * THREE.MathUtils.clamp((0.5 - num("envI")) / 0.3, 0, 1);

        // Sun: rises on the left, sets on the right, low and behind him.
        const p = (hr - SUNRISE) / (SUNSET - SUNRISE);
        const up = p > -0.06 && p < 1.06;
        const elev = Math.sin(THREE.MathUtils.clamp(p, 0, 1) * Math.PI);
        sunDir.set(THREE.MathUtils.lerp(-0.2, 0.2, p), elev * 0.9 - 0.015, -1).normalize();
        skyUniforms.sunDir.value.copy(sunDir);
        sun.visible = up;
        sun.position.copy(sunDir).multiplyScalar(80);
        const low = 1 - THREE.MathUtils.clamp(elev / 0.35, 0, 1);
        sun.scale.setScalar(14 + low * 8);
        sunMat.color.copy(col("glow")).lerp(new THREE.Color(0xffffff), 0.35 * (1 - low));

        // Moon: crosses the sky from evening to morning.
        const nightLen = 24 - (SUNSET - SUNRISE);
        const qn = ((hr - SUNSET + 24) % 24) / nightLen;
        moonDir.set(THREE.MathUtils.lerp(-0.22, 0.22, qn), 0.07 + Math.sin(qn * Math.PI) * 0.16, -1).normalize();
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

      // Head follows the cursor; arrow keys steer it while held.
      const pointer = new THREE.Vector2(0, 0);
      const look = new THREE.Vector2(0, 0);
      const keys = new Set();
      const onPointerMove = (e) => {
        const r = container.getBoundingClientRect();
        pointer.set(
          THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1),
          THREE.MathUtils.clamp((e.clientY - (r.top + r.height * 0.3)) / (r.height / 2), -1, 1)
        );
      };
      const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      const onKeyDown = (e) => {
        if (!ARROWS.includes(e.key)) return;
        e.preventDefault();
        keys.add(e.key);
      };
      const onKeyUp = (e) => keys.delete(e.key);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // Head/neck turn: recomputed from the rest pose every frame (in the rest
      // parent frame), so rotations can never pile up.
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

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load("/models/om.glb", (gltf) => {
        if (disposed) return;
        const character = gltf.scene;
        character.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.frustumCulled = false;
            // The texture is painted from a lit render, so let part of it
            // glow through instead of shading it twice.
            o.material.emissive = new THREE.Color(0xffffff);
            o.material.emissiveMap = o.material.map;
            charMats.push(o.material);
          }
        });
        scene.add(character);

        // Settle into the relaxed pose once; it never animates after this.
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
        applyTime();
      });

      const clock = new THREE.Clock();
      const goal = new THREE.Vector2();
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.1);
        grassUniforms.time.value += dt;

        if (head && neck) {
          if (keys.size) {
            goal.set(
              (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0),
              (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0)
            );
            pointer.copy(goal);
          }
          look.lerp(pointer, 1 - Math.pow(0.004, dt));
          const yaw = look.x * 0.5;
          const pitch = look.y * 0.3;
          turn(neck, neckRest, neckParentQ, yaw * 0.35, pitch * 0.35);
          turn(head, headRest, headParentQ, yaw * 0.65, pitch * 0.65);
        }
        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        clearInterval(timeTimer);
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        pmrem.dispose();
        disc.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={containerRef} className={className} />;
};

export default Meadow;
