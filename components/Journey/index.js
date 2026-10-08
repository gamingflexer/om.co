import React, { useEffect, useRef, useState } from "react";
import { clamp, smoothstep } from "./util";

// Scroll-driven journey: Om on the meadow → his eye → Earth from orbit → the
// solar system → nearby stars → a black hole, a supernova and a pulsar in
// the galactic neighbourhood → the Milky Way → the Local Group → the cosmic
// web and the observable universe → back through the eye to the meadow.
// Each stage is its own three.js scene rendered to an HDR target; the
// composite pass cross-fades neighbours and does tone mapping, vignette and
// grain. Scroll position maps to one global progress value.

export const PAGES = 21; // page height in viewports

// Stage windows in global progress. Overlaps are the cross-fades.
const STAGES = [
  { id: "meadow", a: 0.0, b: 0.09 },
  { id: "iris", a: 0.075, b: 0.132 },
  { id: "earth", a: 0.106, b: 0.24 },
  { id: "solar", a: 0.228, b: 0.33 },
  { id: "stars", a: 0.318, b: 0.4 },
  // Inside the galaxy first: a black hole, a supernova and the pulsar it
  // leaves behind, then out of the disc to see the whole Milky Way.
  { id: "blackhole", a: 0.388, b: 0.49 },
  { id: "supernova", a: 0.478, b: 0.585 },
  { id: "pulsar", a: 0.573, b: 0.665 },
  { id: "galaxy", a: 0.653, b: 0.735 },
  { id: "local", a: 0.723, b: 0.8 },
  { id: "web", a: 0.79, b: 0.9 },
  { id: "iris", a: 0.872, b: 0.935, reverse: true },
  { id: "meadow", a: 0.922, b: 1.0, reverse: true },
];

