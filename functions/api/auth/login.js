import {
  ensureSchema, ensurePaymentsUserId, ensureUsersVerified, json, cors, readJson, verifyPassword,
  createSession, sessionCookie, publicUser, rateLimit, tooMany, clientIp, verifyTurnstile, sameOrigin,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/login { email, password }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  await ensureUsersVerified(env);

  if (!sameOrigin(request)) return json({ error: 'Permintaan ditolak.' }, 403);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return json({ error: 'Email dan password wajib.' }, 400);

  const ip = clientIp(request);
  const limIp = await rateLimit(env, 'login:ip:' + ip, 20, 600);
  if (!limIp.ok) return tooMany(limIp.retry_after);
  const limPair = await rateLimit(env, 'login:' + ip + ':' + email, 8, 900);
  if (!limPair.ok) return tooMany(limPair.retry_after);

  const captcha = await verifyTurnstile(env, request, body.turnstile_token);
  if (!captcha.ok) return json({ error: captcha.error }, 403);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (!user) return json({ error: 'Email atau password salah.' }, 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await rateLimit(env, 'loginfail:' + ip, 40, 3600);
    return json({ error: 'Email atau password salah.' }, 401);
  }

  if (!user.email_verified) {
    return json(
      { error: 'Akun belum aktif. Cek email kamu untuk mengaktifkannya.', needs_verification: true, email: user.email },
      403
    );
  }

  const token = await createSession(env, user.id);
  return json(
    { ok: true, user: publicUser(user), redirect: user.onboarded ? '/app/' : '/onboarding/' },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
}
