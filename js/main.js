/* QRIS.SITE — interaksi halaman utama */
(function () {
  'use strict';

  var fmt = function (n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); };

  /* Nav */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  if (nav) {
    var onScroll = function () {
      if (window.scrollY > 8) nav.classList.add('is-stuck');
      else nav.classList.remove('is-stuck');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  if (nav && navToggle) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Reveal */
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

  /* Toast */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3000);
  }

  /* Nominal cepat */
  var amount = document.getElementById('amount');
  var chips = document.querySelectorAll('#quickAmounts .chip');
  var syncChips = function () {
    var v = Number(amount && amount.value || 0);
    chips.forEach(function (c) {
      c.classList.toggle('is-active', Number(c.getAttribute('data-amount')) === v);
    });
  };
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      if (!amount) return;
      amount.value = c.getAttribute('data-amount');
      syncChips();
    });
  });
  if (amount) amount.addEventListener('input', syncChips);

  /* Buat tagihan */
  var form = document.getElementById('createForm');
  var btn = document.getElementById('createBtn');
  var msg = document.getElementById('createMsg');

  function showMsg(text, kind) {
    if (!msg) return;
    msg.hidden = false;
    msg.className = 'banner' + (kind === 'err' ? ' banner--err' : kind === 'warn' ? ' banner--warn' : '');
    msg.textContent = text;
  }

  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var amt = Number((amount && amount.value) || 0);
      if (!amt || amt < 1000) { showMsg('Nominal minimal Rp 1.000.', 'err'); return; }
      if (amt > 100000000) { showMsg('Nominal maksimal Rp 100.000.000 per tagihan.', 'err'); return; }

      var payload = {
        amount: amt,
        description: (document.getElementById('description') || {}).value || '',
        reference: (document.getElementById('reference') || {}).value || '',
        buyer_name: (document.getElementById('buyerName') || {}).value || ''
      };

      if (btn) { btn.disabled = true; btn.textContent = 'Membuat QRIS…'; }
      if (msg) msg.hidden = true;

      fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          var d = res.d || {};
          if (!res.ok && !d.id) throw new Error(d.error || 'Gagal membuat tagihan.');
          if (d.checkout_url) { window.location.href = d.checkout_url; return; }
          throw new Error('Respons tidak berisi link checkout.');
        })
        .catch(function (err) {
          showMsg(err && err.message ? err.message : 'Gagal membuat tagihan. Coba lagi.', 'err');
          if (btn) { btn.disabled = false; btn.innerHTML = 'Buat QRIS'; }
        });
    });
  }

  /* FAQ */
  var faq = document.getElementById('faq');
  if (faq) {
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
      var firstQ = items[0].querySelector('.faq__q');
      if (firstQ) firstQ.click();
    }
  }
})();
