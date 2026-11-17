import {
  ensureSchema, ensureUsersStoreSlug, ensureUsersVerified, slugify, json, cors, readJson, currentUser, publicUser,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/me/profile { business_name?, store_slug? }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensureUsersStoreSlug(env);
  await ensureUsersVerified(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const body = await readJson(request);
  const patch = {};
  const ts = new Date().toISOString();

  if (body && body.business_name !== undefined) {
    const business = String(body.business_name || '').trim().slice(0, 80);
    if (!business) return json({ error: 'Nama usaha wajib diisi.' }, 400);
    patch.business_name = business;
  }

  if (body && body.store_slug !== undefined) {
    const slug = slugify(body.store_slug);
    if (slug.length < 3) return json({ error: 'Link minimal 3 karakter.' }, 400);
    const taken = await env.DB.prepare('SELECT id FROM users WHERE store_slug = ? AND id != ? LIMIT 1')
      .bind(slug, user.id).first();
    if (taken) return json({ error: 'Link itu sudah dipakai akun lain.' }, 409);
    patch.store_slug = slug;
  }

  if (body && body.logo !== undefined) {
    const raw = String(body.logo || '').trim();
    if (raw === '') {
      patch.logo = null;
    } else {
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(raw)) {
        return json({ error: 'Format foto harus PNG atau JPG.' }, 400);
      }
      if (raw.length > 220000) {
        return json({ error: 'Foto terlalu besar. Maksimal sekitar 150 KB.' }, 400);
      }
      patch.logo = raw;
    }
  }

  if (body && body.onboarded) patch.onboarded = 1;

  if (!Object.keys(patch).length) return json({ error: 'Tidak ada yang diubah.' }, 400);

  const keys = Object.keys(patch);
  const sets = keys.map(function (k) { return k + ' = ?'; }).join(', ');
  const values = keys.map(function (k) { return patch[k]; });
  const stmt = env.DB.prepare('UPDATE users SET ' + sets + ', updated_at = ? WHERE id = ?');
  await stmt.bind.apply(stmt, values.concat([ts, user.id])).run();

  return json({ ok: true, user: publicUser(Object.assign({}, user, patch)) });
}
