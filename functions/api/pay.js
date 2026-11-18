import {
  ensureSchema, ensurePaymentsUserId, json, cors, readJson, mode, newId, nowIso, feeFor,
  createQris, logEvent, publicPayment, qrImageUrl, ownerFromRequest, ensureUsersMerchantId, ensurePaymentsProviderId,
} from './_lib.js';

export async function onRequestOptions() {
  return cors();
}

// POST /api/pay  — buat tagihan QRIS
// body: { amount, description?, reference?, buyer_name?, buyer_email? }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  await ensureUsersMerchantId(env);
  await ensurePaymentsProviderId(env);

  // Pemilik tagihan: user yang login (cookie) atau Bearer API key. Boleh kosong
  // untuk pemakaian publik tanpa akun (mode demo / tamu).
  let owner = null;
  try {
    owner = await ownerFromRequest(request, env);
  } catch (e) {
    const usedKey = (request.headers.get('authorization') || '') || (request.headers.get('x-api-key') || '');
    if (e && e.status === 401 && usedKey) {
      return json({ error: e.message }, 401);
    }
    owner = null;
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const amount = Math.round(Number(body.amount || 0));
  if (!Number.isFinite(amount) || amount < 1000) {
    return json({ error: 'Nominal minimal Rp 1.000.' }, 400);
  }
  if (amount > 100000000) {
    return json({ error: 'Nominal melebihi batas Rp 100.000.000 per transaksi.' }, 400);
  }

  const feeRate = Number(env.FEE_RATE || 0.007);
  const fee = feeFor(amount, feeRate);
  const id = newId('pay');
  const ts = nowIso();
  const reference = String(body.reference || id).slice(0, 64);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const q = await createQris(
    env,
    { id, reference, amount, description: body.description },
    { umkm_name: owner && owner.business_name ? owner.business_name : '' }
  );

  // Provider bisa menambah kode unik dan memotong biayanya sendiri.
  const billAmount = q.ok && q.bill ? q.bill.total_amount : amount;
  const billFee = q.ok && q.bill ? q.bill.fee : fee;
  const billNet = q.ok && q.bill ? q.bill.net : amount - fee;
  const providerExpiry = q.ok && q.bill && q.bill.expires_at
    ? new Date(String(q.bill.expires_at).replace(' ', 'T') + '+07:00').toISOString()
    : expiresAt;

  const qrImage = q.ok ? (q.qr_image || (q.qr_string ? qrImageUrl(q.qr_string) : null)) : null;

  await env.DB.prepare(
    `INSERT INTO payments
      (id, reference, amount, fee, net_amount, status, description, buyer_name, buyer_email,
       method, qr_string, qr_image, expires_at, created_at, updated_at, raw, user_id, provider_id)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'QRIS', ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      reference,
      billAmount,
      billFee,
      billNet,
      String(body.description || '').slice(0, 200) || null,
      String(body.buyer_name || '').slice(0, 80) || null,
      String(body.buyer_email || '').slice(0, 120) || null,
      q.ok ? q.qr_string || null : null,
      qrImage,
      providerExpiry,
      ts,
      ts,
      q.ok && q.raw ? JSON.stringify(q.raw) : null,
      owner ? owner.id : null,
      q.ok && q.provider_id ? q.provider_id : null
    )
    .run();

  await logEvent(env, id, 'created', { amount, reference, demo: mode(env) !== 'live' });

  if (!q.ok) {
    return json(
      {
        error: q.error || 'Gagal membuat QRIS.',
        id,
        reference,
        amount,
        status: 'pending',
        note: 'Tagihan tercatat, tetapi QR gagal dibuat. Periksa konfigurasi provider.',
      },
      502
    );
  }

  return json({
    id,
    reference,
    amount: billAmount,
    fee: billFee,
    net_amount: billNet,
    unique_code: q.ok && q.bill ? q.bill.unique_code : 0,
    status: 'pending',
    description: body.description || null,
    mode: mode(env),
    provider: q.provider || (mode(env) === 'live' ? 'generic' : 'demo'),
    provider_id: q.provider_id || null,
    qr_string: q.qr_string || null,
    qr_image: qrImage,
    expires_at: providerExpiry,
    provider_payment_url: q.ok && q.bill ? q.bill.payment_url : null,
    checkout_url: `${new URL(request.url).origin}/bayar/${id}`,
  });
}

// GET /api/pay?limit=20 — publik: daftar transaksi terbaru versi ringkas (tanpa data pembeli)
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const rows = await env.DB.prepare(
    'SELECT * FROM payments ORDER BY created_at DESC LIMIT ?'
  )
    .bind(limit)
    .all();
  const list = (rows.results || []).map(publicPayment);
  return json({ count: list.length, payments: list });
}
