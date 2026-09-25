// A brick tube of varying radius: narrow underground culvert widening into the open dock.
// TubeGeometry can't vary its radius along the path, so this builds the rings by hand from the
// curve's Frenet frames — the same construction, with radius as a function of arc-length t.
import * as THREE from 'three';

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
