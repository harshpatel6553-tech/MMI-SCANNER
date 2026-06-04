/**
 * @module supabase
 * @description Supabase client configuration and connectivity testing.
 * Gracefully handles missing credentials so the app can run without a database.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/** Whether Supabase is properly configured with real credentials */
export const isSupabaseConfigured: boolean =
  SUPABASE_URL !== '' &&
  SUPABASE_ANON_KEY !== '' &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('your-supabase-anon-key');

/**
 * Supabase client instance.
 *
 * If environment variables are missing or contain placeholder values,
 * a client is still created (to avoid null checks everywhere) but
 * {@link isSupabaseConfigured} will be `false` and all DB operations
 * should be skipped.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: { persistSession: false },
  }
);

/**
 * Test the Supabase connection by performing a lightweight query.
 *
 * @returns `true` if the connection succeeds, `false` otherwise.
 *
 * @example
 * ```typescript
 * const ok = await testConnection();
 * if (!ok) logger.warn('Running without database persistence');
 * ```
 */
export async function testConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    logger.warn(
      'Supabase credentials not configured — running without database persistence. ' +
        'Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable.'
    );
    return false;
  }

  try {
    const { error } = await supabase.from('stocks').select('symbol').limit(1);

    if (error) {
      // Table might not exist yet — that's okay, connection itself worked
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn(
          'Supabase connected but "stocks" table not found. ' +
            'Run the migration SQL to create required tables.'
        );
        return true;
      }
      logger.error(`Supabase connection test failed: ${error.message}`);
      return false;
    }

    logger.info('✅ Supabase connection verified successfully');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Supabase connection error: ${message}`);
    return false;
  }
}

export default supabase;
