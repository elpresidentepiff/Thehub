// The Lloyds Wharf cleat (assets/brand/cleat.svg) as a real 3D mesh, cut from thick plate.
// Shared by every 3D study — iron.html and history-studies/neckinger.html — so the geometry
// is authored once and stays consistent everywhere it appears.
import * as THREE from 'three';

// cleat.svg units → metres-ish: 100 svg units = 1 world unit, plinth on y = 0
const P = (x, y) => [(x - 500) / 100, (288 - y) / 100];
const V = (x, y, z = 0) => new THREE.Vector3(...P(x, y), z);

function cubicPath(segments) {
  const path = new THREE.CurvePath();
  for (const [a, b, c, d] of segments) path.add(new THREE.CubicBezierCurve3(V(...a), V(...b), V(...c), V(...d)));
  return path;
}

export function buildCleat(material, { radius = 0.095 } = {}) {
  const g = new THREE.Group();
  const R = radius;
  const bar = (curve, samples = 160, closed = false) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, samples, R, 18, closed), material);
    m.scale.z = 2.6; // cut from thick plate: deeper than it is wide
    m.castShadow = true;
    g.add(m);
  };
  // horn (closed outline)
  bar(cubicPath([
    [[26, 52], [170, 22], [350, 14], [500, 14]],
    [[500, 14], [650, 14], [830, 22], [974, 52]],
    [[974, 52], [990, 62], [988, 82], [966, 88]],
    [[966, 88], [830, 68], [650, 60], [500, 60]],
    [[500, 60], [350, 60], [170, 68], [34, 88]],
    [[34, 88], [12, 82], [10, 62], [26, 52]],
  ]), 420, true);
  // body
  bar(cubicPath([
    [[196, 62], [202, 122], [252, 172], [322, 200]],
    [[322, 200], [394, 224], [606, 224], [678, 200]],
    [[678, 200], [748, 172], [798, 122], [804, 62]],
  ]), 240);
  // stem and plinth
  bar(new THREE.LineCurve3(V(500, 60), V(500, 288)), 8);
  const plinth = new THREE.CurvePath();
  [[240, 150, 190, 288], [190, 288, 810, 288], [810, 288, 760, 150]].forEach(([a, b, c, d]) =>
    plinth.add(new THREE.LineCurve3(V(a, b), V(c, d))));
  bar(plinth, 120);
  // slots and bolts
  for (const [cx, cy] of [[267, 212], [733, 212]]) {
    const shape = new THREE.Path();
    shape.absellipse(0, 0, 0.15, 0.22, 0, Math.PI * 2);
    const pts = shape.getPoints(40).map((p) => V(cx + p.x * 100, cy - p.y * 100));
    bar(new THREE.CatmullRomCurve3(pts, true), 60, true);
  }
  for (const cx of [238, 762]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, R, 14, 40), material);
    ring.position.set(...P(cx, 262), 0);
    ring.scale.z = 2.6;
    g.add(ring);
  }
  return g;
}
