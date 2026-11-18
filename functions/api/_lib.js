// ===== Lib bersama untuk semua endpoint /api/* =====
// Cloudflare Pages Functions + D1. Tanpa dependency eksternal.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  reference TEXT,
  amount INTEGER NOT NULL,
  fee INTEGER DEFAULT 0,
  net_amount INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  method TEXT DEFAULT 'QRIS',
  issuer TEXT,
  qr_string TEXT,
  qr_image TEXT,
  expires_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  type TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_payment ON events(payment_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  business_name TEXT,
  api_key TEXT UNIQUE,
  plan TEXT DEFAULT 'warung',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
`;

let schemaReady = false;
let verifiedEnsured = false;

export async function ensureSchema(env) {
  if (schemaReady) return;
  const stmts = SCHEMA.split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) {
    await env.DB.prepare(s).run();
  }
  schemaReady = true;
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      extra
    ),
  });
}

export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

export const nowIso = () => new Date().toISOString();

export function newId(prefix = 'pay') {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}${hex.slice(0, 8)}`;
}

export function feeFor(amount, rate) {
  const r = Number.isFinite(rate) ? rate : 0.007;
  return Math.round(amount * r);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

export function mode(env) {
  // 'demo' = QR contoh, pembayaran bisa disimulasikan (tanpa uang sungguhan)
  // 'live' = memanggil provider QRIS asli (butuh QRIS_API_KEY dkk)
  return String(env.PAYMENT_MODE || (env.QRIS_API_KEY ? 'live' : 'demo')).toLowerCase();
}

export function adminToken(env) {
  return String(env.ADMIN_TOKEN || '');
}

export function isAdmin(request, env) {
  const want = adminToken(env);
  if (!want) return false;
  const h = request.headers.get('authorization') || '';
  const got = h.replace(/^Bearer\s+/i, '').trim();
  return got && got === want;
}

// ===== HMAC SHA-256 dengan Web Crypto =====
export async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function safeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i++) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}

