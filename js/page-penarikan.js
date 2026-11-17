(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2400); }

  function statusBadge(s) {
    var map = { pending: ['pending', 'menunggu'], approved: ['paid', 'disetujui'], paid: ['paid', 'dibayar'], rejected: ['failed', 'ditolak'] };
    var c = map[s] || ['pending', s];
    return '<span class="badge badge--' + c[0] + '"><i></i>' + c[1] + '</span>';
  }

  function renderBalance(b) {
    $('#bAvail').textContent = fmt(b.available);
    $('#bEarned').textContent = fmt(b.earned);
    $('#bPending').textContent = fmt(b.pending);
    $('#bDone').textContent = fmt(b.withdrawn);
    var amt = $('#amount');
    if (amt) { amt.max = b.available; }
  }

  function load() {
    fetch('/api/me/withdrawals', { credentials: 'same-origin' })
      .then(function (r) { if (r.status === 401) { location.href = '/masuk/'; throw new Error('auth'); } return r.json(); })
      .then(function (d) {
        renderBalance(d.balance || {});
        var list = d.withdrawals || [];
        $('#wdRows').innerHTML = list.map(function (w) {
          return '<tr><td style="white-space:nowrap">' + fmtDate(w.created_at) + '</td>' +
            '<td class="num">' + fmt(w.amount) + '</td>' +
            '<td>' + esc((w.bank_name || '') + ' ' + (w.account_number || '')) + '</td>' +
            '<td>' + statusBadge(w.status) + '</td></tr>';
        }).join('');
        $('#wdEmpty').hidden = list.length > 0;
      })
      .catch(function (err) { if (err.message !== 'auth') toast('Gagal memuat data.'); });
  }

  $('#wdForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#wdBtn'), msg = $('#wdMsg');
    btn.disabled = true; btn.textContent = 'Mengirim…';
    msg.hidden = true;

    fetch('/api/me/withdrawals', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number($('#amount').value || 0),
        bank_name: $('#bank').value,
        account_number: $('#acc').value,
        account_name: $('#holder').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Gagal mengajukan.');
        msg.hidden = false; msg.className = 'banner'; msg.textContent = 'Pengajuan terkirim. Dana diproses 1×24 jam kerja.';
        if (res.d.balance) renderBalance(res.d.balance);
        $('#wdForm').reset();
        load();
      })
      .catch(function (err) {
        msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = err.message;
      })
      .finally(function () { btn.disabled = false; btn.textContent = 'Ajukan pencairan'; });
  });

  document.addEventListener('session', function (ev) { if (ev.detail.user) load(); else location.href = '/masuk/'; });
})();
