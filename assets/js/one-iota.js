/* IOTA site: hero.
   Small points gather straight into the IOTA wordmark and a chrome sweep lights it left to right.
   All four branches meet at one point under the wordmark and run out to the hubs.
   Sparks peel off the twinkling letters, land on that meeting point, then run out along a branch
   with soft trails, taking on the hub colour and ringing the hub dot when they arrive.
   Hover a hub to route power to it. Click or tap the hero to send a pulse wave and a burst of sparks.
   Near the pointer, points move aside and faint chrome links join nearby points.
   No libraries. Pauses when the hero is off screen or the tab is hidden. Reduced motion shows a still frame. */
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
  var G0 = 0.02, IG0 = 0.5, IG1 = 0.92;  // gather, then the ignition sweep
  var B0 = 0.92, B1 = 1.32;              // branches draw from the letters to the hubs
  var HUBS_AT = 1.15, COPY_AT = 1.3, END = 1.6, SPARKS_AT = 1.25;
  var GOLD = '#D4B86A', SPARK = '#F3E9CC';

  var hubs = Array.prototype.slice.call(hero.querySelectorAll('.iota-hub')).map(function (el) {
    var c = getComputedStyle(el).getPropertyValue('--c').trim() || '#C0C0C0';
    return { el: el, dot: el.querySelector('.iota-dot'), color: c, rgb: rgbOf(c), x: 0, y: 0, ox: 0, oy: 0, list: [], acc: 0, hit: -9, power: 0 };
  });

  var W = 0, H = 0, dpr = 1, N = 0, S = { x: 0, y: 0, w: 0, h: 0 }, O = { x: 0, y: 0 }, oHit = -9;
  var sx, sy, bx, by, ox, oy, vx, vy, dl, sz, br, ph, hb, li;
  var letterEdges = [];
  var white = [];
  var t = 0, last = 0, raf = 0, inView = true, built = false;
  var ptr = { x: -9999, y: -9999, on: false };
  var hot = -1, sparks = [], flashes = [], waves = [], near = [];

  var seed = 20261120;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(v, a, b) { return clamp((v - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function rgbOf(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { var p = m[1].split(','); return [+p[0], +p[1], +p[2]]; }
    return [210, 210, 214];
  }
  function rgba(v, a) { return 'rgba(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ',' + a + ')'; }
  function mix(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
  var SPARK_RGB = rgbOf(SPARK), GOLD_RGB = rgbOf(GOLD);

  // Glow sprites, one per colour, drawn once.
  var sprites = {};
  function sprite(v) {
    var key = (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0);
    if (sprites[key]) return sprites[key];
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, rgba(v, 0.95)); g.addColorStop(0.4, rgba(v, 0.28)); g.addColorStop(1, rgba(v, 0));
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    sprites[key] = c; return c;
  }

  // Pick n points inside whatever draw() paints in a box (hero coordinates).
  function sample(box, n, draw, jitter) {
    var w = Math.max(1, Math.ceil(box.w)), h = Math.max(1, Math.ceil(box.h));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; draw(x, w, h);
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
    sx = new Float32Array(n); sy = new Float32Array(n); bx = new Float32Array(n); by = new Float32Array(n);
    ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    dl = new Float32Array(n); sz = new Float32Array(n); br = new Float32Array(n); ph = new Float32Array(n);
    hb = new Int8Array(n); li = new Int8Array(n);
    var perHub = Math.round(n * 0.015);
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
      letters.forEach(function (l, i) {
        x.fillText(l, cx, base);
        cx += widths[i] + fs * track; letterEdges.push(S.x + cx - fs * track / 2);
      });
    }, W < 700 ? 0.15 : 0.45);
    var R = Math.max(W, H) * 0.65, cxm = S.x + S.w / 2, cym = S.y + S.h / 2;
    for (var i = 0; i < N; i++) {
      bx[i] = word[i][0]; by[i] = word[i][1];
      var L = 0; while (L < letterEdges.length - 1 && bx[i] > letterEdges[L]) L++; li[i] = L;
      if (fresh || !built) {
        var an = rnd() * Math.PI * 2, rad = (0.3 + rnd() * 0.7) * R;
        sx[i] = cxm + Math.cos(an) * rad; sy[i] = cym + Math.sin(an) * rad * 0.62;
      }
    }
    built = true; sparks = []; flashes = [];
  }

  // Cubic from the meeting point O under the wordmark to hub k.
  function curve(k, f) {
    var h = hubs[k], x0 = O.x, y0 = O.y, x3 = h.x, y3 = h.y, dy = y3 - y0;
    var x1 = x0, y1 = y0 + dy * 0.55, x2 = x3, y2 = y0 + dy * 0.35, u = 1 - f;
    return [u * u * u * x0 + 3 * u * u * f * x1 + 3 * u * f * f * x2 + f * f * f * x3,
            u * u * u * y0 + 3 * u * u * f * y1 + 3 * u * f * f * y2 + f * f * f * y3];
  }

  var PX = new Float32Array(0), PY = new Float32Array(0), PA = new Float32Array(0), TW = new Float32Array(0);
  function positions(time, still) {
    if (PX.length !== N) { PX = new Float32Array(N); PY = new Float32Array(N); PA = new Float32Array(N); TW = new Float32Array(N); }
    var idle = time > END && !still;
    var sheen = idle ? S.x - 120 + (((time - END) % 7) / 7) * (S.w + 240) : -1e4;
    var sweep = S.x - 70 + seg(time, IG0, IG1) * (S.w + 140), igniting = time < IG1 + 0.25 && !still;
    var RR = 95, nearCap = W < 700 ? 40 : 70;
    near.length = 0;
    for (var i = 0; i < N; i++) {
      var d = dl[i];
      var u = easeOut(seg(time, G0 + d * 0.34, 0.6 + d * 0.3));
      if (still) u = 1;
      var x = sx[i] + (bx[i] - sx[i]) * u, y = sy[i] + (by[i] - sy[i]) * u;
      var wob = (1 - u) * 10;
      if (!still) { x += Math.sin(time * 1.6 + ph[i] * 7) * wob + Math.sin(time * 0.8 + ph[i]) * 0.35; y += Math.cos(time * 1.3 + ph[i] * 5) * wob; }
      var a = br[i] * (0.25 + 0.75 * u), tw = 0;
      if (igniting) {
        // Dim until the sweep passes, then lit, with a bright edge at the sweep.
        var sd = (x - sweep) / 30;
        a *= x < sweep ? 1 : 0.42;
        a = Math.min(1, a + 0.75 * Math.exp(-sd * sd) * u);
      }
      if (idle) {
        a *= 0.8 + 0.2 * Math.sin(time * 1.5 + ph[i] * 3);
        var sd2 = (x - sheen) / 46; a = Math.min(1, a + 0.5 * Math.exp(-sd2 * sd2));
        tw = Math.pow(Math.max(0, Math.sin(time * 2.1 + ph[i] * 13)), 24);
        a = Math.min(1, a + tw * 0.6);
      }
      var k = hb[i];
      if (k >= 0) {
        var q = still ? 1 : easeOut(seg(time, B0 + d * 0.5, B1 + d * 0.5));
        if (q > 0) {
          var sp = hot === k ? 0.62 : 0.26;
          var f = still ? (ph[i] / (Math.PI * 2)) : ((time * sp + ph[i] / (Math.PI * 2)) % 1);
          var c = curve(k, f);
          x += (c[0] - x) * q; y += (c[1] - y) * q;
          a = a * (1 - q) + q * (0.35 + 0.65 * Math.sin(f * Math.PI));
          if (hot >= 0 && hot !== k) a *= 0.45;
        }
      }
      if (!still) {
        // Pulse waves push points outward as the ring passes.
        for (var w = 0; w < waves.length; w++) {
          var wv = waves[w], wr = (time - wv.t0) * 760, wx = x + ox[i] - wv.x, wy = y + oy[i] - wv.y, wd = Math.sqrt(wx * wx + wy * wy) || 1, band = (wd - wr) / 22;
          if (band > -1.5 && band < 1.5) {
            var fall = Math.exp(-band * band) * (1 - seg(time, wv.t0, wv.t0 + 1.1));
            vx[i] += (wx / wd) * 1.5 * fall; vy[i] += (wy / wd) * 1.5 * fall; a = Math.min(1, a + 0.7 * fall);
          }
        }
        // Cursor or touch push, with a spring back to rest.
        var px = x + ox[i] - ptr.x, py = y + oy[i] - ptr.y, dd = px * px + py * py;
        if (ptr.on && dd < RR * RR && dd > 0.01) {
          var dist = Math.sqrt(dd), push = (1 - dist / RR) * 1.3;
          vx[i] += (px / dist) * push; vy[i] += (py / dist) * push;
          if (near.length < nearCap && u > 0.9) near.push(i);
        }
        vx[i] = (vx[i] - ox[i] * 0.07) * 0.84; vy[i] = (vy[i] - oy[i] * 0.07) * 0.84;
        ox[i] += vx[i]; oy[i] += vy[i];
      }
      PX[i] = x + ox[i]; PY[i] = y + oy[i]; PA[i] = a; TW[i] = tw;
    }
  }

  // Sparks: peel off a twinkling point anywhere on IOTA, arc down to O, then run out along branch k.
  function spawn(k, time, opts) {
    opts = opts || {};
    var p = white.length ? white[Math.floor(Math.random() * white.length)] : -1;
    var x0 = p >= 0 ? PX[p] : O.x, y0 = p >= 0 ? PY[p] : S.y + S.h / 2;
    var boost = hot === k ? 2.75 : 1;
    sparks.push({ k: k, x0: x0, y0: y0, t0: time, d1: opts.d1 || 0.6, d2: opts.d2 || 1.25 / boost, col: opts.col || null, size: opts.size || 1, passed: false });
    flashes.push({ x: x0, y: y0, t0: time, k: k });
  }
  // Position at a given age: first the arc into O (arriving straight down, so it flows into the branch), then the branch.
  function sparkAt(s, age) {
    if (age < s.d1) {
      var f = Math.max(0, age / s.d1), e = f * f * (3 - 2 * f), u = 1 - e;
      var x1 = s.x0, y1 = s.y0 + (O.y - s.y0) * 0.6, x2 = O.x, y2 = O.y - Math.max(24, (O.y - s.y0) * 0.45);
      return [u * u * u * s.x0 + 3 * u * u * e * x1 + 3 * u * e * e * x2 + e * e * e * O.x,
              u * u * u * s.y0 + 3 * u * u * e * y1 + 3 * u * e * e * y2 + e * e * e * O.y];
    }
    return curve(s.k, Math.min(1, (age - s.d1) / s.d2));
  }
  function step(dt, time) {
    if (time < SPARKS_AT) return;
    hubs.forEach(function (h, k) {
      h.power += ((hot === k ? 1 : 0) - h.power) * Math.min(1, dt * 6);
      var rate = 0.42 * (hot === k ? 2.75 : 1) * (hot >= 0 && hot !== k ? 0.6 : 1);
      h.acc += dt * rate * (0.7 + Math.random() * 0.6);
      if (h.acc >= 1) { h.acc -= 1; spawn(k, time); }
    });
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      if (!s.passed && time - s.t0 >= s.d1) { s.passed = true; oHit = time; }
      if (time - s.t0 >= s.d1 + s.d2) {
        sparks.splice(i, 1);
        var h = hubs[s.k]; h.hit = time;
        if (h.dot && h.dot.animate) h.dot.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.7)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      }
    }
    for (var j = flashes.length - 1; j >= 0; j--) if (time - flashes[j].t0 > 0.4) flashes.splice(j, 1);
    for (var w = waves.length - 1; w >= 0; w--) if (time - waves[w].t0 > 1.4) waves.splice(w, 1);
  }
  function waveFloor() { var m = H; hubs.forEach(function (h) { m = Math.min(m, h.y - 10); }); return hubs.length ? m : S.y + S.h + 20; }
  function pulse(x, y) {
    waves.push({ x: x, y: y, t0: t });
    if (waves.length > 3) waves.shift();
    if (t < SPARKS_AT) return;
    hubs.forEach(function (h, k) { spawn(k, t, { d1: 0.42, d2: 0.62, size: 1.35 }); });
  }

  // White chrome on the way to O, then easing into the hub colour along the branch.
  function sparkColor(s, age) {
    if (s.col) return s.col;
    var h = hubs[s.k], f = age <= s.d1 ? 0 : Math.min(1, (age - s.d1) / s.d2);
    return mix(SPARK_RGB, h.rgb, Math.min(1, f * (0.85 + 0.15 * h.power) + 0.25 * h.power * f));
  }

  function draw(time, still) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var cxm = S.x + S.w / 2, cym = S.y + S.h / 2;
    // Soft light behind the wordmark.
    var gl = still ? 1 : seg(time, 0.3, 1.1);
    if (gl > 0) {
      var g = ctx.createRadialGradient(cxm, cym, 0, cxm, cym, Math.max(S.w, 320) * 0.75);
      g.addColorStop(0, 'rgba(180,182,188,' + (0.085 * gl) + ')'); g.addColorStop(1, 'rgba(180,182,188,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Branch lines from the meeting point O.
    var bp = still ? 1 : easeOut(seg(time, B0, B1)), k, s;
    if (bp > 0) {
      hubs.forEach(function (h, k2) {
        var pw = still ? 0 : h.power, dim = hot >= 0 && hot !== k2 ? 0.4 : 1;
        ctx.beginPath();
        for (s = 0; s <= 40; s++) { var f = (s / 40) * bp, c = curve(k2, f); if (s) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }
        if (pw > 0.02) { ctx.strokeStyle = rgba(h.rgb, 0.22 * pw); ctx.lineWidth = 5; ctx.stroke(); }
        ctx.strokeStyle = h.color; ctx.lineWidth = 1 + pw * 0.6; ctx.globalAlpha = (0.38 + 0.5 * pw) * dim; ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
    // A soft glow where the branches meet, pulsing as sparks pass through.
    if (bp > 0) {
      var op = still ? 0 : clamp(1 - (time - oHit) / 0.5), orad = 10 + op * 10;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.28 + 0.55 * op) * bp; ctx.drawImage(sprite(SPARK_RGB), O.x - orad, O.y - orad, orad * 2, orad * 2);
      if (op > 0) { ctx.globalAlpha = 0.5 * op; ctx.strokeStyle = 'rgba(236,238,242,1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(O.x, O.y, 4 + (1 - op) * 9, 0, 6.2832); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    positions(time, still);
    var n, idx, tint = hot >= 0 && !still ? hubs[hot] : null;
    ctx.fillStyle = '#E4E5E8';
    for (n = 0; n < white.length; n++) {
      idx = white[n];
      if (tint && TW[idx] > 0.35) continue;
      ctx.globalAlpha = PA[idx]; var z = sz[idx] + TW[idx] * 1.2; ctx.fillRect(PX[idx], PY[idx], z, z);
    }
    if (tint) {
      ctx.fillStyle = tint.color;
      for (n = 0; n < white.length; n++) { idx = white[n]; if (TW[idx] <= 0.35) continue; ctx.globalAlpha = Math.min(1, PA[idx] + 0.2); var z2 = sz[idx] + TW[idx] * 1.6; ctx.fillRect(PX[idx], PY[idx], z2, z2); }
    }
    var q0 = still ? 1 : seg(time, B0, B0 + 0.4);
    for (k = 0; k < hubs.length; k++) {
      var h = hubs[k];
      ctx.fillStyle = q0 > 0 ? h.color : '#E4E5E8';
      for (n = 0; n < h.list.length; n++) { idx = h.list[n]; ctx.globalAlpha = PA[idx]; ctx.fillRect(PX[idx], PY[idx], sz[idx] + 0.3, sz[idx] + 0.3); }
    }
    ctx.globalAlpha = 1;

    if (!still) {
      // Ignition: a chrome glare band crossing the wordmark.
      var ig = seg(time, IG0, IG1);
      if (ig > 0 && ig < 1) {
        var gx = S.x - 70 + ig * (S.w + 140), band = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0), env = Math.sin(ig * Math.PI);
        band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.45, 'rgba(240,242,246,' + 0.16 * env + ')'); band.addColorStop(0.55, rgba(GOLD_RGB, 0.1 * env)); band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = band; ctx.fillRect(gx - 60, S.y - 10, 120, S.h + 20); ctx.globalCompositeOperation = 'source-over';
      }
      // Chrome hairlines between points near the pointer.
      if (near.length > 2) {
        var L2 = W < 700 ? 30 * 30 : 26 * 26, links = 0, cap = W < 700 ? 60 : 110;
        ctx.beginPath();
        for (var a1 = 0; a1 < near.length && links < cap; a1++) for (var b1 = a1 + 1; b1 < near.length && links < cap; b1++) {
          var i1 = near[a1], i2 = near[b1], ddx = PX[i1] - PX[i2], ddy = PY[i1] - PY[i2];
          if (ddx * ddx + ddy * ddy < L2) { ctx.moveTo(PX[i1] + 0.6, PY[i1] + 0.6); ctx.lineTo(PX[i2] + 0.6, PY[i2] + 0.6); links++; }
        }
        ctx.strokeStyle = 'rgba(214,216,222,0.28)'; ctx.lineWidth = 0.6; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      // Flash where a spark leaves its letter.
      flashes.forEach(function (fl) {
        var p = (time - fl.t0) / 0.4, al = (1 - p), r = 7 + p * 10, col = SPARK_RGB;
        ctx.globalAlpha = al; ctx.drawImage(sprite(col), fl.x - r * 1.6, fl.y - r * 1.6, r * 3.2, r * 3.2);
        ctx.strokeStyle = rgba([255, 255, 255], 0.55 * al); ctx.lineWidth = 0.8; ctx.beginPath();
        ctx.moveTo(fl.x - r, fl.y); ctx.lineTo(fl.x + r, fl.y); ctx.moveTo(fl.x, fl.y - r * 0.8); ctx.lineTo(fl.x, fl.y + r * 0.8); ctx.stroke();
      });
      // Sparks with comet trails.
      sparks.forEach(function (sp) {
        var age = time - sp.t0, col = sparkColor(sp, age), head = sparkAt(sp, age), prev = head;
        for (var j = 1; j <= 12; j++) {
          var aj = age - j * 0.022; if (aj <= 0) break;
          var p2 = sparkAt(sp, aj);
          ctx.globalAlpha = 0.55 * (1 - j / 13); ctx.strokeStyle = rgba(sparkColor(sp, aj), 1); ctx.lineWidth = 2.6 * (1 - j / 14) * sp.size;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); prev = p2;
        }
        var rr = 11 * sp.size; ctx.globalAlpha = 1; ctx.drawImage(sprite(col), head[0] - rr, head[1] - rr, rr * 2, rr * 2);
      });
      // Hub rings when sparks arrive.
      hubs.forEach(function (h) {
        var p = (time - h.hit) / 0.65; if (p < 0 || p > 1) return;
        ctx.globalAlpha = 1 - p; ctx.strokeStyle = h.color; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(h.x, h.y, 4 + p * 10, 0, 6.2832); ctx.stroke();
        ctx.drawImage(sprite(h.rgb), h.x - 13, h.y - 13, 26, 26);
      });
      // Pulse waves: a chrome ring with a gold echo, kept above the hub labels so it never crosses text.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, waveFloor()); ctx.clip();
      waves.forEach(function (wv) {
        var age = time - wv.t0, wr = age * 760, al = 1 - seg(age, 0, 1.1);
        if (al <= 0) return;
        ctx.globalAlpha = 0.55 * al; ctx.strokeStyle = 'rgba(236,238,242,1)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(wv.x, wv.y, wr, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 0.35 * al; ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wv.x, wv.y, Math.max(0, wr - 8), 0, 6.2832); ctx.stroke();
        if (age < 0.25) { ctx.globalAlpha = 1 - age / 0.25; ctx.drawImage(sprite(GOLD_RGB), wv.x - 40, wv.y - 40, 80, 80); }
      });
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (time >= HUBS_AT) hero.classList.add('is-hubs');
    if (time >= COPY_AT) hero.classList.add('is-copy');
  }

  function running() { return inView && !document.hidden && !reduceMq.matches; }
  function frame(now) {
    raf = 0;
    if (!running()) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now; t += dt;
    step(dt, t);
    draw(t, false);
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (reduceMq.matches) { drawStill(); return; }
    if (running() && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function drawStill() { t = Math.max(t, END); hot = -1; sparks = []; flashes = []; waves = []; revealAll(); draw(END, true); }

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
        lastW = w; layout(); if (reduceMq.matches || !running()) draw(Math.max(t, END), reduceMq.matches);
      }, 150);
    });
    function setPtr(e) { var r = hero.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; }
    hero.addEventListener('pointermove', setPtr, { passive: true });
    hero.addEventListener('pointerdown', function (e) {
      setPtr(e);
      // Links and buttons keep their normal job; anywhere else in the hero sends a pulse.
      if (reduceMq.matches || (e.target.closest && e.target.closest('a,button,input,label'))) return;
      if (e.button != null && e.button > 0) return;
      pulse(ptr.x, ptr.y);
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { ptr.on = false; });
    hero.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') ptr.on = false; });
    hero.addEventListener('pointercancel', function () { ptr.on = false; });
    // Hover or focus a hub to route power to its branch.
    hubs.forEach(function (h, k) {
      h.el.addEventListener('pointerenter', function () { hot = k; });
      h.el.addEventListener('pointerleave', function () { if (hot === k) hot = -1; });
      h.el.addEventListener('focusin', function () { hot = k; });
      h.el.addEventListener('focusout', function () { if (hot === k) hot = -1; });
    });
    kick();
  }

  // Wait for Geist so the wordmark samples the real font, but not for long.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('700 120px Geist') : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 800); })]).then(start, start);
})();