// ===== Adapter provider QRIS (qris.site) =====
// Semua nama env bisa diatur supaya cocok dengan dokumentasi provider yang dipakai:
//   QRIS_API_BASE, QRIS_API_KEY, QRIS_MERCHANT_ID, QRIS_CREATE_PATH, QRIS_STATUS_PATH
// Bentuk respons provider berbeda-beda, jadi pembacaan field dibuat fleksibel.
export async function createQris(env, payment, opts = {}) {
  if (mode(env) !== 'live') {
    return { ok: true, demo: true, qr_string: demoQrString(payment), qr_image: null, provider_id: null };
  }

  const provider = String(env.QRIS_PROVIDER || (String(env.QRIS_API_BASE || '').includes('buatqris') ? 'buatqris' : 'generic')).toLowerCase();
  if (provider === 'buatqris') {
    return createBuatQris(env, payment, {
      umkm_name: (opts && opts.umkm_name) || env.QRIS_UMKM_NAME || '',
      callback_url: env.PUBLIC_BASE_URL ? String(env.PUBLIC_BASE_URL).replace(/\/+$/, '') + '/api/buatqris/callback' : undefined,
      test: String(env.QRIS_SANDBOX || '') === '1',
    });
  }

  const base = String(env.QRIS_API_BASE || 'https://api.qris.site').replace(/\/+$/, '');
  const path = String(env.QRIS_CREATE_PATH || '/v1/qris/create');
  const key = String(env.QRIS_API_KEY || '');
  if (!key) return { ok: false, error: 'QRIS_API_KEY belum diset.' };

  const body = {
    merchant_id: env.QRIS_MERCHANT_ID || undefined,
    amount: payment.amount,
    reference: payment.reference || payment.id,
    description: payment.description || 'Pembayaran QRIS',
    expires_in: 900,
    callback_url: env.PUBLIC_BASE_URL ? `${String(env.PUBLIC_BASE_URL).replace(/\/+$/, '')}/api/webhook` : undefined,
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  let res;
  try {
    res = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'X-Api-Key': key,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: 'Gagal menghubungi provider QRIS: ' + (e && e.message ? e.message : String(e)) };
  }

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Provider mengirim respons non-JSON (HTTP ${res.status}).` };
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.msg)) || `HTTP ${res.status}`;
    return { ok: false, error: 'Provider menolak permintaan: ' + msg };
  }

  const root = data.data || data.payment || data.result || data;
  const qrString =
    root.qr_string || root.qrString || root.qris_string || root.qr_code || root.qrCode || root.payload || '';
  const qrImage =
    root.qr_image || root.qrImage || root.qr_url || root.qrUrl || root.image_url || root.payment_url || '';
  const providerId = root.id || root.trx_id || root.transaction_id || root.invoice_id || null;

  if (!qrString && !qrImage) {
    return { ok: false, error: 'Respons provider tidak berisi QR (qr_string/qr_image).' };
  }
  return { ok: true, demo: false, qr_string: qrString || null, qr_image: qrImage || null, provider_id: providerId, raw: data };
}


// ===== Adapter BuatQris (api.buatqris.site) =====
// Semua request POST form-urlencoded dengan parameter action.
const BQ_DEFAULT_BASE = 'https://api.buatqris.site';

function bqBase(env) {
  return String(env.QRIS_API_BASE || BQ_DEFAULT_BASE).replace(/\/+$/, '');
}

async function bqPost(env, params) {
  const body = new URLSearchParams();
  body.set('account_id', String(env.QRIS_MERCHANT_ID || ''));
  body.set('secret_token', String(env.QRIS_API_KEY || ''));
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') body.set(k, String(params[k]));
  });
  let res;
  try {
    res = await fetch(bqBase(env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, error: 'Penyedia pembayaran tidak dapat dihubungi.' };
  }
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) {
    return { ok: false, error: 'Penyedia pembayaran mengirim respons tak dikenal (HTTP ' + res.status + ').' };
  }
  if (!res.ok || data.success === false) {
    const msg = data.message || data.error || ('HTTP ' + res.status);
    return { ok: false, error: 'Penyedia pembayaran menolak permintaan.', raw: data };
  }
  return { ok: true, data: data.data || data };
}

export async function createBuatQris(env, payment, opts = {}) {
  const umkm = String(opts.umkm_name || '').slice(0, 15) || undefined;
  const r = await bqPost(env, {
    action: 'api_create_qris',
    amount: payment.amount,
    description: payment.description || 'Pembayaran QRIS',
    umkm_name: umkm,
    callback_url: opts.callback_url,
    test: opts.test ? 1 : undefined,
  });
  if (!r.ok) return r;
  const d = r.data || {};
  const qrImage = d.qris_image || d.qr_url || d.qr_url_png || null;
  if (!qrImage) return { ok: false, error: 'Penyedia pembayaran tidak mengirim gambar QR.', raw: d };
  return {
    ok: true,
    demo: false,
    provider: 'buatqris',
    qr_string: d.qris_string || null,
    qr_image: qrImage,
    provider_id: d.transaction_id || null,
    bill: {
      total_amount: Number(d.total_amount || payment.amount),
      fee: Number(d.admin_fee || 0),
      net: Number(d.credit_amount || 0),
      unique_code: Number(d.amount_uniq || 0),
      method: d.qris_method || null,
      expires_at: d.expired_at || null,
      payment_url: d.payment_url || null,
    },
    raw: d,
  };
}

export async function checkBuatQris(env, transactionId) {
  const r = await bqPost(env, { action: 'api_check_status', transaction_id: transactionId });
  if (!r.ok) return r;
  const d = r.data || {};
  const raw = String(d.status || '').toLowerCase();
  const status = ['success', 'settlement', 'paid', 'lunas'].includes(raw) ? 'paid'
    : ['expired', 'kadaluarsa'].includes(raw) ? 'expired'
    : ['failed', 'gagal', 'cancel', 'cancelled'].includes(raw) ? 'failed'
    : 'pending';
  return { ok: true, status, raw, data: d };
}

// Perbarui tagihan pending lewat provider (dipakai halaman bayar dan daftar transaksi).
export async function refreshPending(env, payment) {
  if (mode(env) !== 'live' || !payment || !payment.provider_id) return null;
  if (payment.status !== 'pending') return null;
  const r = await checkBuatQris(env, payment.provider_id);
  if (!r.ok) return null;
  if (r.status === 'paid') {
    await markPaid(env, payment, { issuer: 'buatqris', raw: r.data });
    return 'paid';
  }
  if (r.status === 'expired' || r.status === 'failed') {
    await env.DB.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
      .bind(r.status, nowIso(), payment.id).run();
    return r.status;
  }
  return 'pending';
}

// QR contoh (mode demo) — payload mirip EMVCo, jelas bukan transaksi nyata.
export function demoQrString(payment) {
  const amt = String(payment.amount);
  const ref = String(payment.reference || payment.id).slice(0, 24);
  return (
    '00020101021226' +
    '0016ID.CO.QRIS.DEMO' +
    '52045812' +
    '5303360' +
    '54' + String(amt.length).padStart(2, '0') + amt +
    '5802ID' +
    '62' + String(('05' + String(ref.length).padStart(2, '0') + ref).length).padStart(2, '0') + '05' + String(ref.length).padStart(2, '0') + ref +
    '6304DEMO'
  );
}

export function qrImageUrl(qrString, size = 320) {
  return (
    'https://api.qrserver.com/v1/create-qr-code/?size=' +
    size +
    'x' +
    size +
    '&margin=0&data=' +
    encodeURIComponent(qrString)
  );
}

export function publicPayment(row) {
  if (!row) return null;
  const qrString = row.qr_string || '';
  return {
    id: row.id,
    reference: row.reference,
    amount: row.amount,
    fee: row.fee,
    net_amount: row.net_amount,
    status: row.status,
    description: row.description,
    method: row.method || 'QRIS',
    issuer: row.issuer || null,
    qr_string: qrString || null,
    qr_image: row.qr_image || (qrString ? qrImageUrl(qrString) : null),
    expires_at: row.expires_at,
    paid_at: row.paid_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    merchant_name: row.merchant_name || null,
  };
}

export async function logEvent(env, paymentId, type, payload) {
  try {
    await env.DB.prepare(
      'INSERT INTO events (id, payment_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(newId('evt'), paymentId, type, JSON.stringify(payload || {}), nowIso())
      .run();
  } catch (e) {
    /* log tidak boleh menggagalkan transaksi */
  }
}



// ===== Merek (white label) & notifikasi Telegram =====
let brandReady = false;
let providerIdReady = false;
export async function ensurePaymentsProviderId(env) {
  if (providerIdReady) return;
  try { await env.DB.prepare('ALTER TABLE payments ADD COLUMN provider_id TEXT').run(); } catch (e) { /* ada */ }
  providerIdReady = true;
}

export async function ensureBrandChannels(env) {
  if (brandReady) return;
  const cols = [
    'ALTER TABLE users ADD COLUMN brand_accent TEXT',
    'ALTER TABLE users ADD COLUMN telegram_chat_id TEXT',
    'ALTER TABLE users ADD COLUMN telegram_code TEXT',
    'ALTER TABLE users ADD COLUMN telegram_linked_at TEXT',
  ];
  for (const sql of cols) {
    try { await env.DB.prepare(sql).run(); } catch (e) { /* kolom sudah ada */ }
  }
  brandReady = true;
}

export async function sendTelegram(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function notifyPaid(env, row) {
  try {
    const u = await env.DB.prepare(
      'SELECT business_name, telegram_chat_id FROM users WHERE id = ? LIMIT 1'
    ).bind(row.user_id).first();
    if (!u || !u.telegram_chat_id) return;

    const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
    const net = (Number(row.amount) || 0) - (Number(row.fee) || 0);
    const lines = [
      '<b>Pembayaran masuk</b>',
      rp(row.amount),
      '',
      (row.description ? String(row.description) : 'Tagihan QRIS'),
      (u.business_name ? 'Toko: ' + u.business_name : ''),
      'Bersih: ' + rp(net) + ' (biaya ' + rp(row.fee) + ')',
      new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB',
    ].filter(Boolean);
    await sendTelegram(env, u.telegram_chat_id, lines.join('\n'));
  } catch (e) {
    /* notifikasi tidak boleh menggagalkan transaksi */
  }
}

export async function markPaid(env, row, info = {}) {
  const ts = nowIso();
  await env.DB.prepare(
    "UPDATE payments SET status = 'paid', paid_at = ?, updated_at = ?, issuer = COALESCE(?, issuer), raw = COALESCE(?, raw) WHERE id = ?"
  )
    .bind(ts, ts, info.issuer || null, info.raw ? JSON.stringify(info.raw) : null, row.id)
    .run();
  await logEvent(env, row.id, 'paid', info);
  await notifyPaid(env, row);
}


// ===== AUTH: password, sesi, API key =====
const PBKDF2_ITER = 100000; // batas Cloudflare Workers = 100.000 iterasi

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function unb64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4) return false;
    const iter = parseInt(parts[1], 10);
    const salt = unb64(parts[2]);
    const want = parts[3];
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
    return safeEqual(b64(bits), want);
  } catch (e) {
    return false;
  }
}

export async function sha256Hex(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionCookie(token, maxAgeSec = 60 * 60 * 24 * 30) {
  return `qris_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearCookie() {
  return 'qris_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

function cookieValue(request, name) {
  const raw = request.headers.get('cookie') || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i === -1) continue;
    if (p.slice(0, i).trim() === name) return decodeURIComponent(p.slice(i + 1).trim());
  }
  return '';
}

