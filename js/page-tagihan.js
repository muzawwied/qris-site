(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  var lastLink = '';

  function toast(msg) {
    var el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('is-on');
    setTimeout(function () { el.classList.remove('is-on'); }, 2400);
  }

  var amount = $('#amount');
  var chips = document.querySelectorAll('#quickAmounts .chip');
  function sync() {
    var v = Number(amount.value || 0);
    chips.forEach(function (c) { c.classList.toggle('is-active', Number(c.getAttribute('data-amount')) === v); });
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { amount.value = c.getAttribute('data-amount'); sync(); }); });
  amount.addEventListener('input', sync);

  $('#createForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var amt = Number(amount.value || 0);
    var msg = $('#msg');
    if (!amt || amt < 1000) { msg.hidden = false; msg.textContent = 'Nominal minimal Rp 1.000.'; return; }
    if (amt > 100000000) { msg.hidden = false; msg.textContent = 'Nominal maksimal Rp 100.000.000.'; return; }
    msg.hidden = true;

    var btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Membuat…';

    fetch('/api/pay', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amt,
        description: $('#description').value,
        reference: $('#reference').value,
        buyer_name: $('#buyerName').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (!res.ok && !d.id) throw new Error(d.error || 'Gagal membuat tagihan.');

        $('#resultPanel').hidden = false;
        $('#hintPanel').hidden = true;
        $('#resAmount').textContent = fmt(d.amount);
        $('#resId').textContent = d.id;
        $('#resFee').textContent = fmt(d.fee);
        $('#resNet').textContent = fmt(d.net_amount);
        if (d.qr_image) $('#qrImg').src = d.qr_image;
        lastLink = d.checkout_url || '';
        $('#openCheckout').href = lastLink;
        window.__qrisShort = location.origin + '/q/' + encodeURIComponent(d.id);
        var vq = document.getElementById('viewQr');
        if (vq) vq.href = 'qris.html?id=' + encodeURIComponent(d.id);
        toast('Tagihan dibuat.');
      })
      .catch(function (err) {
        msg.hidden = false; msg.textContent = err.message;
      })
      .finally(function () { btn.disabled = false; btn.textContent = 'Buat QRIS'; });
  });

  $('#copyLink').addEventListener('click', function () {
    if (!lastLink) return;
    var out = window.__qrisShort || lastLink;
    if (navigator.clipboard) navigator.clipboard.writeText(out).then(function () { toast('Tautan QRIS disalin.'); });
    else window.prompt('Salin tautan:', out);
  });

  var shareBtn = document.getElementById('shareQris');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var url = window.__qrisShort || lastLink;
      if (!url) { toast('Buat tagihan dulu.'); return; }
      if (navigator.share) navigator.share({ title: 'Pembayaran QRIS', text: 'Scan untuk membayar', url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Tautan disalin.'); });
    });
  }

  document.addEventListener('session', function (ev) { if (!ev.detail.user) location.href = 'dashboard.html'; });
})();
