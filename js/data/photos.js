import { OfflineError, isNetworkError } from '../core/offline.js';
import { getState } from '../core/store.js';
import { supabase, unwrap } from '../core/supabase.js';

const SIGNED_SECONDS = 3600;
const bucket = () => supabase.storage.from('tickets');

function check({ data, error }) {
  if (error) throw isNetworkError(error) ? new OfflineError() : error;
  return data;
}

export async function uploadTicketPhoto({ id, blob, previousPath }) {
  const path = `${getState().user.id}/${id}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
  check(await bucket().upload(path, blob, { upsert: true, contentType: blob.type }));
  unwrap(await supabase.from('tickets').update({ photo_path: path }).eq('id', id));
  if (previousPath && previousPath !== path) await bucket().remove([previousPath]);
}

export async function removeTicketPhoto(ticketId, path) {
  check(await bucket().remove([path]));
  unwrap(await supabase.from('tickets').update({ photo_path: null }).eq('id', ticketId));
}

export async function deleteTicketWithPhoto({ id, photo_path: path }) {
  unwrap(await supabase.from('tickets').delete().eq('id', id));
  if (path) await bucket().remove([path]);
}

export async function ticketPhotoUrl(path) {
  return check(await bucket().createSignedUrl(path, SIGNED_SECONDS)).signedUrl;
}
