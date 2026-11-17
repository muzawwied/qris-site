import {
  ensureSchema, ensurePaymentsUserId, json, cors, readJson, nowIso, newId, randomToken,
  hashPassword, createSession, sessionCookie, publicUser,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/register { email, password, business_name }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const business = String(body.business_name || '').trim().slice(0, 80);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email tidak valid.' }, 400);
  if (password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
  if (!business) return json({ error: 'Nama usaha wajib diisi.' }, 400);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (exists) return json({ error: 'Email sudah terdaftar. Silakan masuk.' }, 409);

  const id = newId('usr');
  const ts = nowIso();
  const hash = await hashPassword(password);
  const apiKey = 'qsk_' + randomToken(20);

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, business_name, api_key, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, email, hash, business, apiKey, 'warung', ts, ts).run();

  const token = await createSession(env, id);

  return json(
    { ok: true, user: { id, email, business_name: business, plan: 'warung', api_key: apiKey, created_at: ts } },
    201,
    { 'Set-Cookie': sessionCookie(token) }
  );
}
