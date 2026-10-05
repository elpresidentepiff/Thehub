import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bookingConfig, type BookingConfig } from '@/commerce/booking-config.ts';

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

/** A lazy server-only client. Importing or building the app never requires credentials. */
export function supabaseAdmin(config: BookingConfig = bookingConfig()): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('The booking database is not configured');
  }
  if (cached?.url === config.supabaseUrl && cached.key === config.supabaseSecretKey) return cached.client;

  const client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'the-hub-booking-server' } },
  });
  cached = { url: config.supabaseUrl, key: config.supabaseSecretKey, client };
  return client;
}
