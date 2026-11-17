import {
  ensureSchema, ensureUsersVerified, json, cors, readJson, nowIso, randomToken, sha256Hex, sendVerifyEmail,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/resend { email }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensureUsersVerified(env);

  const body = await readJson(request);
  const email = String((body && body.email) || '').trim().toLowerCase();
  const generic = { ok: true, message: 'Kalau email itu terdaftar dan belum aktif, tautan aktivasi baru sudah dibuat.' };
  if (!email || !email.includes('@')) return json({ error: 'Email tidak valid.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (!user) return json(generic);
  if (user.email_verified) return json(Object.assign({}, generic, { already: true }));

  const last = await env.DB.prepare(
    'SELECT created_at FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(user.id).first();
  if (last && Date.now() - new Date(last.created_at).getTime() < 60 * 1000) {
    return json(Object.assign({}, generic, { throttled: true }));
  }

  const token = randomToken(32);
  const ts = nowIso();
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare(
    'INSERT INTO email_verifications (token_hash, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(await sha256Hex(token), user.id, email, ts, exp).run();

  const origin = String(env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const link = `${origin}/verifikasi/?t=${token}`;
  const sent = await sendVerifyEmail(env, { to: email, link });

  const out = Object.assign({}, generic, { sent });
  if (!sent) out.verify_url = link;
  return json(out);
}
