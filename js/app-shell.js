/* Shell aplikasi: sidebar, cek sesi, logout, toggle mobile. */
(function () {
  'use strict';

  var NAV = [
    { href: 'dashboard.html', label: 'Ringkasan', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { href: 'tagihan.html', label: 'Buat tagihan', icon: 'M12 5v14M5 12h14' },
    { href: 'transaksi.html', label: 'Transaksi', icon: 'M4 7h16M4 12h16M4 17h10' },
    { href: 'integrasi.html', label: 'Integrasi & API', icon: 'M8 12h8M6 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM18 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 4v4M12 14v6' },
    { href: 'pengaturan.html', label: 'Pengaturan', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15H4.4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4.6V4.4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z' }
  ];

  var here = (location.pathname.split('/').pop() || 'dashboard.html').replace(/\.html$/, '') || 'dashboard';
  var current = here + '.html';

  function icon(path) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
  }

  function render(user) {
    var host = document.getElementById('shell');
    if (!host) return;

    if (!document.getElementById('side')) {
      var side = document.createElement('aside');
      side.className = 'side';
      side.id = 'side';
      side.innerHTML =
        '<div class="side__top">' +
        '<a class="side__brand" href="index.html"><span class="brand__mark">Q</span> QRIS.SITE</a>' +
        '<button class="side__close" id="sideClose" aria-label="Tutup menu">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        '</button></div>' +
        '<div class="side__label">Menu</div>' +
        '<nav class="side__nav">' +
        NAV.map(function (n) {
          return '<a class="side__link' + (n.href === current ? ' is-active' : '') + '" href="' + n.href + '">' +
            icon(n.icon) + '<span>' + n.label + '</span></a>';
        }).join('') +
        '</nav>' +
        '<div class="side__label" style="margin-top:10px">Publik</div>' +
        '<nav class="side__nav">' +
        '<a class="side__link" href="index.html">' + icon('M4 12l8-8 8 8M6 10v10h12V10') + '<span>Halaman utama</span></a>' +
        '<a class="side__link" href="api.html">' + icon('M8 9l-4 3 4 3M16 9l4 3-4 3') + '<span>Dokumentasi</span></a>' +
        '</nav>' +
        '<div class="side__foot">' +
        '<div class="side__user"><b id="sideName">—</b><span id="sideEmail">—</span></div>' +
        '<button class="side__logout" id="sideLogout">' + icon('M15 17l5-5-5-5M20 12H9M12 4H5v16h7') + '<span>Keluar</span></button>' +
        '</div>';
      host.insertBefore(side, host.firstChild);

      var backdrop = document.createElement('div');
      backdrop.className = 'side__backdrop';
      backdrop.id = 'sideBackdrop';
      host.appendChild(backdrop);

      var toggle = document.createElement('button');
      toggle.className = 'side__toggle';
      toggle.setAttribute('aria-label', 'Buka menu');
      toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      host.appendChild(toggle);
      function openSide() {
        side.classList.add('is-open');
        backdrop.classList.add('is-on');
        document.body.style.overflow = 'hidden';
      }
      function closeSide() {
        side.classList.remove('is-open');
        backdrop.classList.remove('is-on');
        document.body.style.overflow = '';
      }
      toggle.addEventListener('click', function () {
        if (side.classList.contains('is-open')) closeSide(); else openSide();
      });
      backdrop.addEventListener('click', closeSide);
      var closeBtn = document.getElementById('sideClose');
      if (closeBtn) closeBtn.addEventListener('click', closeSide);
      side.addEventListener('click', function (ev) {
        if (ev.target.closest('.side__link')) closeSide();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') closeSide();
      });

      document.getElementById('sideLogout').addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
          .catch(function () {})
          .finally(function () { location.href = 'dashboard.html'; });
      });
    }

    if (user) {
      var name = document.getElementById('sideName');
      var mail = document.getElementById('sideEmail');
      if (name) name.textContent = user.business_name || 'Usaha';
      if (mail) mail.textContent = user.email || '';
    }
  }

  /* Sesi: kalau belum login, tampilkan gerbang login di halaman ini */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var user = d && d.user;
      render(user);
      document.dispatchEvent(new CustomEvent('session', { detail: { user: user } }));
    })
    .catch(function () {
      render(null);
      document.dispatchEvent(new CustomEvent('session', { detail: { user: null } }));
    });
})();
