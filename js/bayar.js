/* Halaman checkout: muat tagihan, tampilkan QR, pantau status. */
(function () {
  'use strict';

  var fmt = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  };

  var id = new URLSearchParams(location.search).get('id') || '';
  if (!id) {
    var seg = location.pathname.replace(/\/+$/, '').split('/');
    if (seg.length && /^pay_|^usr_/.test(seg[seg.length - 1])) id = seg[seg.length - 1];
  }
  var $ = function (s) { return document.querySelector(s); };

  var loading = $('#loading');
  var content = $('#content');
  var errorBox = $('#errorBox');
  var statusLabel = $('#statusLabel');
  var qrImg = $('#qrImg');
  var qrFallback = $('#qrFallback');
  var qrLink = $('#qrLink');
  var demoArea = $('#demoArea');
  var paidBox = $('#paidBox');
  var simulateBtn = $('#simulateBtn');
  var countdownEl = $('#countdown');

  var current = null;
  var pollTimer = null;
  var tickTimer = null;

  function fail(msg) {
    if (loading) loading.hidden = true;
    if (errorBox) { errorBox.hidden = false; errorBox.textContent = msg; }
  }

  function setStatus(status) {
    if (!statusLabel) return;
    var map = {
      paid: ['Sudah dibayar', ''],
      pending: ['Menunggu pembayaran', ' status-label--wait'],
      expired: ['Kedaluwarsa', ' status-label--dead'],
      failed: ['Gagal', ' status-label--dead']
    };
    var cfg = map[status] || ['Menunggu pembayaran', ' status-label--wait'];
    statusLabel.className = 'status-label' + cfg[1];
    statusLabel.innerHTML = '<i></i> ' + cfg[0];
  }

  function renderCountdown() {
    if (!current || !countdownEl) return;
    if (current.status !== 'pending') {
      countdownEl.textContent = current.status === 'paid' ? 'Pembayaran selesai' : 'Tagihan tidak aktif';
      return;
    }
    var ms = Date.parse(current.expires_at || '') - Date.now();
    if (!isFinite(ms) || ms <= 0) { countdownEl.textContent = 'Tagihan kedaluwarsa'; return; }
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    countdownEl.textContent = 'Berlaku ' + m + ':' + String(s).padStart(2, '0');
  }

  function render(p) {
    current = p;
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;

    $('#amount').textContent = fmt(p.amount);
    $('#payId').textContent = p.id;
    $('#payRef').textContent = p.reference || p.id;
    $('#payAmount').textContent = fmt(p.amount);
    $('#payFee').textContent = fmt(p.fee);
    $('#payNet').textContent = fmt(p.net_amount);
    $('#payExp').textContent = fmtDate(p.expires_at);
    $('#title').textContent = p.description || 'Pembayaran QRIS';
    $('#subtitle').textContent = p.status === 'paid'
      ? 'Pembayaran sudah diterima.'
      : 'Scan QR dengan aplikasi e-wallet atau mobile banking apa pun.';

    setStatus(p.status);
    renderCountdown();

    var big = document.getElementById('bigQrLink');
    if (big) big.href = '/qris/' + encodeURIComponent(p.id);

    if (p.qr_image) {
      qrImg.src = p.qr_image;
      qrImg.hidden = false;
      qrImg.onerror = function () {
        qrImg.hidden = true;
        if (qrFallback) qrFallback.hidden = false;
        if (qrLink) qrLink.href = p.qr_image;
      };
    } else {
      qrImg.hidden = true;
      if (qrFallback) qrFallback.hidden = false;
    }

    if (p.status === 'paid') {
      if (demoArea) demoArea.hidden = true;
      if (paidBox) paidBox.hidden = false;
      stopPolling();
    } else if (p.status === 'pending') {
      if (paidBox) paidBox.hidden = true;
    } else {
      if (demoArea) demoArea.hidden = true;
      if (paidBox) paidBox.hidden = true;
    }
  }

  function load(showDemo) {
    return fetch('/api/pay/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Tagihan tidak ditemukan.');
        render(res.d);
        if (showDemo) {
          fetch('/api/config')
            .then(function (r) { return r.json(); })
            .then(function (cfg) {
              if (cfg && cfg.mode !== 'live' && res.d.status === 'pending' && demoArea) demoArea.hidden = false;
            })
            .catch(function () {});
        }
      })
      .catch(function (err) { fail(err && err.message ? err.message : 'Gagal memuat tagihan.'); });
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  if (!id) {
    fail('ID tagihan tidak ada di tautan. Contoh: /bayar/pay_xxxx');
  } else {
    load(true);
    pollTimer = setInterval(function () {
      if (!current || current.status !== 'pending') { stopPolling(); return; }
      fetch('/api/pay/' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.id) render(d); })
        .catch(function () {});
    }, 4000);
    tickTimer = setInterval(renderCountdown, 1000);
  }

  var sharePay = document.getElementById('sharePay');
  if (sharePay) {
    sharePay.addEventListener('click', function () {
      var url = location.origin + '/q/' + encodeURIComponent(id);
      if (navigator.share) {
        navigator.share({ title: 'Pembayaran QRIS', text: current ? ('Bayar ' + fmt(current.amount)) : 'Pembayaran QRIS', url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          var t = document.getElementById('toast');
          if (t) { t.textContent = 'Tautan QRIS disalin.'; t.classList.add('is-on'); setTimeout(function(){ t.classList.remove('is-on'); }, 2200); }
        });
      }
    });
  }

  if (simulateBtn) {
    simulateBtn.addEventListener('click', function () {
      simulateBtn.disabled = true;
      simulateBtn.textContent = 'Memproses…';
      fetch('/api/demo-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Simulasi gagal.');
          load(false);
        })
        .catch(function (err) {
          simulateBtn.disabled = false;
          simulateBtn.textContent = 'Simulasikan pembayaran berhasil';
          if (errorBox) { errorBox.hidden = false; errorBox.textContent = err.message; }
        });
    });
  }
})();
