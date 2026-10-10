import { useEffect, useRef } from "react";

/*
 * Loading overlay for the journey. The centrepiece is a frame-by-frame
 * reconstruction of Gleb Kuznetsov's "Processing animation for Light camera"
 * (dribbble.com/shots/3251472): white dots on black that split from a single
 * point into a 2x2 grid, ripple out into a 4x4 grid, then swell into an
 * aperture-like cluster and collapse back into the point. The source GIF is
 * 87 frames at 30 ms (2.61 s per loop); every keyframe below was measured
 * from it, in source pixels around the centre (grid pitch 37.5 px).
 *
 * Track keyframes are [frame, x, y, diameter, strokeWidth, alpha];
 * strokeWidth 0 means a filled disc, otherwise a ring.
 */

const FRAME_MS = 30;
const FIRST = 1;
const LAST = 88; // frame 88 == frame 1 of the next loop
const HOLD = 79; // settled "aperture" pose, shown when loading is done
const A = 18.75; // inner grid offset
const B = 56.25; // outer grid offset
const DOT = 3.8; // base dot diameter
const EXTENT = 115; // half-size of the drawing in source pixels

// Ayu Health palette: the shot is white on black; its dots become Offwhite,
// the accents (pulse rings, the aperture's inner discs) Tiger Orange and the
// outermost satellites Bright Yellow.
const OFFWHITE = "#FAF7F5";
const TIGER = "#F15C3E";
const YELLOW = "#FFF35C";

const k = (f, x, y, d, sw = 0, a = 1) => [f, x, y, d, sw, a];
const tint = (track, c) => Object.assign(track, { c });

// Transform helpers for the symmetric copies.
const rot90 = (n) => (x, y) => {
  let p = [x, y];
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) p = [-p[1], p[0]];
  return p;
};
const mirror = (sx, sy, swap = false) => (x, y) => (swap ? [sx * y, sy * x] : [sx * x, sy * y]);
const map = (kfs, fn) => kfs.map(([f, x, y, d, sw, a]) => [f, ...fn(x, y), d, sw, a]);
const stat = (x, y, from, to, d = DOT) => [k(from, x, y, d), k(to, x, y, d)];
const slide = (frames, axis, other, from) =>
  frames.map((v, i) => (axis === "x" ? k(from + i, v, other, DOT) : k(from + i, other, v, DOT)));

// A ring that bursts out of a dot and fades (phase 2 and 3 pulses).
const RING_D = [6, 9, 13, 17, 21, 25, 27, 29];
const RING_SW = [0, 0, 2.5, 2, 1.6, 1.3, 1.2, 1.1];
const RING_A = [1, 1, 1, 1, 0.72, 0.53, 0.32, 0.12];
const pulse = (x, y, start, ds = RING_D) =>
  tint(
    ds.map((d, i) => k(start + i, x, y, d, RING_SW[i], RING_A[i])),
    TIGER
  );

