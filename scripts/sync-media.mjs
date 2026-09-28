// Copies the web-encoded walkthrough media from assets/ (the source of truth) into
// public/media/ for serving. public/media is generated and git-ignored.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'arrive.mp4',
  'arrive_poster.jpg',
  'floor-survey/photo_2026-09-28_10-18-32.jpg',
  'floor-survey/photo_2026-09-28_10-18-47.jpg',
  'floor-survey/photo_2026-09-28_10-18-54.jpg',
  'floor-survey/photo_2026-09-28_10-19-00.jpg',
  'floor-survey/photo_2026-09-28_10-19-08.jpg',
  'floor-survey/photo_2026-09-28_10-19-16.jpg',
  'floor-survey/photo_2026-09-28_10-19-18.jpg',
];
const out = join(root, 'public', 'media');
mkdirSync(out, { recursive: true });

for (const f of files) {
  const src = join(root, 'assets', 'video', f);
  const dst = join(out, f);
  mkdirSync(dirname(dst), { recursive: true });
  let fresh = false;
  try { fresh = statSync(dst).mtimeMs >= statSync(src).mtimeMs; } catch {}
  if (!fresh) copyFileSync(src, dst);
}
console.log(`sync-media: ${files.length} files in public/media`);
