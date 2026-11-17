/* Dashboard: daftar/masuk dengan email, ringkasan transaksi milik user, API key. */
(function () {
  'use strict';

  var state = { status: 'all', q: '', offset: 0, limit: 25, total: 0, tab: 'login', user: null };

  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  };
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  var loginView = $('#loginView');
  var dashView = $('#dashView');
  var authForm = $('#authForm');
  var authMsg = $('#authMsg');
  var authBtn = $('#authBtn');
  var authTitle = $('#authTitle');
  var authSub = $('#authSub');
  var bizField = $('#bizField');
  var logoutBtn = $('#logoutBtn');
  var dashError = $('#dashError');

  var tabBtns = document.querySelectorAll('.is-tab');

  function setTab(tab) {
    state.tab = tab;
    tabBtns.forEach(function (b) {
      var active = b.getAttribute('data-tab') === tab;
      b.style.background = active ? 'var(--ink)' : 'transparent';
      b.style.color = active ? 'var(--paper)' : 'var(--ink)';
      b.style.borderColor = active ? 'var(--ink)' : 'var(--line-strong)';
    });
    if (bizField) bizField.hidden = tab !== 'register';
    if (authTitle) authTitle.textContent = tab === 'register' ? 'Buat akun usaha.' : 'Masuk ke dashboard.';
    if (authSub) authSub.textContent = tab === 'register'
      ? 'Sekali daftar, semua tagihan tercatat rapi di satu tempat.'
      : 'Kelola tagihan, lihat transaksi masuk, dan ambil API key usahamu.';
    if (authBtn) authBtn.textContent = tab === 'register' ? 'Daftar' : 'Masuk';
    if (authMsg) authMsg.hidden = true;
  }

  tabBtns.forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
  });

  function showLogin() {
    if (loginView) loginView.hidden = false;
    if (dashView) dashView.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
  }
  function showDash() {
    if (loginView) loginView.hidden = true;
    if (dashView) dashView.hidden = false;
    if (logoutBtn) logoutBtn.hidden = false;
  }

  function statusText(s) {
    return ({ paid: 'dibayar', pending: 'menunggu', expired: 'kedaluwarsa', failed: 'gagal' })[s] || s;
  }

  function rowHtml(p) {
    var badge = 'badge--' + (p.status === 'paid' ? 'paid' : p.status === 'pending' ? 'pending' : p.status === 'expired' ? 'expired' : 'failed');
    return '<tr>' +
      '<td style="white-space:nowrap">' + fmtDate(p.created_at) + '</td>' +
      '<td class="mono">' + (p.reference || p.id) + '</td>' +
      '<td>' + (p.description ? escapeHtml(p.description) : '<span class="muted">—</span>') + '</td>' +
      '<td class="num">' + fmt(p.amount) + '</td>' +
      '<td class="num">' + fmt(p.fee) + '</td>' +
      '<td><span class="badge ' + badge + '"><i></i>' + statusText(p.status) + '</span></td>' +
      '<td><a class="link-u" style="font-size:12px" href="bayar.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Buka</a></td>' +
      '</tr>';
  }

  function load() {
    if (!state.user) { showLogin(); return; }
    if (dashError) dashError.hidden = true;

    var url = '/api/me/payments?limit=' + state.limit + '&offset=' + state.offset +
      '&status=' + encodeURIComponent(state.status) + '&q=' + encodeURIComponent(state.q);

    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { state.user = null; showLogin(); throw new Error('unauthorized'); }
        return r.json();
      })
      .then(function (d) {
        showDash();
        state.total = d.total || 0;
        var s = d.summary || {};
        $('#sToday').textContent = fmt(s.today_paid);
        $('#sGross').textContent = fmt(s.gross_paid);
        $('#sFee').textContent = fmt(s.fee_paid);
        $('#sPending').textContent = (s.pending_count || 0) + ' tagihan';

        var ml = $('#modeLabel');
        if (ml) {
          ml.className = 'status-label' + (d.mode === 'live' ? '' : ' status-label--wait');
          ml.innerHTML = '<i></i> ' + (d.mode === 'live' ? 'mode live' : 'mode percobaan');
        }

        var list = d.payments || [];
        $('#rows').innerHTML = list.map(rowHtml).join('');
        $('#empty').hidden = list.length > 0;
        $('#countInfo').textContent = list.length
          ? 'Menampilkan ' + (state.offset + 1) + '–' + (state.offset + list.length) + ' dari ' + state.total
          : 'Belum ada transaksi';
        $('#prevBtn').disabled = state.offset === 0;
        $('#nextBtn').disabled = state.offset + state.limit >= state.total;
      })
      .catch(function (err) {
        if (err && err.message === 'unauthorized') return;
        if (dashError) { dashError.hidden = false; dashError.textContent = 'Gagal memuat data: ' + (err.message || 'error jaringan'); }
      });
  }

  function loadKey() {
    fetch('/api/me/apikey', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = $('#apiKeyBox');
        if (box) box.textContent = d.api_key || 'Belum ada. Klik "Ganti key" untuk membuat.';
      })
      .catch(function () {});
  }

  function me() {
    return fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.user = d.user || null;
        if (state.user) {
          showDash();
          load();
          loadKey();
        } else {
          showLogin();
        }
      })
      .catch(function () { showLogin(); });
  }

  if (authForm) {
    authForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = ($('#email') || {}).value || '';
      var password = ($('#password') || {}).value || '';
      var business = ($('#business') || {}).value || '';
      var endpoint = state.tab === 'register' ? '/api/auth/register' : '/api/auth/login';
      var payload = state.tab === 'register'
        ? { email: email, password: password, business_name: business }
        : { email: email, password: password };

      if (authBtn) { authBtn.disabled = true; authBtn.textContent = 'Memproses…'; }
      if (authMsg) authMsg.hidden = true;

      fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Gagal memproses.');
          state.user = res.d.user;
          toast(state.tab === 'register' ? 'Akun dibuat. Selamat datang.' : 'Berhasil masuk.');
          showDash();
          load();
          loadKey();
        })
        .catch(function (err) {
          if (authMsg) { authMsg.hidden = false; authMsg.textContent = err.message; }
        })
        .finally(function () {
          if (authBtn) { authBtn.disabled = false; authBtn.textContent = state.tab === 'register' ? 'Daftar' : 'Masuk'; }
        });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .catch(function () {})
        .finally(function () {
          state.user = null;
          showLogin();
          toast('Sudah keluar.');
        });
    });
  }

  /* API key */
  var copyBtn = $('#copyKeyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var txt = ($('#apiKeyBox') || {}).textContent || '';
      if (!txt || txt.indexOf('qsk_') !== 0) { toast('Belum ada API key.'); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('API key disalin.'); });
      else window.prompt('Salin API key:', txt);
    });
  }

  var rotateBtn = $('#rotateKeyBtn');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', function () {
      if (!confirm('Ganti API key? Key lama langsung tidak berlaku.')) return;
      rotateBtn.disabled = true;
      fetch('/api/me/apikey', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.api_key) {
            var box = $('#apiKeyBox');
            if (box) box.textContent = d.api_key;
            toast('API key baru dibuat.');
          }
        })
        .catch(function () { toast('Gagal membuat key baru.'); })
        .finally(function () { rotateBtn.disabled = false; });
    });
  }

  /* Filter */
  var qEl = $('#q');
  var timer = null;
  if (qEl) {
    qEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = qEl.value.trim();
        state.offset = 0;
        load();
      }, 350);
    });
  }

  var sf = $('#statusFilter');
  if (sf) sf.addEventListener('change', function () { state.status = sf.value; state.offset = 0; load(); });

  var refresh = $('#refreshBtn');
  if (refresh) refresh.addEventListener('click', function () { load(); toast('Data dimuat ulang.'); });

  var prev = $('#prevBtn');
  if (prev) prev.addEventListener('click', function () { if (state.offset > 0) { state.offset -= state.limit; load(); } });

  var next = $('#nextBtn');
  if (next) next.addEventListener('click', function () { state.offset += state.limit; load(); });

  setTab('login');
  me();
})();
