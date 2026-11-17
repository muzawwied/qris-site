(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };

  function renderBalance(b) {
    $('#bAvail').textContent = fmt(b.available);
    $('#bPending').textContent = fmt(b.pending);
    $('#bDone').textContent = fmt(b.withdrawn);
    $('#bEarned').textContent = fmt(b.earned);
    $('#availHint').textContent = fmt(b.available);
    var amt = $('#amount');
    amt.max = b.available;
    if (b.available >= 10000 && Number(amt.value) > b.available) amt.value = b.available;
  }

  function load() {
    fetch('/api/me/withdrawals', { credentials: 'same-origin' })
      .then(function (r) { if (r.status === 401) { location.href = '/masuk/'; throw new Error('auth'); } return r.json(); })
      .then(function (d) { renderBalance(d.balance || {}); })
      .catch(function (err) { if (err.message !== 'auth') $('#availHint').textContent = 'gagal dimuat'; });
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
        if (res.d.balance) renderBalance(res.d.balance);
        location.href = '/app/penarikan/?diajukan=1';
      })
      .catch(function (err) {
        msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = err.message;
        btn.disabled = false; btn.textContent = 'Kirim pengajuan';
      });
  });


  /* jalankan langsung (cookie ikut terkirim) supaya tidak balapan dengan event session */
  load();

  document.addEventListener('session', function (ev) {
    if (!ev.detail.user) location.href = '/masuk/';
  });
})();
