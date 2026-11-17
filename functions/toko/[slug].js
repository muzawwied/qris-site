import { renderStore } from '../_store.js';

// /toko/<slug> tetap tersedia sebagai alamat lama.
export async function onRequestGet({ request, env, params }) {
  return renderStore(request, env, params.slug);
}
