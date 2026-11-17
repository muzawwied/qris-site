import { ensureSchema, ensurePaymentsUserId, json, cors, readJson, verifyPassword, createSession, sessionCookie, publicUser } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/login { email, password }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'Email dan password wajib.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (!user) return json({ error: 'Email atau password salah.' }, 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return json({ error: 'Email atau password salah.' }, 401);

  const token = await createSession(env, user.id);
  return json({ ok: true, user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token) });
}
