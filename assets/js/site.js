/* IOTA site script. Vanilla JS, no dependencies. Reads window.IOTA_CONFIG from config.js. */
(function () {
  'use strict';
  var CFG = window.IOTA_CONFIG || { metrics: {}, links: {} };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- config: links, email, placeholders ---------- */
  function applyConfig() {
    var L = CFG.links || {};
    $$('[data-link]').forEach(function (a) { var v = L[a.getAttribute('data-link')]; if (v) a.href = v; });
    if (L.email) {
      $$('a[href^="mailto:"]').forEach(function (a) {
        var subj = a.getAttribute('data-mail');
        var q = a.href.indexOf('?') > -1 ? a.href.slice(a.href.indexOf('?')) : '';
        if (subj) q = '?subject=' + encodeURIComponent(subj);
        a.href = 'mailto:' + L.email + q;
      });
    }
    var M = CFG.metrics || {};
    $$('[data-ph]').forEach(function (el) {
      var key = el.getAttribute('data-ph');
      var v = M[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') el.textContent = String(v);
      var txt = el.textContent.trim();
      var unset = txt === 'X' || /^\[.*\]$/.test(txt);
      el.classList.toggle('unset', unset);
      if (unset) el.setAttribute('title', 'Placeholder: set ' + key + ' in assets/js/config.js');
    });
    var y = $('[data-year]'); if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- count up real numbers once visible ---------- */
  function countUp(root) {
    if (reduce) return;
    $$('.metric .v .ph', root).forEach(function (el) {
      var n = parseFloat(el.textContent);
      if (!isFinite(n) || el.classList.contains('unset')) return;
      var dec = (el.textContent.split('.')[1] || '').length, t0 = null, dur = 1400;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = (n * e).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- reveal on scroll ---------- */
  function reveals() {
    var els = $$('.reveal, .alloc');
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          if (en.target.hasAttribute('data-metrics')) countUp(en.target);
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- nav menu ---------- */
  function nav() {
    var n = $('.nav'), b = $('.menu-btn');
    if (!n || !b) return;
    b.addEventListener('click', function () {
      var open = n.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Close' : 'Menu';
    });
    $$('#nav-links a').forEach(function (a) { a.addEventListener('click', function () { n.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); b.textContent = 'Menu'; }); });
  }

  /* ---------- pointer spotlight on cards ---------- */
  function spotlight() {
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- hero: growing tree canvas ---------- */
  function heroTree() {
    var cv = $('#tree'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var css = getComputedStyle(document.documentElement);
    var BR = [
      ['Investment', '--c-inv'], ['Enterprise AI', '--c-ent'], ['Windows', '--c-win'], ['Mobile', '--c-mob'],
      ['Games', '--c-game'], ['Models', '--c-model'], ['IOTA RAG', '--c-rag']
    ].map(function (b) { return { label: b[0], color: css.getPropertyValue(b[1]).trim() || '#C0C0C0' }; });
    var W, H, DPR, edges, tips, paths, pulses, stars, start, raf, running = true, built = false;
    var GROW = 2600;

    function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var R = rand(7);
      var narrow = W < 820;
      var rootX = narrow ? W * 0.5 : W * 0.785, rootY = H + 4;
      var forkY = narrow ? H - 90 : H * 0.64;
      var spanL = W * 0.06, spanR = W * 0.94, topY = H - 230;
      var rx = W * 0.185, ry = Math.min(H * 0.42, (forkY - 150));
      edges = []; tips = []; paths = [];
      var trunk = { x0: rootX, y0: rootY, cx: rootX + (narrow ? 0 : -6), cy: (rootY + forkY) / 2, x1: rootX, y1: forkY, w: 3.2, color: '#D6D6D8', t0: 0, t1: 0.28, depth: 0 };
      edges.push(trunk);
      BR.forEach(function (b, i) {
        var f = BR.length === 1 ? 0.5 : i / (BR.length - 1);
        var ang, ex, ey, th = null;
        if (narrow) {
          ang = Math.PI * (0.06 + 0.88 * f);
          ex = spanL + (spanR - spanL) * f;
          ey = topY + Math.pow(Math.abs(f - 0.5) * 2, 1.6) * (forkY - topY) * 0.55 + R() * 18;
        } else {
          th = Math.PI * (1.07 + 0.86 * f); // fan above the fork, left to right
          ex = rootX + Math.cos(th) * rx; ey = forkY + Math.sin(th) * ry + (R() - 0.5) * 14;
          ang = Math.PI - (th - Math.PI);
        }
        var e1 = { x0: trunk.x1, y0: trunk.y1, cx: trunk.x1 + (ex - trunk.x1) * 0.25, cy: ey + (trunk.y1 - ey) * 0.75, x1: ex, y1: ey, w: 2.2, color: b.color, t0: 0.26, t1: 0.62, depth: 1, b: i };
        edges.push(e1);
        tips.push({ x: ex, y: ey, b: b, i: i });
        // sub branches
        var kids = [];
        for (var k = 0; k < 3; k++) {
          var a = (th === null ? -Math.PI / 2 + (Math.cos(ang) * -0.9) : th) + (k - 1) * 0.55 + (R() - 0.5) * 0.3;
          var len = (narrow ? 26 : 34) + R() * (narrow ? 18 : 30);
          var x2 = ex + Math.cos(a) * len, y2 = ey + Math.sin(a) * len;
          var e2 = { x0: ex, y0: ey, cx: ex + Math.cos(a - 0.3) * len * 0.5, cy: ey + Math.sin(a - 0.3) * len * 0.5, x1: x2, y1: y2, w: 1.2, color: b.color, t0: 0.58 + R() * 0.05, t1: 0.82, depth: 2, b: i };
          edges.push(e2);
          for (var m = 0; m < 2; m++) {
            var a2 = a + (m ? 0.5 : -0.5) + (R() - 0.5) * 0.4, l2 = len * (0.45 + R() * 0.25);
            var e3 = { x0: x2, y0: y2, cx: x2 + Math.cos(a2) * l2 * 0.6, cy: y2 + Math.sin(a2) * l2 * 0.6, x1: x2 + Math.cos(a2) * l2, y1: y2 + Math.sin(a2) * l2, w: 0.7, color: b.color, t0: 0.78 + R() * 0.06, t1: 1, depth: 3, b: i };
            edges.push(e3); kids.push([e2, e3]);
          }
        }
        kids.forEach(function (kk) { paths.push({ list: [trunk, e1, kk[0], kk[1]], color: b.color }); });
        paths.push({ list: [trunk, e1], color: b.color, toTip: true });
      });
      // background constellation
      stars = [];
      var n = Math.round(W * H / 14000);
      for (var s = 0; s < n; s++) stars.push({ x: R() * W, y: R() * H, r: R() * 1.1 + 0.2, a: R() * 0.5 + 0.1, p: R() * 6.28 });
      pulses = [];
      built = true;
    }

    function q(e, t) { // point on quadratic bezier
      var u = 1 - t;
      return { x: u * u * e.x0 + 2 * u * t * e.cx + t * t * e.x1, y: u * u * e.y0 + 2 * u * t * e.cy + t * t * e.y1 };
    }
    function drawEdge(e, p) { // draw first p (0..1) of edge using split bezier
      if (p <= 0) return;
      var cx = e.x0 + (e.cx - e.x0) * p, cy = e.y0 + (e.cy - e.y0) * p, end = q(e, p);
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.quadraticCurveTo(cx, cy, end.x, end.y);
      ctx.strokeStyle = e.color; ctx.lineWidth = e.w; ctx.globalAlpha = e.depth === 0 ? 0.85 : (e.depth === 1 ? 0.6 : (e.depth === 2 ? 0.4 : 0.28));
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!built) build();
      if (!start) start = now;
      var g = reduce ? 1 : Math.min(1, (now - start) / GROW);
      ctx.clearRect(0, 0, W, H);
      // stars and faint links
      stars.forEach(function (s) {
        var tw = reduce ? 1 : (0.6 + 0.4 * Math.sin(now / 1400 + s.p));
        ctx.globalAlpha = s.a * tw; ctx.fillStyle = '#C0C0C0';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // glow under root
      var rg = ctx.createRadialGradient(edges[0].x0, H, 0, edges[0].x0, H, Math.max(W, H) * 0.45);
      rg.addColorStop(0, 'rgba(192,192,192,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';
      edges.forEach(function (e) {
        var p = (g - e.t0) / (e.t1 - e.t0);
        drawEdge(e, Math.max(0, Math.min(1, p)));
      });
      // tips: glowing nodes and labels
      var tipP = Math.max(0, Math.min(1, (g - 0.55) / 0.3));
      if (tipP > 0) {
        var showLabels = W >= 820;
        tips.forEach(function (t) {
          var pulse = reduce ? 0 : Math.sin(now / 900 + t.i) * 0.5 + 0.5;
          var grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 22 + pulse * 6);
          grd.addColorStop(0, hexA(t.b.color, 0.55 * tipP)); grd.addColorStop(1, hexA(t.b.color, 0));
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(t.x, t.y, 28, 0, 6.283); ctx.fill();
          ctx.fillStyle = hexA(t.b.color, tipP); ctx.beginPath(); ctx.arc(t.x, t.y, 3.6, 0, 6.283); ctx.fill();
          ctx.strokeStyle = hexA(t.b.color, 0.5 * tipP); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(t.x, t.y, 8 + pulse * 2, 0, 6.283); ctx.stroke();
          if (showLabels) {
            ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
            ctx.fillStyle = 'rgba(203,203,203,' + (0.75 * tipP) + ')';
            ctx.textAlign = 'center';
            var lab = t.b.label.toUpperCase(), lw = ctx.measureText(lab).width / 2 + 8;
            ctx.fillText(lab, Math.max(lw, Math.min(W - lw, t.x)), t.y - 18);
          }
        });
      }
      // root node
      var r0 = edges[0];
      ctx.fillStyle = '#E0E0E0'; ctx.beginPath(); ctx.arc(r0.x1, r0.y1, 4.5 * Math.min(1, g * 4), 0, 6.283); ctx.fill();
      // pulses travelling from root to tips
      if (!reduce && g >= 1) {
        if (pulses.length < 14 && Math.random() < 0.08) {
          var p = paths[(Math.random() * paths.length) | 0];
          pulses.push({ path: p, t: 0, speed: 0.0045 + Math.random() * 0.004 });
        }
        pulses = pulses.filter(function (pl) {
          pl.t += pl.speed;
          var n = pl.path.list.length, seg = Math.min(n - 1, Math.floor(pl.t * n)), lt = pl.t * n - seg;
          if (pl.t >= 1) return false;
          var pt = q(pl.path.list[seg], lt);
          var gl = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 9);
          var col = seg === 0 ? '#E0E0E0' : pl.path.color;
          gl.addColorStop(0, hexA(col, 0.95)); gl.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(pt.x, pt.y, 9, 0, 6.283); ctx.fill();
          return true;
        });
      }
      if (running && !reduce) raf = requestAnimationFrame(frame);
      else if (!reduce && g < 1) raf = requestAnimationFrame(frame);
    }
    function hexA(hex, a) {
      var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function play() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }

    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); if (reduce) frame(performance.now()); }, 120); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { running = en[0].isIntersecting && !document.hidden; if (running) play(); }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) play(); });
    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(play); else play();
  }

  /* ---------- interactive showcase ---------- */
  var ICONS = {
    core: '',
    chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5"/></svg>',
    flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 3 5 3 3 0 0 0 5 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-3 5 3 3 0 0 1-5 1"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>'
  };
  var ORDER = ['core', 'chats', 'models', 'mcp', 'skills', 'kb', 'rag', 'memory', 'persona'];

  function showcase() {
    var wrap = $('[data-showcase]'), stage = $('[data-stage]'), panel = $('[data-panel]'), src = $('[data-nodes]');
    if (!wrap || !stage || !panel || !src) return;
    var card = stage.parentNode;
    var arts = {}; $$('article[data-node]', src).forEach(function (a) { arts[a.getAttribute('data-node')] = a; });
    var root = arts.core, rx = +root.getAttribute('data-x'), ry = +root.getAttribute('data-y');
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'links'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    stage.appendChild(svg);
    var buttons = {}, lines = {}, pos = {};
    ORDER.forEach(function (key) {
      var a = arts[key]; if (!a) return;
      var x = +a.getAttribute('data-x'), y = +a.getAttribute('data-y');
      pos[key] = [x, y];
      if (key !== 'core') {
        var d = 'M' + rx + ' ' + (ry - 3) + ' C ' + rx + ' ' + (ry - 30) + ', ' + x + ' ' + (y + (ry - y) * 0.55) + ', ' + x + ' ' + y;
        var p1 = document.createElementNS(NS, 'path'); p1.setAttribute('d', d); p1.setAttribute('class', 'lk'); p1.setAttribute('vector-effect', 'non-scaling-stroke');
        var p2 = document.createElementNS(NS, 'path'); p2.setAttribute('d', d); p2.setAttribute('class', 'flow'); p2.setAttribute('vector-effect', 'non-scaling-stroke');
        var p3 = document.createElementNS(NS, 'path'); p3.setAttribute('d', d); p3.setAttribute('class', 'lk hl'); p3.setAttribute('pathLength', '1'); p3.setAttribute('vector-effect', 'non-scaling-stroke'); p3.style.display = 'none';
        svg.appendChild(p1); svg.appendChild(p2); svg.appendChild(p3); lines[key] = [p1, p2, p3];
      }
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'node' + (key === 'core' ? ' root' : '');
      b.style.left = x + '%'; b.style.top = y + '%';
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-controls', 'showcase-panel');
      b.innerHTML = (key === 'core' ? '<img src="assets/img/iota-chevron-sm.png" alt="" width="48" height="32">' : '<span class="ni">' + (ICONS[a.getAttribute('data-icon')] || '') + '</span>') +
        '<span>' + a.getAttribute('data-label') + '</span><span class="pulse"></span>';
      b.addEventListener('click', function () { select(key, true, true); });
      stage.appendChild(b); buttons[key] = b;
    });
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'zoom-reset'; reset.setAttribute('aria-label', 'Show the full tree');
    reset.innerHTML = '&larr; Full tree <kbd>Esc</kbd>';
    reset.addEventListener('click', function () { zoomOut(); });
    card.appendChild(reset);
    panel.id = 'showcase-panel';

    // Camera: view centre (cx, cy) and scale s, in the stage's 0..100 coordinates.
    var cam = { x: 50, y: 50, s: 1 }, anim = null, zoomedKey = null, DUR = 620;
    function apply(c) {
      var w = 100 / c.s, vx = c.x - w / 2, vy = c.y - w / 2;
      svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + w + ' ' + w);
      Object.keys(buttons).forEach(function (k) {
        buttons[k].style.left = ((pos[k][0] - vx) * c.s) + '%';
        buttons[k].style.top = ((pos[k][1] - vy) * c.s) + '%';
      });
    }
    function clampCam(c) {
      var h = 50 / c.s;
      c.x = Math.max(h, Math.min(100 - h, c.x)); c.y = Math.max(h, Math.min(100 - h, c.y));
      return c;
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function moveTo(target) {
      if (anim) cancelAnimationFrame(anim);
      if (reduce) { cam = target; apply(cam); return; }
      var from = { x: cam.x, y: cam.y, s: cam.s }, t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / DUR), e = ease(t);
        // tween the visible width (1/s) so the zoom speed feels even
        var w0 = 1 / from.s, w1 = 1 / target.s;
        cam = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, s: 1 / (w0 + (w1 - w0) * e) };
        apply(cam);
        anim = t < 1 ? requestAnimationFrame(step) : null;
      })(t0);
    }
    function targetFor(key) {
      var p = pos[key], small = stage.clientWidth < 520;
      if (key === 'core') return clampCam({ x: rx, y: ry - 22, s: 1.5 });
      var s = small ? 1.45 : 1.6, k = 0.34;
      return clampCam({ x: p[0] + (rx - p[0]) * k, y: p[1] + (ry - p[1]) * k, s: s });
    }
    function highlight(key) {
      Object.keys(lines).forEach(function (k) {
        var on = k === key, hl = lines[k][2];
        lines[k][0].classList.toggle('on', on); lines[k][1].classList.toggle('on', on);
        hl.classList.remove('draw');
        hl.style.display = on && zoomedKey ? '' : 'none';
      });
      if (zoomedKey && lines[key]) {
        var hl = lines[key][2];
        hl.getBoundingClientRect();
        requestAnimationFrame(function () { hl.classList.add('draw'); });
      }
    }
    function zoomTo(key) {
      zoomedKey = key; card.classList.add('zoomed');
      moveTo(targetFor(key)); highlight(key);
    }
    function zoomOut() {
      if (!zoomedKey) return;
      var cur = zoomedKey; zoomedKey = null; card.classList.remove('zoomed');
      moveTo({ x: 50, y: 50, s: 1 }); highlight(cur);
      if (buttons[cur]) buttons[cur].focus({ preventScroll: true });
    }

    var pipeTimer = null, swapTimer = null, scrollTimer = null, current = null;
    function render(key) {
      var a = arts[key];
      var i = ORDER.indexOf(key), prev = ORDER[(i - 1 + ORDER.length) % ORDER.length], next = ORDER[(i + 1) % ORDER.length];
      var body = a.cloneNode(true);
      panel.innerHTML = '';
      var crumb = document.createElement('p'); crumb.className = 'crumb'; crumb.textContent = 'IOTA for Windows / ' + a.getAttribute('data-label'); panel.appendChild(crumb);
      var div = document.createElement('div'); div.className = 'body'; while (body.firstChild) div.appendChild(body.firstChild); panel.appendChild(div);
      var row = document.createElement('div'); row.className = 'nav-row';
      row.innerHTML = '<button type="button" data-go="' + prev + '">&larr; ' + arts[prev].getAttribute('data-label') + '</button><button type="button" data-go="' + next + '">' + arts[next].getAttribute('data-label') + ' &rarr;</button>';
      panel.appendChild(row);
      $$('[data-go]', row).forEach(function (bt) { bt.addEventListener('click', function () { var g = bt.getAttribute('data-go'); select(g, true, true); buttons[g].focus({ preventScroll: true }); }); });
      clearInterval(pipeTimer);
      var steps = $$('.pipe li', panel);
      if (steps.length) {
        var s = 0; steps[0].classList.add('lit');
        if (!reduce) pipeTimer = setInterval(function () { steps.forEach(function (li, j) { li.classList.toggle('lit', j <= s); }); s = (s + 1) % (steps.length + 1); }, 900);
        else steps.forEach(function (li) { li.classList.add('lit'); });
      }
    }
    function select(key, user, zoom) {
      if (!arts[key]) return;
      Object.keys(buttons).forEach(function (k) { buttons[k].setAttribute('aria-pressed', k === key ? 'true' : 'false'); });
      if (zoom) zoomTo(key); else highlight(key);
      if (key !== current) {
        current = key;
        clearTimeout(swapTimer);
        if (reduce || !panel.firstChild) { panel.classList.remove('out'); render(key); }
        else {
          panel.classList.add('out');
          swapTimer = setTimeout(function () { render(key); panel.classList.remove('out'); }, 180);
        }
      }
      clearTimeout(scrollTimer);
      if (user && window.innerWidth < 1020) scrollTimer = setTimeout(function () {
        if (panel.getBoundingClientRect().top > window.innerHeight - 120) panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }, reduce ? 0 : DUR + 150);
    }
    // keyboard: arrows move through nodes, Escape zooms out
    stage.addEventListener('keydown', function (e) {
      var cur = ORDER.indexOf((document.activeElement && Object.keys(buttons).filter(function (k) { return buttons[k] === document.activeElement; })[0]) || '');
      if (cur < 0) return;
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = ORDER[(cur + 1) % ORDER.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = ORDER[(cur - 1 + ORDER.length) % ORDER.length];
      if (n) { e.preventDefault(); buttons[n].focus(); select(n, false, !!zoomedKey); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && zoomedKey) { e.preventDefault(); zoomOut(); }
    });
    var params = new URLSearchParams(location.search);
    var want = params.get('node');
    if (arts[want]) {
      select(want, false, true);
      setTimeout(function () { var s = $('#showcase'); if (s) s.scrollIntoView({ block: 'start' }); }, 50);
    } else select('rag', false, false);
  }

  applyConfig(); nav(); spotlight(); reveals(); heroTree(); showcase();
})();
