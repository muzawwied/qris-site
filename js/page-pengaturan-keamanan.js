(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  document.addEventListener('session', function (ev) {
    if (!ev.detail.user) location.href = '/masuk/';
  });

  $('#passForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#passMsg');
    msg.hidden = false;
    msg.className = 'banner banner--err';

    if ($('#next').value !== $('#next2').value) {
      msg.textContent = 'Password baru dan ulangannya belum sama.';
      return;
    }
    if ($('#next').value.length < 8) {
      msg.textContent = 'Password baru minimal 8 karakter.';
      return;
    }

    fetch('/api/me/password', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: $('#cur').value, new_password: $('#next').value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) {
          msg.className = 'banner';
          msg.textContent = 'Password diperbarui.';
          $('#passForm').reset();
          toast('Password diperbarui.');
        } else {
          msg.className = 'banner banner--err';
          msg.textContent = res.d.error || 'Gagal memperbarui password.';
        }
      })
      .catch(function () { msg.className = 'banner banner--err'; msg.textContent = 'Gagal memperbarui password.'; });
  });
})();
