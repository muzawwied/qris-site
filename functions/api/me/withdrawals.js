import {
  ensureSchema, ensurePaymentsUserId, json, cors, readJson, currentUser,
  newId, nowIso, balanceOf, publicWithdrawal,
} from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/me/withdrawals — riwayat pengajuan + saldo
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const rows = await env.DB.prepare(
    'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all();

  const balance = await balanceOf(env, user.id);
  return json({
    balance,
    min_withdraw: 10000,
    withdrawals: (rows.results || []).map(publicWithdrawal),
  });
}

// POST /api/me/withdrawals — ajukan pencairan
// body: { amount, bank_name, account_number, account_name }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const amount = Math.round(Number(body.amount || 0));
  const bankName = String(body.bank_name || '').trim().slice(0, 60);
  const accountNumber = String(body.account_number || '').replace(/[^\d]/g, '').slice(0, 32);
  const accountName = String(body.account_name || '').trim().slice(0, 80);

  if (!Number.isFinite(amount) || amount < 10000) return json({ error: 'Minimal pencairan Rp 10.000.' }, 400);
  if (!bankName) return json({ error: 'Nama bank/e-wallet wajib diisi.' }, 400);
  if (accountNumber.length < 6) return json({ error: 'Nomor rekening tidak valid.' }, 400);
  if (!accountName) return json({ error: 'Nama pemilik rekening wajib diisi.' }, 400);

  const balance = await balanceOf(env, user.id);
  if (amount > balance.available) {
    return json({ error: 'Saldo tersedia hanya Rp ' + balance.available.toLocaleString('id-ID') + '.' }, 400);
  }

  const id = newId('wd');
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO withdrawals (id, user_id, amount, bank_name, account_number, account_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(id, user.id, amount, bankName, accountNumber, accountName, ts, ts).run();

  const row = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(id).first();
  const newBalance = await balanceOf(env, user.id);
  return json({ ok: true, withdrawal: publicWithdrawal(row), balance: newBalance }, 201);
}
