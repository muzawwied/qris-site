import {
  ensureSchema, json, cors, readJson, nowIso, sha256Hex, hashPassword,
  createSession, sessionCookie, publicUser, logEvent,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/reset { token, password }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  if (!token) return json({ error: 'Tautan tidak lengkap. Minta tautan baru.' }, 400);
  if (password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);

  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT * FROM password_resets WHERE token_hash = ? LIMIT 1').bind(hash).first();
  if (!row) return json({ error: 'Tautan tidak valid atau sudah dipakai.' }, 400);
  if (row.used_at) return json({ error: 'Tautan sudah dipakai. Minta tautan baru.' }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ error: 'Tautan sudah kedaluwarsa. Minta tautan baru.' }, 400);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(row.user_id).first();
  if (!user) return json({ error: 'Akun tidak ditemukan.' }, 400);

  const ts = nowIso();
  const pwHash = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(pwHash, ts, user.id).run();
  await env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').bind(ts, hash).run();
  // Password baru: semua sesi lama diputus.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

  await logEvent(env, null, 'password_reset_done', { user_id: user.id });

  const session = await createSession(env, user.id);
  return json({ ok: true, user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(session) });
}
