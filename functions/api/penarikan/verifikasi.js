import { ensureSchema, ensurePaymentsUserId, json, cors, publicWithdrawal, verifyWithdrawalSignature } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/penarikan/verifikasi?id=wd_x&sig=hmac — cek keaslian tanda tangan
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  const sig = String(url.searchParams.get('sig') || '').trim();
  if (!id) return json({ valid: false, error: 'id wajib.' }, 400);

  const row = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ? LIMIT 1').bind(id).first();
  if (!row) return json({ valid: false, error: 'Pengajuan tidak ditemukan.' }, 404);

  const valid = await verifyWithdrawalSignature(env, row, sig);
  const w = publicWithdrawal(row);
  const acct = String(row.account_number || '');
  const masked = acct.length > 4 ? '••••' + acct.slice(-4) : acct;

  return json({
    valid,
    id: row.id,
    amount: w.amount,
    status: w.status,
    processed_at: row.processed_at || null,
    created_at: row.created_at,
    destination: (row.bank_name || '') + ' ' + masked,
    signed_at: row.processed_at || row.updated_at || row.created_at,
    note: valid ? 'Tanda tangan cocok dengan catatan Clinqoo.' : 'Tanda tangan tidak cocok. Bisa jadi data berubah atau tanda tangan tidak sah.',
  });
}
