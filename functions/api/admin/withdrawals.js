import { ensureSchema, ensurePaymentsUserId, json, cors, readJson, isAdmin, nowIso, publicWithdrawal } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/admin/withdrawals?status=pending — daftar pengajuan pencairan
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  if (!isAdmin(request, env)) return json({ error: 'Butuh admin token.' }, 401);

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim();
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const rows = status && status !== 'all'
    ? await env.DB.prepare('SELECT w.*, u.email, u.business_name FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id WHERE w.status = ? ORDER BY w.created_at DESC LIMIT ?').bind(status, limit).all()
    : await env.DB.prepare('SELECT w.*, u.email, u.business_name FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT ?').bind(limit).all();

  return json({
    withdrawals: (rows.results || []).map(function (r) {
      var out = publicWithdrawal(r);
      out.email = r.email || null;
      out.business_name = r.business_name || null;
      return out;
    }),
  });
}

// POST /api/admin/withdrawals { id, status: approved|rejected|paid, note }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  if (!isAdmin(request, env)) return json({ error: 'Butuh admin token.' }, 401);

  const body = await readJson(request);
  const id = String((body && body.id) || '').trim();
  const status = String((body && body.status) || '').trim();
  const note = String((body && body.note) || '').slice(0, 300);

  if (!id) return json({ error: 'id wajib.' }, 400);
  if (['approved', 'rejected', 'paid'].indexOf(status) === -1) {
    return json({ error: 'status harus approved, rejected, atau paid.' }, 400);
  }

  const row = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Pengajuan tidak ditemukan.' }, 404);

  const ts = nowIso();
  await env.DB.prepare('UPDATE withdrawals SET status = ?, note = ?, updated_at = ?, processed_at = ? WHERE id = ?')
    .bind(status, note || null, ts, status === 'paid' ? ts : row.processed_at || null, id).run();

  return json({ ok: true, id, status });
}
