// Source-level rules from the constitution, enforced before every build (`prebuild`).
//
//  1. Production code never imports lab code. Experiments live in src/lab and src/app/lab; the
//     arrow only points the other way (lab may import production to test it).
//  2. Controlled resources stay in the lab until an experiment promotes them with a named job:
//     @liquefy-ui/* and vendored React Bits.
//  3. The Theatre studio is only ever imported by the dev-only runtime loader.
//  4. Cut libraries stay cut: Anime.js, Curtains.js, GSAP ScrollSmoother (Lenis is the one
//     scroll-smoothing layer).
//  5. The accent yellow is UNRESOLVED: no accent token or provisional hex anywhere in src/ or
//     tokens/.
//  6. src/commerce is pure: it imports only node: built-ins and its own modules — no React, no
//     SVG, no renderer. Test files and fixtures are imported only by tests.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p).split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|json|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const isLab = (file) => file.startsWith('src/lab/') || file.startsWith('src/app/lab/');
const STUDIO_ALLOWED = new Set(['src/experience/spatial/theatre/runtime.ts']);
const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

for (const abs of walk(join(root, 'src'))) {
  const file = rel(abs);
  const text = readFileSync(abs, 'utf8');

  if (/accent-provisional|--(hub-)?accent\b|#E3B400/i.test(text)) fail(file, 'references the UNRESOLVED accent yellow');

  if (!/\.tsx?$/.test(file)) continue;
  for (const m of text.matchAll(importRe)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    if (!isLab(file)) {
      if (/^@\/lab(\/|$)|(^|\/)lab\//.test(spec)) fail(file, `production imports lab code (${spec})`);
      if (spec.startsWith('@liquefy-ui/')) fail(file, `production imports ${spec} — lab only until promoted`);
      if (/react-bits/.test(spec)) fail(file, `production imports React Bits (${spec}) — lab only until promoted`);
    }
    if (spec === '@theatre/studio' && !STUDIO_ALLOWED.has(file)) fail(file, 'imports @theatre/studio outside the dev-only loader');
    if (/^(animejs|anime|curtainsjs)$/.test(spec) || spec === 'gsap/ScrollSmoother') fail(file, `imports a cut library (${spec})`);
    if (file.startsWith('src/commerce/') && !/^node:/.test(spec) && !/^\.\/[\w-]+(\.test)?\.ts$/.test(spec)) {
      fail(file, `commerce must stay pure — imports ${spec}`);
    }
    if (!/\.test\.ts$|\/test-fixtures\.ts$/.test(file) && /(\.test|test-fixtures)(\.tsx?)?$/.test(spec)) {
      fail(file, `app code imports test code (${spec})`);
    }
  }
}

const tokens = readFileSync(join(root, 'tokens', 'tokens.css'), 'utf8');
if (/--hub-accent[\w-]*\s*:/.test(tokens)) fail('tokens/tokens.css', 'defines an accent token while the yellow is UNRESOLVED');

if (failures.length) {
  console.error(`check-boundaries: ${failures.length} violation(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-boundaries: ok');
