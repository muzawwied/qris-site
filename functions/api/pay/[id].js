import { ensureSchema, json, cors, publicPayment } from '../_lib.js';

export async function onRequestOptions() {
  return cors();
}

// GET /api/pay/:id — status terkini satu tagihan
export async function onRequestGet({ params, env }) {
  await ensureSchema(env);
  const id = String(params.id || '').trim();
  if (!id) return json({ error: 'id wajib.' }, 400);

  const row = await env.DB.prepare(
    `SELECT p.*, u.business_name AS merchant_name
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = ? OR p.reference = ? LIMIT 1`
  ).bind(id, id).first();

  if (!row) return json({ error: 'Tagihan tidak ditemukan.' }, 404);

  // Tagihan pending yang sudah lewat masa berlaku otomatis jadi expired
  if (row.status === 'pending' && row.expires_at && Date.now() > Date.parse(row.expires_at)) {
    await env.DB.prepare("UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), row.id)
      .run();
    row.status = 'expired';
  }

  const out = publicPayment(row);
  out.merchant_name = row.merchant_name || null;
  return json(out);
}
