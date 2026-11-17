import { ensureSchema, ensureBrandChannels, json, cors, currentUser, sendTelegram } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

function code() {
  const r = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(r).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 9);
}

// GET /api/me/telegram — status koneksi
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensureBrandChannels(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const row = await env.DB.prepare(
    'SELECT telegram_chat_id, telegram_linked_at FROM users WHERE id = ? LIMIT 1'
  ).bind(user.id).first();

  return json({
    linked: !!(row && row.telegram_chat_id),
    linked_at: (row && row.telegram_linked_at) || null,
    bot_username: env.TELEGRAM_BOT_USERNAME || null,
    ready: !!env.TELEGRAM_BOT_TOKEN,
  });
}

// POST /api/me/telegram { action: 'link' | 'unlink' | 'test' }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensureBrandChannels(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const action = String((body && body.action) || 'link');

  if (action === 'unlink') {
    await env.DB.prepare(
      'UPDATE users SET telegram_chat_id = NULL, telegram_code = NULL, telegram_linked_at = NULL WHERE id = ?'
    ).bind(user.id).run();
    return json({ ok: true, linked: false });
  }

  if (action === 'test') {
    const row = await env.DB.prepare('SELECT telegram_chat_id FROM users WHERE id = ? LIMIT 1').bind(user.id).first();
    if (!row || !row.telegram_chat_id) return json({ error: 'Telegram belum terhubung.' }, 400);
    const ok = await sendTelegram(env, row.telegram_chat_id, '<b>Notifikasi aktif</b>\nPembayaran yang masuk akan dikirim ke chat ini.');
    if (!ok) return json({ error: 'Gagal mengirim pesan. Cek token bot.' }, 502);
    return json({ ok: true });
  }

  const kode = code();
  await env.DB.prepare('UPDATE users SET telegram_code = ? WHERE id = ?').bind(kode, user.id).run();
  const bot = env.TELEGRAM_BOT_USERNAME || null;
  return json({
    ok: true,
    code: kode,
    bot_username: bot,
    deep_link: bot ? ('https://t.me/' + bot + '?start=' + kode) : null,
    ready: !!env.TELEGRAM_BOT_TOKEN,
  });
}
