import { supabase } from './supabase.js';

export function onAuthChange(handler) {
  supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(() => handler(session?.user ?? null), 0);
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
