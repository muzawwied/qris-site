(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var tab = 'login';

  /* Sudah login? langsung ke dashboard */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.user) location.replace('/app/'); })
    .catch(function () {});

  function setTab(t) {
    tab = t;
    $('#tabLogin').classList.toggle('is-on', t === 'login');
    $('#tabRegister').classList.toggle('is-on', t === 'register');
    $('#bizField').hidden = t !== 'register';
    $('#pwHint').hidden = t !== 'register';
    $('#forgotRow').hidden = t !== 'login';
    $('#authBtn').textContent = t === 'register' ? 'Buat akun' : 'Masuk';
    $('#authHeadline').textContent = t === 'register' ? 'Buat akun usahamu.' : 'Masuk ke akunmu.';
    $('#authSub').textContent = t === 'register'
      ? 'Cukup nama usaha, email, dan password. Tanpa unggah dokumen.'
      : 'Kelola tagihan, transaksi, dan pencairan di satu tempat.';
    $('#password').setAttribute('autocomplete', t === 'register' ? 'new-password' : 'current-password');
    $('#authMsg').hidden = true;
  }

  var eye = $('#togglePw');
  if (eye) {
    eye.addEventListener('click', function () {
      var input = $('#password');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      eye.style.color = show ? 'var(--ink)' : '';
    });
  }

  $('#tabLogin').addEventListener('click', function () { setTab('login'); });
  $('#tabRegister').addEventListener('click', function () { setTab('register'); });

  $('#authForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var payload = { email: $('#email').value, password: $('#password').value };
    if (tab === 'register') payload.business_name = $('#business').value;

    var btn = $('#authBtn');
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    $('#authMsg').hidden = true;

    fetch(tab === 'register' ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Gagal memproses.');
        location.replace('/app/');
      })
      .catch(function (err) {
        var m = $('#authMsg');
        m.hidden = false;
        m.textContent = err.message;
        btn.disabled = false;
        btn.textContent = tab === 'register' ? 'Buat akun' : 'Masuk';
      });
  });
})();
