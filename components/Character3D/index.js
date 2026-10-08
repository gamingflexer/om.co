import React, { useEffect, useRef } from "react";

// Animated 3D character (public/models/om.glb): waves once `start` is true,
// idles with breathing, follows the cursor with its head, waves again on tap.
const Character3D = ({ start = true, className = "" }) => {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const startedRef = useRef(false);
  const startRef = useRef(start);

  useEffect(() => {
    startRef.current = start;
    if (start && waveRef.current && !startedRef.current) {
      startedRef.current = true;
      waveRef.current();
    }
  }, [start]);

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
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0xffffff, 0);
      const canvas = renderer.domElement;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Animated 3D character of Om Surve waving");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.85;

      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(0.6, 5, 2.2);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -1.5;
      key.shadow.camera.right = 1.5;
      key.shadow.camera.top = 2.5;
      key.shadow.camera.bottom = -0.5;
      key.shadow.radius = 6;
      key.shadow.bias = -0.0005;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.5);
      fill.position.set(-1, 1.6, 4);
      scene.add(fill);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.ShadowMaterial({ opacity: 0.12 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
      const target = new THREE.Vector3(0, 0.92, 0);
      const controls = new OrbitControls(camera, canvas);
      controls.enableZoom = false;
      controls.enablePan = false;
      // Touch screens keep vertical scrolling (OrbitControls would block it);
      // desktop can drag to turn.
      controls.enabled = !coarsePointer;
      canvas.style.touchAction = coarsePointer ? "pan-y" : "none";
      controls.enableDamping = true;
      controls.minPolarAngle = Math.PI * 0.38;
      controls.maxPolarAngle = Math.PI * 0.55;
      controls.minAzimuthAngle = -Math.PI * 0.3;
      controls.maxAzimuthAngle = Math.PI * 0.3;

      // Fit the whole 1.75 m character (and a raised waving arm) in view.
      const resize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        const aspect = w / h;
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const dist = Math.max(2.15 / (2 * halfTan), 1.95 / (2 * halfTan * aspect));
        camera.aspect = aspect;
        camera.position.set(0, target.y + 0.15, dist);
        camera.updateProjectionMatrix();
        controls.target.copy(target);
        controls.update();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      // Ease back to the front a moment after the visitor lets go.
      let lastInteraction = -Infinity;
      controls.addEventListener("start", () => { lastInteraction = Infinity; });
      controls.addEventListener("end", () => { lastInteraction = performance.now(); });

      // Head follows the cursor, measured from the character's position on screen.
      const pointer = new THREE.Vector2(0, 0);
      const look = new THREE.Vector2(0, 0);
      const onPointerMove = (e) => {
        const r = container.getBoundingClientRect();
        pointer.set(
          THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1),
          THREE.MathUtils.clamp((e.clientY - (r.top + r.height * 0.25)) / (window.innerHeight / 2), -1, 1)
        );
      };
      window.addEventListener("pointermove", onPointerMove);

      let mixer, idleAction, waveAction, head, neck, character;
      let waving = false;
      const wave = () => {
        if (!waveAction || waving || reducedMotion) return;
        waving = true;
        waveAction.reset();
        waveAction.setLoop(THREE.LoopOnce, 1);
        waveAction.clampWhenFinished = true;
        waveAction.play();
        idleAction.crossFadeTo(waveAction, 0.35, false);
      };

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load("/models/om.glb", (gltf) => {
        if (disposed) return;
        character = gltf.scene;
        character.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.frustumCulled = false;
            // The texture is painted from a lit render, so let part of it
            // glow through instead of shading it twice.
            o.material.emissive = new THREE.Color(0xffffff);
            o.material.emissiveMap = o.material.map;
            o.material.emissiveIntensity = 0.32;
          }
        });
        scene.add(character);
        head = character.getObjectByName("head");
        neck = character.getObjectByName("neck");

        mixer = new THREE.AnimationMixer(character);
        const clip = (name) => THREE.AnimationClip.findByName(gltf.animations, name);
        idleAction = mixer.clipAction(clip("idle"));
        waveAction = mixer.clipAction(clip("wave"));
        idleAction.play();
        mixer.addEventListener("finished", (e) => {
          if (e.action !== waveAction) return;
          idleAction.reset().play();
          waveAction.crossFadeTo(idleAction, 0.5, false);
          waving = false;
        });

        waveRef.current = () => setTimeout(wave, 400);
        if (startRef.current && !startedRef.current) {
          startedRef.current = true;
          waveRef.current();
        }
      });

      // Tap or click the character (not a drag) to wave again.
      const raycaster = new THREE.Raycaster();
      let downAt = null;
      const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
      const onUp = (e) => {
        if (!downAt || !character) return;
        const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
        downAt = null;
        if (moved > 6) return;
        const r = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.intersectObject(character, true).length) wave();
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);

      // Turn a bone by a world-space rotation on top of the animated pose.
      const qWorld = new THREE.Quaternion();
      const qParent = new THREE.Quaternion();
      const qTmp = new THREE.Quaternion();
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      const addWorldRotation = (bone, yaw, pitch) => {
        euler.set(pitch, yaw, 0);
        qWorld.setFromEuler(euler);
        bone.parent.getWorldQuaternion(qParent);
        qTmp.copy(qParent).invert().multiply(qWorld).multiply(qParent);
        bone.quaternion.premultiply(qTmp);
      };

      // Only render while the hero is on screen.
      let visible = true;
      const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
      io.observe(container);

      const clock = new THREE.Clock();
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.1);
        if (!visible) return;
        if (mixer) mixer.update(dt);

        if (head && neck && !reducedMotion) {
          look.lerp(pointer, 1 - Math.pow(0.002, dt));
          const yaw = look.x * 0.45;
          const pitch = look.y * 0.22;
          character.updateMatrixWorld(true);
          addWorldRotation(neck, yaw * 0.4, pitch * 0.4);
          character.updateMatrixWorld(true);
          addWorldRotation(head, yaw * 0.6, pitch * 0.6);
        }

        if (performance.now() - lastInteraction > 2500) {
          const az = controls.getAzimuthalAngle();
          if (Math.abs(az) > 0.001) {
            const back = az * (1 - Math.pow(0.15, dt));
            camera.position.sub(target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -back).add(target);
          }
        }
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        controls.dispose();
        pmrem.dispose();
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

export default Character3D;
