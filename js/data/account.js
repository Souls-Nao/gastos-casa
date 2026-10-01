import { isNetworkError } from '../core/offline.js';
import { rpc } from '../core/supabase.js';

export async function seedDefaults() {
  try {
    await rpc('seed_defaults');
  } catch (error) {
    if (!isNetworkError(error)) throw error;
  }
}
