/**
 * The Theatre.js runtime for the WebGL tier. Loaded only inside the spatial chunk.
 *
 * Production ships @theatre/core plus `opening.theatre.json`. In `next dev`, adding `?studio` to
 * the URL mounts the Theatre studio over the page so the camera can be re-authored by hand; the
 * result is exported from the studio as JSON and replaces `opening.theatre.json`.
 */

import { getProject, types } from '@theatre/core';
import state from './opening.theatre.json';
import { CAMERA_DEFAULTS, CAMERA_OBJECT, SEQUENCE_LENGTH, SHEET, setCameraProvider } from './camera';

let attached: Promise<() => void> | null = null;

export function attachTheatreCamera(): Promise<() => void> {
  attached ??= (async () => {
    await maybeStartStudio();
    const project = getProject('The Hub at Lloyds Wharf', { state });
    await project.ready;
    const sheet = project.sheet(SHEET);
    const camera = sheet.object(CAMERA_OBJECT, {
      dolly: types.number(CAMERA_DEFAULTS.dolly, { range: [1, 12], nudgeMultiplier: 0.01 }),
    });
    return setCameraProvider((p) => {
      sheet.sequence.position = p * SEQUENCE_LENGTH;
      return camera.value;
    });
  })();
  return attached;
}

async function maybeStartStudio() {
  if (process.env.NODE_ENV !== 'development') return;
  if (!new URLSearchParams(location.search).has('studio')) return;
  const { default: studio } = await import('@theatre/studio');
  studio.initialize();
}
