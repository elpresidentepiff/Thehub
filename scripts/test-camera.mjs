// The camera has two evaluators: @theatre/core (WebGL tier, and the studio in dev) and the small
// evaluator in camera.ts (DOM wordmark before the spatial chunk loads, and the Canvas 2D tier).
// They must agree everywhere, or the wordmark and the water would drift apart mid push-through.
//
// Also pins the authored camera to the approved choreography: rest until the push window opens,
// ×4.8 when it closes (the prototype's 1 + 3.8·push through the cleat).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const core = require('@theatre/core');

const dir = join(root, 'src', 'experience', 'spatial', 'theatre');
const state = JSON.parse(readFileSync(join(dir, 'opening.theatre.json'), 'utf8'));
const source = readFileSync(join(dir, 'camera.ts'), 'utf8').replace(
  /import state from '\.\/opening\.theatre\.json';/,
  `const state = ${JSON.stringify(state)};`,
);
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const tmp = mkdtempSync(join(tmpdir(), 'hub-camera-'));
const file = join(tmp, 'camera.mjs');
writeFileSync(file, js);
const camera = await import(pathToFileURL(file).href);
rmSync(tmp, { recursive: true, force: true });

const project = core.getProject('The Hub camera parity', { state });
await project.ready;
const sheet = project.sheet(camera.SHEET);
const obj = sheet.object(camera.CAMERA_OBJECT, { dolly: core.types.number(camera.CAMERA_DEFAULTS.dolly, { range: [1, 12] }) });

let worst = 0;
let worstAt = 0;
const N = 2000;
for (let i = 0; i <= N; i++) {
  const p = i / N;
  sheet.sequence.position = p * camera.SEQUENCE_LENGTH;
  const diff = Math.abs(obj.value.dolly - camera.evaluateAuthoredCamera(p).dolly);
  if (diff > worst) {
    worst = diff;
    worstAt = p;
  }
}

const failures = [];
if (worst > 1e-6) failures.push(`evaluators disagree by ${worst} at p=${worstAt}`);
const at = (p) => camera.evaluateAuthoredCamera(p).dolly;
if (at(0) !== 1 || at(0.5) !== 1) failures.push(`camera moves before the push window (p=0.5 → ${at(0.5)})`);
if (Math.abs(at(0.73) - 4.8) > 1e-9 || Math.abs(at(1) - 4.8) > 1e-9) failures.push(`camera does not settle at ×4.8 (p=0.73 → ${at(0.73)})`);

if (failures.length) {
  console.error(`test-camera: FAIL\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`test-camera: ok — ${N + 1} positions, max |Theatre − evaluator| = ${worst.toExponential(2)}`);
