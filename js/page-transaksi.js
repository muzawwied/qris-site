(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var state = { status: 'all', q: '', offset: 0, limit: 25, total: 0 };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function badge(s) {
    var cls = s === 'paid' ? 'paid' : s === 'pending' ? 'pending' : s === 'expired' ? 'expired' : 'failed';
    var txt = ({ paid: 'dibayar', pending: 'menunggu', expired: 'kedaluwarsa', failed: 'gagal' })[s] || s;
    return '<span class="badge badge--' + cls + '"><i></i>' + txt + '</span>';
  }

  function load() {
    var url = '/api/me/payments?limit=' + state.limit + '&offset=' + state.offset +
      '&status=' + encodeURIComponent(state.status) + '&q=' + encodeURIComponent(state.q);

    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { if (r.status === 401) { location.href = '/app/'; throw new Error('auth'); } return r.json(); })
      .then(function (d) {
        var s = d.summary || {};
        $('#sToday').textContent = fmt(s.today_paid);
        $('#sGross').textContent = fmt(s.gross_paid);
        $('#sFee').textContent = fmt(s.fee_paid);
        $('#sPending').textContent = (s.pending_count || 0) + ' tagihan';

        var list = d.payments || [];
        state.total = d.total || 0;
        $('#rows').innerHTML = list.map(function (p) {
          return '<tr><td style="white-space:nowrap">' + fmtDate(p.created_at) + '</td>' +
            '<td class="mono">' + esc(p.reference || p.id) + '</td>' +
            '<td>' + (p.description ? esc(p.description) : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + fmt(p.amount) + '</td>' +
            '<td class="num">' + fmt(p.fee) + '</td>' +
            '<td>' + badge(p.status) + '</td>' +
            '<td><a class="link-u" style="font-size:12px" href="/bayar/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Buka</a></td></tr>';
        }).join('');
        $('#empty').hidden = list.length > 0;
        $('#countInfo').textContent = list.length
          ? 'Menampilkan ' + (state.offset + 1) + '–' + (state.offset + list.length) + ' dari ' + state.total
          : 'Tidak ada data';
        $('#prevBtn').disabled = state.offset === 0;
        $('#nextBtn').disabled = state.offset + state.limit >= state.total;
      })
      .catch(function (err) {
        if (err.message === 'auth') return;
        var e = $('#dashError'); e.hidden = false; e.textContent = 'Gagal memuat: ' + err.message;
      });
  }

  var t = null;
  $('#q').addEventListener('input', function (ev) {
    clearTimeout(t);
    t = setTimeout(function () { state.q = ev.target.value.trim(); state.offset = 0; load(); }, 320);
  });
  $('#statusFilter').addEventListener('change', function (ev) { state.status = ev.target.value; state.offset = 0; load(); });
  $('#refreshBtn').addEventListener('click', load);
  $('#prevBtn').addEventListener('click', function () { if (state.offset > 0) { state.offset -= state.limit; load(); } });
  $('#nextBtn').addEventListener('click', function () { state.offset += state.limit; load(); });

  document.addEventListener('session', function (ev) { if (ev.detail.user) load(); else location.href = '/app/'; });

  /* muat langsung tanpa menunggu event sesi */
  load();
})();
