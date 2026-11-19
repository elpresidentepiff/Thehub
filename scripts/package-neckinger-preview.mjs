import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const copy = (from, to) => cp(join(root, from), join(dist, to), { recursive: true });

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copy('lab/history-studies/neckinger.html', 'lab/history-studies/neckinger.html');
await copy('lab/history-studies/shared.css', 'lab/history-studies/shared.css');
await copy('lab/history-studies/tunnel.js', 'lab/history-studies/tunnel.js');
await copy('lab/history-studies/archive', 'lab/history-studies/archive');
await copy('lab/cleat-studies/shared.js', 'lab/cleat-studies/shared.js');
await copy('lab/cleat-studies/cleat.js', 'lab/cleat-studies/cleat.js');
await copy('lab/cleat-studies/brick.jpg', 'lab/cleat-studies/brick.jpg');
await copy('node_modules/three/build/three.module.js', 'node_modules/three/build/three.module.js');
await copy('node_modules/three/build/three.core.js', 'node_modules/three/build/three.core.js');
await copy('node_modules/three/examples/jsm', 'node_modules/three/examples/jsm');
await copy('assets/brand/hub-sign-lit.jpg', 'assets/brand/hub-sign-lit.jpg');
await copy('assets/video/arrive.mp4', 'assets/video/arrive.mp4');
await copy('assets/video/arrive_poster.jpg', 'assets/video/arrive_poster.jpg');

await writeFile(join(dist, 'index.html'), `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=/lab/history-studies/neckinger.html?auto">
<title>The Neckinger — Lloyds Wharf</title></head><body><p><a href="/lab/history-studies/neckinger.html?auto">Enter the tunnel</a></p></body></html>\n`);
console.log(`Packaged tunnel preview at ${dist}`);