function buildTracks() {
  const t = [];

  // Phase 1: a ring closes to a point, the point breathes, then splits into
  // four dots that spiral out to the inner 2x2 grid.
  t.push([
    k(1, 0, 0, 14, 2.4),
    k(2, 0, 0, 9, 2),
    k(3, 0, 0, 4),
    k(4, 0, 0, 4.5),
    k(5, 0, 0, 6.5),
    k(6, 0, 0, 6.5),
    k(7, 0, 0, 6),
    k(8, 0, 0, 5),
    k(9, 0, 0, DOT),
    k(13, 0, 0, DOT),
  ]);
  const spiral = [
    k(13, 0, 0, DOT),
    k(14, 2, -0.8, DOT),
    k(15, 4.5, -2, DOT),
    k(16, 9, -1, DOT),
    k(17, 13, 1, DOT),
    k(18, 18, 8.5, DOT),
    k(19, 18.5, 13.5, DOT),
    k(20, 18.75, 17, DOT),
    k(21, A, A, DOT),
  ];
  // Inner dots: hold, then swell (phase 4), settle, collapse.
  const inner = [
    k(53, A, A, DOT),
    k(54, 19, 19, 4.5),
    k(55, 23, 23, 9.5),
    k(56, 25, 25, 12.5),
    k(57, 27, 27, 16.5),
    k(58, 27.5, 27.5, 20),
    k(59, 27, 27, 24.5),
    k(60, 26.5, 26.5, 29),
    k(61, 25, 25, 37),
    k(62, 23.5, 23.5, 43),
    k(63, 22, 22, 42),
    k(64, 19, 19, 33.5),
    k(65, 18.5, 18.5, 29.5),
    k(66, 18.25, 18.25, 27.5),
    k(86, 18.25, 18.25, 27.5),
    k(87, 17, 17, 16.5),
    k(88, 6, 6, 8, 0, 0.6),
  ];
  for (let r = 0; r < 4; r++) {
    t.push(map([...spiral, k(53, A, A, DOT)], rot90(r)));
    t.push(tint(map(inner, rot90(r)), TIGER));
  }

  // Phase 2: each inner dot pulses a ring and throws a copy sideways,
  // filling the 2x4 band.
  t.push(pulse(A, -A, 26, [6, 13, 17, 21, 26, 28, 29, 30]), pulse(-A, A, 27), pulse(-A, -A, 28), pulse(A, A, 29));
  t.push(slide([A, 21, 26, 35, 40, 44, 48, 52, 54, 55.5, B], "x", -A, 24));
  t.push(slide([-A, -25, -30, -34, -39, -44, -48, -53, -B], "x", A, 26));
  t.push(slide([-A, -26, -31, -37, -42, -47, -51, -54, -B], "x", -A, 27));
  t.push(slide([A, 25, 30, 35, 40, 44, 48, 51, 54.5, B], "x", A, 28));
  t.push(stat(-B, A, 26, 34));

  // Phase 3: the outer ring of the 4x4 grid assembles.
  // Top-left corner: a ring implodes into a dot.
  t.push(tint([
    k(37, -B, -B, 32, 2, 0.96),
    k(38, -B, -B, 30, 2, 0.97),
    k(39, -B, -B, 25, 2, 0.9),
    k(40, -B, -B, 19.5, 2, 0.92),
    k(41, -B, -B, 13.5, 2.2, 0.9),
    k(41.5, -B, -B, 11, 2.2, 0.9),
  ], TIGER), [k(41.5, -B, -B, 10), k(42, -B, -B, 7.5), k(43, -B, -B, DOT)]);
  // Left-lower edge dot pulses.
  t.push(tint([
    k(38, -B, A, 4.5),
    k(39, -B, A, 8.5),
    k(40, -B, A, 12.5, 3.5),
    k(41, -B, A, 16.5, 2),
    k(42, -B, A, 20.5, 1.6, 0.76),
    k(43, -B, A, 24.5, 1.3, 0.52),
    k(44, -B, A, 28, 1.1, 0.25),
    k(45, -B, A, 29, 1, 0),
  ], TIGER));
  // Two dots orbit half way round the grid (point symmetric), dropping a
  // dot and a ring on the way.
  const orbit = [
    k(40, B, -A, DOT),
    k(41, 51, -27, DOT),
    k(42, 46, -35, DOT),
    k(43, 37, -44, DOT),
    k(44, 26, -51, DOT),
    k(45, 1, -57, DOT),
    k(46, -9, -56, DOT),
    k(47, -15, -55, DOT),
    k(48, -A, -B, DOT),
  ];
  const dropRing = [
    k(44.4, A, -B, 4),
    k(45, A, -B, 12.5, 2.4, 0.91),
    k(46, A, -B, 16.5, 2, 0.76),
    k(47, A, -B, 20.5, 1.6, 0.59),
    k(48, A, -B, 24.5, 1.3, 0.43),
    k(49, A, -B, 28, 1.1, 0.2),
    k(50, A, -B, 29, 1, 0),
  ];
  t.push(orbit, map(orbit, rot90(2)), tint(dropRing, TIGER), tint(map(dropRing, rot90(2)), TIGER));
  // Corner dots slide out of the edge dots and pop.
  t.push([
    ...slide([-A, -19.5, -27, -33, -39, -44, -49, -53], "y", B, 44),
    k(52, B, -B, 9),
    k(53, B, -B, 13),
    k(54, B, -B, 13),
    k(55, B, -B, 9),
    k(56, B, -B, 5),
    k(57, B, -B, DOT),
  ]);
  t.push([
    ...slide([A, 24, 32, 49, B], "y", -B, 42),
    k(47, -B, B, 6),
    k(48, -B, B, 10),
    k(49, -B, B, 9),
    k(50, -B, B, 8),
    k(51, -B, B, 6),
    k(52, -B, B, 5),
    k(53, -B, B, DOT),
  ]);

  // Phase 4: the 4x4 grid swells into the aperture, satellites appear,
  // everything settles, then collapses back to the centre.
  // Edge dot (x small, y large), measured on (-A, -B).
  const edge = (start) => [
    k(start, A, B, DOT),
    k(58, 19, 57, 4.5),
    k(59, 20.5, 61.5, 5.5),
    k(60, 22.5, 68, 7),
    k(61, 25.5, 74.5, 9.5),
    k(62, 26.5, 80, 11.5),
    k(63, 27.5, 82, 13.5),
    k(64, 26.5, 78.5, 19),
    k(65, 25, 75, 24.5),
    k(66, 23, 70.5, 28.5),
    k(67, 22.5, 66, 27),
    k(68, 20.5, 62, 25),
    k(69, 19.5, 58, 21.5),
    k(70, 18.5, 55.5, 19.5),
    k(71, 18.5, 55, 18.5),
    k(84, 18.5, 55, 18.5),
    k(85, 18.5, 54.5, 15.5),
    k(86, 14.5, 44, 9.5),
    k(87, 10, 30, 4.5),
    k(88, 2, 6, 2, 0, 0.5),
  ];
  const corner = (late) => [
    late ? k(57, B, B, 0, 0, 0) : k(57, B, B, DOT),
    k(58, 56, 56, late ? 1.5 : 4.5, 0, late ? 0.5 : 1),
    k(59, 58, 58, late ? 3 : 5.5),
    k(60, 61.5, 61.5, late ? 4.5 : 7),
    k(61, 65, 65, late ? 6 : 8.5),
    k(62, 67, 67, late ? 8 : 10),
    k(63, 68.5, 68.5, late ? 11 : 12),
    k(64, 67, 67, 16.5),
    k(65, 65, 65, 21.5),
    k(66, 63, 63, 25.5),
    k(67, 60.5, 60.5, 25.5),
    k(68, 58.5, 58.5, 23.5),
    k(69, 56.5, 56.5, 21.5),
    k(70, 55.5, 55.5, 19.5),
    k(71, 55, 55, 18.5),
    k(84, 55, 55, 18.5),
    k(85, 46.5, 46.5, 13.5),
    k(86, 35, 35, 7.5),
    k(87, 24, 24, 3),
  ];
  const satellite = [
    k(64, 20.5, 93, 2.6, 0, 0.85),
    k(65, 21.5, 97.5, 3.5),
    k(66, 22.5, 101.5, 4.5),
    k(67, 22.5, 102.5, 5.5),
    k(68, 23, 102, 6.5),
    k(69, 22, 101, 8),
    k(70, 22, 98.5, 10.5),
    k(71, 21, 95.5, 12.5),
    k(72, 20.5, 92.5, 13),
    k(73, 19, 87, 10.5),
    k(74, 18.75, 84, 9.5),
    k(75, 18.5, 82.5, 9),
    k(76, 18.25, 82, 8.7),
    k(83, 18.25, 82, 8.7),
    k(84, 17.5, 77.5, 7.5),
    k(85, 14.5, 67, 5.5),
    k(86, 14.5, 44, 4),
  ];

  // Persisting grid dots from their arrival until phase 4 takes over.
  const hold = (x, y, from, to = 57) => stat(x, y, from, to);
  t.push(hold(B, -A, 34), hold(-B, -A, 35), hold(-B, A, 34), hold(B, A, 37));
  t.push(hold(-B, -B, 43), hold(A, -B, 44.5), hold(-A, B, 44.5), hold(-A, -B, 48), hold(A, B, 48));
  t.push(hold(-B, B, 53));

  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    t.push(map(edge(57), mirror(sx, sy)), map(edge(57), mirror(sx, sy, true)));
    t.push(map(corner(sx === 1 && sy === 1), mirror(sx, sy)));
    t.push(tint(map(satellite, mirror(sx, sy)), YELLOW), tint(map(satellite, mirror(sx, sy, true)), YELLOW));
  }
  return t.filter((tr) => tr.length > 1);
}

