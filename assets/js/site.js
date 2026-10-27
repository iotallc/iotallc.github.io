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
    $$('[data-cfg]').forEach(function (el) { var v = CFG[el.getAttribute('data-cfg')]; if (typeof v === 'string' && v.trim()) el.textContent = v; });
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

  /* ---------- hero: growing tree canvas ---------- */
  function heroTree() {
    var cv = $('#tree'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var css = getComputedStyle(document.documentElement);
    var skipList = (cv.getAttribute('data-skip') || '').split(',');
    function skipped(label) { return skipList.indexOf(label) >= 0; }
    function token(name) { return css.getPropertyValue(name).trim() || '#C0C0C0'; }
    // Two layers. Hub colors are tree-only: Mobile is yellow, Investments is green.
    // Page sections keep their own accents (mobile green, investment gold, skills teal).
    var HUBS = [
      { label: 'Enterprise AI', color: token('--c-ent'), id: 'enterprise', leaves: [
        { label: 'Skills', id: 'skills' }, { label: 'Models', id: 'models' }
      ] },
      { label: 'Windows', color: token('--c-win'), id: 'windows', leaves: [
        { label: 'Exe', id: 'editions' }, { label: 'PowerShell', id: 'editions' }
      ] },
      { label: 'Mobile', color: token('--c-inv'), id: 'mobile', leaves: [
        { label: 'App', id: 'mobile' }, { label: 'Games', id: 'games' }
      ] },
      { label: 'Investments', color: token('--c-mob'), id: 'investment.html', leaves: [] }
    ];
    var NODES = [];
    HUBS.forEach(function (h) {
      if (skipped(h.label)) return;
      var hub = { label: h.label, color: h.color, id: h.id, hub: true, parent: null, leaves: [] };
      hub.i = NODES.length;
      NODES.push(hub);
      h.leaves.forEach(function (leaf) {
        if (skipped(leaf.label)) return;
        var node = { label: leaf.label, color: h.color, id: leaf.id, hub: false, parent: hub.i };
        node.i = NODES.length;
        NODES.push(node);
        hub.leaves.push(node);
      });
    });
    var BLURB = {
      'Enterprise AI': 'Platforms for companies, hosted in the cloud or on infrastructure you control.',
      'Skills': 'Slash-command add-ons. The downloadable library stays at /skills.',
      'Models': 'Public, fine-tuned, or custom models connected to business systems.',
      'Windows': 'A desktop AI app in two editions: Exe and PowerShell.',
      'Exe': 'The EXE edition is faster and can connect to cloud models.',
      'PowerShell': 'The PowerShell edition is strictly offline.',
      'Mobile': 'IOTA Mobile, a free assistant in closed alpha on Android.',
      'App': 'The IOTA Mobile app. Closed alpha for invited testers.',
      'Games': 'Fine-tuned models for safe-for-work mobile games.',
      'Investments': 'Sector allocation strategies. Opens the investment page.'
    };
    var readout = $('[data-tree-readout]');
    var IDLE_FINE = 'Four hubs. Point at one to see what it covers.';
    var IDLE_COARSE = 'Tap a hub or a leaf, or use the list above.';
    function readoutText() {
      return readout ? (readout.querySelector('.tree-readout-text') || readout) : null;
    }
    function fillReadout(el, i) {
      if (i == null || !NODES[i]) {
        el.textContent = fineHover ? IDLE_FINE : IDLE_COARSE;
        return;
      }
      el.textContent = '';
      var strong = document.createElement('b');
      strong.textContent = NODES[i].label;
      el.appendChild(strong);
      el.appendChild(document.createTextNode('. ' + (BLURB[NODES[i].label] || '')));
    }
    function prepareReadout() {
      if (!readout || readout.querySelector('.tree-readout-text')) return;
      var initial = readout.textContent;
      readout.textContent = '';
      function addSizer(fill) {
        var s = document.createElement('span');
        s.className = 'tree-readout-sizer';
        s.setAttribute('aria-hidden', 'true');
        fill(s);
        readout.appendChild(s);
      }
      [IDLE_FINE, IDLE_COARSE].forEach(function (t) {
        addSizer(function (s) { s.textContent = t; });
      });
      NODES.forEach(function (b, i) { addSizer(function (s) { fillReadout(s, i); }); });
      var text = document.createElement('span');
      text.className = 'tree-readout-text';
      text.textContent = initial;
      readout.appendChild(text);
    }
    function updateReadout(i) {
      var el = readoutText();
      if (!el) return;
      fillReadout(el, i);
    }
    function syncReadout() {
      updateReadout(fineHover ? (hoverTarget !== null ? hoverTarget : focusIndex) : null);
    }
    var W, H, DPR, edges, tips, paths, pulses, stars, start, raf, running = true, built = false, labelGutter = 0;
    var GROW = 2600;
    var hoverTarget = null, focusIndex = null, branchAmp = [], maxAmp = 0, lastNow = 0;
    var fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    var fineHover = !!(fineMq && fineMq.matches);
    prepareReadout();
    function syncFine() {
      fineHover = !!(fineMq && fineMq.matches);
      if (!fineHover) { hoverTarget = null; focusIndex = null; }
      syncReadout();
    }
    if (fineMq && fineMq.addEventListener) fineMq.addEventListener('change', syncFine);
    var hits = document.createElement('div');
    hits.className = 'tree-hits';
    cv.parentNode.appendChild(hits);
    var lineCatch = document.createElement('div');
    lineCatch.className = 'tree-line-catch';
    hits.appendChild(lineCatch);
    var LINE_HIT = 16;
    function nearestBranch(clientX, clientY) {
      if (!edges) return null;
      var rect = cv.getBoundingClientRect();
      var x = clientX - rect.left, y = clientY - rect.top;
      var bestI = null, bestD = LINE_HIT;
      for (var ei = 0; ei < edges.length; ei++) {
        var e = edges[ei];
        if ((e.depth !== 1 && e.depth !== 2) || e.node == null) continue;
        var prev = q(e, 0);
        for (var s = 1; s <= 28; s++) {
          var p = q(e, s / 28);
          var dx = p.x - prev.x, dy = p.y - prev.y, len2 = dx * dx + dy * dy;
          var t = len2 ? ((x - prev.x) * dx + (y - prev.y) * dy) / len2 : 0;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          var px = prev.x + dx * t, py = prev.y + dy * t;
          var dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
          if (dist < bestD) { bestD = dist; bestI = e.node; }
          prev = p;
        }
      }
      return bestI;
    }
    var tipAnchors = [];
    function hitLink(i) { return tipAnchors[i] || null; }
    function setLineHover(i) {
      if (!fineHover) return;
      lineCatch.classList.toggle('is-branch', i != null);
      if (hoverTarget === i) return;
      hoverTarget = i;
      syncReadout();
      if (reduce) frame(performance.now());
    }
    lineCatch.addEventListener('pointermove', function (e) {
      if (!fineHover) return;
      setLineHover(nearestBranch(e.clientX, e.clientY));
    });
    lineCatch.addEventListener('pointerleave', function (e) {
      if (!fineHover) return;
      var to = e.relatedTarget;
      var tip = to && to.closest && to.closest('.tree-hit');
      if (tip && hits.contains(tip)) return;
      setLineHover(null);
    });
    lineCatch.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      var i = nearestBranch(e.clientX, e.clientY);
      if (i == null) return;
      var a = hitLink(i);
      if (!a) return;
      if (e.metaKey || e.ctrlKey) { window.open(a.href, '_blank', 'noopener'); return; }
      a.click();
    });
    hits.addEventListener('pointerover', function (e) {
      if (!fineHover) return;
      var a = e.target.closest && e.target.closest('a');
      if (!a || !hits.contains(a)) return;
      hoverTarget = +a.getAttribute('data-i');
      lineCatch.classList.toggle('is-branch', true);
      syncReadout();
      if (reduce) frame(performance.now());
    });
    hits.addEventListener('pointerout', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a || !hits.contains(a)) return;
      var to = e.relatedTarget;
      if (to && a.contains(to)) return;
      if (to === lineCatch || (to && lineCatch.contains(to))) return;
      if (hoverTarget === +a.getAttribute('data-i')) hoverTarget = null;
      if (!lineCatch.matches(':hover')) lineCatch.classList.remove('is-branch');
      syncReadout();
      if (reduce) frame(performance.now());
    });
    hits.addEventListener('focusin', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      focusIndex = +a.getAttribute('data-i');
      syncReadout();
      if (reduce) frame(performance.now());
    });
    hits.addEventListener('focusout', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      if (focusIndex === +a.getAttribute('data-i')) focusIndex = null;
      syncReadout();
      if (reduce) frame(performance.now());
    });

    function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var R = rand(7);
      var narrow = W < 820;
      labelGutter = 12;
      if (!narrow) {
        var cvBox = cv.getBoundingClientRect();
        ['.hero h1', '.hero .lead', '.hero-chips', '[data-tree-readout]'].forEach(function (sel) {
          var el = document.querySelector(sel);
          if (!el) return;
          labelGutter = Math.max(labelGutter, el.getBoundingClientRect().right - cvBox.left + 36);
        });
      }
      var hubs = NODES.filter(function (n) { return n.hub; });
      function unit(x, y) {
        var l = Math.sqrt(x * x + y * y) || 1;
        return { x: x / l, y: y / l };
      }
      function place(scale) {
        var forkX = narrow ? W * 0.5 : Math.min(W - 150, Math.max(labelGutter + 180, (labelGutter + W - 24) / 2 + 20));
        var forkY = narrow ? H * 0.78 : Math.min(H * 0.74, H - 96);
        var rx = (narrow ? W * 0.28 : Math.min(230, (W - 28 - labelGutter) * 0.34)) * scale;
        var ry = narrow ? H * 0.16 : Math.min(H * 0.40, forkY - 48);
        var leafLen = (narrow ? 42 : Math.max(70, Math.min(92, Math.min(W, H) * 0.075))) * Math.max(0.8, scale);
        var leafSpread = 0.36;
        var a0 = Math.PI * (narrow ? 1.18 : 1.12);
        var a1 = Math.PI * (narrow ? 1.82 : 1.88);
        edges = []; tips = []; paths = [];
        var trunk = { x0: forkX, y0: H + 4, cx: forkX, cy: (H + 4 + forkY) / 2, x1: forkX, y1: forkY, w: 3.2, color: '#D6D6D8', t0: 0, t1: 0.28, depth: 0 };
        edges.push(trunk);
        hubs.forEach(function (hub, hi) {
          var th = hubs.length === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * (hi + 0.5) / hubs.length;
          var hx = forkX + Math.cos(th) * rx;
          var hy = forkY + Math.sin(th) * ry;
          var mx = (forkX + hx) / 2, my = (forkY + hy) / 2;
          var e1 = { x0: forkX, y0: forkY, cx: mx, cy: my - Math.min(42, ry * 0.12), x1: hx, y1: hy, w: 2.15, color: hub.color, t0: 0.26, t1: 0.62, depth: 1, node: hub.i, lit: [hub.i] };
          edges.push(e1);
          var out = unit(hx - forkX, hy - forkY);
          tips.push({ x: hx, y: hy, label: hub.label, color: hub.color, id: hub.id, i: hub.i, hub: true, ux: out.x, uy: out.y, pad: 0, shift: 0, terminal: !hub.leaves.length });
          var tangent = unit(hx - e1.cx, hy - e1.cy);
          var tang = Math.atan2(tangent.y, tangent.x);
          hub.leaves.forEach(function (leaf, j) {
            var n = hub.leaves.length;
            var dir = tang + (j - (n - 1) / 2) * leafSpread;
            var len = leafLen;
            var lx = hx + Math.cos(dir) * len;
            var ly = hy + Math.sin(dir) * len;
            if (lx < 20 || lx > W - 20 || ly < 20) {
              len *= 0.72;
              lx = hx + Math.cos(dir) * len;
              ly = hy + Math.sin(dir) * len;
            }
            var e2 = { x0: hx, y0: hy, cx: hx + Math.cos(dir) * len * 0.42, cy: hy + Math.sin(dir) * len * 0.42, x1: lx, y1: ly, w: 1.35, color: hub.color, t0: 0.58, t1: 0.9, depth: 2, node: leaf.i, lit: [hub.i, leaf.i] };
            edges.push(e2);
            var leafDir = unit(lx - hx, ly - hy);
            tips.push({ x: lx, y: ly, label: leaf.label, color: leaf.color, id: leaf.id, i: leaf.i, hub: false, ux: leafDir.x, uy: leafDir.y, pad: 0, shift: 0, terminal: true });
            paths.push({ list: [trunk, e1, e2], color: hub.color, targets: [hub.i, leaf.i] });
          });
          paths.push({ list: [trunk, e1], color: hub.color, targets: [hub.i], toTip: true });
        });
        tips.forEach(function (t) {
          if (t.terminal) return;
          var ox = t.ux, oy = t.uy;
          t.ax = t.x - ox * 50;
          t.ay = t.y - oy * 50;
          var a = { x: -oy, y: ox }, b = { x: oy, y: -ox };
          t.ux = a.x; t.uy = a.y;
          var ca = labelClearance(t);
          t.ux = b.x; t.uy = b.y;
          var cb = labelClearance(t);
          if (ca >= cb) { t.ux = a.x; t.uy = a.y; }
        });
      }
      var scale = 1;
      for (var fit = 0; fit < 8; fit++) {
        place(scale);
        relaxLabels();
        if (narrow || labelsFit()) break;
        scale *= 0.9;
      }
      // background constellation
      stars = [];
      var n = Math.round(W * H / 14000);
      for (var s = 0; s < n; s++) stars.push({ x: R() * W, y: R() * H, r: R() * 1.1 + 0.2, a: R() * 0.5 + 0.1, p: R() * 6.28 });
      pulses = [];
      built = true;
      positionHits();
    }

    function q(e, t) { // point on quadratic bezier
      var u = 1 - t;
      return { x: u * u * e.x0 + 2 * u * t * e.cx + t * t * e.x1, y: u * u * e.y0 + 2 * u * t * e.cy + t * t * e.y1 };
    }
    function drawEdge(e, p) { // draw first p (0..1) of edge using split bezier
      if (p <= 0) return;
      var cx = e.x0 + (e.cx - e.x0) * p, cy = e.y0 + (e.cy - e.y0) * p, end = q(e, p);
      var mul = 1, widthMul = 1, glow = 0;
      var amp = 0;
      if (e.lit && maxAmp > 0.001) {
        for (var li = 0; li < e.lit.length; li++) {
          var a = branchAmp[e.lit[li]] || 0;
          if (a > amp) amp = a;
        }
        mul = 1 - maxAmp * 0.28 + amp * 0.85;
        widthMul = 1 + amp * 0.4;
        glow = amp;
      }
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.quadraticCurveTo(cx, cy, end.x, end.y);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = e.w * widthMul;
      ctx.globalAlpha = Math.min(1, (e.depth === 0 ? 0.85 : (e.depth === 1 ? 0.6 : (e.depth === 2 ? 0.4 : 0.28))) * mul);
      ctx.shadowBlur = 0;
      if (glow > 0.04) { ctx.shadowColor = hexA(e.color, 0.85); ctx.shadowBlur = 14 * glow; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    function labelLayout(t) {
      ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      var lab = t.label.toUpperCase();
      var lines = ctx.measureText(lab).width > 108 && lab.indexOf(' ') !== -1 ? lab.split(' ') : [lab];
      var half = 0;
      lines.forEach(function (line) { half = Math.max(half, ctx.measureText(line).width / 2 + 8); });
      var n = lines.length;
      var ux = t.ux || 0, uy = t.uy == null ? -1 : t.uy;
      var ul = Math.sqrt(ux * ux + uy * uy) || 1;
      ux /= ul; uy /= ul;
      var boxH = n * 13;
      var along = (t.pad || 0) + 16 + Math.abs(ux) * half + Math.abs(uy) * boxH * 0.5;
      var ox = t.ax != null ? t.ax : t.x, oy = t.ay != null ? t.ay : t.y;
      var x = Math.max(half + 2, Math.min(W - half - 2, ox + ux * along + (t.shift || 0)));
      var cy = oy + uy * along;
      var top = cy - boxH / 2;
      var ys = [];
      for (var i = 0; i < n; i++) ys.push(top + i * 13 + 10);
      return { lines: lines, x: x, half: half, ys: ys };
    }
    function labelBox(t) {
      var lay = labelLayout(t);
      var y0 = 1e9, y1 = -1e9;
      lay.ys.forEach(function (y) { if (y - 11 < y0) y0 = y - 11; if (y + 3 > y1) y1 = y + 3; });
      return { x0: lay.x - lay.half, x1: lay.x + lay.half, y0: y0, y1: y1 };
    }
    function boxesOverlap(a, b) {
      return a.x0 < b.x1 + 10 && a.x1 > b.x0 - 10 && a.y0 < b.y1 + 8 && a.y1 > b.y0 - 8;
    }
    function pointBoxDist(p, box) {
      var dx = p.x < box.x0 ? box.x0 - p.x : (p.x > box.x1 ? p.x - box.x1 : 0);
      var dy = p.y < box.y0 ? box.y0 - p.y : (p.y > box.y1 ? p.y - box.y1 : 0);
      return Math.sqrt(dx * dx + dy * dy);
    }
    function labelClearance(t) {
      var box = labelBox(t);
      var minD = 1e9;
      for (var ei = 0; ei < edges.length; ei++) {
        for (var s = 0; s <= 16; s++) {
          var d = pointBoxDist(q(edges[ei], s / 16), box);
          if (d < minD) minD = d;
        }
      }
      for (var ti = 0; ti < tips.length; ti++) {
        if (tips[ti] === t) continue;
        var nd = pointBoxDist(tips[ti], { x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1 });
        if (nd < minD) minD = nd;
      }
      if (box.x0 < labelGutter || box.x1 > W - 8 || box.y0 < 16 || box.y1 > H - 10) minD = -80;
      return minD;
    }
    function labelsFit() {
      for (var i = 0; i < tips.length; i++) {
        var box = labelBox(tips[i]);
        if (box.x0 < labelGutter - 2 || box.x1 > W - 6 || box.y0 < 12 || box.y1 > H - 8) return false;
      }
      return true;
    }
    function relaxLabels() {
      if (W < 820) return;
      var pass, i, j, boxes, hit;
      for (pass = 0; pass < 14; pass++) {
        boxes = tips.map(labelBox);
        hit = false;
        for (i = 0; i < tips.length; i++) {
          var crowded = labelClearance(tips[i]) < 14;
          if (!crowded) {
            for (j = 0; j < tips.length; j++) {
              if (i !== j && boxesOverlap(boxes[i], boxes[j])) { crowded = true; break; }
            }
          }
          if (crowded && (tips[i].pad || 0) < 64) {
            tips[i].pad = (tips[i].pad || 0) + 6;
            hit = true;
          }
          for (j = i + 1; j < tips.length; j++) {
            if (!boxesOverlap(boxes[i], boxes[j])) continue;
            var ic = (boxes[i].x0 + boxes[i].x1) / 2, jc = (boxes[j].x0 + boxes[j].x1) / 2;
            var push = ic <= jc ? -7 : 7;
            tips[i].shift = Math.max(-42, Math.min(42, (tips[i].shift || 0) + push));
            tips[j].shift = Math.max(-42, Math.min(42, (tips[j].shift || 0) - push));
            hit = true;
          }
        }
        if (!hit) break;
      }
    }
    function positionHits() {
      if (!tips) return;
      while (tipAnchors.length < tips.length) {
        var created = document.createElement('a');
        hits.appendChild(created);
        tipAnchors.push(created);
      }
      while (tipAnchors.length > tips.length) hits.removeChild(tipAnchors.pop());
      var showLabels = W >= 820;
      tips.forEach(function (t, i) {
        var a = tipAnchors[i];
        a.className = 'tree-hit';
        var dest = t.id;
        var pageLink = dest.charAt(0) !== '#' && (dest.indexOf('.') !== -1 || dest.indexOf('/') !== -1);
        a.href = pageLink ? dest : '#' + dest;
        a.setAttribute('data-i', String(t.i));
        a.setAttribute('aria-label', pageLink ? 'Open ' + t.label : 'Scroll to ' + t.label);
        var left = t.x - 18, right = t.x + 18, top = t.y - 18, bottom = t.y + 18;
        if (showLabels) {
          var lay = labelLayout(t);
          left = Math.min(left, lay.x - lay.half);
          right = Math.max(right, lay.x + lay.half);
          lay.ys.forEach(function (y) {
            top = Math.min(top, y - 12);
            bottom = Math.max(bottom, y + 6);
          });
        }
        a.style.left = (left - 4) + 'px';
        a.style.top = (top - 4) + 'px';
        a.style.width = Math.max(12, right - left + 8) + 'px';
        a.style.height = Math.max(12, bottom - top + 8) + 'px';
      });
    }

    function frame(now) {
      if (!built) build();
      if (!start) start = now;
      var g = reduce ? 1 : Math.min(1, (now - start) / GROW);
      if (branchAmp.length !== NODES.length) branchAmp = NODES.map(function () { return 0; });
      var dt = lastNow ? Math.min(48, now - lastNow) : 16;
      lastNow = now;
      var step = reduce ? 1 : (1 - Math.pow(0.0015, dt / 260));
      var goalIndex = fineHover ? (hoverTarget !== null ? hoverTarget : focusIndex) : null;
      maxAmp = 0;
      for (var bi = 0; bi < branchAmp.length; bi++) {
        var goal = goalIndex != null && (bi === goalIndex || NODES[bi].parent === goalIndex) ? 1 : 0;
        branchAmp[bi] += (goal - branchAmp[bi]) * step;
        if (Math.abs(branchAmp[bi] - goal) < 0.01) branchAmp[bi] = goal;
        if (branchAmp[bi] > maxAmp) maxAmp = branchAmp[bi];
      }
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
          var amp = branchAmp[t.i] || 0;
          var glowMul = maxAmp > 0.001 ? (1 - maxAmp * 0.28 + amp * 0.7) : 1;
          var grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 22 + pulse * 6 + amp * 12);
          grd.addColorStop(0, hexA(t.color, Math.min(1, 0.55 * tipP * glowMul))); grd.addColorStop(1, hexA(t.color, 0));
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(t.x, t.y, (t.hub ? 30 : 22) + amp * 8, 0, 6.283); ctx.fill();
          ctx.fillStyle = hexA(t.color, Math.min(1, tipP * (maxAmp > 0.001 ? glowMul : 1))); ctx.beginPath(); ctx.arc(t.x, t.y, (t.hub ? 4.4 : 3.2) + amp * 0.8, 0, 6.283); ctx.fill();
          ctx.strokeStyle = hexA(t.color, Math.min(1, 0.5 * tipP * glowMul)); ctx.lineWidth = 1 + amp * 0.6; ctx.beginPath(); ctx.arc(t.x, t.y, 8 + pulse * 2 + amp * 2, 0, 6.283); ctx.stroke();
          if (showLabels) {
            var lay = labelLayout(t);
            var labelA = 0.92 * tipP * (maxAmp > 0.001 ? (1 - maxAmp * 0.3 + amp * 0.4) : 1);
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(5,5,6,' + Math.min(0.92, labelA) + ')';
            ctx.fillStyle = 'rgba(214,214,216,' + Math.min(1, labelA) + ')';
            lay.lines.forEach(function (line, li) {
              ctx.strokeText(line, lay.x, lay.ys[li]);
              ctx.fillText(line, lay.x, lay.ys[li]);
            });
          }
        });
      }
      // root node
      var r0 = edges[0];
      ctx.fillStyle = '#E0E0E0'; ctx.beginPath(); ctx.arc(r0.x1, r0.y1, 4.5 * Math.min(1, g * 4), 0, 6.283); ctx.fill();
      // pulses travelling from root to tips
      if (!reduce && g >= 1) {
        if (pulses.length < 14 && Math.random() < 0.08) {
          var pool = paths;
          if (fineHover && hoverTarget !== null) {
            var matched = paths.filter(function (p) { return p.targets.indexOf(hoverTarget) !== -1; });
            if (matched.length) pool = matched;
          }
          var p = pool[(Math.random() * pool.length) | 0];
          pulses.push({ path: p, t: 0, speed: 0.0025 + Math.random() * 0.0022 });
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
    syncReadout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { positionHits(); play(); }); else play();
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
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>'
  };
  var ORDER = ['core', 'editions', 'chats', 'models', 'mcp', 'skills', 'kb', 'rag', 'memory', 'persona'];

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
    var cam = { x: 50, y: 50, s: 1 }, anim = null, zoomedKey = null, DUR = 460;
    var fineNode = window.matchMedia('(hover: hover) and (pointer: fine)');
    stage.addEventListener('pointerover', function (e) {
      if (!fineNode.matches) return;
      var b = e.target.closest && e.target.closest('button.node');
      if (!b || !stage.contains(b)) return;
      var key = null;
      Object.keys(buttons).forEach(function (k) { if (buttons[k] === b) key = k; });
      Object.keys(lines).forEach(function (k) { lines[k][0].classList.toggle('hot', key && k === key); });
    });
    stage.addEventListener('pointerleave', function () {
      Object.keys(lines).forEach(function (k) { lines[k][0].classList.remove('hot'); });
    });
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

  /* ---------- IOTA Orchestration interactive pipeline ---------- */
  function ragPipe() {
    var box = $('[data-ragpipe]'); if (!box) return;
    var items = $$('[data-rp]', box), detail = $('#rp-detail', box), cur = null, t = null;
    var stages = $$('.rp-item', box);
    var playBtn = $('[data-rp-play]', box);
    var playing = false, stepTimer = null, stepAt = 0;
    box.classList.add('live');
    function show(it) {
      if (!it || it === cur) return;
      cur = it;
      items.forEach(function (x) {
        var on = x === it;
        x.classList.toggle('on', on);
        $('.rp-stage', x).setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var idx = stages.indexOf(it);
      var expanded = it.getAttribute('data-rp') === 'expanded';
      box.style.setProperty('--prog', expanded || idx < 0 ? 1 : idx / Math.max(1, stages.length - 1));
      box.classList.toggle('xon', expanded);
      var html = $('.rp-desc', it).innerHTML;
      clearTimeout(t);
      if (reduce) { detail.innerHTML = html; return; }
      detail.classList.add('out');
      t = setTimeout(function () { detail.innerHTML = html; detail.classList.remove('out'); }, 120);
    }
    function stopPlay() {
      playing = false;
      clearTimeout(stepTimer);
      if (playBtn) playBtn.textContent = reduce ? 'Next stage' : 'Play sequence';
    }
    function playFrom(i) {
      if (!stages.length) return;
      if (reduce) {
        var next = stages[Math.min(stages.length - 1, (stages.indexOf(cur) + 1) % stages.length)];
        if (stages.indexOf(cur) === stages.length - 1) next = stages[0];
        show(next);
        return;
      }
      playing = true;
      stepAt = i;
      cur = null;
      if (playBtn) playBtn.textContent = 'Stop';
      show(stages[stepAt]);
      stepTimer = setTimeout(function tick() {
        stepAt += 1;
        if (stepAt >= stages.length) { stopPlay(); return; }
        show(stages[stepAt]);
        stepTimer = setTimeout(tick, 720);
      }, 720);
    }
    items.forEach(function (it, i) {
      var b = $('.rp-stage', it);
      b.addEventListener('click', function () { stopPlay(); show(it); });
      b.addEventListener('mouseenter', function () {
        if (playing) return;
        if (window.matchMedia('(hover:hover)').matches) show(it);
      });
      b.addEventListener('focus', function () { if (!playing) show(it); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = items[(i + 1) % items.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = items[(i - 1 + items.length) % items.length];
        if (e.key === 'Home') n = items[0];
        if (e.key === 'End') n = items[items.length - 1];
        if (n) { e.preventDefault(); stopPlay(); $('.rp-stage', n).focus(); }
      });
    });
    var track = $('.rp-stages', box);
    if (track) track.addEventListener('pointermove', function (e) {
      if (playing || e.pointerType === 'touch') return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      var r = track.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var vertical = r.height > r.width * 1.2;
      var ratio = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      var idx = Math.max(0, Math.min(stages.length - 1, Math.floor(ratio * stages.length)));
      show(stages[idx]);
    });
    if (playBtn) {
      playBtn.textContent = reduce ? 'Next stage' : 'Play sequence';
      playBtn.addEventListener('click', function () {
        if (playing) { stopPlay(); return; }
        playFrom(0);
      });
    }
    show(stages[0] || items[0]);
  }

  /* ---------- duration labels from measured tok/s ---------- */
  function formatDuration(sec) {
    if (!isFinite(sec) || sec < 0) return '';
    if (sec === 0) return '0 ms';
    if (sec < 0.001) return 'under 1 ms';
    if (sec < 1) {
      var ms = sec * 1000;
      if (ms < 10) return (Math.round(ms * 10) / 10).toFixed(1) + ' ms';
      return Math.round(ms) + ' ms';
    }
    if (sec < 10) return (Math.round(sec * 100) / 100).toFixed(2) + ' s';
    if (sec < 60) return (Math.round(sec * 10) / 10).toFixed(1) + ' s';
    if (sec < 3600) {
      var m = Math.floor(sec / 60);
      var s = Math.round(sec - m * 60);
      if (s === 60) { m += 1; s = 0; }
      return m + ' min' + (s ? ' ' + s + ' s' : '');
    }
    var h = Math.floor(sec / 3600);
    var min = Math.round((sec - h * 3600) / 60);
    if (min === 60) { h += 1; min = 0; }
    return h + ' h' + (min ? ' ' + min + ' min' : '');
  }
  function formatCount(n) {
    if (!isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString('en-US');
    var digits = Math.abs(n) < 1 ? 3 : 2;
    return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  /* ---------- live corpus reading race ---------- */
  function speedRace() {
    var root = $('[data-race]');
    if (!root) return;
    var corpus = parseFloat(root.getAttribute('data-corpus'));
    if (!isFinite(corpus) || corpus <= 0) return;
    var CAP = 10;
    var rows = $$('[data-race-row]', root).map(function (el) {
      return {
        el: el,
        name: ($('.read-name', el) || {}).textContent || '',
        tps: parseFloat(el.getAttribute('data-tps')),
        fill: $('.fill', el),
        read: $('[data-read]', el),
        proj: $('[data-proj]', el),
        shown: ''
      };
    }).filter(function (row) { return isFinite(row.tps) && row.tps > 0 && row.fill && row.read && row.proj; });
    if (!rows.length) return;
    var clock = $('[data-race-clock]', root);
    var mode = $('[data-race-mode]', root);
    var btn = $('[data-race-btn]', root);
    var elapsed = 0, last = 0, raf = 0, running = false, started = false, onScreen = false;

    function summarize(t) {
      var sum = $('[data-race-sum]', root);
      if (!sum) return;
      if (t + 1e-9 < CAP) { sum.hidden = true; return; }
      var tuned = null, slow = null;
      rows.forEach(function (row) {
        if (!tuned || row.tps > tuned.tps) tuned = row;
        if (!slow || row.tps < slow.tps) slow = row;
      });
      if (!tuned || !slow) return;
      var slowRead = Math.min(corpus, Math.floor(slow.tps * Math.min(CAP, t) + 1e-6));
      var tunedDoneAt = corpus / tuned.tps;
      sum.hidden = false;
      sum.textContent = tuned.name + (tunedDoneAt <= CAP
        ? ' finished the corpus in ' + formatDuration(tunedDoneAt) + '. '
        : ' has read ' + Math.min(corpus, Math.floor(tuned.tps * CAP)).toLocaleString('en-US') + ' tokens. ')
        + slow.name + ' has read ' + slowRead.toLocaleString('en-US') + ' of ' + corpus.toLocaleString('en-US') + ' tokens.';
    }
    function paint(t) {
      if (clock) clock.textContent = 'Elapsed ' + (Math.round(Math.min(CAP, t) * 10) / 10).toFixed(1) + ' s';
      rows.forEach(function (row) {
        var doneAt = corpus / row.tps;
        var done = t + 1e-9 >= doneAt;
        var readN = done ? corpus : Math.min(corpus, Math.floor(row.tps * t + 1e-6));
        var stamp = (done ? 'd' : 'p') + readN;
        if (stamp !== row.shown) {
          row.shown = stamp;
          row.read.textContent = readN.toLocaleString('en-US') + ' tokens read';
          row.proj.textContent = done ? ('Finished in ' + formatDuration(doneAt)) : ('Projected ' + formatDuration(doneAt));
        }
        row.el.classList.toggle('is-done', done);
        row.fill.style.width = Math.min(100, (readN / corpus) * 100) + '%';
      });
      summarize(t);
    }
    function halt() {
      cancelAnimationFrame(raf);
      running = false;
      last = 0;
    }
    function frame(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed = Math.min(CAP, elapsed + dt);
      paint(elapsed);
      if (elapsed >= CAP) { halt(); if (btn) btn.textContent = 'Replay'; return; }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      started = true;
      halt();
      elapsed = 0;
      rows.forEach(function (row) { row.shown = ''; });
      if (reduce) {
        if (mode) mode.textContent = '10 second result';
        paint(CAP);
        if (btn) btn.textContent = 'Replay';
        return;
      }
      if (mode) mode.textContent = 'Shown at real speed';
      paint(0);
      if (btn) btn.textContent = 'Replay';
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function resume() {
      if (reduce || !started || elapsed >= CAP || !onScreen || document.hidden || running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    if (btn) btn.addEventListener('click', start);
    paint(0);
    if (reduce) {
      if (mode) mode.textContent = '10 second result';
      rows.forEach(function (row) { row.shown = ''; });
      paint(CAP);
      if (btn) btn.textContent = 'Replay';
      return;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        onScreen = !!ents[0].isIntersecting;
        if (onScreen && !started) start();
        else if (!onScreen) halt();
        else resume();
      }, { threshold: 0.15 }).observe(root);
    } else {
      onScreen = true;
      start();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) halt();
      else resume();
    });
  }

  /* ---------- document reading-time calculator ---------- */
  function speedCalc() {
    var root = $('[data-calc]');
    if (!root) return;
    var per = parseFloat(root.getAttribute('data-per-page'));
    if (!isFinite(per) || per <= 0) per = 500;
    var input = $('[data-calc-input]', root);
    var range = $('[data-calc-range]', root);
    var echo = $('[data-calc-echo]', root);
    var msg = $('[data-calc-msg]', root);
    var fast = $('[data-calc-fast]', root);
    var buttons = $$('[data-unit]', root);
    var rows = $$('[data-calc-row]', root);
    if (!input || !rows.length) return;
    var unit = 'pages';
    buttons.forEach(function (b) { if (b.getAttribute('aria-pressed') === 'true') unit = b.getAttribute('data-unit'); });

    function setPressed() {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-unit') === unit ? 'true' : 'false');
      });
    }
    function word(n, one, many) { return Math.abs(n - 1) < 1e-9 ? one : many; }
    function logWidth(tps) {
      var logs = rows.map(function (row) { return Math.log(parseFloat(row.getAttribute('data-tps'))); }).filter(function (x) { return isFinite(x); });
      var min = Math.min.apply(null, logs), max = Math.max.apply(null, logs), x = Math.log(tps);
      if (!logs.length || !isFinite(x) || max === min) return 0;
      return 8 + 92 * (x - min) / (max - min);
    }
    function syncRange(n) {
      if (!range || !isFinite(n)) return;
      if (unit === 'pages') { range.max = '400'; range.step = '1'; }
      else { range.max = '200000'; range.step = '500'; }
      range.value = String(Math.max(0, Math.min(Number(range.max), n)));
    }
    function render() {
      var raw = input.value.trim();
      var n = raw === '' ? NaN : Number(raw);
      if (raw === '' || !isFinite(n) || n < 0) {
        if (msg) msg.hidden = false;
        if (echo) echo.textContent = '';
        if (fast) fast.textContent = '';
        rows.forEach(function (row) {
          var slot = $('[data-time]', row); if (slot) slot.textContent = '';
          var bar = $('[data-bar]', row); if (bar) bar.style.width = '0%';
        });
        return;
      }
      if (msg) msg.hidden = true;
      syncRange(n);
      var tokens = unit === 'pages' ? n * per : n;
      var pages = tokens / per;
      if (echo) {
        echo.textContent = unit === 'pages'
          ? formatCount(n) + ' ' + word(n, 'page', 'pages') + ' ' + word(n, 'equals', 'equal') + ' ' + formatCount(tokens) + ' tokens.'
          : formatCount(n) + ' ' + word(n, 'token', 'tokens') + ' ' + word(n, 'equals', 'equal') + ' ' + formatCount(pages) + ' ' + word(pages, 'page', 'pages') + '.';
      }
      var best = null;
      rows.forEach(function (row) {
        var tps = parseFloat(row.getAttribute('data-tps'));
        var slot = $('[data-time]', row);
        if (slot) slot.textContent = isFinite(tps) && tps > 0 ? formatDuration(tokens / tps) : '';
        var bar = $('[data-bar]', row);
        if (bar) bar.style.width = (isFinite(tps) ? logWidth(tps) : 0) + '%';
        var name = ($('b', row) || {}).textContent || '';
        if (isFinite(tps) && tps > 0 && (!best || tps > best.tps)) best = { tps: tps, name: name };
      });
      if (fast) fast.textContent = best ? 'Shortest time at this size: ' + best.name + ', ' + formatDuration(tokens / best.tps) + '.' : '';
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = b.getAttribute('data-unit');
        if (!next || next === unit) return;
        var n = Number(input.value);
        if (isFinite(n) && n >= 0) {
          if (unit === 'pages' && next === 'tokens') input.value = String(Math.round(n * per));
          if (unit === 'tokens' && next === 'pages') {
            var pages = Math.round((n / per) * 100) / 100;
            input.value = String(pages);
          }
        }
        unit = next;
        setPressed();
        render();
      });
    });
    input.addEventListener('input', render);
    if (range) range.addEventListener('input', function () { input.value = range.value; render(); });
    setPressed();
    render();
  }

  /* ---------- edition compare ---------- */
  function editions() {
    var root = $('[data-editions]');
    if (!root) return;
    var note = $('[data-ed-note]', root);
    var grid = $('.editions');
    var cards = $$('[data-ed-card]');
    var copy = {
      ps: 'PowerShell edition stays offline. It does not connect to the internet, and RAG uses local databases only.',
      exe: 'EXE edition can connect to cloud models and switch between local and cloud hosting with one click.',
      none: 'Both editions run from the USB kit. Pick what you need.'
    };
    function pick(ed) {
      cards.forEach(function (c) { c.classList.toggle('is-match', !!ed && c.getAttribute('data-ed-card') === ed); });
      if (grid) grid.classList.toggle('is-chosen', !!ed);
      $$('[data-ed]', root).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ed') === ed ? 'true' : 'false'); });
      if (note) note.textContent = copy[ed] || copy.none;
    }
    $$('[data-ed]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var ed = b.getAttribute('data-ed');
        pick(b.getAttribute('aria-pressed') === 'true' ? '' : ed);
      });
    });
  }

  /* ---------- home skills command picker ---------- */
  function skillPick() {
    var root = $('[data-skillpick]');
    if (!root) return;
    var detail = $('[data-skill-detail]', root);
    var copy = {
      '/chart': 'Build a chart from numbers or a table.',
      '/deck': 'Make a slide deck.',
      '/pdf': 'Create a PDF document.',
      '/ocr': 'Read the text in an image or scan.',
      '/transcribe': 'Turn an audio recording into text.',
      '/units': 'Convert units exactly.',
      '/fin': 'Run finance calculations.'
    };
    var buttons = $$('[data-cmd]', root);
    function show(btn) {
      buttons.forEach(function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
      if (!detail) return;
      var cmd = btn.getAttribute('data-cmd');
      detail.textContent = '';
      var strong = document.createElement('b');
      strong.textContent = cmd + '.';
      detail.appendChild(strong);
      detail.appendChild(document.createTextNode(' ' + (copy[cmd] || '')));
    }
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { show(b); });
      b.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover:hover)').matches) show(b);
      });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = buttons[(i + 1) % buttons.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = buttons[(i - 1 + buttons.length) % buttons.length];
        if (n) { e.preventDefault(); n.focus(); show(n); }
      });
    });
    if (buttons[0]) show(buttons[0]);
  }

  /* ---------- investment illustration: read the drawn weight ---------- */
  function allocInspect() {
    var card = $('.alloc');
    if (!card) return;
    var rows = $$('.row', card);
    if (!rows.length) return;
    var note = document.createElement('p');
    note.className = 'alloc-note';
    note.setAttribute('aria-live', 'polite');
    var foot = $('.foot', card);
    if (foot) card.insertBefore(note, foot); else card.appendChild(note);
    function weight(row) {
      var fill = $('.fill', row);
      return fill ? (fill.style.getPropertyValue('--w') || '').trim() : '';
    }
    function show(row) {
      rows.forEach(function (r) { r.classList.toggle('is-on', r === row); });
      if (!row) {
        note.textContent = 'Illustration only. Select a row to read the weight drawn on the track.';
        return;
      }
      var name = (row.querySelector('span') || {}).textContent || 'This row';
      note.textContent = name + ' is drawn at ' + weight(row) + ' of the track. This is an illustration, not a portfolio.';
    }
    rows.forEach(function (row) {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('pointerenter', function () {
        if (window.matchMedia('(hover:hover)').matches) show(row);
      });
      row.addEventListener('focus', function () { show(row); });
      row.addEventListener('click', function () { show(row); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(row); }
      });
    });
    card.addEventListener('pointerleave', function (e) {
      if (!window.matchMedia('(hover:hover)').matches) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      show(null);
    });
    show(null);
  }

  function sameDoc(a) {
    if (!a.hash) return false;
    try {
      var u = new URL(a.getAttribute('href') || '', location.href);
      return u.pathname === location.pathname && !!document.getElementById(a.hash.slice(1));
    } catch (err) { return false; }
  }
  function markHere(selector) {
    var links = $$(selector).filter(sameDoc);
    if (links.length < 2 || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { var id = a.hash.slice(1); if (!map[id]) map[id] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = map[en.target.id];
        if (!a || !en.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('is-here'); });
        a.classList.add('is-here');
      });
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  function guideSteps() {
    var items = $$('.steps-list > li');
    if (items.length < 2 || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-current', en.isIntersecting); });
    }, { rootMargin: '-20% 0px -58% 0px', threshold: 0 });
    items.forEach(function (li) { io.observe(li); });
  }

  applyConfig(); nav(); reveals(); heroTree(); showcase(); ragPipe(); speedRace(); speedCalc(); editions(); skillPick(); allocInspect(); markHere('#nav-links a'); markHere('.toc a'); guideSteps();
})();
