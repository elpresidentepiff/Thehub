// Post-build proof that what must not ship did not ship (`postbuild`).
//
//  - No emitted chunk contains the Theatre studio (an animation editor no visitor can use).
//  - The chunks the production route `/` loads contain no lab code and no Liquefy.
//
// The route → chunk mapping comes from the prerendered HTML of `/` plus every chunk those
// chunks can import dynamically, so lazily-loaded code (the WebGL stage) is covered too.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = join(root, '.next');
const chunksDir = join(next, 'static', 'chunks');

const MARKERS = {
  studio: 'theatrejs-studio-root',
  liquefy: 'lq-probe',
  lab: '__HUB_LAB__',
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const failures = [];
const all = walk(chunksDir);
const text = new Map(all.map((p) => [p, readFileSync(p, 'utf8')]));

for (const [p, src] of text) {
  if (src.includes(MARKERS.studio)) failures.push(`${relative(root, p)} contains @theatre/studio`);
}

// Chunks reachable from `/`: script tags in the prerendered page, then a closure over any
// chunk filename referenced from inside a reachable chunk (Turbopack's dynamic imports).
const html = ['server/app/index.html', 'server/app/page.html']
  .map((f) => join(next, f))
  .find((f) => existsSync(f));
if (!html) {
  failures.push('could not find the prerendered HTML for `/` in .next/server/app');
} else {
  const byName = new Map(all.map((p) => [p.slice(chunksDir.length + 1), p]));
  const reachable = new Set();
  const queue = [];
  const enqueue = (name) => {
    const p = byName.get(name);
    if (p && !reachable.has(p)) {
      reachable.add(p);
      queue.push(p);
    }
  };
  const chunkRef = /static\/chunks\/([\w./-]+?\.js)/g;
  for (const m of readFileSync(html, 'utf8').matchAll(chunkRef)) enqueue(m[1]);
  while (queue.length) {
    const src = text.get(queue.shift());
    for (const m of src.matchAll(chunkRef)) enqueue(m[1]);
    for (const m of src.matchAll(/["']([\w-]+\.js)["']/g)) enqueue(m[1]);
  }

  let bytes = 0;
  for (const p of reachable) {
    const src = text.get(p);
    bytes += Buffer.byteLength(src);
    if (src.includes(MARKERS.liquefy)) failures.push(`${relative(root, p)} (reachable from /) contains Liquefy`);
    if (src.includes(MARKERS.lab)) failures.push(`${relative(root, p)} (reachable from /) contains lab code`);
  }
  console.log(`check-bundle: / reaches ${reachable.size} chunks, ${(bytes / 1024).toFixed(0)} KiB uncompressed`);
}

if (failures.length) {
  console.error(`check-bundle: ${failures.length} violation(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-bundle: ok (${all.length} chunks scanned; no studio, no lab, no Liquefy on /)`);
