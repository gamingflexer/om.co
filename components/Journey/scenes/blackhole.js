import { lerp, loadTexture, smoothstep, track } from "../util";

// A Schwarzschild black hole with a thin accretion disc, in the spirit of the
// Interstellar renders: light is bent around the hole, so the far side of the
// disc appears above and below the shadow, and the photon ring hugs it.
// Rays are integrated per pixel in the fragment shader (u'' = 1.5 u² − u in
// the ray's own plane) at reduced resolution into an internal target, which a
// full-screen quad then shows in the stage scene. Units: Schwarzschild radius = 1.

export const createBlackHole = async (THREE, { renderer, small, tier, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sky = await loadTexture(THREE, tier === "h" ? "/space/milkyway_4k.jpg" : "/space/milkyway_2k.jpg", { anisotropy: 4 });
  sky.wrapS = THREE.RepeatWrapping;

  const STEPS = small ? 110 : 170;
  const uniforms = {
    res: { value: new THREE.Vector2(1, 1) },
    camPos: { value: new THREE.Vector3(0, 2, 30) },
    camRot: { value: new THREE.Matrix3() },
    tanH: { value: Math.tan((38 * Math.PI) / 360) },
    sky: { value: sky },
    skyRot: { value: new THREE.Matrix3() },
    discN: { value: new THREE.Vector3(0, 1, 0) },
    rIn: { value: 1.6 },
    rOut: { value: 11.0 },
    time: { value: 0 },
    glow: { value: 1 },
  };
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const rtScene = new THREE.Scene();
  const rtMat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      precision highp float;
      uniform vec2 res; uniform vec3 camPos; uniform mat3 camRot; uniform float tanH;
      uniform sampler2D sky; uniform mat3 skyRot; uniform vec3 discN; uniform float rIn, rOut, time, glow;
      #define PI 3.14159265
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.1 + 3.7; a *= 0.5; } return v; }
      vec3 skyColor(vec3 d){
        vec3 g = skyRot * d;
        vec2 uv = vec2(atan(g.z, g.x) / (2.0 * PI) + 0.5, asin(clamp(g.y, -1.0, 1.0)) / PI + 0.5);
        return texture2D(sky, uv).rgb * 0.55;
      }
      // Black-body-ish ramp from a normalised temperature.
      vec3 bb(float t){
        vec3 c = mix(vec3(0.9, 0.18, 0.03), vec3(1.0, 0.55, 0.18), smoothstep(0.0, 0.35, t));
        c = mix(c, vec3(1.0, 0.86, 0.6), smoothstep(0.3, 0.65, t));
        c = mix(c, vec3(0.92, 0.95, 1.0), smoothstep(0.6, 1.0, t));
        return c;
      }
      // Disc radiance and opacity at (r, azimuth) with Keplerian shear.
      vec4 disc(float r, float az){
        float w = pow(r, -1.5) * 0.9;
        float a1 = az - w * time;
        float lr = log(r);
        float n = fbm(vec2(a1 * 3.0, lr * 9.0)) * 0.6 + fbm(vec2(a1 * 9.0 + 2.0, lr * 22.0)) * 0.4;
        float streak = fbm(vec2(a1 * 1.5, lr * 40.0 + 7.0));
        float d = smoothstep(0.0, 0.25, (r - rIn) / rIn) * (1.0 - smoothstep(0.55, 1.0, (r - rIn) / (rOut - rIn)));
        d *= 0.55 + 0.75 * n;
        float temp = pow(rIn / r, 0.75);
        float I = pow(temp, 3.2) * (0.7 + 0.9 * n) * (0.7 + 0.6 * streak) * 1.5;
        return vec4(bb(temp) * I, clamp(d * (0.7 + 0.5 * streak), 0.0, 1.0));
      }
      void main(){
        vec2 uv = (gl_FragCoord.xy / res) * 2.0 - 1.0;
        float aspect = res.x / res.y;
        vec3 dir = normalize(camRot * vec3(uv.x * aspect * tanH, uv.y * tanH, -1.0));
        vec3 pos = camPos;
        float r0 = length(pos);
        vec3 e1 = pos / r0;
        float dr = dot(dir, e1);
        vec3 tv = dir - dr * e1;
        float tl = length(tv);
        vec3 e2 = tl > 1e-5 ? tv / tl : normalize(cross(e1, vec3(0.0, 1.0, 0.0)));
        tl = max(tl, 1e-5);
        float u = 1.0 / r0;
        float du = -dr / (tl * r0);
        float phi = 0.0;
        vec3 col = vec3(0.0);
        float acc = 0.0;
        vec3 P = pos; vec3 Pp = pos;
        float sidePrev = dot(P, discN);
        bool captured = false; bool escaped = false;
        vec3 outDir = dir;
        for (int i = 0; i < ${STEPS}; i++){
          float r = 1.0 / u;
          float h = 0.02 + 0.012 * r;
          // Semi-implicit Euler on u'' = 1.5u² − u.
          du += (1.5 * u * u - u) * h;
          u += du * h;
          phi += h;
          if (u > 1.0) { captured = true; break; }
          if (u < 1.0 / 90.0) { escaped = true; break; }
          r = 1.0 / u;
          Pp = P;
          P = r * (cos(phi) * e1 + sin(phi) * e2);
          float side = dot(P, discN);
          if (side * sidePrev < 0.0 && acc < 0.98) {
            float f = sidePrev / (sidePrev - side);
            vec3 X = mix(Pp, P, f);
            float rc = length(X);
            if (rc > rIn && rc < rOut) {
              vec3 rad = normalize(X);
              vec3 tang = normalize(cross(discN, rad));
              float az = atan(dot(X, cross(discN, vec3(1.0, 0.0, 0.0))), dot(X, vec3(1.0, 0.0, 0.0)));
              vec4 D = disc(rc, az);
              // Doppler beaming and gravitational redshift.
              vec3 ray = normalize(P - Pp);
              float v = sqrt(0.5 / rc);
              float cosA = dot(tang, -ray);
              float gam = 1.0 / sqrt(1.0 - v * v);
              float dop = 1.0 / (gam * (1.0 - v * cosA));
              float g = dop * sqrt(max(1.0 - 1.0 / rc, 0.0));
              vec3 c = D.rgb * pow(g, 3.0);
              c = mix(c, c * vec3(0.75, 0.85, 1.25), smoothstep(1.0, 1.6, g) * 0.5);
              c = mix(c, c * vec3(1.2, 0.7, 0.45), smoothstep(1.0, 0.6, g) * 0.5);
              col += (1.0 - acc) * c * D.a;
              acc += (1.0 - acc) * D.a;
            }
          }
          sidePrev = side;
          outDir = normalize(P - Pp);
        }
        if (!captured) {
          if (!escaped) outDir = normalize(P - Pp);
          col += (1.0 - acc) * skyColor(outDir);
        }
        col *= glow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  rtScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rtMat));
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt.texture, depthTest: false, depthWrite: false }));
  scene.add(quad);

  // The sky is rotated so the galactic plane runs diagonally behind the hole.
  const skyM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.9, 0.3, 0.5));
  uniforms.skyRot.value.setFromMatrix4(skyM);
  const discM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.0, 0.0, 0.0));
  uniforms.discN.value.set(0, 1, 0).applyMatrix4(discM).normalize();

  const scale = small ? 0.4 : 0.5;
  const resize = (w, h, dpr = 1) => {
    const W = Math.max(2, Math.floor(w * dpr * scale));
    const H = Math.max(2, Math.floor(h * dpr * scale));
    rt.setSize(W, H);
    uniforms.res.value.set(W, H);
  };

  const camM = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Vector3();
  const update = ({ t, time }) => {
    uniforms.time.value = reducedMotion ? 0 : time;
    // Approach from far out, swing a third of the way round and climb a
    // little above the disc so its far side shows over the top.
    const d = track([[0, 46], [0.35, 22], [0.75, 13.5], [1, 11]], t, { log: true });
    const az = lerp(0.2, 1.4, t);
    const el = track([[0, 0.05], [0.4, 0.14], [1, 0.26]], t);
    const pos = uniforms.camPos.value;
    pos.set(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d);
    // Look slightly past the hole so it sits a touch off centre.
    look.set(0, lerp(0.4, 0.0, t), 0);
    camM.lookAt(pos, look, up);
    uniforms.camRot.value.setFromMatrix4(camM);
    uniforms.glow.value = smoothstep(0.0, 0.08, t);
  };
  // Render the raymarch into the internal target before the stage draws the quad.
  const updateAndRender = (args) => {
    update(args);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(rtScene, camera);
    renderer.setRenderTarget(prev);
  };
  return {
    scene,
    camera,
    update: updateAndRender,
    resize,
    ready: Promise.resolve(),
    dispose: () => {
      rt.dispose();
      rtMat.dispose();
    },
  };
};
