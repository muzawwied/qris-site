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
    $('#pwHint').hidden = t !== 'register';
    $('#forgotRow').hidden = t !== 'login';
    $('#authBtn').textContent = t === 'register' ? 'Buat akun' : 'Masuk';
    $('#authHeadline').textContent = t === 'register' ? 'Buat akun usahamu.' : 'Masuk ke akunmu.';
    $('#authSub').textContent = t === 'register'
      ? 'Cukup email dan password. Nama usaha diisi setelah email aktif.'
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

  var tsWidget = null;
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (d) {
    var key = d && d.turnstile_site_key;
    if (!key) return;
    var slot = $('#turnstileSlot');
    slot.hidden = false;
    var sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    sc.async = true;
    sc.onload = function () {
      if (!window.turnstile) return;
      tsWidget = window.turnstile.render(slot, { sitekey: key, theme: 'light', size: 'normal' });
    };
    document.head.appendChild(sc);
  }).catch(function () {});

  function captchaToken() {
    try { return tsWidget !== null ? window.turnstile.getResponse(tsWidget) : ''; }
    catch (e) { return ''; }
  }

  $('#authForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var payload = { email: $('#email').value, password: $('#password').value };
    var tok = captchaToken();
    if (tok) payload.turnstile_token = tok;

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
        if (tab === 'register' || res.d.needs_verification) {
          try {
            if (res.d.verify_url) sessionStorage.setItem('clinqoo_verify_link', res.d.verify_url);
            sessionStorage.setItem('clinqoo_verify_email', res.d.email || payload.email);
          } catch (e) {}
          location.replace('/daftar/verifikasi/');
          return;
        }
        location.replace(res.d.redirect || '/app/');
      })
      .catch(function (err) {
        var m = $('#authMsg');
        m.hidden = false;
        m.textContent = err.message;
        try { if (tsWidget !== null && window.turnstile) window.turnstile.reset(tsWidget); } catch (e) {}
        btn.disabled = false;
        btn.textContent = tab === 'register' ? 'Buat akun' : 'Masuk';
      });
  });
})();
