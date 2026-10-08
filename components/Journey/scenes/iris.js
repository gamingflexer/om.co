import { lerp, smoothstep } from "../util";

// Full-screen procedural eye: skin and lids, lashes, sclera with veins, a
// fibrous brown iris, and a pupil that is a window (alpha 0 once `open` is 1)
// so the composite shows the next scene through it.
// t 0 → 1 zooms from the whole eye into the pupil; reverse mode mirrors it.
// The starting zoom is chosen so the iris is the same size on screen as the
// 3D eye at the end of the meadow stage, which makes the dissolve a push.

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; }
    return v;
  }
  // Ridged noise for the iris fibres.
  float ridge(vec2 p){
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++){ v += a * (1.0 - abs(noise(p) * 2.0 - 1.0)); p = p * 2.1 + vec2(3.7, 1.9); a *= 0.5; }
    return v;
  }
`;

export const createIris = (THREE) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    res: { value: new THREE.Vector2(1, 1) },
    zoom: { value: 0.3 },
    pupil: { value: 0.33 },
    open: { value: 0 },
    time: { value: 0 },
    lidOpen: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      precision highp float;
      uniform vec2 res; uniform float zoom; uniform float pupil; uniform float open; uniform float time; uniform float lidOpen;
      ${NOISE}

      // Lid edges as y(x): upper and lower curves of the almond opening.
      float upperLid(float x){ float u = clamp(x / 2.05, -1.0, 1.0); return 0.96 * lidOpen * pow(max(1.0 - u * u, 0.0), 0.58) * (1.0 - 0.1 * u) - 0.04; }
      float lowerLid(float x){ float u = clamp(x / 2.05, -1.0, 1.0); return -0.86 * pow(max(1.0 - u * u, 0.0), 0.75) * (1.0 + 0.04 * u) - 0.04; }

      void main(){
        vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
        p /= zoom;
        float r = length(p);
        float ang = atan(p.y, p.x);

        // ---- Iris ----
        float pr = pupil * (1.0 + 0.012 * noise(vec2(ang * 7.0, 1.0)) + 0.006 * noise(vec2(ang * 23.0, 4.0)));
        float inPupil = 1.0 - smoothstep(pr - 0.008, pr + 0.008, r);
        float rn = clamp((r - pr) / max(1.0 - pr, 0.05), 0.0, 1.0);
        // Fibres radiate from the pupil: fine in angle, stretched in radius.
        vec2 fp = vec2(ang * 11.0, rn * 3.0);
        float fiber = ridge(fp * vec2(2.2, 1.0)) * 0.55 + ridge(fp * vec2(6.0, 1.3) + 5.0) * 0.3 + fbm(fp * vec2(14.0, 2.0) + 9.0) * 0.15;
        float crypt = fbm(p * 6.5 + 11.0);
        float crypt2 = fbm(p * 16.0 + 3.0);
        // Collarette: the wavy ridge a third of the way out.
        float collar = smoothstep(0.26, 0.34, rn + 0.03 * noise(vec2(ang * 9.0, 2.0))) * (1.0 - smoothstep(0.36, 0.5, rn));
        vec3 dark = vec3(0.10, 0.05, 0.02);
        vec3 brown = vec3(0.33, 0.165, 0.06);
        vec3 amber = vec3(0.62, 0.36, 0.12);
        vec3 honey = vec3(0.78, 0.52, 0.22);
        vec3 col = mix(dark, brown, smoothstep(0.25, 0.72, fiber));
        col = mix(col, amber, smoothstep(0.6, 0.92, fiber) * 0.75);
        col = mix(col, honey, smoothstep(0.78, 0.98, fiber) * collar * 0.9);
        col = mix(col, amber * 1.1, collar * 0.35);
        col *= 0.7 + 0.6 * crypt;
        col *= 0.85 + 0.3 * crypt2;
        // Darker crypts at the collarette, the pupillary ruff, the limbal ring.
        col *= 1.0 - 0.35 * smoothstep(0.55, 0.9, crypt) * smoothstep(0.3, 0.5, rn) * (1.0 - smoothstep(0.5, 0.75, rn));
        col *= mix(0.45, 1.0, smoothstep(0.0, 0.2, rn));
        col *= 1.0 - 0.85 * smoothstep(0.8, 1.0, rn);
        // Shadow of the upper lid on the iris (ambient occlusion).
        col *= 1.0 - 0.35 * smoothstep(0.3, 1.1, p.y);

        // ---- Sclera ----
        vec3 sclera = vec3(0.90, 0.86, 0.80);
        float vein = fbm(vec2(ang * 5.0, r * 2.5) + 5.0) * 0.6 + fbm(p * 9.0 + 1.0) * 0.4;
        float veinM = smoothstep(0.6, 0.78, vein) * smoothstep(1.05, 1.8, r) * 0.45;
        sclera = mix(sclera, vec3(0.78, 0.38, 0.34), veinM);
        // Pinker towards the corners; darker under the lids.
        sclera = mix(sclera, vec3(0.86, 0.66, 0.62), smoothstep(1.6, 2.3, abs(p.x)));
        float ul = upperLid(p.x); float ll = lowerLid(p.x);
        float lidAO = smoothstep(0.0, 0.45, ul - p.y);
        float lidAOlow = smoothstep(0.0, 0.25, p.y - ll);
        sclera *= 0.35 + 0.65 * lidAO;
        sclera *= 0.7 + 0.3 * lidAOlow;
        sclera *= 0.82 + 0.18 * smoothstep(1.2, -0.8, p.y);
        // Limbal blur: the iris edge is soft where it meets the sclera.
        vec3 eye = mix(col, sclera, smoothstep(0.975, 1.03, r));
        eye = mix(eye, vec3(0.006, 0.003, 0.002), inPupil);
        // Wet highlights (two windows).
        vec2 h1 = p - vec2(-0.38, 0.4);
        float hl = exp(-dot(h1 * vec2(4.6, 3.2), h1 * vec2(4.6, 3.2))) * 0.95;
        vec2 h2 = p - vec2(0.32, -0.38);
        hl += exp(-dot(h2 * 9.0, h2 * 9.0)) * 0.22;
        // Soft overall sheen across the cornea.
        hl += 0.06 * smoothstep(1.0, 0.0, r) * smoothstep(-0.2, 0.9, p.y);
        float inside = smoothstep(-0.01, 0.01, p.y - ll) * smoothstep(-0.01, 0.01, ul - p.y);

        // ---- Skin, lids and lashes ----
        vec3 skin = vec3(0.50, 0.30, 0.19);
        float pores = fbm(p * 18.0 + 7.0);
        skin *= 0.88 + 0.24 * pores;
        skin *= 0.92 + 0.16 * fbm(p * 3.0);
        skin = mix(skin, vec3(0.58, 0.36, 0.24), 0.35 * smoothstep(-0.2, 0.8, -p.y));
        // Lid crease above the upper lid and the darker lid margin.
        float creaseD = p.y - (ul + 0.42 + 0.06 * noise(vec2(p.x * 1.5, 0.0)));
        skin *= 1.0 - 0.35 * exp(-creaseD * creaseD * 60.0) * step(0.0, p.y - ul);
        float margin = exp(-(p.y - ul) * (p.y - ul) * 300.0) * step(0.0, p.y - ul);
        skin = mix(skin, vec3(0.42, 0.22, 0.16), margin * 0.8);
        float marginL = exp(-(p.y - ll) * (p.y - ll) * 500.0) * step(0.0, ll - p.y);
        skin = mix(skin, vec3(0.62, 0.42, 0.34), marginL * 0.7);
        // Under-eye shadow and the shading of the brow ridge.
        skin *= 1.0 - 0.3 * smoothstep(0.0, 0.9, ll - p.y) * (1.0 - smoothstep(0.9, 1.6, ll - p.y));
        skin *= 1.0 - 0.25 * smoothstep(0.8, 2.4, p.y - ul);
        // Lashes: dark strokes that fan out from the upper lid margin.
        float lx = p.x * 22.0 + 0.8 * noise(vec2(p.x * 5.0, 1.0));
        float lashN = hash(vec2(floor(lx), 1.0));
        float lashN2b = hash(vec2(floor(lx), 7.0));
        float lashLen = 0.16 + 0.26 * lashN * (1.0 - 0.5 * smoothstep(1.2, 2.0, abs(p.x)));
        float curl = sign(p.x + 0.3) * (0.25 + 0.3 * lashN2b) * smoothstep(0.0, 1.6, abs(p.x)) + (lashN2b - 0.5) * 0.2;
        float along = (p.y - ul) / lashLen;
        float lashCore = abs(fract(lx) - 0.5 - curl * along * along);
        float width = mix(0.14, 0.02, clamp(along, 0.0, 1.0));
        float lash = (1.0 - smoothstep(width * 0.6, width, lashCore)) * step(0.0, along) * (1.0 - smoothstep(0.85, 1.0, along));
        lash *= step(0.42, lashN);
        skin = mix(skin, vec3(0.05, 0.03, 0.02), lash * 0.9);
        // Lashes also fall across the top of the eye as a shadow.
        float lashShadow = (1.0 - smoothstep(0.02, 0.24, ul - p.y)) * inside;
        eye *= 1.0 - 0.35 * lashShadow;
        // Lower lashes, sparser and shorter.
        float lx2 = p.x * 16.0 + 3.0 + 0.5 * noise(vec2(p.x * 3.0, 2.0));
        float lashN2 = hash(vec2(floor(lx2), 2.0));
        float along2 = (ll - p.y) / (0.06 + 0.1 * lashN2);
        float width2 = mix(0.1, 0.02, clamp(along2, 0.0, 1.0));
        float lash2 = (1.0 - smoothstep(width2 * 0.6, width2, abs(fract(lx2) - 0.5 - (lashN2 - 0.5) * 0.3 * along2))) * step(0.0, along2) * (1.0 - smoothstep(0.7, 1.0, along2)) * step(0.6, lashN2);
        skin = mix(skin, vec3(0.08, 0.05, 0.04), lash2 * 0.6);

        vec3 outCol = mix(skin, eye + vec3(1.0) * hl * (1.0 - inPupil * open), inside);
        float alpha = 1.0 - inPupil * open * inside;
        gl_FragColor = vec4(outCol * alpha, alpha);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const resize = (w, h, dpr = 1) => uniforms.res.value.set(w * dpr, h * dpr);
  // Forward: t 0 (whole eye, iris as big as the 3D one) → 1 (pupil fills the
  // screen, open).
  const update = ({ t, time }) => {
    const u = t;
    uniforms.time.value = time;
    uniforms.zoom.value = Math.exp(lerp(Math.log(0.62), Math.log(7.0), u * u * (3 - 2 * u)));
    uniforms.pupil.value = lerp(0.36, 0.62, smoothstep(0.15, 0.9, u));
    uniforms.open.value = smoothstep(0.3, 0.5, u);
    uniforms.lidOpen.value = lerp(1.0, 1.15, smoothstep(0.0, 0.6, u));
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => mat.dispose() };
};
