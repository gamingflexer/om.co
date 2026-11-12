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
// scene modules come first, then Om's avatar downloads (the largest file,
// reported by bytes), then shader compilation and the first frame.
const PHASES = { modules: 0.3, model: 0.5, warm: 0.2 };
// After this long, the loader adds an estimate of the time left.
const SLOW_AFTER = 35;
const MODULE_COUNT = 13;
// Glow added on top of the picture, per unit of the bloom chain's output.
const BLOOM_STRENGTH = 0.07;

// How far the hero copy stays on screen (global progress) before it fades.
export const HERO_FADE = [0.006, 0.03];

const Journey = ({ className = "", spacerRef, sound, onFail, children }) => {
  const containerRef = useRef(null);
  // Scroll progress drives the hero copy, the scroll cue and the progress
  // line. They are written straight to the DOM from the render loop, so
  // scrolling never re-renders React (it used to, every frame).
  const heroRef = useRef(null);
  const hintRef = useRef(null);
  const barRef = useRef(null);
  const overlayRef = useRef("on");
  const [soundOn, setSoundOn] = useState(false);
  // Loading overlay: target progress lives in a ref, the eased value shown
  // to the user is state.
  const loadTarget = useRef(0);
  const [shown, setShown] = useState(0);
  // on → settling (bar full, dot animation plays to its hold pose) → fading → off
  const [overlay, setOverlay] = useState("on");
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);
  // The hero copy fades in on a CSS transition once the loader is gone; after
  // that it follows the (already smoothed) scroll directly, with no lag.
  useEffect(() => {
    if (overlay !== "off" || !heroRef.current) return undefined;
    const id = setTimeout(() => heroRef.current && (heroRef.current.style.transition = "none"), 1000);
    return () => clearTimeout(id);
  }, [overlay]);
  const [failed, setFailed] = useState(false);
  // Seconds left on a slow load (null until SLOW_AFTER, Infinity when the
  // rate is too low to estimate).
  const [eta, setEta] = useState(null);
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
    // Recent (time, progress) samples for the rate, and the countdown shown.
    const samples = [];
    let countdown = null;
    let lastSec = null;
    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = loadTarget.current;
      // performance.now() counts from navigation start, so this is the
      // whole wait the visitor has seen.
      const secs = now / 1000;
      if (!samples.length || secs - samples[samples.length - 1][0] > 0.5) samples.push([secs, t]);
      while (samples.length > 2 && secs - samples[0][0] > 10) samples.shift();
      if (secs > SLOW_AFTER && t < 1) {
        const [s0, t0] = samples[0];
        const rate = (t - t0) / Math.max(secs - s0, 0.001);
        const estimate = rate > 0.002 ? (1 - t) / rate : Infinity;
        // Count down steadily; re-sync only when the estimate drifts far.
        if (countdown === null || !Number.isFinite(countdown)) countdown = estimate;
        else {
          countdown = Math.max(0, countdown - dt);
          if (estimate > countdown * 1.5 + 5 || estimate < countdown * 0.5) countdown = estimate;
        }
        const sec = Number.isFinite(countdown) ? Math.ceil(countdown) : Infinity;
        if (sec !== lastSec) {
          lastSec = sec;
          setEta(sec);
        }
      }
      // Drift a little ahead of the last report, never past the next phase.
      const ceiling = Math.min(t + 0.06, 0.985);
      const goal = t >= 1 ? 1 : ceiling;
      const k = t >= 1 ? 6 : v < t ? 4 : 0.35;
      v += (goal - v) * (1 - Math.exp(-dt * k));
      setShown((prev) => (Math.abs(prev - v) > 0.0015 ? v : prev));
      if (t >= 1 && v > 0.995) {
        setShown(1);
        setEta(null);
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
      // Phones with little memory or few cores: lower resolution cap and no
      // multisampling (the half-float MSAA resolve is what they choke on).
      const lowEnd = small && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4);

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowEnd ? 1.25 : small ? 1.5 : 2));
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
      const rtOpts = { type: THREE.HalfFloatType, samples: lowEnd ? 0 : small ? 2 : 4, depthBuffer: true };
      const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
      const rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
      const compUniforms = {
        texA: { value: rtA.texture },
        texB: { value: rtB.texture },
        bloomTex: { value: null },
        bloomI: { value: 0 },
        w: { value: 0 },
        time: { value: 0 },
        fade: { value: 0 },
        res: { value: new THREE.Vector2(1, 1) },
      };
      // With no incoming stage the composite reads B from this opaque black
      // pixel instead of clearing and resolving a whole multisampled target.
      const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      black.needsUpdate = true;
      const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeo = new THREE.PlaneGeometry(2, 2);
      const QUAD_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
      // The cross-fade of the two stage targets, shared by the bloom
      // prefilter and the final composite.
      const MIX_FN = `
        uniform sampler2D texA, texB; uniform float w;
        vec3 stageMix(vec2 uv){
          vec4 A = texture2D(texA, uv); vec4 B = texture2D(texB, uv);
          float aA = clamp(A.a, 0.0, 1.0); float aB = clamp(B.a, 0.0, 1.0);
          return mix(A.rgb, B.rgb, max(w * aB, 1.0 - aA));
        }`;
      const pass = (fragmentShader, uniforms) => {
        const sc = new THREE.Scene();
        const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, vertexShader: QUAD_VS, fragmentShader });
        sc.add(new THREE.Mesh(quadGeo, material));
        return { scene: sc, material };
      };
      const comp = pass(
        `
          precision highp float;
          ${MIX_FN}
          uniform sampler2D bloomTex; uniform float bloomI, time, fade; uniform vec2 res; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main(){
            vec3 col = stageMix(vUv);
            col += texture2D(bloomTex, vUv).rgb * bloomI;
            vec2 q = vUv - 0.5;
            col *= 1.0 - 0.45 * smoothstep(0.15, 0.75, dot(q, q));
            vec2 px = gl_FragCoord.xy + vec2(time * 61.0, time * 37.0);
            col += (hash(px) - 0.5) * 0.012 * (0.35 + col);
            col *= fade;
            gl_FragColor = vec4(max(col, 0.0), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            // Triangular dither at one 8-bit step: no banding in skies and glows.
            gl_FragColor.rgb += (hash(px + 17.0) + hash(px + 59.0) - 1.0) / 255.0;
          }`,
        compUniforms
      );
      const compScene = comp.scene;

      // HDR bloom (dual-filter mip chain): only pixels brighter than the
      // threshold glow, so lit surfaces stay crisp and suns, discs and star
      // cores get a real halo. Half resolution at the top, a few levels down.
      const BLOOM_LEVELS = small ? 4 : 5;
      const bloomOpts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
      const bloomDown = [];
      const bloomUp = [];
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        bloomDown.push(new THREE.WebGLRenderTarget(1, 1, bloomOpts));
        if (i < BLOOM_LEVELS - 1) bloomUp.push(new THREE.WebGLRenderTarget(1, 1, bloomOpts));
      }
      const preU = { texA: compUniforms.texA, texB: compUniforms.texB, w: compUniforms.w, texel: { value: new THREE.Vector2() } };
      const prefilter = pass(
        `
          precision highp float;
          ${MIX_FN}
          uniform vec2 texel; varying vec2 vUv;
          vec3 tap(vec2 o){
            vec3 c = min(stageMix(vUv + o * texel), vec3(64.0));
            float br = max(c.r, max(c.g, c.b));
            // Soft knee around 1.0, then a luma weight against fireflies.
            float soft = clamp(br - 0.55, 0.0, 0.9); soft = soft * soft / 1.8;
            c *= max(soft, br - 1.0) / max(br, 1e-4);
            return c / (1.0 + max(c.r, max(c.g, c.b)) * 0.25);
          }
          void main(){
            vec3 c = tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
            gl_FragColor = vec4(c * 0.25, 1.0);
          }`,
        preU
      );
      const downU = { src: { value: null }, texel: { value: new THREE.Vector2() } };
      const down = pass(
        `
          precision highp float;
          uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(src, vUv).rgb * 4.0;
            c += texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb;
            c += texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb;
            c += texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb;
            c += texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb;
            gl_FragColor = vec4(c / 8.0, 1.0);
          }`,
        downU
      );
      const upU = { src: { value: null }, base: { value: null }, texel: { value: new THREE.Vector2() } };
      const up = pass(
        `
          precision highp float;
          uniform sampler2D src, base; uniform vec2 texel; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(src, vUv + texel * vec2(-2.0, 0.0)).rgb + texture2D(src, vUv + texel * vec2(2.0, 0.0)).rgb
                   + texture2D(src, vUv + texel * vec2(0.0, -2.0)).rgb + texture2D(src, vUv + texel * vec2(0.0, 2.0)).rgb;
            c += 2.0 * (texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb
                      + texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb);
            gl_FragColor = vec4(c / 12.0 + texture2D(base, vUv).rgb, 1.0);
          }`,
        upU
      );
      const blit = (p, target) => {
        renderer.setRenderTarget(target);
        renderer.render(p.scene, compCam);
      };
      const renderBloom = () => {
        preU.texel.value.set(0.5 / bloomDown[0].width, 0.5 / bloomDown[0].height);
        blit(prefilter, bloomDown[0]);
        for (let i = 1; i < BLOOM_LEVELS; i++) {
          downU.src.value = bloomDown[i - 1].texture;
          downU.texel.value.set(0.5 / bloomDown[i].width, 0.5 / bloomDown[i].height);
          blit(down, bloomDown[i]);
        }
        let src = bloomDown[BLOOM_LEVELS - 1];
        for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
          upU.src.value = src.texture;
          upU.base.value = bloomDown[i].texture;
          upU.texel.value.set(0.5 / src.width, 0.5 / src.height);
          blit(up, bloomUp[i]);
          src = bloomUp[i];
        }
        return src.texture;
      };

      // Scenes (shared instances for the two hero/iris stages).
      const hero = heroM.createHero(THREE, {
        renderer,
        small,
        reducedMotion,
        deps: { RoomEnvironment },
        onModelProgress: (loaded, total) => {
          // Without a length, assume the ~1.7 MB file so the bar still moves.
          done.model = Math.min(0.99, loaded / (total || 1.7e6));
          report();
        },
      });
      const iris = irisM.createIris(THREE);
      const scenes = { hero, iris };
      // The other stages are built only once Om is in, so on a slow link
      // their textures do not compete with the avatar download.
      const startScenes = () => ({
        earth: earthM.createEarth(THREE, { tier, maxTex }),
        solar: solarM.createSolar(THREE, { tier, small }),
        stars: starsM.createStars(THREE, { tier, small }),
        galaxy: galaxyM.createGalaxy(THREE, { small, reducedMotion }),
        local: localM.createLocal(THREE, { small, reducedMotion }),
        web: webM.createWeb(THREE, { small }),
        blackhole: blackholeM.createBlackHole(THREE, { renderer, small, tier, reducedMotion }),
        supernova: supernovaM.createSupernova(THREE, { tier, small, reducedMotion }),
        pulsar: pulsarM.createPulsar(THREE, { tier, small, reducedMotion }),
      });
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
      hero.ready.then(() => {
        if (disposed) return;
        Object.entries(startScenes()).forEach(([id, p]) =>
          p.then((s) => {
            if (disposed) return;
            scenes[id] = s;
            s.resize(W, H, renderer.getPixelRatio());
            warmQueue.push(s);
          }).catch((e) => console.error("scene", id, e))
        );
      });

      // Dynamic resolution: the pixel ratio starts at the device's (capped)
      // value and steps down only while frames run long, then climbs back.
      // A fast GPU never leaves full resolution.
      const maxDpr = renderer.getPixelRatio();
      const minDpr = Math.max(0.75, maxDpr * 0.6);
      let rect = container.getBoundingClientRect();
      const resize = () => {
        W = container.clientWidth;
        H = container.clientHeight;
        if (!W || !H) return;
        rect = container.getBoundingClientRect();
        renderer.setSize(W, H, false);
        const dpr = renderer.getPixelRatio();
        rtA.setSize(Math.floor(W * dpr), Math.floor(H * dpr));
        rtB.setSize(Math.floor(W * dpr), Math.floor(H * dpr));
        compUniforms.res.value.set(W * dpr, H * dpr);
        for (let i = 0; i < BLOOM_LEVELS; i++) {
          const bw = Math.max(2, Math.floor((W * dpr) / (2 << i)));
          const bh = Math.max(2, Math.floor((H * dpr) / (2 << i)));
          bloomDown[i].setSize(bw, bh);
          if (bloomUp[i]) bloomUp[i].setSize(bw, bh);
        }
        Object.values(scenes).forEach((s) => s.resize(W, H, dpr));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // Scroll → progress, smoothed. Once the footer covers the whole
      // viewport the scene is not drawn at all.
      let target = 0;
      let s = 0;
      let covered = false;
      const onScroll = () => {
        const spacer = spacerRef && spacerRef.current;
        const end = spacer ? spacer.offsetTop + spacer.offsetHeight : document.documentElement.scrollHeight;
        const max = end - window.innerHeight;
        target = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
        const foot = spacer && spacer.nextElementSibling;
        covered = !!foot && foot.offsetHeight >= window.innerHeight && window.scrollY >= end;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });

      // Head look follows the pointer in the hero stages.
      const onPointerMove = (e) => {
        const r = rect;
        const px = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
        const py = clamp((e.clientY - (r.top + r.height * 0.3)) / (r.height / 2), -1, 1);
        Object.values(scenes).forEach((sc) => sc.setPointer && sc.setPointer(px, py));
      };
      window.addEventListener("pointermove", onPointerMove);

      await hero.ready;
      if (disposed) return;
      done.model = 1;
      report();
      // Let the overlay paint the new phase before the (blocking) compile.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      if (disposed) return;
      warm(hero);
      done.warm = 0.6;
      report();
      warm(iris);
      done.warm = 0.85;
      report();

      const clock = new THREE.Clock();
      let raf = 0;
      let lastProgress = -1;
      let lastOverlay = null;
      let fade = 0;
      // Frame-time bookkeeping for the dynamic resolution.
      let ema = 1 / 60;
      let since = 0;
      let flips = 0;
      let lastDir = 0;
      const setDpr = (d) => {
        d = Math.round(clamp(d, minDpr, maxDpr) * 100) / 100;
        if (Math.abs(d - renderer.getPixelRatio()) < 0.01) return;
        renderer.setPixelRatio(d);
        resize();
      };
      const adapt = (dt) => {
        ema += (dt - ema) * 0.08;
        since += dt;
        if (since < 1.2 || warmQueue.length) return;
        const dpr = renderer.getPixelRatio();
        // Under ~45 fps: drop 15 %. Back above ~57 fps for 3 s: raise 10 %.
        // After a few up/down flips it stays where it is.
        if (ema > 1 / 45 && dpr > minDpr) {
          setDpr(dpr * 0.85);
          flips += lastDir > 0 ? 1 : 0;
          lastDir = -1;
          since = 0;
        } else if (ema < 1 / 57 && dpr < maxDpr && since > 3 && flips < 4) {
          setDpr(dpr * 1.1);
          lastDir = 1;
          since = 0;
        }
      };
      const writeProgress = (p) => {
        const hf = smoothstep(HERO_FADE[0], HERO_FADE[1], p);
        const hero = heroRef.current;
        if (hero && overlayRef.current === "off") {
          hero.style.opacity = String(1 - hf);
          hero.style.transform = `translate3d(0, ${-hf * 40}px, 0)`;
          hero.style.pointerEvents = p < HERO_FADE[1] ? "auto" : "none";
        }
        if (hintRef.current) hintRef.current.style.opacity = overlayRef.current === "off" && p < 0.03 ? "1" : "0";
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(clock.getDelta(), 0.1);
        const time = clock.elapsedTime;
        s += (target - s) * (1 - Math.exp(-dt * 5.5));
        if (Math.abs(s - lastProgress) > 0.0005 || overlayRef.current !== lastOverlay) {
          lastProgress = s;
          lastOverlay = overlayRef.current;
          writeProgress(s);
        }
        if (warmQueue.length) warm(warmQueue.shift());
        if (covered && fade >= 1) return;
        adapt(dt);
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
        // A slot with no (built) stage samples the black pixel rather than
        // its target: the targets are multisampled and only resolved after a
        // render, so a stale one would still hold its last frame (it once
        // showed as a second iris through the open pupil).
        const render = (st, rt) => {
          const sc = st && scenes[st.id];
          if (!sc) return false;
          renderer.setRenderTarget(rt);
          renderer.setClearColor(0x000000, 1);
          renderer.clear();
          sc.update({ t: st.t, dt, time, reverse: !!st.reverse });
          renderer.render(sc.scene, sc.camera);
          return true;
        };
        compUniforms.texA.value = render(A, rtA) ? rtA.texture : black;
        compUniforms.texB.value = render(B, rtB) ? rtB.texture : black;
        compUniforms.w.value = w;
        // Each stage may scale the glow (scene.bloom, default 1); 0 on both
        // skips the bloom passes altogether.
        const bA = A && scenes[A.id] ? scenes[A.id].bloom ?? 1 : 0;
        const bB = B && scenes[B.id] ? scenes[B.id].bloom ?? 1 : 0;
        const bloomI = (B ? bA + (bB - bA) * w : bA) * BLOOM_STRENGTH;
        compUniforms.bloomI.value = bloomI;
        compUniforms.bloomTex.value = bloomI > 0.001 ? renderBloom() : black;
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
        window.__journey = { scenes, hero, renderer, STAGES, get s() { return s; } };
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointerMove);
        Object.values(scenes).forEach((sc) => sc.dispose && sc.dispose());
        rtA.dispose();
        rtB.dispose();
        bloomDown.forEach((t) => t.dispose());
        bloomUp.forEach((t) => t.dispose());
        black.dispose();
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
    shown < PHASES.modules ? "Loading the engine" : shown < PHASES.modules + PHASES.model ? "Bringing Om in" : shown < 0.995 ? "Preparing the view" : "Scroll to begin";
  return (
    <>
      <div ref={containerRef} className={className} />
      {/* Hero copy (name, taglines, links) over the opening stage. It fades
          as Om slides to the centre and the push into his eye begins. */}
      {children && (
        <div ref={heroRef} className="journey-hero">
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
          eta={eta}
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
      {/* Scroll cue (after about.senbuzy.com): a pulsing "Scroll" label over
          a hairline with a glowing dot sliding down it. Fades out once the
          journey starts. */}
      <div ref={hintRef} aria-hidden="true" className="journey-hint" style={{ opacity: 0 }}>
        <span className="journey-hint__label">Scroll</span>
        <span className="journey-hint__track">
          <span className="journey-hint__dot" />
        </span>
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
      <div ref={barRef} aria-hidden="true" className="journey-progress" />
    </>
  );
};

export default Journey;
