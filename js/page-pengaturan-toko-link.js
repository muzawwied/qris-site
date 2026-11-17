(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  var shopUrl = '';

  function showLink(slug) {
    if (!slug) return;
    shopUrl = location.origin + '/' + slug;
    $('#shopLink').textContent = shopUrl.replace('https://', '');
    $('#openShop').href = shopUrl;
    $('#slugPreview').textContent = slug;
    $('#slug').value = slug;
  }

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) { location.href = '/masuk/'; return; }
    showLink(u.store_slug || '');
  });

  $('#slug').addEventListener('input', function () {
    var s = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    $('#slugPreview').textContent = s || 'nama-toko';
  });

  $('#copyShop').addEventListener('click', function () {
    if (!shopUrl) { toast('Link belum siap.'); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(shopUrl).then(function () { toast('Link toko disalin.'); });
    else window.prompt('Salin:', shopUrl);
  });

  $('#tokoForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#tokoMsg');
    var slug = $('#slug').value.trim();
    fetch('/api/me/profile', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_slug: slug })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        msg.hidden = false;
        msg.className = 'banner' + (res.ok ? '' : ' banner--err');
        if (res.ok) {
          msg.textContent = 'Nama link tersimpan.';
          showLink(res.d.user.store_slug);
          toast('Link toko diperbarui.');
        } else {
          msg.textContent = res.d.error || 'Gagal menyimpan.';
        }
      })
      .catch(function () { msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = 'Gagal menyimpan.'; });
  });
})();
