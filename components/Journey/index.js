import React, { useEffect, useRef, useState } from "react";
import { clamp, smoothstep } from "./util";
import JourneyLoader from "./Loader";

// Scroll-driven journey: Om on the meadow → his eye → Earth from orbit →
// the solar system → nearby stars → a black hole, a supernova and a pulsar in
// the galactic neighbourhood → the Milky Way → the Local Group → the cosmic
// web and the observable universe → back through the eye to the meadow.
// Each stage is its own three.js scene rendered to an HDR target; the
// composite pass cross-fades neighbours and does tone mapping, vignette and
// grain. Scroll position maps to one global progress value.

export const PAGES = 21; // page height in viewports

// Stage windows in global progress. Overlaps are the cross-fades.
const STAGES = [
  { id: "hero", a: 0.0, b: 0.09 },
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
  { id: "hero", a: 0.922, b: 1.0, reverse: true },
];

// Loading phases and their share of the bar. The three.js chunk and the
// scene modules come first, then Om is built from primitives, then shader
// compilation and the first frame.
const PHASES = { modules: 0.55, model: 0.15, warm: 0.3 };
const MODULE_COUNT = 13;

// How far the hero copy stays on screen (global progress) before it fades.
export const HERO_FADE = [0.006, 0.03];

const Journey = ({ className = "", spacerRef, sound, onFail, children }) => {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // Loading overlay: target progress lives in a ref, the eased value shown
  // to the user is state.
  const loadTarget = useRef(0);
  const [shown, setShown] = useState(0);
  // on → settling (bar full, dot animation plays to its hold pose) → fading → off
  const [overlay, setOverlay] = useState("on");
  const [failed, setFailed] = useState(false);
  const soundRef = useRef(null);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Ease the shown value toward the target so the bar never jumps or
  // stalls dead; when the engine has not reported yet it still creeps.
  useEffect(() => {
    if (overlay !== "on") return undefined;
    let raf = 0;
    let v = 0;
    let last = performance.now();
    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = loadTarget.current;
      // Drift a little ahead of the last report, never past the next phase.
      const ceiling = Math.min(t + 0.06, 0.985);
      const goal = t >= 1 ? 1 : ceiling;
      const k = t >= 1 ? 6 : v < t ? 4 : 0.35;
      v += (goal - v) * (1 - Math.exp(-dt * k));
      setShown((prev) => (Math.abs(prev - v) > 0.0015 ? v : prev));
      if (t >= 1 && v > 0.995) {
        setShown(1);
        cancelAnimationFrame(raf);
        setOverlay("settling");
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [overlay]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    // Progress bookkeeping for the overlay.
    const done = { modules: 0, model: 0, warm: 0 };
    const report = () => {
      const p = done.modules * PHASES.modules + done.model * PHASES.model + done.warm * PHASES.warm;
      loadTarget.current = Math.max(loadTarget.current, Math.min(1, p));
    };
    let modulesLoaded = 0;
    const mod = (promise) =>
      promise.then((m) => {
        modulesLoaded += 1;
        done.modules = modulesLoaded / MODULE_COUNT;
        report();
        return m;
      });
    (async () => {
      const THREE = await mod(import("three"));
      const { RoomEnvironment } = await mod(import("three/examples/jsm/environments/RoomEnvironment.js"));
      const scenesMod = await Promise.all([
        mod(import("./scenes/hero")),
        mod(import("./scenes/iris")),
        mod(import("./scenes/earth")),
        mod(import("./scenes/solar")),
        mod(import("./scenes/stars")),
        mod(import("./scenes/galaxy")),
        mod(import("./scenes/local")),
        mod(import("./scenes/web")),
        mod(import("./scenes/blackhole")),
        mod(import("./scenes/supernova")),
        mod(import("./scenes/pulsar")),
      ]);
      if (disposed) return;
      const [heroM, irisM, earthM, solarM, starsM, galaxyM, localM, webM, blackholeM, supernovaM, pulsarM] = scenesMod;

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
      const blank = new THREE.Scene();
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

      // Scenes (shared instances for the two hero/iris stages).
      const hero = heroM.createHero(THREE, { renderer, small, reducedMotion, deps: { RoomEnvironment } });
      done.model = 1;
      report();
      const iris = irisM.createIris(THREE);
      const scenes = { hero, iris };
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
      const onScroll = () => {
        const spacer = spacerRef && spacerRef.current;
        const max = (spacer ? spacer.offsetTop + spacer.offsetHeight : document.documentElement.scrollHeight) - window.innerHeight;
        target = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });

      // Head look follows the pointer in the hero stages.
      const onPointerMove = (e) => {
        const r = container.getBoundingClientRect();
        const px = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
        const py = clamp((e.clientY - (r.top + r.height * 0.3)) / (r.height / 2), -1, 1);
        Object.values(scenes).forEach((sc) => sc.setPointer && sc.setPointer(px, py));
      };
      window.addEventListener("pointermove", onPointerMove);

      await hero.ready;
      if (disposed) return;
      // Let the overlay paint the new phase before the (blocking) compile.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      if (disposed) return;
      warm(hero);
      done.warm = 0.6;
      report();
      warm(iris);
      done.warm = 0.85;
      report();
      setLoaded(true);

      const clock = new THREE.Clock();
      let raf = 0;
      let lastProgress = -1;
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
        let w = 0;
        if (A && B) {
          const o0 = B.a;
          const o1 = A.b;
          w = smoothstep(o0, o1, s);
        }
        // An empty slot still goes through render(): the targets are
        // multisampled and three.js only resolves them after a render, so a
        // bare clear() would leave the last frame in the texture (it showed
        // as a second iris through the open pupil).
        const render = (st, rt) => {
          const sc = st && scenes[st.id];
          renderer.setRenderTarget(rt);
          renderer.setClearColor(0x000000, 1);
          if (!sc) {
            renderer.render(blank, compCam);
            return;
          }
          renderer.clear();
          sc.update({ t: st.t, dt, time, reverse: !!st.reverse });
          renderer.render(sc.scene, sc.camera);
        };
        render(A, rtA);
        render(B, rtB);
        compUniforms.w.value = w;
        renderer.setRenderTarget(null);
        renderer.render(compScene, compCam);
      };
      tick();
      // First frame is on screen: the bar can finish.
      requestAnimationFrame(() => {
        done.warm = 1;
        report();
      });

      if (new URLSearchParams(window.location.search).has("debug")) {
        window.__journey = { scenes, hero, STAGES, get s() { return s; } };
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
    })().catch((e) => {
      console.error(e);
      if (disposed) return;
      setFailed(true);
      if (onFail) onFail(e);
    });

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; sound is read through soundRef, spacerRef is a stable ref
  }, []);

  const pct = Math.round(shown * 100);
  // The caption follows the bar, so it never runs ahead of the number.
  const label =
    shown < PHASES.modules ? "Loading the engine" : shown < PHASES.modules + PHASES.model ? "Building Om" : shown < 0.995 ? "Preparing the view" : "Scroll to begin";
  return (
    <>
      <div ref={containerRef} className={className} />
      {/* Hero copy (name, taglines, links) over the opening stage. It fades
          as Om slides to the centre and the push into his eye begins. */}
      {children && (
        <div
          className="journey-hero"
          style={{
            opacity: overlay === "off" ? 1 - smoothstep(HERO_FADE[0], HERO_FADE[1], progress) : 0,
            transform: `translateY(${-smoothstep(HERO_FADE[0], HERO_FADE[1], progress) * 40}px)`,
            pointerEvents: progress < HERO_FADE[1] ? "auto" : "none",
          }}
        >
          {children}
        </div>
      )}
      {/* Loading overlay (components/Journey/Loader.js): the dot-grid
          animation with a real progress bar fed by chunk, build and shader
          progress. Fades out over the first frames of the meadow. */}
      {overlay !== "off" && (
        <JourneyLoader
          shown={shown}
          pct={pct}
          label={label}
          overlay={overlay}
          failed={failed}
          onSettled={() => {
            // The dot grid has reached its final pose: hold it a beat, fade
            // the overlay out, and only then reveal the hero copy.
            setTimeout(() => setOverlay("fading"), 500);
            setTimeout(() => setOverlay("off"), 500 + 900);
          }}
        />
      )}
      {/* Scroll hint: a pill at the bottom that fades out once the journey starts. */}
      <div
        aria-hidden="true"
        className="journey-hint"
        style={{ opacity: loaded && overlay === "off" && progress < 0.03 ? 1 : 0 }}
      >
        <span>Scroll to begin</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "journey-bob 2.2s ease-in-out infinite" }}>
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
