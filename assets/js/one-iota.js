/* IOTA site: One Iota hero.
   Small points gather into the Greek letter iota, grow into the IOTA wordmark,
   then branch to the hubs. Plays once, then holds with a gentle shimmer.
   Points move away from the cursor or a finger and spring back.
   No libraries. Pauses when the hero is off screen or the tab is hidden. */
(function () {
  'use strict';
  var hero = document.querySelector('[data-one-iota]');
  if (!hero) return;
  var cv = hero.querySelector('#one-iota');
  var stage = hero.querySelector('[data-iota-stage]');

  function revealAll() { hero.classList.add('is-hubs', 'is-copy', 'is-done'); }
  if (!cv || !cv.getContext || !stage) { hero.classList.add('iota-nocanvas'); revealAll(); return; }
  var ctx = cv.getContext('2d');
  if (!ctx) { hero.classList.add('iota-nocanvas'); revealAll(); return; }

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // Timeline in seconds.
  var G0 = 0.15, G1 = 1.45;   // gather into the iota
  var M0 = 2.65, M1 = 3.6;   // grow into the wordmark
  var B0 = 3.6, B1 = 4.4;    // branches draw to the hubs
  var HUBS_AT = 3.85, COPY_AT = 4.25, END = 5.4;

  var hubs = Array.prototype.slice.call(hero.querySelectorAll('.iota-hub')).map(function (el) {
    var c = getComputedStyle(el).getPropertyValue('--c').trim() || '#C0C0C0';
    return { el: el, dot: el.querySelector('.iota-dot'), color: c, x: 0, y: 0, list: [] };
  });

  var W = 0, H = 0, dpr = 1, N = 0, S = { x: 0, y: 0, w: 0, h: 0 }, O = { x: 0, y: 0 };
  var sx, sy, ax, ay, bx, by, ox, oy, vx, vy, dl, sz, br, ph, hb, li;
  var letterEdges = [];
  var white = [];
  var t = 0, last = 0, raf = 0, inView = true, built = false, sheenSeed = 0;
  var ptr = { x: -9999, y: -9999, on: false };

  // Small seeded random so the gather looks the same on every visit.
  var seed = 20261120;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(v, a, b) { return clamp((v - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  // Pick n points inside whatever draw() paints in a box (hero coordinates).
  function sample(box, n, draw, jitter) {
    if (jitter == null) jitter = 0.45;
    var w = Math.max(1, Math.ceil(box.w)), h = Math.max(1, Math.ceil(box.h));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; draw(x, w, h);
    var d = x.getImageData(0, 0, w, h).data, filled = 0, i, j;
    for (i = 3; i < d.length; i += 16) if (d[i] > 128) filled += 4;
    var step = Math.max(1, Math.floor(Math.sqrt(filled / n)));
    var pts = [];
    for (j = 0; j < h; j += step) for (i = 0; i < w; i += step) {
      if (d[(j * w + i) * 4 + 3] > 128) pts.push([box.x + i + (rnd() - 0.5) * step * jitter, box.y + j + (rnd() - 0.5) * step * jitter]);
    }
    if (!pts.length) pts.push([box.x + w / 2, box.y + h / 2]);
    for (i = pts.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); var tmp = pts[i]; pts[i] = pts[j]; pts[j] = tmp; }
    var out = new Array(n);
    for (i = 0; i < n; i++) out[i] = pts[i % pts.length];
    return out;
  }

  function relRect(el) {
    var r = el.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    return { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
  }

  function alloc(n) {
    N = n; seed = 20261120;
    sx = new Float32Array(n); sy = new Float32Array(n); ax = new Float32Array(n); ay = new Float32Array(n);
    bx = new Float32Array(n); by = new Float32Array(n); ox = new Float32Array(n); oy = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n); dl = new Float32Array(n); sz = new Float32Array(n);
    br = new Float32Array(n); ph = new Float32Array(n); hb = new Int8Array(n); li = new Int8Array(n);
    var perHub = Math.round(n * 0.02);
    white = []; hubs.forEach(function (h) { h.list = []; });
    for (var i = 0; i < n; i++) {
      var small = n < 1500;
      dl[i] = rnd() * 0.5; sz[i] = small ? 1.45 + rnd() * 0.5 : 0.9 + rnd() * 1.3; br[i] = small ? 0.72 + rnd() * 0.28 : 0.45 + rnd() * 0.55; ph[i] = rnd() * Math.PI * 2;
      var k = Math.floor(i / perHub);
      hb[i] = k < hubs.length ? k : -1;
      if (hb[i] >= 0) hubs[k].list.push(i); else white.push(i);
    }
  }

  function layout() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var want = W < 700 ? 900 : 3000;
    var fresh = want !== N;
    if (fresh) alloc(want);
    S = relRect(stage);
    O = { x: S.x + S.w / 2, y: S.y + S.h + 10 };
    hubs.forEach(function (h) { var d = relRect(h.dot || h.el); h.x = d.x + d.w / 2; h.y = d.y + d.h / 2; });

    // Wordmark targets: IOTA in Geist 700 with wide tracking, fit to the stage.
    var fam = getComputedStyle(document.body).fontFamily;
    var word = sample(S, N, function (x, w, h) {
      var fs = h / 0.74, track = 0.1, letters = 'IOTA'.split(''), total, widths;
      function measure() {
        x.font = '700 ' + fs + 'px ' + fam;
        widths = letters.map(function (l) { return x.measureText(l).width; });
        total = widths.reduce(function (a, b) { return a + b; }, 0) + fs * track * (letters.length - 1);
      }
      measure();
      if (total > w * 0.98) { fs *= (w * 0.98) / total; measure(); }
      var cx = (w - total) / 2, base = h / 2 + fs * 0.36;
      letterEdges = [];
      letters.forEach(function (l, i) { x.fillText(l, cx, base); cx += widths[i] + fs * track; letterEdges.push(S.x + cx - fs * track / 2); });
    }, W < 700 ? 0.15 : 0.45);
    // Iota targets: a drawn lowercase iota (stem with a tail), so it does not depend on font coverage.
    var gh = S.h * 1.55, gw = gh * 0.5;
    var gbox = { x: O.x - gw / 2, y: S.y + S.h / 2 - gh / 2, w: gw, h: gh };
    var glyph = sample(gbox, N, function (x, w, h) {
      var sw = h * 0.12, x0 = w * 0.42, top = h * 0.04, bot = h * 0.96 - sw / 2, rr = h * 0.2;
      x.lineWidth = sw; x.lineCap = 'butt'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(x0, top); x.lineTo(x0, bot - rr); x.quadraticCurveTo(x0, bot, x0 + rr, bot); x.lineTo(x0 + rr * 1.25, bot); x.stroke();
    });
    var R = Math.max(W, H) * 0.65;
    for (var i = 0; i < N; i++) {
      ax[i] = glyph[i][0]; ay[i] = glyph[i][1]; bx[i] = word[i][0]; by[i] = word[i][1];
      var L = 0; while (L < letterEdges.length - 1 && bx[i] > letterEdges[L]) L++; li[i] = L;
      if (fresh || !built) {
        var an = rnd() * Math.PI * 2, rad = (0.3 + rnd() * 0.7) * R;
        sx[i] = O.x + Math.cos(an) * rad; sy[i] = S.y + S.h / 2 + Math.sin(an) * rad * 0.62;
      }
    }
    built = true;
  }

  function curve(h, f) {
    // Cubic from the wordmark base to a hub dot.
    var x0 = O.x, y0 = O.y, x3 = h.x, y3 = h.y, dy = y3 - y0;
    var x1 = x0, y1 = y0 + dy * 0.55, x2 = x3, y2 = y0 + dy * 0.35;
    var u = 1 - f;
    return [u * u * u * x0 + 3 * u * u * f * x1 + 3 * u * f * f * x2 + f * f * f * x3,
            u * u * u * y0 + 3 * u * u * f * y1 + 3 * u * f * f * y2 + f * f * f * y3];
  }

  var PX = new Float32Array(0), PY = new Float32Array(0), PA = new Float32Array(0);
  function positions(time, still) {
    if (PX.length !== N) { PX = new Float32Array(N); PY = new Float32Array(N); PA = new Float32Array(N); }
    var idle = time > END && !still;
    var sheen = idle ? S.x - 120 + (((time - END) % 7) / 7) * (S.w + 240) : -1e4;
    for (var i = 0; i < N; i++) {
      var d = dl[i];
      var u1 = ease(seg(time, G0 + d * 0.6, G1 + d * 0.4));
      // Letter by letter: I, O, T, A peel off the iota in turn, each along its own arc.
      var l0 = M0 + li[i] * 0.16 + d * 0.22;
      var u2 = ease(seg(time, l0, l0 + 0.62));
      var x = sx[i] + (ax[i] - sx[i]) * u1, y = sy[i] + (ay[i] - sy[i]) * u1;
      if (u2 > 0) {
        var ddx = bx[i] - x, ddy = by[i] - y, arc = Math.sin(u2 * Math.PI) * (0.22 + 0.06 * li[i]);
        var side = li[i] < 2 ? 1 : -1;
        x += ddx * u2 - ddy * arc * side; y += ddy * u2 + ddx * arc * side;
      }
      var wob = (1 - u1) * 12;
      if (!still) { x += Math.sin(time * 1.6 + ph[i] * 7) * wob + Math.sin(time * 0.8 + ph[i]) * 0.35; y += Math.cos(time * 1.3 + ph[i] * 5) * wob; }
      var a = br[i] * (0.25 + 0.75 * u1);
      if (idle) {
        a *= 0.8 + 0.2 * Math.sin(time * 1.5 + ph[i] * 3);
        var sd = (x - sheen) / 46; a = Math.min(1, a + 0.55 * Math.exp(-sd * sd));
      }
      var k = hb[i];
      if (k >= 0) {
        var q = easeOut(seg(time, B0 + d * 0.8, B1 + d * 0.8));
        if (q > 0) {
          var f = still ? (ph[i] / (Math.PI * 2)) : ((time * 0.26 + ph[i] / (Math.PI * 2)) % 1);
          var c = curve(hubs[k], f);
          x += (c[0] - x) * q; y += (c[1] - y) * q;
          a = a * (1 - q) + q * (0.35 + 0.65 * Math.sin(f * Math.PI));
        }
      }
      // Cursor or touch push, with a spring back to rest.
      if (!still) {
        var px = x + ox[i] - ptr.x, py = y + oy[i] - ptr.y, dd = px * px + py * py, RR = 95;
        if (ptr.on && dd < RR * RR && dd > 0.01) {
          var dist = Math.sqrt(dd), push = (1 - dist / RR) * 1.6;
          vx[i] += (px / dist) * push; vy[i] += (py / dist) * push;
        }
        vx[i] = (vx[i] - ox[i] * 0.07) * 0.84; vy[i] = (vy[i] - oy[i] * 0.07) * 0.84;
        ox[i] += vx[i]; oy[i] += vy[i];
      }
      PX[i] = x + ox[i]; PY[i] = y + oy[i]; PA[i] = a;
    }
  }

  function draw(time, still) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Soft light behind the wordmark.
    var gl = seg(time, 1.0, 2.2);
    if (gl > 0) {
      var g = ctx.createRadialGradient(O.x, S.y + S.h / 2, 0, O.x, S.y + S.h / 2, Math.max(S.w, 320) * 0.75);
      g.addColorStop(0, 'rgba(180,182,188,' + (0.085 * gl) + ')'); g.addColorStop(1, 'rgba(180,182,188,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Branch lines.
    var bp = easeOut(seg(time, B0, B1));
    if (bp > 0) {
      ctx.lineWidth = 1;
      hubs.forEach(function (h) {
        ctx.strokeStyle = h.color; ctx.globalAlpha = 0.38;
        ctx.beginPath();
        for (var s = 0; s <= 40; s++) { var f = (s / 40) * bp, c = curve(h, f); if (s) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    positions(time, still);
    var i, n, idx;
    ctx.fillStyle = '#E4E5E8';
    for (n = 0; n < white.length; n++) { idx = white[n]; ctx.globalAlpha = PA[idx]; ctx.fillRect(PX[idx], PY[idx], sz[idx], sz[idx]); }
    for (i = 0; i < hubs.length; i++) {
      var h = hubs[i], q = seg(time, B0, B0 + 0.5);
      for (n = 0; n < h.list.length; n++) {
        idx = h.list[n];
        ctx.fillStyle = q > 0 ? h.color : '#E4E5E8';
        ctx.globalAlpha = PA[idx]; ctx.fillRect(PX[idx], PY[idx], sz[idx] + 0.3, sz[idx] + 0.3);
      }
    }
    ctx.globalAlpha = 1;
    if (time >= HUBS_AT) hero.classList.add('is-hubs');
    if (time >= COPY_AT) hero.classList.add('is-copy');
  }

  function running() { return inView && !document.hidden && !reduceMq.matches; }
  function frame(now) {
    raf = 0;
    if (!running()) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now; t += dt;
    draw(t, false);
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (reduceMq.matches) { drawStill(); return; }
    if (running() && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function drawStill() { t = Math.max(t, END); revealAll(); draw(END, true); }

  function start() {
    try { layout(); } catch (e) { hero.classList.add('iota-nocanvas'); revealAll(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; kick(); }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', kick);
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', kick);
    var rt = 0, lastW = W;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        // Mobile browsers resize when the address bar hides. Only rebuild on real width changes.
        var w = hero.getBoundingClientRect().width;
        if (Math.abs(w - lastW) < 2 && Math.abs(hero.getBoundingClientRect().height - H) < 120) return;
        lastW = w; layout(); if (reduceMq.matches || !running()) draw(Math.max(t, reduceMq.matches ? END : t), reduceMq.matches);
      }, 150);
    });
    function setPtr(e) { var r = hero.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; }
    hero.addEventListener('pointermove', setPtr, { passive: true });
    hero.addEventListener('pointerdown', setPtr, { passive: true });
    hero.addEventListener('pointerleave', function () { ptr.on = false; });
    hero.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') ptr.on = false; });
    hero.addEventListener('pointercancel', function () { ptr.on = false; });
    kick();
  }

  // Wait for Geist so the wordmark samples the real font, but never longer than 1.5 s.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('700 120px Geist') : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
