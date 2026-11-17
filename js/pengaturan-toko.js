(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  var shopUrl = '';
  function showLink(slug) {
    if (!slug) return;
    shopUrl = location.origin + '/toko/' + slug;
    $('#shopLink').textContent = shopUrl.replace('https://', '');
    $('#openShop').href = shopUrl;
    $('#slugPreview').textContent = slug;
    if (!$('#slug').value || !$('#slug').dataset.touched) $('#slug').value = slug;
  }

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) return;
    showLink(u.store_slug || '');
  });

  $('#slug').addEventListener('input', function () {
    this.dataset.touched = '1';
    var s = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    $('#slugPreview').textContent = s || 'nama-toko';
  });

  $('#copyShop').addEventListener('click', function () {
    if (!shopUrl) { toast('Link belum siap.'); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(shopUrl).then(function () { toast('Link toko disalin.'); });
    else window.prompt('Salin:', shopUrl);
  });
})();
