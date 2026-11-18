import { rateLimit, tooMany, clientIp, sameOrigin, verifyTurnstile,
  ensureSchema, json, cors, readJson, mode, nowIso, randomToken, sha256Hex, logEvent,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/auth/forgot { email }
// Selalu balas 200 supaya tidak bisa dipakai menebak email terdaftar.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  await ensureSchema(env);

  const ip = clientIp(request);
  const lim = await rateLimit(env, 'forgot:ip:' + ip, 10, 3600);
  if (!lim.ok) return tooMany(lim.retry_after);

  const body = await readJson(request);

  const captcha = await verifyTurnstile(env, request, body.turnstile_token);
  if (!captcha.ok) return json({ error: captcha.error }, 403);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ error: 'Email tidak valid.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(email).first();
  const generic = { ok: true, message: 'Kalau email itu terdaftar, tautan atur ulang sudah dikirim.' };
  if (!user) return json(generic);

  // Batasi permintaan berulang: satu tautan baru per menit per akun.
  const last = await env.DB.prepare(
    'SELECT created_at FROM password_resets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(user.id).first();
  if (last && Date.now() - new Date(last.created_at).getTime() < 60 * 1000) {
    return json(Object.assign({}, generic, { throttled: true }));
  }

  const token = randomToken(32);
  const ts = nowIso();
  const exp = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare(
    'INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(await sha256Hex(token), user.id, ts, exp).run();

  const origin = String(env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const link = `${origin}/atur-ulang-password/?t=${token}`;

  let sent = false;
  const resendKey = String(env.RESEND_API_KEY || '');
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.MAIL_FROM || 'Clinqoo <no-reply@clinqoo.id>',
          to: [email],
          subject: 'Atur ulang password Clinqoo',
          html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17160f">
            <p>Halo,</p>
            <p>Klik tautan berikut untuk mengatur ulang password akun Clinqoo kamu. Tautan berlaku 30 menit.</p>
            <p><a href="${link}" style="background:#17160f;color:#f7f4ee;padding:12px 20px;border-radius:3px;text-decoration:none;display:inline-block">Atur ulang password</a></p>
            <p style="color:#6b675c;font-size:13px">Kalau kamu tidak meminta ini, abaikan saja email ini.</p>
          </div>`,
        }),
      });
      sent = r.ok;
    } catch (e) {
      sent = false;
    }
  }

  await logEvent(env, null, 'password_reset_requested', { email, sent });

  const out = Object.assign({}, generic);
  // Tanpa penyedia email dan masih demo: tautan ditampilkan supaya bisa diuji.
  if (!sent && mode(env) !== 'live') {
    out.dev_link = link;
    out.delivery = 'none';
    out.message = 'Email belum terhubung. Karena masih mode demo, tautan atur ulang ditampilkan di bawah.';
  }
  return json(out);
}
