import { ensureSchema, ensurePaymentsUserId, json, cors, ownerFromRequest } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

function ymd(d) { return d.toISOString().slice(0, 10); }

function parseRange(url) {
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromRaw = String(url.searchParams.get('from') || '').trim();
  const toRaw = String(url.searchParams.get('to') || '').trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : ymd(defFrom);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : ymd(now);
  return { from, to };
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// GET /api/me/report?from=&to=&format=json|csv — ringkasan + unduhan laporan
export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);

  const user = await ownerFromRequest(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const url = new URL(request.url);
  const { from, to } = parseRange(url);
  const format = String(url.searchParams.get('format') || 'json').toLowerCase();

  // rentang tanggal memakai waktu lokal WIB (UTC+7)
  const startIso = new Date(from + 'T00:00:00+07:00').toISOString();
  const endIso = new Date(to + 'T23:59:59+07:00').toISOString();

  const rows = await env.DB.prepare(
    `SELECT * FROM payments
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC`
  ).bind(user.id, startIso, endIso).all();

  const list = rows.results || [];
  const paid = list.filter((r) => r.status === 'paid');
  const sum = (arr, key) => arr.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const summary = {
    from,
    to,
    count: list.length,
    paid_count: paid.length,
    gross: sum(paid, 'amount'),
    fee: sum(paid, 'fee'),
    net: sum(paid, 'net_amount'),
  };

  if (format !== 'csv') {
    return json({ summary, payments: list.slice(0, 200) });
  }

  const header = ['Tanggal', 'ID tagihan', 'Keterangan', 'Status', 'Nominal', 'Biaya', 'Diterima', 'Dibayar pada'];
  const lines = [header.join(',')];
  for (const r of list) {
    lines.push([
      csvCell(new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })),
      csvCell(r.id),
      csvCell(r.description || ''),
      csvCell(r.status),
      csvCell(r.amount),
      csvCell(r.fee),
      csvCell(r.net_amount),
      csvCell(r.paid_at ? new Date(r.paid_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''),
    ].join(','));
  }
  lines.push('');
  lines.push(['Total transaksi', summary.count, 'Lunas', summary.paid_count, 'Nominal', summary.gross, 'Biaya', summary.fee, 'Diterima', summary.net].join(','));

  const name = `laporan-qris-${from}-ke-${to}.csv`;
  return new Response('\ufeff' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