export async function createSession(env, userId) {
  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const now = new Date();
  const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(hash, userId, now.toISOString(), exp.toISOString())
    .run();
  return token;
}

export async function currentUser(request, env) {
  const token = cookieValue(request, 'qris_session');
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1'
  ).bind(hash, new Date().toISOString()).first();
  return row || null;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    business_name: u.business_name,
    plan: u.plan || 'warung',
    merchant_id: u.merchant_id || null,
    store_slug: u.store_slug || null,
    logo: u.logo || null,
    api_key: u.api_key || null,
    email_verified: u.email_verified ? 1 : 0,
    onboarded: u.onboarded ? 1 : 0,
    created_at: u.created_at,
  };
}

// Pemilik transaksi: sesi login, atau pasangan Bearer <api_key> + X-Merchant-Id.
// Kalau Authorization dikirim tapi pasangannya tidak lengkap/salah, lempar 401
// supaya pemanggil tahu kredensialnya kurang, bukan diam-diam dianggap tamu.
export async function ownerFromRequest(request, env) {
  const user = await currentUser(request, env);
  if (user) return user;

  const h = request.headers.get('authorization') || '';
  const keyHeader = request.headers.get('x-api-key') || '';
  const key = (h ? h.replace(/^Bearer\s+/i, '').trim() : '') || keyHeader.trim();
  if (!key) return null;
  if (key === adminToken(env)) return null;

  const row = await env.DB.prepare('SELECT * FROM users WHERE api_key = ? LIMIT 1').bind(key).first();
  if (!row) {
    const err = new Error('API key tidak dikenal.');
    err.status = 401;
    throw err;
  }

  const mid =
    request.headers.get('x-merchant-id') ||
    new URL(request.url).searchParams.get('merchant_id') ||
    '';
  if (!String(mid).trim()) {
    const err = new Error('Sertakan X-Merchant-Id milikmu bersama API key.');
    err.status = 401;
    throw err;
  }
  if (String(mid).trim() !== String(row.merchant_id || '')) {
    const err = new Error('X-Merchant-Id tidak cocok dengan API key ini.');
    err.status = 401;
    throw err;
  }
  return row;
}

