import { glareTexture, lerp, loadTexture, smoothstep, track } from "../util";
import { createSky } from "./sky";

// Earth from low orbit over Bengaluru out to a dot with the Moon beside it.
// Units: Earth radius = 1. Day/night/cloud/atmosphere shading is custom.

const NOISE = `
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;

// Surface point for a latitude/longitude on three's sphere UV layout.
const surface = (THREE, latDeg, lonDeg) => {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
};

export const createEarth = async (THREE, { tier, maxTex }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 4000);
  const sunDir = surface(THREE, 12, 48);

  const high = tier === "h" && maxTex >= 8192;
  const [day, night, clouds, detail, moonTex, sky] = await Promise.all([
    loadTexture(THREE, high ? "/space/earth_day_8k.jpg" : "/space/earth_day_4k.jpg", { anisotropy: 16 }),
    loadTexture(THREE, tier === "h" ? "/space/earth_night_4k.jpg" : "/space/earth_night_2k.jpg"),
    loadTexture(THREE, tier === "h" ? "/space/earth_clouds_4k.jpg" : "/space/earth_clouds_2k.jpg", { srgb: false, wrap: true }),
    loadTexture(THREE, "/space/earth_india_3k.jpg", { anisotropy: 16 }),
    loadTexture(THREE, "/space/moon_2k.jpg"),
    createSky(THREE, { radius: 2500, tier, intensity: 0.5 }),
  ]);
  // The sky is tilted so Earth's axis is not aligned with the galactic pole.
  sky.group.rotation.set(1.1, 0.4, 0.3);
  scene.add(sky.group);

  const earthUniforms = {
    dayMap: { value: day },
    nightMap: { value: night },
    cloudMap: { value: clouds },
    detailMap: { value: detail },
    sunDir: { value: sunDir },
    cloudShift: { value: 0 },
    time: { value: 0 },
  };
  const earthMat = new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D dayMap, nightMap, cloudMap, detailMap; uniform vec3 sunDir; uniform float cloudShift;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(sunDir);
        vec3 day = texture2D(dayMap, vUv).rgb;
        float lon = vUv.x * 360.0 - 180.0; float lat = vUv.y * 180.0 - 90.0;
        vec2 duv = vec2((lon - 55.0) / 50.0, (lat + 5.0) / 50.0);
        float inside = smoothstep(0.0, 0.08, duv.x) * smoothstep(1.0, 0.92, duv.x) * smoothstep(0.0, 0.08, duv.y) * smoothstep(1.0, 0.92, duv.y);
        day = mix(day, texture2D(detailMap, duv).rgb, inside);
        float NdL = dot(N, L);
        float dayAmt = smoothstep(-0.1, 0.3, NdL);
        float cloud = texture2D(cloudMap, vec2(vUv.x + cloudShift, vUv.y)).r;
        float ocean = smoothstep(0.01, 0.08, day.b - max(day.r, day.g) * 1.05);
        vec3 surf = day * (0.02 + 0.98 * max(NdL, 0.0));
        surf *= 1.0 - 0.5 * cloud * dayAmt;
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 90.0) * ocean * 0.9 * dayAmt;
        surf += spec * vec3(1.0, 0.93, 0.8);
        vec3 night = texture2D(nightMap, vUv).rgb;
        float nightAmt = 1.0 - smoothstep(-0.18, 0.06, NdL);
        surf += night * vec3(1.0, 0.78, 0.5) * 1.5 * nightAmt;
        // Thin blue rim from inside the atmosphere.
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
        surf += vec3(0.35, 0.55, 1.0) * fres * (0.15 + 0.85 * dayAmt) * 0.9;
        gl_FragColor = vec4(surf, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 192), earthMat);
  scene.add(earth);

  // Cloud shell with lit, twilight-tinted clouds.
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { cloudMap: { value: clouds }, sunDir: { value: sunDir }, cloudShift: earthUniforms.cloudShift },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D cloudMap; uniform vec3 sunDir; uniform float cloudShift;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN); vec3 L = normalize(sunDir); vec3 V = normalize(cameraPosition - vW);
        float c = texture2D(cloudMap, vec2(vUv.x + cloudShift, vUv.y)).r;
        float NdL = dot(N, L);
        vec3 col = vec3(1.0) * (0.02 + 0.98 * max(NdL, 0.0));
        col *= mix(vec3(1.0), vec3(1.0, 0.55, 0.3), smoothstep(0.3, 0.0, NdL) * smoothstep(-0.2, 0.0, NdL));
        float a = smoothstep(0.05, 0.9, c) * 0.95;
        // Fade the thin shell at grazing angles so the limb stays clean.
        a *= smoothstep(0.0, 0.25, dot(N, V));
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(1.006, 192, 128), cloudMat);
  scene.add(cloudShell);

  // Atmosphere halo just outside the limb.
  const atmMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sunDir } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vN; varying vec3 vW;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      precision highp float;
      uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        float a = max(dot(N, V), 0.0);
        float band = smoothstep(0.0, 0.42, a) * pow(1.0 - a, 1.2);
        float lit = smoothstep(-0.35, 0.3, dot(N, normalize(sunDir)));
        vec3 col = mix(vec3(0.9, 0.5, 0.25), vec3(0.35, 0.6, 1.0), smoothstep(-0.1, 0.35, dot(N, normalize(sunDir))));
        gl_FragColor = vec4(col * band * lit * 1.6, band * lit);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 128, 96), atmMat));

  // Moon (closer than life so it reads in frame).
  const moonLight = new THREE.DirectionalLight(0xffffff, 2.6);
  moonLight.position.copy(sunDir).multiplyScalar(100);
  scene.add(moonLight, new THREE.AmbientLight(0xffffff, 0.02));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 96, 64), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }));
  const moonDir = new THREE.Vector3(-0.75, 0.18, -0.6).normalize();
  moon.position.copy(moonDir).multiplyScalar(26);
  scene.add(moon);

  // Sun glare far away in the light direction.
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTexture(THREE, 512), color: 0xfff3dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glare.position.copy(sunDir).multiplyScalar(2000);
  glare.scale.setScalar(380);
  scene.add(glare);

  const blr = surface(THREE, 12.97, 77.59);
  const upRef = new THREE.Vector3(0, 1, 0);
  const camDir = new THREE.Vector3();
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const resize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const update = ({ t, time }) => {
    earthUniforms.cloudShift.value = time * 0.00012;
    sky.setTime(time);
    earth.rotation.y = t * 0.35;
    cloudShell.rotation.y = t * 0.35;
    // Distance from the centre (log keyframes) and the viewing direction,
    // which drifts eastward so the planet turns beneath the camera.
    const d = track([[0, 1.07], [0.18, 1.6], [0.4, 3.4], [0.62, 9], [0.82, 60], [1, 420]], t, { log: true });
    const lift = smoothstep(0.0, 0.5, t);
    camDir.copy(blr).applyAxisAngle(upRef, earth.rotation.y + lerp(0.0, 0.5, lift)).normalize();
    // Tilt the approach so the horizon is visible from orbit.
    const side = new THREE.Vector3().crossVectors(camDir, upRef).normalize();
    camDir.applyAxisAngle(side, lerp(-0.22, 0.0, lift)).normalize();
    camera.position.copy(camDir).multiplyScalar(d);
    // Look: a point ahead on the surface from orbit, the centre later.
    look.copy(blr).applyAxisAngle(upRef, earth.rotation.y + 0.09).multiplyScalar(1.0);
    target.copy(look).lerp(new THREE.Vector3(0, 0, 0), smoothstep(0.0, 0.35, t));
    camera.up.copy(upRef);
    camera.lookAt(target);
    camera.fov = lerp(44, 36, smoothstep(0.3, 0.8, t));
    camera.updateProjectionMatrix();
    sky.setScale(600);
  };
  return { scene, camera, update, resize, ready: Promise.resolve(), dispose: () => {} };
};
