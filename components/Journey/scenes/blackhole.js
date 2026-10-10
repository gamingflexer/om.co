import { lerp, milkyWay, smoothstep, track } from "../util";

// A Schwarzschild black hole with a thin accretion disc, in the spirit of the
// Interstellar renders: light is bent around the hole, so the far side of the
// disc appears above and below the shadow, and the photon ring hugs it.
// Rays are integrated per pixel in the fragment shader (u'' = 1.5 u² − u in
// the ray's own plane) at reduced resolution into an internal target, which a
// full-screen quad then shows in the stage scene. Units: Schwarzschild radius = 1.

export const createBlackHole = async (THREE, { renderer, small, tier, reducedMotion }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sky = await milkyWay(THREE, tier);

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
    // The blue supergiant we turn to at the end (the next stage's star), a
    // point in the sky that is lensed like everything else.
    pDir: { value: new THREE.Vector3(1, 0, 0) },
    beacon: { value: 1 },
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
      uniform vec3 pDir; uniform float beacon;
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
        vec3 c = texture2D(sky, uv).rgb * 0.55;
        // The supergiant: a hot point with a soft halo (angles in radians).
        float th2 = max(2.0 * (1.0 - dot(d, pDir)), 0.0);
        c += vec3(0.72, 0.84, 1.0) * beacon * (7.0 * exp(-th2 / 1.4e-5) + 0.35 * exp(-th2 / 2.0e-4));
        return c;
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
        // Rays escape once they are well outside the start radius again, so
        // the camera can sit far out while the hole is still a speck.
        float escR = max(90.0, r0 * 1.05);
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
          float h = min(0.02 + 0.012 * r, 0.2);
          // RK4 on u'' = 1.5u² − u. (A first-order step's error depends on
          // how many steps a ray takes, which showed as rings in the sky.)
          float k1u = du;                 float k1v = 1.5 * u * u - u;
          float u2 = u + 0.5 * h * k1u;   float k2u = du + 0.5 * h * k1v; float k2v = 1.5 * u2 * u2 - u2;
          float u3 = u + 0.5 * h * k2u;   float k3u = du + 0.5 * h * k2v; float k3v = 1.5 * u3 * u3 - u3;
          float u4 = u + h * k3u;         float k4u = du + h * k3v;       float k4v = 1.5 * u4 * u4 - u4;
          u += h / 6.0 * (k1u + 2.0 * k2u + 2.0 * k3u + k4u);
          du += h / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
          phi += h;
          // Inside the photon sphere (r < 1.5) and still falling, a ray can
          // only end at the horizon, and the disc starts outside it at rIn:
          // stop here rather than march the last, smallest steps.
          if (u > 1.0 || (u > 0.6667 && du > 0.0)) { captured = true; break; }
          if (u < 1.0 / escR && du < 0.0) { escaped = true; break; }
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
          // Exact tangent of the orbit (the chord between steps is off by
          // half a step's angle): dP/dphi ∝ -(u'/u) n + n'.
          vec3 n = cos(phi) * e1 + sin(phi) * e2;
          vec3 nP = -sin(phi) * e1 + cos(phi) * e2;
          outDir = normalize(-(du / u) * n + nP);
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

  const scale = small ? 0.5 : 0.75;
  const resize = (w, h, dpr = 1) => {
    const W = Math.max(2, Math.floor(w * dpr * scale));
    const H = Math.max(2, Math.floor(h * dpr * scale));
    rt.setSize(W, H);
    uniforms.res.value.set(W, H);
  };

  const camM = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const toHole = new THREE.Vector3();
  // Camera path: zoom from a speck to the close-up (t 0 → 0.56), hold, then
  // back away and turn left (t 0.62 → 0.86, done before the next stage
  // fades in) until the hole has slid off to the
  // right and a blue supergiant sits in the middle of the frame: the star
  // that goes supernova in the next stage.
  const HOLD = 0.62;
  const TURNED = 0.86;
  const camAt = (t, out) => {
    const d = track([[0, 530], [0.08, 470], [0.28, 60], [0.44, 16], [0.56, 11.5], [HOLD, 11.5], [TURNED, 70]], t, { log: true });
    const o = Math.min(1, t / HOLD);
    const az = lerp(0.2, 1.4, o) + 0.15 * smoothstep(HOLD, TURNED, t);
    const el = track([[0, 0.05], [0.26, 0.14], [HOLD, 0.26]], t);
    return out.set(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d);
  };
  {
    const end = camAt(1, new THREE.Vector3());
    const f = end.clone().negate().normalize();
    const left = new THREE.Vector3().crossVectors(up, f).normalize();
    uniforms.pDir.value.copy(f).multiplyScalar(Math.cos(1.2)).addScaledVector(left, Math.sin(1.2)).addScaledVector(up, -0.08).normalize();
  }
  const update = ({ t, time }) => {
    uniforms.time.value = reducedMotion ? 0 : time;
    // Start where the stars stage left it, a speck far off (disc radius ~6%
    // of the half-height), then zoom all the way in, swinging a third of the
    // way round and climbing a little above the disc so its far side shows
    // over the top.
    const pos = camAt(t, uniforms.camPos.value);
    // Look slightly past the hole so it sits a touch off centre, then turn
    // to the supergiant.
    toHole.set(0, lerp(0.4, 0.0, Math.min(1, t / HOLD)), 0).sub(pos).normalize();
    fwd.copy(toHole).lerp(uniforms.pDir.value, smoothstep(HOLD, TURNED, t)).normalize();
    look.copy(pos).add(fwd);
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
