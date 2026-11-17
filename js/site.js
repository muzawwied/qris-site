/* Nav + footer bersama untuk semua halaman publik.
   Dipasang oleh js/site.js supaya setiap halaman cukup berisi kontennya. */
(function () {
  'use strict';

  var NAV = [
    { href: '/produk/', label: 'Produk' },
    { href: '/cara-kerja/', label: 'Cara kerja' },
    { href: '/harga/', label: 'Harga' },
    { href: '/faq/', label: 'FAQ' },
    { href: '/docs/', label: 'Dokumentasi' }
  ];

  function active(href) {
    var p = location.pathname;
    if (href === '/') return p === '/' || p === '/index.html';
    return p === href || p.indexOf(href) === 0;
  }

  var header = document.getElementById('siteHeader');
  if (header) {
    header.className = 'nav';
    header.id = 'nav';
    header.innerHTML =
      '<div class="wrap nav__inner">' +
        '<a class="brand" href="/"><img class="brand__logo" src="/assets/brand/icon-48.png" srcset="/assets/brand/icon-48.png 1x, /assets/brand/icon-192.png 4x" width="30" height="30" alt=""> <span class="brand__name">Clinqoo</span></a>' +
        '<nav class="nav__links" id="navLinks">' +
          NAV.map(function (n) {
            return '<a href="' + n.href + '"' + (active(n.href) ? ' style="color:var(--ink)"' : '') + '>' + n.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="nav__cta">' +
          '<a class="link-u" href="/masuk/" style="border:0;font-size:13.5px">Masuk</a>' +
          '<a class="btn btn--sm" href="/app/tagihan/">Buat tagihan</a>' +
          '<button class="nav__toggle" id="navToggle" aria-label="Buka menu" aria-expanded="false"><span></span></button>' +
        '</div>' +
      '</div>';

    var toggle = document.getElementById('navToggle');
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    header.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () { header.classList.remove('is-open'); });
    });

    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add('is-stuck'); else header.classList.remove('is-stuck');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var footer = document.getElementById('siteFooter');
  if (footer) {
    footer.className = 'foot';
    footer.innerHTML =
      '<div class="wrap">' +
        '<div class="foot__grid">' +
          '<div class="foot__brand">' +
            '<a class="brand" href="/"><img class="brand__logo" src="/assets/brand/icon-48.png" srcset="/assets/brand/icon-48.png 1x, /assets/brand/icon-192.png 4x" width="30" height="30" alt=""> <span class="brand__name">Clinqoo</span></a>' +
            '<p>Payment gateway QRIS untuk penjual Indonesia. Tagihan cepat, dana masuk rekening.</p>' +
          '</div>' +
          '<div><h4>Produk</h4><ul>' +
            '<li><a href="/produk/">Fitur</a></li>' +
            '<li><a href="/cara-kerja/">Cara kerja</a></li>' +
            '<li><a href="/harga/">Harga</a></li>' +
            '<li><a href="/app/tagihan/">Buat tagihan</a></li>' +
          '</ul></div>' +
          '<div><h4>Developer</h4><ul>' +
            '<li><a href="/docs/">Dokumentasi</a></li>' +
            '<li><a href="/docs/#webhook">Webhook</a></li>' +
            '<li><a href="/api/health">Status sistem</a></li>' +
          '</ul></div>' +
          '<div><h4>Legal</h4><ul>' +
            '<li><a href="/legal/">Syarat &amp; ketentuan</a></li>' +
            '<li><a href="/legal/#privasi">Kebijakan privasi</a></li>' +
            '<li><a href="/legal/#biaya">Biaya &amp; limit</a></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="foot__bottom">' +
          '<span>© 2026 Clinqoo</span>' +
          '<span>QRIS diproses melalui penyedia jasa pembayaran berizin Bank Indonesia.</span>' +
        '</div>' +
      '</div>';
  }

  /* Reveal on scroll */
  var els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }
})();

/* FAQ accordion (dipakai halaman /faq/) */
(function () {
  var faq = document.getElementById('faq');
  if (!faq) return;
  var items = faq.querySelectorAll('.faq__item');
  items.forEach(function (item) {
    var q = item.querySelector('.faq__q');
    var panel = item.querySelector('.faq__a');
    if (!q || !panel) return;
    q.addEventListener('click', function () {
      var open = item.classList.contains('is-open');
      items.forEach(function (other) {
        if (other === item) return;
        other.classList.remove('is-open');
        var p = other.querySelector('.faq__a');
        if (p) p.style.maxHeight = '0px';
      });
      if (open) { item.classList.remove('is-open'); panel.style.maxHeight = '0px'; }
      else { item.classList.add('is-open'); panel.style.maxHeight = panel.scrollHeight + 'px'; }
    });
  });
  if (items.length) {
    var first = items[0].querySelector('.faq__q');
    if (first) first.click();
  }
})();