const TRACKS = buildTracks();

function sample(track, f) {
  if (f < track[0][0] || f > track[track.length - 1][0]) return null;
  let i = 0;
  while (i < track.length - 2 && f > track[i + 1][0]) i++;
  const p = track[i];
  const q = track[i + 1];
  const u = q[0] === p[0] ? 1 : (f - p[0]) / (q[0] - p[0]);
  const out = new Array(6);
  for (let j = 1; j < 6; j++) out[j] = p[j] + (q[j] - p[j]) * u;
  // A ring that turns into a disc (or back) switches at the keyframe.
  if (p[4] === 0 || q[4] === 0) out[4] = u < 0.5 ? p[4] : q[4];
  return out;
}

function draw(ctx, f, size, dpr) {
  const s = (size * dpr) / (EXTENT * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size * dpr, size * dpr);
  ctx.setTransform(s, 0, 0, s, (size * dpr) / 2, (size * dpr) / 2);
  for (const tr of TRACKS) {
    const v = sample(tr, f);
    if (!v) continue;
    ctx.fillStyle = tr.c || OFFWHITE;
    ctx.strokeStyle = tr.c || OFFWHITE;
    const [, x, y, d, sw, a] = v;
    if (d <= 0.2 || a <= 0.01) continue;
    ctx.globalAlpha = Math.min(1, a);
    ctx.beginPath();
    if (sw > 0 && sw * 2 < d) {
      ctx.lineWidth = sw;
      ctx.arc(x, y, (d - sw) / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.arc(x, y, d / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function DotAperture({ done, onSettled }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(done);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);
  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    let size = 0;
    let dpr = 1;
    const fit = () => {
      size = canvas.clientWidth || 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    };
    fit();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      draw(ctx, HOLD, size, dpr);
      if (onSettledRef.current) onSettledRef.current();
      return undefined;
    }
    const loop = (LAST - FIRST) * FRAME_MS;
    const t0 = performance.now();
    let raf = 0;
    let frozen = false;
    let last = FIRST;
    const tick = (now) => {
      const f = FIRST + (((now - t0) % loop) + loop) % loop / FRAME_MS;
      // Once loading is done, play on to the settled pose and hold it.
      if (doneRef.current && !frozen && last < HOLD && f >= HOLD && f < HOLD + 4) {
        frozen = true;
        if (onSettledRef.current) onSettledRef.current();
      }
      last = f;
      draw(ctx, frozen ? HOLD : f, size, dpr);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="journey-loader__anim" aria-hidden="true" />;
}

export default function JourneyLoader({ shown, pct, label, overlay, failed, onSettled }) {
  return (
    <div
      className={`journey-loader ${overlay === "fading" ? "journey-loader--done" : ""} ${failed ? "journey-loader--failed" : ""}`}
      role={failed ? "alert" : "progressbar"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={failed ? undefined : pct}
      aria-label={failed ? undefined : label}
    >
      {failed ? (
        <div className="journey-loader__box">
          <p className="journey-loader__eyebrow">Om Surve</p>
          <p className="journey-loader__msg">
            The 3D journey could not start in this browser.
            <br />
            It needs WebGL; try another browser or device.
          </p>
          <a className="journey-btn journey-btn--primary mt-6" href="#end">
            Skip to the end
          </a>
        </div>
      ) : (
        <div className="journey-loader__box">
          <p className="journey-loader__eyebrow">Om Surve</p>
          <DotAperture done={shown >= 1} onSettled={onSettled} />
          <p className="journey-loader__pct">
            {pct}
            <span>%</span>
          </p>
          <div className="journey-loader__track">
            <div className="journey-loader__bar" style={{ transform: `scaleX(${shown})` }} />
          </div>
          <p className="journey-loader__label">{label}</p>
        </div>
      )}
    </div>
  );
}
