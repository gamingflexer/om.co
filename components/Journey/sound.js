// Synthesised sound design (no audio files): an ambient bed that follows the
// journey, scroll ticks, hover blips and click sounds. Everything is built on
// the Web Audio API and starts only after the visitor turns sound on.

const STORAGE_KEY = "om-sound";

export const createSound = () => {
  let ctx = null;
  let master = null;
  let enabled = false;
  let bed = null;
  let lastTick = 0;
  let lastHover = 0;
  const listeners = new Set();

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return ctx;
  };

  // Ambient bed: wind-like filtered noise (meadow) and a deep detuned drone
  // (space). `space` in [0, 1] cross-fades between them.
  const startBed = () => {
    if (bed || !ctx) return;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      // Pink-ish noise.
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.5;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 220;
    windLfo.connect(windLfoGain).connect(windFilter.frequency);
    noise.connect(windFilter).connect(windGain).connect(master);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 180;
    droneFilter.connect(droneGain).connect(master);
    const oscs = [55, 55.4, 82.5, 110.3].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? "sawtooth" : "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.08 : 0.05;
      o.connect(g).connect(droneFilter);
      o.start();
      return o;
    });
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 0.05;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 60;
    shimmer.connect(shimmerGain).connect(droneFilter.frequency);
    shimmer.start();
    windLfo.start();
    noise.start();
    bed = { windGain, droneGain, oscs, noise, windLfo, shimmer };
  };

  const setSpace = (space) => {
    if (!bed || !ctx) return;
    const t = ctx.currentTime;
    bed.windGain.gain.setTargetAtTime(0.5 * (1 - space), t, 0.4);
    bed.droneGain.gain.setTargetAtTime(0.9 * space, t, 0.4);
  };

  const blip = (freq, dur, gain, type = "sine") => {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  const noiseBurst = (dur, gain, freq) => {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  };

  const api = {
    get enabled() {
      return enabled;
    },
    onChange: (fn) => listeners.add(fn),
    toggle: async () => {
      const c = ensure();
      if (!c) return false;
      if (c.state === "suspended") await c.resume();
      enabled = !enabled;
      if (enabled) startBed();
      master.gain.setTargetAtTime(enabled ? 0.9 : 0, c.currentTime, 0.3);
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
      } catch (e) {
        /* private mode */
      }
      listeners.forEach((fn) => fn(enabled));
      return enabled;
    },
    // Called every frame with the journey progress.
    update: (s) => {
      if (!enabled) return;
      const space = s < 0.1 ? 0 : s > 0.935 ? 0 : Math.min(1, (s - 0.1) / 0.06) * Math.min(1, (0.935 - s) / 0.06);
      setSpace(Math.max(0, Math.min(1, space)));
    },
    // Scroll tick, rate-limited; pitch rises with speed.
    scroll: (speed) => {
      if (!enabled || !ctx) return;
      const now = performance.now();
      if (now - lastTick < 90) return;
      lastTick = now;
      noiseBurst(0.05, 0.12 + Math.min(0.2, speed * 0.3), 1800 + Math.min(2500, speed * 3000));
    },
    hover: () => {
      const now = performance.now();
      if (now - lastHover < 60) return;
      lastHover = now;
      blip(1400, 0.06, 0.05);
    },
    clickDown: () => blip(520, 0.07, 0.09, "triangle"),
    clickUp: () => blip(780, 0.08, 0.07, "triangle"),
    // A soft swoosh at stage hand-offs.
    swoosh: () => noiseBurst(0.6, 0.18, 600),
    wasEnabled: () => {
      try {
        return localStorage.getItem(STORAGE_KEY) === "1";
      } catch (e) {
        return false;
      }
    },
    dispose: () => {
      if (ctx) ctx.close();
      ctx = null;
      bed = null;
    },
  };
  return api;
};