const Journey = ({ className = "", spacerRef, sound }) => {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // The sound API arrives after mount; the render loop reads it via a ref.
  const soundRef = useRef(null);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const [{ GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
      ]);
      const scenesMod = await Promise.all([
        import("./scenes/meadow"),
        import("./scenes/iris"),
        import("./scenes/earth"),
        import("./scenes/solar"),
        import("./scenes/stars"),
        import("./scenes/galaxy"),
        import("./scenes/local"),
        import("./scenes/web"),
        import("./scenes/blackhole"),
        import("./scenes/supernova"),
        import("./scenes/pulsar"),
      ]);
      if (disposed) return;
      const [meadowM, irisM, earthM, solarM, starsM, galaxyM, localM, webM, blackholeM, supernovaM, pulsarM] = scenesMod;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
      const tier = small ? "m" : "h";

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Scroll journey from Om on a meadow, into his eye, out past Earth, the solar system, nearby stars, a black hole, a supernova and a pulsar, then the Milky Way and on to the observable universe");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
      const maxTex = renderer.capabilities.maxTextureSize;

      // Two HDR targets for the cross-fade.
      const rtOpts = { type: THREE.HalfFloatType, samples: small ? 2 : 4, depthBuffer: true };
      const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
      const rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
      const compUniforms = {
        texA: { value: rtA.texture },
        texB: { value: rtB.texture },
        w: { value: 0 },
        time: { value: 0 },
        fade: { value: 0 },
        res: { value: new THREE.Vector2(1, 1) },
      };
      const compScene = new THREE.Scene();
      const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      compScene.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({
            uniforms: compUniforms,
            depthTest: false,
            depthWrite: false,
            vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
            fragmentShader: `
              precision highp float;
              uniform sampler2D texA, texB; uniform float w, time, fade; uniform vec2 res; varying vec2 vUv;
              void main(){
                vec4 A = texture2D(texA, vUv); vec4 B = texture2D(texB, vUv);
                float aA = clamp(A.a, 0.0, 1.0); float aB = clamp(B.a, 0.0, 1.0);
                float m = max(w * aB, 1.0 - aA);
                vec3 col = mix(A.rgb, B.rgb, m);
                vec2 q = vUv - 0.5;
                col *= 1.0 - 0.45 * smoothstep(0.15, 0.75, dot(q, q));
                float g = fract(sin(dot(gl_FragCoord.xy + vec2(time * 61.0, time * 37.0), vec2(12.9898, 78.233))) * 43758.5453);
                col += (g - 0.5) * 0.015;
                col *= fade;
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
              }`,
          })
        )
      );

      // Scenes (shared instances for the two meadow/iris stages).
      const meadow = meadowM.createMeadow(THREE, { renderer, small, reducedMotion, deps: { GLTFLoader, MeshoptDecoder, RoomEnvironment } });
      const iris = irisM.createIris(THREE);
      const scenes = { meadow, iris };
      const pending = {
        earth: earthM.createEarth(THREE, { tier, maxTex }),
        solar: solarM.createSolar(THREE, { tier, small }),
        stars: starsM.createStars(THREE, { tier, small }),
        galaxy: galaxyM.createGalaxy(THREE, { small, reducedMotion }),
        local: localM.createLocal(THREE, { small, reducedMotion }),
        web: webM.createWeb(THREE, { small }),
        blackhole: blackholeM.createBlackHole(THREE, { renderer, small, tier, reducedMotion }),
        supernova: supernovaM.createSupernova(THREE, { tier, small, reducedMotion }),
        pulsar: pulsarM.createPulsar(THREE, { tier, small, reducedMotion }),
      };
      let W = 1;
      let H = 1;
      // Compile shaders and upload textures as each scene arrives so the
      // first scroll into it does not stall.
      const warm = (sc) => {
        try {
          sc.scene.traverse((o) => {
            const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
            mats.forEach((m) => {
              const texs = [m.map, m.emissiveMap, m.alphaMap];
              if (m.uniforms) Object.values(m.uniforms).forEach((u) => u && u.value && u.value.isTexture && texs.push(u.value));
              texs.forEach((t) => t && renderer.initTexture(t));
            });
          });
          renderer.compile(sc.scene, sc.camera);
        } catch (e) {
          console.warn("warm", e);
        }
      };
      // Warm one scene per frame so the load does not freeze the page.
      const warmQueue = [];
      Object.entries(pending).forEach(([id, p]) =>
        p.then((s) => {
          if (disposed) return;
          scenes[id] = s;
          s.resize(W, H, renderer.getPixelRatio());
          warmQueue.push(s);
        }).catch((e) => console.error("scene", id, e))
      );

      const resize = () => {
        W = container.clientWidth;
        H = container.clientHeight;
        if (!W || !H) return;
        renderer.setSize(W, H, false);
        const dpr = renderer.getPixelRatio();
        rtA.setSize(Math.floor(W * dpr), Math.floor(H * dpr));
        rtB.setSize(Math.floor(W * dpr), Math.floor(H * dpr));
        compUniforms.res.value.set(W * dpr, H * dpr);
        Object.values(scenes).forEach((s) => s.resize(W, H, dpr));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // Scroll → progress, smoothed.
      let target = 0;
      let s = 0;
      let lastY = window.scrollY;
      let lastT = performance.now();
      const onScroll = () => {
        const spacer = spacerRef && spacerRef.current;
        const max = (spacer ? spacer.offsetTop + spacer.offsetHeight : document.documentElement.scrollHeight) - window.innerHeight;
        target = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
        const now = performance.now();
        const speed = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT);
        lastY = window.scrollY;
        lastT = now;
        if (soundRef.current) soundRef.current.scroll(speed);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });

      // Head look follows the pointer in the meadow stages.
      const onPointerMove = (e) => {
        const r = container.getBoundingClientRect();
        meadow.setPointer(
          clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1),
          clamp((e.clientY - (r.top + r.height * 0.3)) / (r.height / 2), -1, 1)
        );
      };
      window.addEventListener("pointermove", onPointerMove);

      await meadow.ready;
      if (disposed) return;
      warm(meadow);
      warm(iris);
      setLoaded(true);

      const clock = new THREE.Clock();
      let raf = 0;
      let lastProgress = -1;
      let lastStage = "";
      let fade = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.1);
        const time = clock.elapsedTime;
        s += (target - s) * (1 - Math.exp(-dt * 5.5));
        if (Math.abs(s - lastProgress) > 0.002) {
          lastProgress = s;
          setProgress(s);
        }
        if (warmQueue.length) warm(warmQueue.shift());
        fade = Math.min(1, fade + dt * 0.8);
        compUniforms.fade.value = fade * fade;
        compUniforms.time.value = time;
        if (soundRef.current) soundRef.current.update(s);

        // Active stages and their weights.
        const active = [];
        STAGES.forEach((st) => {
          if (s < st.a || s > st.b) return;
          const t = (s - st.a) / (st.b - st.a);
          active.push({ ...st, t: st.reverse ? 1 - t : t });
        });
        // The outgoing stage is A, the incoming is B; w is the overlap mix.
        const A = active[0];
        const B = active[1];
        const stageKey = A ? A.id + (A.reverse ? "r" : "") : "";
        if (stageKey !== lastStage) {
          if (lastStage && soundRef.current) soundRef.current.swoosh();
          lastStage = stageKey;
        }
        let w = 0;
        if (A && B) {
          const o0 = B.a;
          const o1 = A.b;
          w = smoothstep(o0, o1, s);
        }
        const render = (st, rt) => {
          const sc = scenes[st.id];
          renderer.setRenderTarget(rt);
          renderer.setClearColor(0x000000, 1);
          renderer.clear();
          if (!sc) return;
          sc.update({ t: st.t, dt, time, reverse: !!st.reverse });
          renderer.render(sc.scene, sc.camera);
        };
        if (A) render(A, rtA);
        else {
          renderer.setRenderTarget(rtA);
          renderer.setClearColor(0x000000, 1);
          renderer.clear();
        }
        if (B) render(B, rtB);
        else {
          renderer.setRenderTarget(rtB);
          renderer.setClearColor(0x000000, 1);
          renderer.clear();
        }
        compUniforms.w.value = w;
        renderer.setRenderTarget(null);
        renderer.render(compScene, compCam);
      };
      tick();

      if (new URLSearchParams(window.location.search).has("debug")) {
        window.__journey = { scenes, meadow, STAGES, get s() { return s; } };
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointerMove);
        Object.values(scenes).forEach((sc) => sc.dispose && sc.dispose());
        rtA.dispose();
        rtB.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })().catch((e) => console.error(e));

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; sound is read through soundRef, spacerRef is a stable ref
  }, []);

  return (
    <>
      <div ref={containerRef} className={className} />
      {/* Scroll hint: fades out once the journey starts. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center transition-opacity duration-700"
        style={{ opacity: loaded && progress < 0.01 ? 1 : 0 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "journey-bob 2.2s ease-in-out infinite" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {/* Sound toggle (synthesised ambience, off until tapped). */}
      {sound && (
        <button
          type="button"
          className={`journey-sound ${soundOn ? "journey-sound--on" : ""}`}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          onMouseEnter={() => sound.hover()}
          onClick={async () => setSoundOn(await sound.toggle())}
        >
          <span className="journey-sound__bars" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
        </button>
      )}
      {/* Thin progress line, no text. */}
      <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-20 h-px bg-white/60" style={{ width: `${progress * 100}%`, transition: "width 120ms linear" }} />
    </>
  );
};

export default Journey;
