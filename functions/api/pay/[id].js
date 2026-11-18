import { ensureSchema, ensureBrandChannels, ensurePaymentsProviderId, json, cors, publicPayment, refreshPending } from '../_lib.js';

export async function onRequestOptions() {
  return cors();
}

// GET /api/pay/:id — status terkini satu tagihan
export async function onRequestGet({ params, env }) {
  await ensureSchema(env);
  await ensureBrandChannels(env);
  await ensurePaymentsProviderId(env);
  const id = String(params.id || '').trim();
  if (!id) return json({ error: 'id wajib.' }, 400);

  const row = await env.DB.prepare(
    `SELECT p.*, u.business_name AS merchant_name, u.logo AS merchant_logo, u.brand_accent AS merchant_accent, u.store_slug AS merchant_slug
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = ? OR p.reference = ? LIMIT 1`
  ).bind(id, id).first();

  if (!row) return json({ error: 'Tagihan tidak ditemukan.' }, 404);

  // Cek langsung ke provider, paling sering tiap 15 detik per tagihan (batas provider).
  if (row.status === 'pending' && row.provider_id) {
    const last = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (!last || Date.now() - last > 15000) {
      const fresh = await refreshPending(env, row);
      if (fresh && fresh !== 'pending') row.status = fresh;
    }
  }

  // Tagihan pending yang sudah lewat masa berlaku otomatis jadi expired
  if (row.status === 'pending' && row.expires_at && Date.now() > Date.parse(row.expires_at)) {
    await env.DB.prepare("UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), row.id)
      .run();
    row.status = 'expired';
  }

  const out = publicPayment(row);
  out.merchant_name = row.merchant_name || null;
  out.merchant_logo = row.merchant_logo || null;
  out.merchant_accent = row.merchant_accent || null;
  out.merchant_slug = row.merchant_slug || null;
  return json(out);
}
