import { ensureSchema, ensurePaymentsUserId, json, cors, ownerFromRequest } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// GET /api/me/stats?days=30 — deret harian + ringkasan untuk grafik
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const user = await ownerFromRequest(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const url = new URL(request.url);
  const days = Math.min(180, Math.max(7, parseInt(url.searchParams.get('days') || '30', 10)));

  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const daily = await env.DB.prepare(
    `SELECT date(COALESCE(paid_at, created_at)) AS d,
            SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS gross,
            SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END) AS net,
            SUM(CASE WHEN status='paid' THEN fee ELSE 0 END) AS fee,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid,
            COUNT(*) AS total
       FROM payments
      WHERE user_id = ? AND date(COALESCE(paid_at, created_at)) >= date(?)
      GROUP BY d ORDER BY d ASC`
  ).bind(user.id, from.toISOString().slice(0, 10)).all();

  const map = {};
  (daily.results || []).forEach((r) => { map[r.d] = r; });

  const series = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(from.getTime() + i * 86400000);
    const key = dt.toISOString().slice(0, 10);
    const r = map[key] || {};
    series.push({
      date: key,
      gross: Number(r.gross || 0),
      net: Number(r.net || 0),
      fee: Number(r.fee || 0),
      paid: Number(r.paid || 0),
      total: Number(r.total || 0),
    });
  }

  const totals = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS gross,
       COALESCE(SUM(CASE WHEN status='paid' THEN fee ELSE 0 END),0) AS fee,
       COALESCE(SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END),0) AS net,
       SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
       SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expired_count,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_count,
       COUNT(*) AS all_count
     FROM payments
     WHERE user_id = ? AND date(COALESCE(paid_at, created_at)) >= date(?)`
  ).bind(user.id, from.toISOString().slice(0, 10)).first();

  const hours = await env.DB.prepare(
    `SELECT CAST(strftime('%H', COALESCE(paid_at, created_at)) AS INTEGER) AS h,
            COUNT(*) AS n,
            SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS gross
       FROM payments
      WHERE user_id = ? AND date(COALESCE(paid_at, created_at)) >= date(?)
      GROUP BY h`
  ).bind(user.id, from.toISOString().slice(0, 10)).all();

  const byHour = Array.from({ length: 24 }, (_, h) => {
    const row = (hours.results || []).find((r) => Number(r.h) === h);
    return { hour: h, count: Number(row ? row.n : 0), gross: Number(row ? row.gross : 0) };
  });

  const paidCount = Number(totals.paid_count || 0);
  const allCount = Number(totals.all_count || 0);
  const gross = Number(totals.gross || 0);

  return json({
    ok: true,
    days,
    from: from.toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    totals: {
      gross,
      fee: Number(totals.fee || 0),
      net: Number(totals.net || 0),
      paid_count: paidCount,
      pending_count: Number(totals.pending_count || 0),
      expired_count: Number(totals.expired_count || 0),
      failed_count: Number(totals.failed_count || 0),
      all_count: allCount,
      avg_ticket: paidCount ? Math.round(gross / paidCount) : 0,
      success_rate: allCount ? Math.round((paidCount / allCount) * 1000) / 10 : 0,
    },
    series,
    by_hour: byHour,
  });
}
