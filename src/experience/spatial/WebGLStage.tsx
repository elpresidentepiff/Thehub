'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { WATER } from './water';
import { waterPaused, waterTime } from './clock';
import { cameraAt } from './theatre/camera';
import { attachTheatreCamera } from './theatre/runtime';
import { WATER_COVERED_AT } from '../opening/choreography';
import { subscribeMotion } from '../runtime/motion';
import { story } from '../runtime/story';
import { recordSpatial } from '../perf/store';

/**
 * The spatial runtime: one R3F canvas behind the whole stage, one camera.
 *
 * World units are CSS pixels at z = 0, where the camera's rest distance makes one unit exactly
 * one pixel. The stage's DOM (the cleat) lives in that same plane, so dolly = on-screen scale
 * for both. Later spatial scenes join this canvas — never a second WebGL context.
 */

const FOV = 35;

/** A number as a GLSL float literal. */
const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const MAX_DPR = 2;
const MIN_DPR = 1;

export interface WebGLStageProps {
  slotRef: RefObject<HTMLElement | null>;
  onReady: () => void;
  onLost: (reason: string) => void;
}

export default function WebGLStage({ slotRef, onReady, onLost }: WebGLStageProps) {
  const [dpr, setDpr] = useState(() => Math.min(devicePixelRatio || 1, MAX_DPR));

  useEffect(() => {
    let release: (() => void) | undefined;
    let cancelled = false;
    attachTheatreCamera().then((r) => {
      if (cancelled) r();
      else release = r;
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, []);

  useEffect(() => recordSpatial({ dpr }), [dpr]);

  return (
    <Canvas
      dpr={dpr}
      flat
      linear
      gl={{ antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 1, far: 20000, position: [0, 0, 1000] }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onLost('WebGL context lost');
        });
      }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setDpr((d) => Math.max(MIN_DPR, +(d - 0.5).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(Math.min(devicePixelRatio || 1, MAX_DPR), +(d + 0.5).toFixed(2)))}
        onFallback={() => setDpr(MIN_DPR)}
      />
      <Governor />
      <Water slotRef={slotRef} onReady={onReady} />
    </Canvas>
  );
}

/**
 * Render only when something changes: continuously while the river is flowing and visible,
 * otherwise on demand when the camera moves (scroll) — and not at all once the arrival covers it.
 */
function Governor() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let current: 'always' | 'demand' | null = null;
    const update = () => {
      const covered = story.progress >= WATER_COVERED_AT;
      const next = !waterPaused() && !covered ? 'always' : 'demand';
      if (next !== current) {
        current = next;
        setFrameloop(next);
      }
      if (next === 'demand' && !covered) invalidate();
    };
    update();
    const a = story.subscribe(update);
    const b = subscribeMotion(update);
    return () => {
      a();
      b();
    };
  }, [setFrameloop, invalidate]);
  return null;
}

const vertexShader = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vPx;
  void main() {
    vPx = vec2(position.x + uSize.x * 0.5, uSize.y * 0.5 - position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Mirrors water.ts line for line. vPx is CSS px from the stage's top-left, at rest.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uTop;
  uniform float uHeight;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vPx;

  const int LINES = ${WATER.lines};

  void main() {
    float y = vPx.y - uTop;
    if (y < 0.0 || y > uHeight) discard;
    float x = vPx.x;
    float fw = max(fwidth(y), 1e-4);
    float acc = 0.0;
    for (int i = 0; i < LINES; i++) {
      float fi = float(i) / float(LINES);
      float amp = ${f(WATER.ampBase)} + fi * ${f(WATER.ampRange)};
      float sp = ${f(WATER.speedBase)} + fi * ${f(WATER.speedRange)};
      float yy = uHeight * fi
        + sin(x * ${f(WATER.k1)} + uTime * sp + float(i) * ${f(WATER.phase)}) * amp
        + sin(x * ${f(WATER.k2)} - uTime * sp * 0.6) * amp * 0.35;
      float cov = 1.0 - smoothstep(0.5 - fw * 0.5, 0.5 + fw * 0.5, abs(y - yy));
      acc += (${f(WATER.alphaBase)} + ${f(WATER.alphaRange)} * fi) * cov * (1.0 - acc);
    }
    float fade = clamp(y / (${f(WATER.fade)} * uHeight), 0.0, 1.0);
    float alpha = acc * fade * uOpacity;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

function Water({ slotRef, onReady }: { slotRef: RefObject<HTMLElement | null>; onReady: () => void }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const ready = useRef(false);
  const slot = useRef({ top: 0, height: 0 });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uSize: { value: new THREE.Vector2() },
          uTime: { value: 0 },
          uTop: { value: 0 },
          uHeight: { value: 1 },
          uOpacity: { value: WATER.opacity },
          uColor: { value: new THREE.Vector3(...WATER.rgb.map((c) => c / 255)) },
        },
        transparent: true,
        premultipliedAlpha: true,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // The water band's rectangle comes from the DOM slot, so CSS stays the one place it is composed.
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const measure = () => {
      slot.current = { top: el.offsetTop, height: el.offsetHeight };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slotRef, size.width, size.height]);

  const rest = size.height / 2 / Math.tan((FOV * Math.PI) / 360);

  useFrame(({ gl }) => {
    const { dolly } = cameraAt(story.progress);
    camera.position.set(0, 0, rest / dolly);
    camera.far = rest * 4;
    camera.updateProjectionMatrix();

    const u = material.uniforms;
    u.uSize!.value.set(size.width, size.height);
    u.uTime!.value = waterTime();
    u.uTop!.value = slot.current.top;
    u.uHeight!.value = slot.current.height;

    if (!ready.current) {
      ready.current = true;
      recordSpatial({ renderer: rendererName(gl) });
      // Hand over from Canvas 2D once this frame is actually on screen.
      requestAnimationFrame(() => {
        recordSpatial({ webglReadyAt: Math.round(performance.now()) });
        onReady();
      });
    }
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[size.width, size.height]} />
    </mesh>
  );
}

function rendererName(gl: THREE.WebGLRenderer): string {
  const ctx = gl.getContext();
  const info = ctx.getExtension('WEBGL_debug_renderer_info');
  return String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
}
