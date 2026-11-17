import {
  ensureSchema, ensureUsersVerified, json, cors, currentUser, createSession, sessionCookie, publicUser, sha256Hex, nowIso,
} from '../_lib.js';
import { readJson } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/verify { token }
// Menandai email terverifikasi lalu langsung membuat sesi (auto-login).
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensureUsersVerified(env);

  const body = await readJson(request);
  const token = String((body && body.token) || '').trim();
  if (!token) return json({ error: 'Tautan tidak lengkap.' }, 400);

  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT * FROM email_verifications WHERE token_hash = ? LIMIT 1'
  ).bind(hash).first();

  if (!row) return json({ error: 'Tautan tidak dikenali. Coba kirim ulang email aktivasi.' }, 400);
  if (row.used_at) return json({ error: 'Tautan ini sudah dipakai. Silakan masuk.' }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ error: 'Tautan sudah kedaluwarsa. Kirim ulang email aktivasi.' }, 400);
  }

  const ts = nowIso();
  await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').bind(ts, row.user_id).run();
  await env.DB.prepare('UPDATE email_verifications SET used_at = ? WHERE token_hash = ?').bind(ts, hash).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(row.user_id).first();

  const session = await createSession(env, user.id);
  return json(
    {
      ok: true,
      user: publicUser(user),
      redirect: user.onboarded ? '/app/' : '/onboarding/',
    },
    200,
    { 'Set-Cookie': sessionCookie(session) }
  );
}

// GET /api/auth/verify?t=token → dipakai kalau tautan dibuka langsung.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const t = url.searchParams.get('t') || '';
  if (!t) return Response.redirect(new URL('/masuk/', request.url).toString(), 302);
  return Response.redirect(new URL('/verifikasi/?t=' + encodeURIComponent(t), request.url).toString(), 302);
}
