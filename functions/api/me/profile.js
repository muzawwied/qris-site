import { ensureSchema, json, cors, readJson, currentUser, publicUser } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/me/profile { business_name }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const body = await readJson(request);
  const business = String((body && body.business_name) || '').trim().slice(0, 80);
  if (!business) return json({ error: 'Nama usaha wajib diisi.' }, 400);

  await env.DB.prepare('UPDATE users SET business_name = ?, updated_at = ? WHERE id = ?')
    .bind(business, new Date().toISOString(), user.id).run();

  return json({ ok: true, user: publicUser(Object.assign({}, user, { business_name: business })) });
}
