// A brick tube of varying radius: narrow underground culvert widening into the open dock.
// TubeGeometry can't vary its radius along the path, so this builds the rings by hand from the
// curve's Frenet frames — the same construction, with radius as a function of arc-length t.
import * as THREE from 'three';
import { PARTS } from '../cleat-studies/cleat.js';

/**
 * @param curve       THREE.Curve, sampled 0..1
 * @param radiusAt    (t) => metres
 * @param segments    rings along the curve
 * @param radial      points per ring
 * @param uvScale     [aroundRepeats, alongRepeatsPerMetre] for a tileable brick texture
 */
export function buildVaryingTube(curve, radiusAt, segments, radial, uvScale = [3, 0.6]) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  let along = 0;
  let prevPoint = curve.getPointAt(0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    if (i > 0) along += point.distanceTo(prevPoint);
    prevPoint = point;
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const nx = normal.x * cos + binormal.x * sin;
      const ny = normal.y * cos + binormal.y * sin;
      const nz = normal.z * cos + binormal.z * sin;
      positions.push(point.x + r * nx, point.y + r * ny, point.z + r * nz);
      normals.push(-nx, -ny, -nz); // facing inward: we are inside the tube
      uvs.push((j / radial) * uvScale[0], along * uvScale[1]);
    }
  }

  const indices = [];
  const ring = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = a + ring;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** A soft-edged cone of light with drifting dust, additively blended — the classic cheap
 *  volumetric-shaft trick: no raymarching, just a shaded translucent mesh. */
export function buildLightShaft() {
  const geo = new THREE.ConeGeometry(1, 1, 32, 1, true);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xfee6b5) }, uOpacity: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying float vY;
      void main() {
        vUv = uv; vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uOpacity; uniform vec3 uColor;
      varying vec2 vUv; varying float vY;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main() {
        float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;         // soft cone edge
        float fall = smoothstep(0.0, 1.0, 1.0 + vY);        // fades to nothing at the tip
        float drift = hash(vUv * vec2(3.0, 40.0) + floor(uTime * 0.6));
        float dust = smoothstep(0.72, 1.0, drift) * 0.5;
        float a = edge * edge * fall * uOpacity * (0.22 + dust);
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

/** Cast iron, not rubber: a canvas-baked mottle of pitting, casting-sand freckle and the odd
 *  streak of rust bleed, used as both the colour and roughness map. No purchased PBR asset —
 *  built the same way as the brick and the signs. */
export function weatheredIronTextures({ size = 512 } = {}) {
  const color = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = rough.width = color.height = rough.height = size;
  const cx = color.getContext('2d');
  const rx = rough.getContext('2d');
  cx.fillStyle = '#141110';
  cx.fillRect(0, 0, size, size);
  rx.fillStyle = '#8a8a8a'; // mid roughness base
  rx.fillRect(0, 0, size, size);

  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  // casting-sand freckle: thousands of tiny flecks, lighter and darker than the base
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.4 + rnd() * 1.1;
    const dark = rnd() < 0.5;
    cx.fillStyle = dark ? 'rgba(0,0,0,.35)' : 'rgba(120,108,92,.22)';
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
    rx.fillStyle = `rgba(255,255,255,${(dark ? 0.15 : 0.28) * rnd()})`;
    rx.beginPath();
    rx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    rx.fill();
  }
  // pitting: sparser, larger, darker pockmarks with a soft roughness halo
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.5 + rnd() * 4;
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
    rx.fillStyle = `rgba(255,255,255,${0.35 * rnd()})`;
    rx.beginPath();
    rx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    rx.fill();
  }
  // rust bleed: a few soft warm streaks running with gravity
  for (let i = 0; i < 5; i++) {
    const x = rnd() * size;
    const y0 = rnd() * size * 0.4;
    const len = size * (0.25 + rnd() * 0.35);
    const g = cx.createLinearGradient(x, y0, x + (rnd() - 0.5) * 30, y0 + len);
    g.addColorStop(0, 'rgba(122,78,34,.28)');
    g.addColorStop(1, 'rgba(122,78,34,0)');
    cx.strokeStyle = g;
    cx.lineWidth = 6 + rnd() * 10;
    cx.beginPath();
    cx.moveTo(x, y0);
    cx.lineTo(x + (rnd() - 0.5) * 30, y0 + len);
    cx.stroke();
  }

  return { colorCanvas: color, roughCanvas: rough };
}

/** A period-painted sign, canvas-rendered so no extra asset is needed. Same hand as the real
 *  "RIVER NECKINGER" wall inside the Hub. */
export function paintedSignTexture(lines, { w = 1024, h = 512 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0)';
  x.fillRect(0, 0, w, h);
  x.textAlign = 'center';
  x.fillStyle = '#EFE7DA';
  lines.forEach((line, i) => {
    x.font = `${line.weight ?? 700} ${line.size ?? 60}px Archivo, sans-serif`;
    x.globalAlpha = line.dim ? 0.72 : 1;
    x.fillText(line.text, w / 2, h * 0.5 + (line.dy ?? 0));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The confirmed logo lockup (operator, 25 Sep): THE HUB @ LLOYDS WHARF, the cleat, ESTD 1857,
 *  WORK CONNECT BELONG — one sign, same as the real entrance wall, not a separate cleat object
 *  and a separate wall text. The cleat icon is the same path data as everywhere else in the
 *  project (cleat.js), rasterised once and drawn onto this canvas alongside the type. */
export function wallLogoTexture({ w = 1400, h = 1500 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.fillStyle = '#EFE7DA';
  x.font = '800 130px Archivo, sans-serif';
  x.fillText('THE HUB', w / 2, h * 0.145);
  x.font = '600 58px Archivo, sans-serif';
  x.fillText('@ LLOYDS WHARF', w / 2, h * 0.225);
  x.font = '600 46px Archivo, sans-serif';
  x.globalAlpha = 0.8;
  x.fillText('ESTD 1857', w / 2, h * 0.79);
  x.font = '600 34px Archivo, sans-serif';
  x.fillText('WORK      CONNECT      BELONG', w / 2, h * 0.87);
  x.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const icon = new Image();
  icon.onload = () => {
    const iw = w * 0.5;
    const ih = (iw * 340) / 1000;
    x.drawImage(icon, (w - iw) / 2, h * 0.36, iw, ih);
    tex.needsUpdate = true;
  };
  icon.src =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 340">` +
        `<g fill="none" stroke="#EFE7DA" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">${PARTS}</g></svg>`,
    );
  return tex;
}
