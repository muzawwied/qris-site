import { ensureSchema, ensureBrandChannels, sendTelegram, nowIso } from '../_lib.js';

const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const jakartaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const jam = (iso) => {
  try {
    return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  } catch (e) { return ''; }
};

const HELP = [
  '<b>Perintah bot</b>',
  '/saldo — saldo siap dicairkan',
  '/hariini — ringkasan hari ini',
  '/riwayat — 5 transaksi terakhir',
  '/tagihan — tagihan menunggu bayar',
  '/penarikan — status pencairan terakhir',
  '/status — akun yang terhubung',
  '/stop — matikan notifikasi',
].join('\n');

async function userFor(env, chatId) {
  return env.DB.prepare(
    'SELECT id, business_name FROM users WHERE telegram_chat_id = ? LIMIT 1'
  ).bind(String(chatId)).first();
}

async function saldoOf(env, userId) {
  const p = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN status='paid' THEN COALESCE(net_amount, amount - COALESCE(fee,0)) ELSE 0 END),0) AS net,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count
       FROM payments WHERE user_id = ?`
  ).bind(userId).first();
  const w = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount),0) AS in_flight FROM withdrawals WHERE user_id = ? AND status IN ('pending','approved','paid')"
  ).bind(userId).first();
  return {
    net: Number((p && p.net) || 0),
    paidCount: Number((p && p.paid_count) || 0),
    inFlight: Number((w && w.in_flight) || 0),
  };
}

export async function onRequestPost({ request, env }) {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }

  let update = {};
  try { update = await request.json(); } catch (e) { return new Response('ok'); }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return new Response('ok');

  const chatId = String(msg.chat.id);
  const text = String(msg.text || '').trim();

  await ensureSchema(env);
  await ensureBrandChannels(env);

  const reply = async (t) => { await sendTelegram(env, chatId, t); return new Response('ok'); };

  // ===== perintah
  if (/^\/start/.test(text)) {
    const payload = text.split(/\s+/)[1] || '';
    if (!payload) {
      const u = await userFor(env, chatId);
      if (u) return reply('<b>Sudah terhubung.</b>\nToko: ' + (u.business_name || '—') + '\n\n' + HELP);
      return reply('<b>Clinqoo</b>\nBot notifikasi dan kontrol toko.\n\nBuka dashboard, lalu Pengaturan → Notifikasi untuk menautkan akun.');
    }

    const row = await env.DB.prepare('SELECT id, business_name FROM users WHERE telegram_code = ? LIMIT 1')
      .bind(payload).first();
    if (!row) return reply('Kode tautan tidak dikenali atau sudah dipakai. Buat kode baru di dashboard.');

    await env.DB.prepare(
      'UPDATE users SET telegram_chat_id = ?, telegram_linked_at = ?, telegram_code = NULL WHERE id = ?'
    ).bind(chatId, nowIso(), row.id).run();

    return reply('<b>Terhubung.</b>\n' + (row.business_name || 'Toko kamu') +
      ' siap mengirim notifikasi ke chat ini.\n\n' + HELP);
  }

  if (/^\/stop/.test(text)) {
    await env.DB.prepare(
      'UPDATE users SET telegram_chat_id = NULL, telegram_linked_at = NULL WHERE telegram_chat_id = ?'
    ).bind(chatId).run();
    return reply('Notifikasi dimatikan. Tautkan lagi dari dashboard kapan saja.');
  }

  if (/^\/(bantuan|help|menu)/.test(text)) return reply(HELP);

  const user = await userFor(env, chatId);
  if (!user) return reply('Chat ini belum tertaut ke akun. Buka dashboard lalu Pengaturan → Notifikasi.');

  if (/^\/status/.test(text)) {
    return reply('<b>Aktif</b>\nToko: ' + (user.business_name || '—') + '\nNotifikasi pembayaran menyala.');
  }

  if (/^\/saldo/.test(text)) {
    const s = await saldoOf(env, user.id);
    return reply(
      '<b>Saldo siap dicairkan</b>\n' + rp(s.net - s.inFlight) + '\n\n' +
      'Total diterima bersih: ' + rp(s.net) + '\n' +
      'Sedang diproses cair: ' + rp(s.inFlight) + '\n' +
      'Transaksi lunas: ' + s.paidCount
    );
  }

  if (/^\/hariini/.test(text)) {
    const today = jakartaDate();
    const r = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount),0) AS gross, COALESCE(SUM(COALESCE(net_amount, amount - COALESCE(fee,0))),0) AS net,
              COUNT(*) AS n
         FROM payments WHERE user_id = ? AND status='paid'
           AND date(COALESCE(paid_at, created_at), '+7 hours') = ?`
    ).bind(user.id, today).first();
    const pend = await env.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS gross FROM payments WHERE user_id = ? AND status='pending'"
    ).bind(user.id).first();
    return reply(
      '<b>Hari ini</b>\n' + rp(r.gross) + ' dari ' + (r.n || 0) + ' transaksi\n' +
      'Bersih: ' + rp(r.net) + '\n\n' +
      'Menunggu bayar: ' + (pend.n || 0) + ' tagihan (' + rp(pend.gross) + ')'
    );
  }

  if (/^\/riwayat/.test(text)) {
    const rows = await env.DB.prepare(
      `SELECT amount, fee, status, description, COALESCE(paid_at, created_at) AS at
         FROM payments WHERE user_id = ? ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 5`
    ).bind(user.id).all();
    const list = (rows.results || []);
    if (!list.length) return reply('Belum ada transaksi.');
    const label = { paid: 'lunas', pending: 'menunggu', expired: 'kedaluwarsa', failed: 'gagal' };
    return reply('<b>5 transaksi terakhir</b>\n' + list.map((x) =>
      '• ' + rp(x.amount) + ' · ' + (label[x.status] || x.status) + '\n  ' +
      (x.description ? String(x.description).slice(0, 40) : 'Tagihan QRIS') + ' · ' + jam(x.at)
    ).join('\n'));
  }

  if (/^\/tagihan/.test(text)) {
    const rows = await env.DB.prepare(
      "SELECT amount, description, expires_at FROM payments WHERE user_id = ? AND status='pending' ORDER BY created_at DESC LIMIT 5"
    ).bind(user.id).all();
    const list = rows.results || [];
    if (!list.length) return reply('Tidak ada tagihan yang menunggu bayar.');
    return reply('<b>Menunggu bayar</b>\n' + list.map((x) =>
      '• ' + rp(x.amount) + ' · ' + (x.description ? String(x.description).slice(0, 40) : 'Tagihan QRIS') +
      '\n  hingga ' + jam(x.expires_at)
    ).join('\n'));
  }

  if (/^\/penarikan/.test(text)) {
    const rows = await env.DB.prepare(
      'SELECT amount, status, bank, account_no, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 3'
    ).bind(user.id).all();
    const list = rows.results || [];
    if (!list.length) return reply('Belum ada pengajuan pencairan.');
    const label = { pending: 'menunggu', approved: 'disetujui', paid: 'sudah cair', rejected: 'ditolak' };
    return reply('<b>Pencairan terakhir</b>\n' + list.map((x) =>
      '• ' + rp(x.amount) + ' · ' + (label[x.status] || x.status) + '\n  ' +
      (x.bank || '') + ' ' + (x.account_no || '') + ' · ' + jam(x.created_at)
    ).join('\n'));
  }

  return reply(HELP);
}

export async function onRequestGet() {
  return new Response('webhook aktif', { status: 200 });
}
