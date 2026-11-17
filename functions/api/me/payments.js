import { ensureSchema, ensurePaymentsUserId, json, cors, currentUser, ownerFromRequest, publicPayment, mode } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/me/payments — transaksi milik user yang login (atau API key)
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const user = await ownerFromRequest(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim();
  const q = String(url.searchParams.get('q') || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  const where = ['user_id = ?'];
  const args = [user.id];
  if (status && status !== 'all') { where.push('status = ?'); args.push(status); }
  if (q) { where.push('(id LIKE ? OR reference LIKE ? OR description LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = 'WHERE ' + where.join(' AND ');

  const rows = await env.DB.prepare(
    `SELECT * FROM payments ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...args, limit, offset).all();

  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM payments ${whereSql}`).bind(...args).first();

  const summary = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS gross_paid,
       COALESCE(SUM(CASE WHEN status='paid' THEN fee ELSE 0 END),0) AS fee_paid,
       COALESCE(SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END),0) AS net_paid,
       COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending_count,
       COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) AS paid_count,
       COALESCE(SUM(CASE WHEN status='paid' AND date(paid_at) = date('now') THEN amount ELSE 0 END),0) AS today_paid
     FROM payments WHERE user_id = ?`
  ).bind(user.id).first();

  return json({
    mode: mode(env),
    total: countRow ? countRow.n : 0,
    limit,
    offset,
    summary: summary || {},
    payments: (rows.results || []).map(publicPayment),
  });
}
