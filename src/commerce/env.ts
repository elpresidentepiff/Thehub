/**
 * Which world the commerce engine is running in. Production is the default whenever
 * NODE_ENV says so, so a missing variable fails closed: mock data refuses to load.
 *
 *   HUB_ENV=development | preview | production   (explicit, wins)
 *   otherwise NODE_ENV=production → production, anything else → development
 */
export type HubEnvironment = 'development' | 'preview' | 'production';

export function hubEnvironment(env: Record<string, string | undefined> = process.env): HubEnvironment {
  const explicit = env.HUB_ENV;
  if (explicit === 'development' || explicit === 'preview' || explicit === 'production') return explicit;
  if (explicit) throw new Error(`HUB_ENV must be development, preview or production (got "${explicit}")`);
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function assertNotProduction(feature: string, env?: Record<string, string | undefined>): void {
  if (hubEnvironment(env) === 'production') {
    throw new Error(`${feature} is development-only and cannot run in production`);
  }
}

/** Stricter: preview deployments are public too, so mock data stays on developer machines. */
export function assertDevelopment(feature: string, env?: Record<string, string | undefined>): void {
  const where = hubEnvironment(env);
  if (where !== 'development') throw new Error(`${feature} runs only in development (this is ${where})`);
}
