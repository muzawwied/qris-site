import { ensureSchema, ensureUsersStoreSlug, cors, json } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/store/:slug — info publik toko untuk halaman bayar.
export async function onRequestGet({ request, env, params }) {
  await ensureSchema(env);
  await ensureUsersStoreSlug(env);

  const slug = String(params.slug || '').toLowerCase();
  const row = await env.DB.prepare(
    'SELECT business_name, store_slug FROM users WHERE store_slug = ? LIMIT 1'
  ).bind(slug).first();

  if (!row) return json({ error: 'Toko tidak ditemukan.' }, 404);
  return json({ slug: row.store_slug, business_name: row.business_name || 'Toko' });
}
