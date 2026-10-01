import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { OfflineError, isNetworkError } from './offline.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function unwrap({ data, error }) {
  if (!error) return data;
  if (error.code === '23505') throw new Error('Ya existe un registro con ese nombre.');
  throw isNetworkError(error) ? new OfflineError() : error;
}

export async function rpc(name, args) {
  return unwrap(await supabase.rpc(name, args));
}
