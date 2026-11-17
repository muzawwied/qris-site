(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) { location.href = '/masuk/'; return; }
    $('#business').value = u.business_name || '';
    $('#email').value = u.email || '';
  });

  $('#profileForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#profileMsg');
    fetch('/api/me/profile', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: $('#business').value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        msg.hidden = false;
        msg.className = 'banner' + (res.ok ? '' : ' banner--err');
        msg.textContent = res.ok ? 'Profil tersimpan.' : (res.d.error || 'Gagal menyimpan.');
        if (res.ok) toast('Profil tersimpan.');
      })
      .catch(function () { msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = 'Gagal menyimpan.'; });
  });

  var current = null;

  function paint(logo, name) {
    var box = $('#avatarPreview');
    if (!box) return;
    var initial = (name || 'K').trim().charAt(0).toUpperCase() || 'K';
    if (logo) {
      box.innerHTML = '<img alt="Foto profil" src="' + logo + '">';
    } else {
      box.innerHTML = '<span id="avatarInitial">' + initial + '</span>';
    }
  }

  function save(logo) {
    fetch('/api/me/profile', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo: logo })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { toast(res.d.error || 'Gagal menyimpan foto.'); return; }
        current = res.d.user.logo || null;
        paint(current, $('#business').value);
        toast(logo ? 'Foto profil diperbarui.' : 'Foto profil dihapus.');
      })
      .catch(function () { toast('Gagal menyimpan foto.'); });
  }

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) return;
    current = u.logo || null;
    paint(current, u.business_name);
  });

  $('#business').addEventListener('input', function () {
    if (!current) paint(null, this.value);
  });

  $('#logoInput').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('Foto terlalu besar, maksimal 8 MB.'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        var data = canvas.toDataURL('image/jpeg', 0.86);
        paint(data, $('#business').value);
        save(data);
      };
      img.onerror = function () { toast('Foto tidak bisa dibaca.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  $('#logoRemove').addEventListener('click', function () {
    if (!current) { toast('Belum ada foto.'); return; }
    save('');
  });

})();