export async function ensureUsersMerchantId(env) {
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN merchant_id TEXT').run();
  } catch (e) {
    /* sudah ada */
  }
  const rows = await env.DB.prepare("SELECT id FROM users WHERE merchant_id IS NULL OR merchant_id = ''").all();
  for (const r of rows.results || []) {
    await env.DB.prepare('UPDATE users SET merchant_id = ? WHERE id = ?')
      .bind('mch_' + randomToken(10), r.id).run();
  }
  await ensureUsersStoreSlug(env);
}

export function newMerchantId() {
  return 'mch_' + randomToken(10);
}

export async function ensurePaymentsUserId(env) {
  // Kolom user_id ditambahkan belakangan (migrasi ringan, aman diulang)
  try {
    await env.DB.prepare('ALTER TABLE payments ADD COLUMN user_id TEXT').run();
  } catch (e) {
    /* sudah ada */
  }
}


// ===== Saldo & penarikan =====
export async function balanceOf(env, userId) {
  const paid = await env.DB.prepare(
    "SELECT COALESCE(SUM(net_amount),0) AS n FROM payments WHERE user_id = ? AND status = 'paid'"
  ).bind(userId).first();
  const held = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount),0) AS n FROM withdrawals WHERE user_id = ? AND status IN ('pending','approved')"
  ).bind(userId).first();
  const done = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount),0) AS n FROM withdrawals WHERE user_id = ? AND status = 'paid'"
  ).bind(userId).first();
  const earned = Number(paid && paid.n || 0);
  const heldN = Number(held && held.n || 0);
  const doneN = Number(done && done.n || 0);
  return {
    earned,
    withdrawn: doneN,
    pending: heldN,
    available: Math.max(0, earned - heldN - doneN),
  };
}

