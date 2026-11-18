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
  var netMode = $('#netMode');
  var rate = 0.02;
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (d) {
    if (d && Number(d.fee_rate) > 0) { rate = Number(d.fee_rate); paint(); }
  }).catch(function () {});

  function grossOf(net) { return Math.ceil(net / (1 - rate)); }

  function paint() {
    var on = netMode.checked;
    $('#amountLabel').textContent = on ? 'Dana yang mau diterima (Rp)' : 'Nominal tagihan (Rp)';
    if (!on) {
      $('#amountHint').textContent = 'Minimal Rp 1.000 · maksimal Rp 100.000.000';
      return;
    }
    var v = Number(amount.value || 0);
    $('#amountHint').textContent = v >= 1000
      ? 'Pembeli membayar sekitar ' + fmt(grossOf(v) + 100) + ' termasuk kode unik. Kamu terima ' + fmt(v) + '.'
      : 'Isi dana bersih yang ingin kamu terima.';
  }
  var chips = document.querySelectorAll('#quickAmounts .chip');
  function sync() {
    var v = Number(amount.value || 0);
    chips.forEach(function (c) { c.classList.toggle('is-active', Number(c.getAttribute('data-amount')) === v); });
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { amount.value = c.getAttribute('data-amount'); sync(); }); });
  amount.addEventListener('input', function () { sync(); paint(); });
  netMode.addEventListener('change', paint);

  $('#createForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var amt = Number(amount.value || 0);
    var msg = $('#msg');
    if (!amt || amt < 1000) { msg.hidden = false; msg.textContent = netMode.checked ? 'Dana bersih minimal Rp 1.000.' : 'Nominal minimal Rp 1.000.'; return; }
    if (amt > 100000000) { msg.hidden = false; msg.textContent = 'Nominal maksimal Rp 100.000.000.'; return; }
    msg.hidden = true;

    var btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Membuat…';

    fetch('/api/pay', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amt,
        net: netMode.checked,
        description: $('#description').value,
        reference: $('#reference').value,
        buyer_name: $('#buyerName').value
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (!res.ok && !d.id) throw new Error(d.error || 'Gagal membuat tagihan.');

        // Form dan tampilan QR dipisah: langsung ke halaman tagihan.
        location.href = '/app/tagihan/hasil/' + encodeURIComponent(d.id) + '/';
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

  document.addEventListener('session', function (ev) { if (!ev.detail.user) location.href = '/app/'; });
})();
