import { ensureSchema, ensurePaymentsUserId, ensureUsersMerchantId, json, cors, currentUser, randomToken } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/me/apikey — lihat API key sendiri
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  await ensureUsersMerchantId(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);
  return json({ api_key: user.api_key || null, merchant_id: user.merchant_id || null });
}

// POST /api/me/apikey — buat/ganti API key
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  await ensureUsersMerchantId(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const key = 'qsk_' + randomToken(20);
  await env.DB.prepare('UPDATE users SET api_key = ?, updated_at = ? WHERE id = ?')
    .bind(key, new Date().toISOString(), user.id).run();
  return json({ ok: true, api_key: key, merchant_id: user.merchant_id || null });
}
