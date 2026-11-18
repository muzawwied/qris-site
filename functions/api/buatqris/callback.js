import { ensureSchema, ensurePaymentsProviderId, json, markPaid, checkBuatQris, hmacHex, safeEqual, logEvent } from '../_lib.js';

// POST /api/buatqris/callback — webhook BuatQris.
// Isi callback tidak dipercaya langsung: status selalu dicek ulang ke provider.
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsProviderId(env);

  const raw = await request.text();
  let body = {};
  try { body = JSON.parse(raw); } catch (e) {
    body = Object.fromEntries(new URLSearchParams(raw));
  }

  const data = body.data && typeof body.data === 'object' ? body.data : body;
  const trx = String(data.transaction_id || data.trx_id || data.id || '').trim();

  const sig = request.headers.get('x-buatqris-signature') || '';
  let signed = false;
  if (sig && env.QRIS_API_KEY) {
    const expected = await hmacHex(env.QRIS_API_KEY, raw);
    signed = safeEqual(expected, sig.replace(/^sha256=/i, '').trim());
  }

  if (!trx) return json({ ok: true, ignored: 'tanpa transaction_id' });

  const row = await env.DB.prepare('SELECT * FROM payments WHERE provider_id = ? LIMIT 1').bind(trx).first();
  if (!row) return json({ ok: true, ignored: 'tagihan tidak dikenal' });
  if (row.status === 'paid') return json({ ok: true, already: true });

  const check = await checkBuatQris(env, trx);

  // Kalau provider sedang membatasi cek status, percayai payload hanya bila bertanda tangan sah.
  if (!check.ok) {
    const st = String(data.status || '').toLowerCase();
    const paidByPayload = ['success', 'settlement', 'paid', 'lunas'].includes(st);
    if (signed && paidByPayload) {
      await markPaid(env, row, { issuer: 'buatqris', raw: data });
      await logEvent(env, row.id, 'callback_paid_signed', {});
      return json({ ok: true, status: 'paid', via: 'signature' });
    }
    return json({ ok: true, status: 'unchecked' });
  }

  if (check.ok && check.status === 'paid') {
    await markPaid(env, row, { issuer: 'buatqris', raw: check.data });
    await logEvent(env, row.id, 'callback_paid', { signed });
    return json({ ok: true, status: 'paid' });
  }

  if (check.ok && (check.status === 'expired' || check.status === 'failed')) {
    await env.DB.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
      .bind(check.status, new Date().toISOString(), row.id).run();
  }

  return json({ ok: true, status: check.ok ? check.status : 'unchecked' });
}

export async function onRequestGet() {
  return new Response('callback aktif', { status: 200 });
}
