import { rpc } from '../core/supabase.js';

export function seedDefaults() {
  return rpc('seed_defaults');
}
