import {
  ensureSchema, ensurePaymentsUserId, ensureUsersMerchantId, ensureUsersVerified, newMerchantId,
  json, cors, readJson, nowIso, newId, randomToken, hashPassword, sha256Hex, logEvent, sendVerifyEmail,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/register { email, password }
// Akun dibuat tapi belum aktif. Sesi baru dibuat setelah email diverifikasi.
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  await ensureUsersMerchantId(env);
  await ensureUsersVerified(env);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email tidak valid.' }, 400);
  if (password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);

  const exists = await env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (exists && exists.email_verified) return json({ error: 'Email sudah terdaftar. Silakan masuk.' }, 409);

  const id = exists ? exists.id : newId('usr');
  const ts = nowIso();
  const hash = await hashPassword(password);
  const apiKey = 'qsk_' + randomToken(20);
  const merchantId = newMerchantId();

  if (exists) {
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(hash, ts, id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, business_name, api_key, merchant_id, plan, email_verified, onboarded, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)'
    ).bind(id, email, hash, null, apiKey, merchantId, 'warung', ts, ts).run();
  }

  const token = randomToken(32);
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(id).run();
  await env.DB.prepare(
    'INSERT INTO email_verifications (token_hash, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(await sha256Hex(token), id, email, ts, exp).run();

  const origin = String(env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const link = `${origin}/verifikasi/?t=${token}`;

  const sent = await sendVerifyEmail(env, { to: email, link });
  await logEvent(env, null, 'signup_pending_verification', { email, sent });

  const out = {
    ok: true,
    needs_verification: true,
    email,
    message: sent
      ? 'Akun dibuat. Cek email kamu untuk mengaktifkannya.'
      : 'Email belum terhubung di server ini, jadi tautan aktivasi ditampilkan langsung.',
  };
  // Tanpa penyedia email: tautan dibuka supaya alur tetap bisa diuji.
  if (!sent) out.verify_url = link;

  return json(out, 201);
}
