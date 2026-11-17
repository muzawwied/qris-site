(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function statusBadge(s) {
    var cls = s === 'paid' ? 'paid' : s === 'pending' ? 'pending' : s === 'expired' ? 'expired' : 'failed';
    var txt = ({ paid: 'dibayar', pending: 'menunggu', expired: 'kedaluwarsa', failed: 'gagal' })[s] || s;
    return '<span class="badge badge--' + cls + '"><i></i>' + txt + '</span>';
  }

  /* ---------- Auth gate ---------- */
  var tab = 'login';
  var gate = $('#gate'), content = $('#pageContent');

  function setTab(t) {
    tab = t;
    $('#tabLogin').classList.toggle('is-on', t === 'login');
    $('#tabRegister').classList.toggle('is-on', t === 'register');
    $('#bizField').hidden = t !== 'register';
    $('#authBtn').textContent = t === 'register' ? 'Daftar' : 'Masuk';
  }
  $('#tabLogin').addEventListener('click', function () { setTab('login'); });
  $('#tabRegister').addEventListener('click', function () { setTab('register'); });

  $('#authForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var payload = { email: $('#email').value, password: $('#password').value };
    if (tab === 'register') payload.business_name = $('#business').value;
    var btn = $('#authBtn'); btn.disabled = true; btn.textContent = 'Memproses…';
    $('#authMsg').hidden = true;

    fetch(tab === 'register' ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Gagal memproses.');
        location.reload();
      })
      .catch(function (err) {
        $('#authMsg').hidden = false;
        $('#authMsg').textContent = err.message;
        btn.disabled = false;
        btn.textContent = tab === 'register' ? 'Daftar' : 'Masuk';
      });
  });

  document.addEventListener('session', function (ev) {
    var user = ev.detail.user;
    if (!user) { gate.hidden = false; content.hidden = true; return; }
    gate.hidden = true; content.hidden = false;
    $('#helloLine').textContent = 'Selamat datang, ' + (user.business_name || user.email) + '.';
    loadAll();
  });

  /* ---------- Data ---------- */
  function loadAll() {
    fetch('/api/me/payments?limit=5', { credentials: 'same-origin' })
      .then(function (r) { if (r.status === 401) throw new Error('unauthorized'); return r.json(); })
      .then(function (d) {
        var s = d.summary || {};
        $('#sToday').textContent = fmt(s.today_paid);
        $('#sGross').textContent = fmt(s.gross_paid);
        $('#sFee').textContent = fmt(s.fee_paid);
        $('#sPending').textContent = (s.pending_count || 0) + ' tagihan';

        var ml = $('#modeLabel');
        ml.className = 'status-label' + (d.mode === 'live' ? '' : ' status-label--wait');
        ml.innerHTML = '<i></i> ' + (d.mode === 'live' ? 'mode live' : 'mode percobaan');

        var list = d.payments || [];
        $('#recentRows').innerHTML = list.map(function (p) {
          return '<tr><td style="white-space:nowrap">' + fmtDate(p.created_at) + '</td>' +
            '<td class="mono">' + esc(p.reference || p.id) + '</td>' +
            '<td class="num">' + fmt(p.amount) + '</td>' +
            '<td>' + statusBadge(p.status) + '</td>' +
            '<td><a class="link-u" style="font-size:12px" href="bayar.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Buka</a></td></tr>';
        }).join('');
        $('#recentEmpty').hidden = list.length > 0;

        var hMode = $('#hMode');
        if (hMode) hMode.textContent = d.mode === 'live' ? 'Live' : 'Percobaan';
      })
      .catch(function (err) {
        if (err.message === 'unauthorized') { gate.hidden = false; content.hidden = true; return; }
        var e = $('#dashError'); e.hidden = false; e.textContent = 'Gagal memuat ringkasan: ' + err.message;
      });

    fetch('/api/health')
      .then(function (r) { return r.json(); })
      .then(function (h) {
        $('#hApi').textContent = h.ok ? 'Normal' : 'Gangguan';
        $('#hDb').textContent = h.db === 'ok' ? 'Terhubung' : 'Error';
      })
      .catch(function () { $('#hApi').textContent = 'Tidak terjangkau'; $('#hDb').textContent = '—'; });
  }
})();
