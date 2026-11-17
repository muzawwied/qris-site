import {
  ensureSchema, json, cors, readJson, mode, nowIso, hmacHex, safeEqual,
  markPaid, logEvent, adminToken,
} from './_lib.js';

export async function onRequestOptions() {
  return cors();
}

const PAID_STATES = ['paid', 'success', 'settlement', 'settled', 'capture', 'captured', 'completed', 'berhasil', 'lunas'];
const EXPIRED_STATES = ['expired', 'expire', 'void', 'cancelled', 'canceled', 'kadaluarsa'];
const FAILED_STATES = ['failed', 'denied', 'declined', 'gagal', 'error'];

function normStatus(v) {
  const s = String(v || '').toLowerCase().trim();
  if (PAID_STATES.includes(s)) return 'paid';
  if (EXPIRED_STATES.includes(s)) return 'expired';
  if (FAILED_STATES.includes(s)) return 'failed';
  return null;
}

function pick(body, keys) {
  for (const k of keys) {
    const parts = k.split('.');
    let cur = body;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
      else { cur = null; break; }
    }
    if (cur !== null && cur !== undefined && cur !== '') return cur;
  }
  return null;
}

// POST /api/webhook — dipanggil provider QRIS saat status transaksi berubah
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);

  const rawBody = await request.text();
  const secret = String(env.WEBHOOK_SECRET || '');
  const sigHeader =
    request.headers.get('x-signature') ||
    request.headers.get('x-callback-signature') ||
    request.headers.get('x-webhook-signature') ||
    '';
  const tokenHeader = request.headers.get('x-webhook-token') || '';

  let verified = false;
  let verifiedBy = null;

  if (secret) {
    if (sigHeader) {
      const expected = await hmacHex(secret, rawBody);
      const provided = sigHeader.replace(/^sha256=/i, '').trim();
      if (safeEqual(expected, provided)) { verified = true; verifiedBy = 'hmac'; }
    }
    if (!verified && tokenHeader && safeEqual(secret, tokenHeader)) { verified = true; verifiedBy = 'token'; }
    if (!verified && request.headers.get('authorization') &&
        safeEqual(secret, request.headers.get('authorization').replace(/^Bearer\s+/i, ''))) {
      verified = true; verifiedBy = 'bearer';
    }
    if (!verified) {
      // Tolak hanya kalau live DAN secret diset — mencegah webhook palsu.
      if (mode(env) === 'live') {
        await logEvent(env, null, 'webhook_rejected', { reason: 'signature', body: rawBody.slice(0, 500) });
        return json({ error: 'Signature tidak valid.' }, 401);
      }
    }
  }

  let body = null;
  try { body = JSON.parse(rawBody); } catch (e) { body = null; }
  if (!body) return json({ error: 'Body harus JSON.' }, 400);

  const statusRaw = pick(body, [
    'status', 'data.status', 'payment.status', 'transaction.status', 'trx_status', 'state',
  ]);
  const status = normStatus(statusRaw);
  if (!status) return json({ ok: true, ignored: true, reason: 'status tidak dikenal', status_raw: statusRaw });

  const identifiers = [
    pick(body, ['reference', 'data.reference', 'data.order_id', 'data.merchant_ref', 'merchant_ref', 'order_id']),
    pick(body, ['data.reference_id', 'data.external_id', 'external_id']),
    pick(body, ['data.merchant_order_id']),
  ].filter(Boolean).map(String);

  const providerId = pick(body, ['id', 'data.id', 'data.trx_id', 'data.transaction_id', 'data.invoice_id', 'trx_id']);
  const issuer = pick(body, ['data.issuer', 'data.channel', 'issuer', 'data.payment_method']);
  const amount = Number(pick(body, ['amount', 'data.amount', 'data.gross_amount', 'gross_amount', 'total']) || 0);

  let row = null;
  for (const ident of identifiers) {
    row = await env.DB.prepare('SELECT * FROM payments WHERE reference = ? OR id = ? LIMIT 1')
      .bind(ident, ident)
      .first();
    if (row) break;
  }
  if (!row && providerId) {
    row = await env.DB.prepare("SELECT * FROM payments WHERE raw LIKE ? LIMIT 1")
      .bind('%' + String(providerId) + '%')
      .first();
  }
  if (!row && amount) {
    // pencocokan terakhir: nominal sama pada transaksi pending terbaru
    row = await env.DB.prepare(
      "SELECT * FROM payments WHERE amount = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
    ).bind(amount).first();
  }

  if (!row) {
    await logEvent(env, null, 'webhook_unmatched', { identifiers, providerId, status, raw: rawBody.slice(0, 800) });
    return json({ ok: true, unmatched: true });
  }

  if (status === 'paid') {
    if (row.status !== 'paid') {
      await markPaid(env, row, { issuer, raw: body, verified_by: verifiedBy });
    }
  } else {
    await env.DB.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, nowIso(), row.id)
      .run();
    await logEvent(env, row.id, 'status_' + status, { raw: body });
  }

  return json({ ok: true, id: row.id, status });
}

// GET /api/webhook — alat uji manual (butuh admin token)
export async function onRequestGet({ request, env }) {
  const want = adminToken(env);
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!want || got !== want) return json({ error: 'Butuh admin token.' }, 401);
  return json({
    endpoint: 'POST /api/webhook',
    verifikasi: ['X-Signature (HMAC SHA-256 dari body mentah)', 'X-Webhook-Token', 'Authorization: Bearer'],
    status_diterima: { paid: PAID_STATES, expired: EXPIRED_STATES, failed: FAILED_STATES },
  });
}
