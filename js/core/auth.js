import { readLocal } from './local.js';
import { supabase } from './supabase.js';

function storedUser() {
  return readLocal(supabase.auth.storageKey)?.user ?? null;
}

export function onAuthChange(handler) {
  supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(() => handler(session?.user ?? (navigator.onLine ? null : storedUser())), 0);
  });
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