export function publicWithdrawal(w) {
  if (!w) return null;
  return {
    id: w.id,
    amount: w.amount,
    bank_name: w.bank_name,
    account_number: w.account_number,
    account_name: w.account_name,
    status: w.status,
    note: w.note || null,
    created_at: w.created_at,
    updated_at: w.updated_at,
    processed_at: w.processed_at || null,
  };
}

export function slugify(input) {
  const base = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'toko';
}

let slugEnsured = false;

// Link toko: satu alamat tetap per akun, dipakai pembeli untuk bayar nominal bebas.
export async function ensureUsersVerified(env) {
  if (verifiedEnsured) return;
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0').run();
  } catch (e) { /* sudah ada */ }
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0').run();
  } catch (e) { /* sudah ada */ }
  // Akun yang dibuat sebelum alur verifikasi ini berlaku tidak perlu melewatinya lagi.
  // Hanya baris lama yang disentuh supaya pendaftar baru tetap 0.
  const CUTOFF = '2026-11-17T15:15:00Z';
  try {
    await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE (email_verified IS NULL OR email_verified = 0) AND created_at < ?").bind(CUTOFF).run();
    await env.DB.prepare("UPDATE users SET onboarded = 1 WHERE (onboarded IS NULL OR onboarded = 0) AND created_at < ?").bind(CUTOFF).run();
  } catch (e) { /* abaikan */ }
  verifiedEnsured = true;
}

export async function ensureUsersStoreSlug(env) {
  if (slugEnsured) return;
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN store_slug TEXT').run();
  } catch (e) {
    /* sudah ada */
  }
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN logo TEXT').run();
  } catch (e) {
    /* sudah ada */
  }
  const rows = await env.DB.prepare(
    "SELECT id, business_name FROM users WHERE store_slug IS NULL OR store_slug = ''"
  ).all();
  for (const r of rows.results || []) {
    let base = slugify(r.business_name);
    let candidate = base;
    let n = 2;
    for (;;) {
      const taken = await env.DB.prepare('SELECT id FROM users WHERE store_slug = ? LIMIT 1')
        .bind(candidate).first();
      if (!taken) break;
      candidate = base.slice(0, 28) + '-' + n;
      n += 1;
    }
    await env.DB.prepare('UPDATE users SET store_slug = ? WHERE id = ?').bind(candidate, r.id).run();
  }
  slugEnsured = true;
}


// ===== Verifikasi email =====
export async function sendVerifyEmail(env, { to, link }) {
  const key = String(env.RESEND_API_KEY || '');
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Clinqoo <no-reply@clinqoo.id>',
        to: [to],
        subject: 'Aktifkan akun Clinqoo kamu',
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#17160f">
          <p>Halo,</p>
          <p>Klik tautan berikut untuk mengaktifkan akun Clinqoo kamu. Tautan berlaku 24 jam.</p>
          <p><a href="${link}" style="background:#17160f;color:#f7f4ee;padding:12px 20px;border-radius:3px;text-decoration:none;display:inline-block">Aktifkan akun</a></p>
          <p style="color:#6b675c;font-size:13px">Kalau kamu tidak membuat akun, abaikan saja email ini.</p>
        </div>`,
      }),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}
