'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import './floor-3d.css';

const LAB_MARKER = '__HUB_LAB__';
const WIDTH = 31.707;
const DEPTH = 18.442;

type Segment = readonly [number, number, number, number];
type ViewName = 'perspective' | 'top' | 'inside';

interface RegistryUnit {
  id: string;
  kind: string;
  label: string;
  capacity: number;
  x_m: number;
  y_m: number;
  rot_deg: number;
  footprint: number[][];
}

interface Registry {
  floor: { name: string; width_m: number; height_m: number };
  status: string;
  units: RegistryUnit[];
}

const VIEW_LABEL: Record<ViewName, string> = {
  perspective: 'Perspective',
  top: 'Plan view',
  inside: 'Floor level',
};

const KIND_LABEL: Record<string, string> = {
  desk: 'Desk',
  meeting_room: 'Meeting room',
  private_office: 'Private office',
  event_space: 'Event space',
};

function parseSegments(svg: string, layer: string): Segment[] {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const d = document.querySelector(`#${layer} path`)?.getAttribute('d') ?? '';
  const expression = /M(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)L(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  return Array.from(d.matchAll(expression), (match) => [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])] as const);
}

function usePlanGeometry(planSrc: string) {
  const [geometry, setGeometry] = useState<{ structure: Segment[]; partition: Segment[] }>({ structure: [], partition: [] });

  useEffect(() => {
    let active = true;
    fetch(planSrc)
      .then((response) => response.text())
      .then((svg) => {
        if (active) setGeometry({ structure: parseSegments(svg, 'structure'), partition: parseSegments(svg, 'partition') });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [planSrc]);

  return geometry;
}

function makeHerringboneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#A48F7C';
  context.fillRect(0, 0, 256, 256);
  context.lineWidth = 3;
  context.strokeStyle = '#C8B7A8';
  for (let row = -1; row < 6; row += 1) {
    for (let column = -1; column < 6; column += 1) {
      const x = column * 56 + (row % 2 ? 28 : 0);
      const y = row * 56;
      context.beginPath();
      context.moveTo(x - 42, y);
      context.lineTo(x, y + 42);
      context.lineTo(x + 42, y);
      context.stroke();
      context.strokeStyle = '#8D7968';
      context.beginPath();
      context.moveTo(x, y + 42);
      context.lineTo(x + 42, y + 84);
      context.stroke();
      context.strokeStyle = '#C8B7A8';
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function InstancedSegments({ segments, height, thickness, color, opacity = 1 }: {
  segments: Segment[];
  height: number;
  thickness: number;
  color: string;
  opacity?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    segments.forEach(([x1, y1, x2, y2], index) => {
      const dx = x2 - x1;
      const dz = y2 - y1;
      object.position.set((x1 + x2) / 2 - WIDTH / 2, height / 2, (y1 + y2) / 2 - DEPTH / 2);
      object.rotation.set(0, -Math.atan2(dz, dx), 0);
      object.scale.set(Math.hypot(dx, dz), height, thickness);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [height, segments, thickness]);

  if (!segments.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, segments.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.82} metalness={color === '#342D2F' ? 0.28 : 0} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  );
}

function Desk({ unit, selected, onSelect }: { unit: RegistryUnit; selected: boolean; onSelect: (id: string) => void }) {
  const rotation = THREE.MathUtils.degToRad(-unit.rot_deg);
  return (
    <group
      position={[unit.x_m - WIDTH / 2, 0, unit.y_m - DEPTH / 2]}
      rotation={[0, rotation, 0]}
      onClick={(event) => { event.stopPropagation(); onSelect(unit.id); }}
    >
      <mesh position={[0, .77, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.34, .09, .68]} />
        <meshStandardMaterial color={selected ? '#FEE6B5' : '#E0DDDC'} roughness={0.58} />
      </mesh>
      {[-.54, .54].flatMap((x) => [-.25, .25].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, .38, z]} castShadow>
          <boxGeometry args={[.055, .72, .055]} />
          <meshStandardMaterial color="#72747E" metalness={0.48} roughness={0.42} />
        </mesh>
      )))}
      <group position={[0, .48, .73]}>
        <mesh castShadow>
          <boxGeometry args={[.54, .1, .5]} />
          <meshStandardMaterial color="#0F0E12" roughness={0.78} />
        </mesh>
        <mesh position={[0, .42, .22]} rotation={[-.12, 0, 0]} castShadow>
          <boxGeometry args={[.54, .72, .08]} />
          <meshStandardMaterial color="#0F0E12" roughness={0.72} />
        </mesh>
      </group>
    </group>
  );
}

function Room({ unit, selected, onSelect }: { unit: RegistryUnit; selected: boolean; onSelect: (id: string) => void }) {
  const segments = useMemo<Segment[]>(() => unit.footprint.map((point, index) => {
    const next = unit.footprint[(index + 1) % unit.footprint.length]!;
    return [point[0]!, point[1]!, next[0]!, next[1]!] as const;
  }), [unit.footprint]);
  const shape = useMemo(() => {
    const result = new THREE.Shape();
    unit.footprint.forEach(([x, y], index) => {
      const px = x! - WIDTH / 2;
      const py = -(y! - DEPTH / 2);
      if (index === 0) result.moveTo(px, py); else result.lineTo(px, py);
    });
    result.closePath();
    return result;
  }, [unit.footprint]);

  return (
    <group onClick={(event) => { event.stopPropagation(); onSelect(unit.id); }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={selected ? '#F8CF95' : '#7E8EB1'} transparent opacity={selected ? .52 : .24} roughness={.36} />
      </mesh>
      <InstancedSegments segments={segments} height={2.45} thickness={.055} color="#342D2F" opacity={.72} />
    </group>
  );
}

const CAMERA: Record<ViewName, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  perspective: { position: new THREE.Vector3(25, 20, 24), target: new THREE.Vector3(0, 0, 0) },
  top: { position: new THREE.Vector3(0, 35, .01), target: new THREE.Vector3(0, 0, 0) },
  inside: { position: new THREE.Vector3(-2, 2.25, 8), target: new THREE.Vector3(5, 1.1, 0) },
};

function CameraRig({ view, controls }: { view: ViewName; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((state) => state.camera);
  const moving = useRef(true);

  useEffect(() => { moving.current = true; }, [view]);
  useFrame(() => {
    if (!moving.current || !controls.current) return;
    const preset = CAMERA[view];
    camera.position.lerp(preset.position, .075);
    controls.current.target.lerp(preset.target, .075);
    controls.current.update();
    if (camera.position.distanceTo(preset.position) < .025 && controls.current.target.distanceTo(preset.target) < .025) moving.current = false;
  });
  return null;
}

function Scene({ planSrc, units, view, blueprint, selected, onSelect }: {
  planSrc: string;
  units: RegistryUnit[];
  view: ViewName;
  blueprint: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const geometry = usePlanGeometry(planSrc);
  const controls = useRef<OrbitControlsImpl>(null);
  const floorTexture = useMemo(() => makeHerringboneTexture(), []);

  useEffect(() => () => floorTexture.dispose(), [floorTexture]);

  return (
    <>
      <color attach="background" args={[blueprint ? '#E0DDDC' : '#0B0907']} />
      <fog attach="fog" args={[blueprint ? '#E0DDDC' : '#0B0907', 34, 72]} />
      <ambientLight intensity={blueprint ? 1.8 : .9} />
      <directionalLight position={[-14, 24, 10]} intensity={blueprint ? 2.2 : 3.3} color="#FEE6B5" castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[16, 10, -12]} intensity={1.6} color="#7E8EB1" />

      <group onClick={() => onSelect(null)}>
        <mesh position={[0, -.11, 0]} receiveShadow>
          <boxGeometry args={[WIDTH, .22, DEPTH]} />
          <meshStandardMaterial color={blueprint ? '#E0DDDC' : '#A48F7C'} map={blueprint ? null : floorTexture} roughness={.88} />
        </mesh>
        <InstancedSegments segments={geometry.structure} height={blueprint ? 1.45 : 2.85} thickness={.19} color={blueprint ? '#342D2F' : '#79573B'} />
        <InstancedSegments segments={geometry.partition} height={blueprint ? .26 : .16} thickness={.07} color="#342D2F" />
        {units.filter((unit) => unit.kind === 'desk').map((unit) => (
          <Desk key={unit.id} unit={unit} selected={selected === unit.id} onSelect={onSelect} />
        ))}
        {units.filter((unit) => unit.kind !== 'desk').map((unit) => (
          <Room key={unit.id} unit={unit} selected={selected === unit.id} onSelect={onSelect} />
        ))}
      </group>

      <CameraRig view={view} controls={controls} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={.075}
        minDistance={3}
        maxDistance={58}
        minPolarAngle={.06}
        maxPolarAngle={Math.PI / 2.04}
      />
    </>
  );
}

export function FloorPlan3D({ planSrc, registry }: { planSrc: string; registry: Registry }) {
  const [view, setView] = useState<ViewName>('perspective');
  const [blueprint, setBlueprint] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = registry.units.find((unit) => unit.id === selectedId);

  return (
    <main className={`f3-root${blueprint ? ' is-blueprint' : ''}`} data-hub-lab={LAB_MARKER}>
      <div className="f3-canvas" aria-label="Interactive 3D floor plan">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [25, 20, 24], fov: 40, near: .1, far: 120 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          fallback={<div className="f3-fallback"><img src={planSrc} alt="Unit 4, Second Floor plan" /></div>}
        >
          <Suspense fallback={null}>
            <Scene
              planSrc={planSrc}
              units={registry.units}
              view={view}
              blueprint={blueprint}
              selected={selectedId}
              onSelect={setSelectedId}
            />
          </Suspense>
        </Canvas>
      </div>

      <header className="f3-header">
        <Link href="/lab/floor" className="f3-brand">THE HUB @ LLOYDS WHARF</Link>
        <span>Measured 3D floor · development test</span>
      </header>

      <section className="f3-title">
        <p>Unit 4 · Second floor</p>
        <h1>The plan,<br />brought to life.</h1>
      </section>

      <nav className="f3-views" aria-label="Camera view">
        {(Object.keys(VIEW_LABEL) as ViewName[]).map((name) => (
          <button key={name} type="button" className={view === name ? 'is-active' : ''} onClick={() => setView(name)}>
            {VIEW_LABEL[name]}
          </button>
        ))}
      </nav>

      <div className="f3-material">
        <span>View</span>
        <button type="button" aria-pressed={!blueprint} className={!blueprint ? 'is-active' : ''} onClick={() => setBlueprint(false)}>Real materials</button>
        <button type="button" aria-pressed={blueprint} className={blueprint ? 'is-active' : ''} onClick={() => setBlueprint(true)}>Drawing</button>
      </div>

      <p className="f3-help">Drag to orbit · Scroll to zoom · Select a desk or room</p>

      <aside className={`f3-selected${selected ? ' is-open' : ''}`} aria-live="polite">
        {selected ? (
          <>
            <button type="button" className="f3-close" onClick={() => setSelectedId(null)} aria-label="Close selection">×</button>
            <p>{KIND_LABEL[selected.kind] ?? 'Place'} · {selected.id}</p>
            <h2>{selected.label}</h2>
            <dl>
              <div><dt>Seats</dt><dd>{selected.capacity}</dd></div>
              <div><dt>Position</dt><dd>{selected.x_m.toFixed(1)} m · {selected.y_m.toFixed(1)} m</dd></div>
            </dl>
          </>
        ) : (
          <><p>Live measured model</p><strong>{registry.units.length} bookable places positioned from Rev B</strong></>
        )}
      </aside>
    </main>
  );
}
