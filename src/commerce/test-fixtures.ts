/** Shared by the *.test.ts files: the real registry and a fixed clock. Never imported by the app. */
import { readFileSync } from 'node:fs';
import { parseRegistry, type Registry } from './inventory.ts';

export const registryJson = (): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL('../../data/inventory/unit4-l2.json', import.meta.url), 'utf8'));

export const registry: Registry = parseRegistry(registryJson());

/** Thursday 24 Sep 2026, 10:00 in London (BST). */
export const NOW = new Date('2026-09-24T09:00:00Z');
