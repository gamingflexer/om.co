import { lerp, smoothstep } from "../util";

// Full-screen procedural iris. The pupil is a window: alpha 0 inside it once
// `open` is 1, so the composite shows the next scene through it.
// t 0 → 1 zooms from the whole eye into the pupil; reverse mode mirrors it.

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
`;

export const createIris = (THREE) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    res: { value: new THREE.Vector2(1, 1) },
    zoom: { value: 1 },
    pupil: { value: 0.33 },
    open: { value: 0 },
    time: { value: 0 },
    lid: { value: 0 },
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
      uniform vec2 res; uniform float zoom; uniform float pupil; uniform float open; uniform float time; uniform float lid;
      ${NOISE}
      void main(){
        vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
        p /= zoom;
        float r = length(p);
        float ang = atan(p.y, p.x);
        // Pupil edge, slightly irregular.
        float pr = pupil * (1.0 + 0.015 * noise(vec2(ang * 6.0, 1.0)));
        float inPupil = 1.0 - smoothstep(pr - 0.012, pr + 0.012, r);
        // Iris fibres: fine in angle, coarse in radius, denser near the pupil.
        float rn = (r - pr) / max(1.0 - pr, 0.05);
        vec2 fp = vec2(ang * 9.0, rn * 4.0);
        float fiber = fbm(fp * vec2(2.5, 1.0)) * 0.6 + fbm(fp * vec2(7.0, 1.6) + 3.1) * 0.4;
        float crypt = fbm(p * 7.0 + 11.0);
        float ring = smoothstep(0.28, 0.36, rn) * (1.0 - smoothstep(0.38, 0.5, rn)); // collarette
        vec3 dark = vec3(0.16, 0.08, 0.03);
        vec3 brown = vec3(0.42, 0.22, 0.08);
        vec3 amber = vec3(0.74, 0.45, 0.16);
        vec3 col = mix(dark, brown, smoothstep(0.2, 0.75, fiber));
        col = mix(col, amber, smoothstep(0.62, 0.95, fiber) * 0.7);
        col = mix(col, amber * 1.15, ring * 0.45);
        col *= 0.75 + 0.5 * crypt;
        // Darker near the pupil and the limbal ring at the edge.
        col *= mix(0.55, 1.0, smoothstep(0.0, 0.25, rn));
        col *= 1.0 - 0.8 * smoothstep(0.78, 1.0, rn);
        // Sclera with a hint of veins and shadow under the upper lid.
        vec3 sclera = vec3(0.90, 0.87, 0.85);
        float vein = fbm(vec2(ang * 4.0, r * 3.0) + 5.0);
        sclera = mix(sclera, vec3(0.78, 0.42, 0.38), smoothstep(0.62, 0.9, vein) * 0.35 * smoothstep(1.0, 1.5, r));
        sclera *= 1.0 - 0.35 * smoothstep(1.0, 2.2, r);
        vec3 eye = mix(col, sclera, smoothstep(0.985, 1.03, r));
        eye *= 1.0 - 0.5 * smoothstep(0.45, 1.25, p.y + lid);
        eye = mix(eye, vec3(0.005, 0.003, 0.002), inPupil);
        // Corneal highlight.
        vec2 h1 = p - vec2(-0.36, 0.42);
        float hl = exp(-dot(h1 * vec2(5.0, 3.5), h1 * vec2(5.0, 3.5))) * 0.95;
        vec2 h2 = p - vec2(0.3, -0.35);
        hl += exp(-dot(h2 * 9.0, h2 * 9.0)) * 0.25;
        eye += vec3(1.0) * hl * (1.0 - inPupil * open);
        float alpha = 1.0 - inPupil * open;
        gl_FragColor = vec4(eye * alpha, alpha);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const resize = (w, h, dpr = 1) => uniforms.res.value.set(w * dpr, h * dpr);
  // Forward: t 0 (eye, pupil closed) → 1 (pupil fills the screen, open).
  const update = ({ t, time }) => {
    const u = t;
    uniforms.time.value = time;
    uniforms.zoom.value = Math.exp(lerp(Math.log(0.95), Math.log(6.0), u * u * (3 - 2 * u)));
    uniforms.pupil.value = lerp(0.4, 0.6, smoothstep(0.1, 0.9, u));
    uniforms.open.value = smoothstep(0.22, 0.42, u);
    uniforms.lid.value = lerp(0, 0.5, u);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => mat.dispose() };
};
