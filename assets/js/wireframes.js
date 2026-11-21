/* IOTA site: chrome wireframe section visuals.
   One renderer, a different shape per section. Edges fly in and assemble a core inside a breathing ring
   (after the ring in the IOTA Mobile app), branches draw out as wire tubes, then rings and packets keep flowing.
   Each canvas starts when it scrolls into view and pauses off screen or when the tab is hidden.
   Reduced motion shows a still frame. No libraries. */
(function () {
  'use strict';
  var canvases = Array.prototype.slice.call(document.querySelectorAll('canvas[data-wf]'));
  if (!canvases.length || !canvases[0].getContext) return;
  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function clamp(x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return x < a ? a : x > b ? b : x; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function hash(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  function rgb(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(c, a) { var v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }

  // Current drawing state, set before each scene draws.
  var ctx, M, LWK = 1;

  /* ---------- meshes ---------- */
  function norm(v, r) { var l = Math.hypot(v[0], v[1], v[2]); r = r || 1; return [v[0] / l * r, v[1] / l * r, v[2] / l * r]; }
  function byLen(v, len) {
    var e = [];
    for (var i = 0; i < v.length; i++) for (var j = i + 1; j < v.length; j++) {
      var d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]);
      if (Math.abs(d - len) < 0.01) e.push([i, j]);
    }
    return e;
  }
  function icosa(r) {
    var p = (1 + Math.sqrt(5)) / 2;
    var v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    var e = byLen(v, 2);
    return { v: v.map(function (x) { return norm(x, r); }), e: e };
  }
  function geodesic(r) {
    var m = icosa(1), v = m.v.slice(), adj = v.map(function () { return {}; }), F = [], key = {}, e = [], seen = {};
    m.e.forEach(function (p) { adj[p[0]][p[1]] = 1; adj[p[1]][p[0]] = 1; });
    for (var i = 0; i < 12; i++) for (var j in adj[i]) { j = +j; if (j > i) for (var k in adj[j]) { k = +k; if (k > j && adj[i][k]) F.push([i, j, k]); } }
    function mid(a, b) { var kk = a < b ? a + '_' + b : b + '_' + a; if (key[kk] == null) { key[kk] = v.length; v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); } return key[kk]; }
    function add(a, b) { var kk = a < b ? a + '_' + b : b + '_' + a; if (!seen[kk]) { seen[kk] = 1; e.push([a, b]); } }
    F.forEach(function (f) {
      var a = f[0], b = f[1], c = f[2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      add(a, ab); add(ab, b); add(b, bc); add(bc, c); add(c, ca); add(ca, a); add(ab, bc); add(bc, ca); add(ca, ab);
    });
    return { v: v.map(function (x) { return [x[0] * r, x[1] * r, x[2] * r]; }), e: e };
  }
  function cube(r) { var v = []; [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { v.push([x * r, y * r, z * r]); }); }); }); return { v: v, e: byLen(v, 2 * r) }; }
  function tetra(r) { var v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(function (x) { return norm(x, r); }); return { v: v, e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] }; }
  function ship() {
    var v = [[0, -1.55, 0]], e = [];
    function ring(y, r, n) { var s = v.length; for (var k = 0; k < n; k++) { var a = k / n * 6.2832; v.push([Math.cos(a) * r, y, Math.sin(a) * r]); } return s; }
    var a = ring(-0.55, 0.38, 6), b = ring(0.35, 0.5, 6), c = ring(0.95, 0.3, 6);
    for (var k = 0; k < 6; k++) e.push([0, a + k], [a + k, a + (k + 1) % 6], [b + k, b + (k + 1) % 6], [c + k, c + (k + 1) % 6], [a + k, b + k], [a + k, b + (k + 1) % 6], [b + k, c + k]);
    [[1.15, 1.15, 0, 0], [-1.15, 1.15, 0, 3], [0, 1.15, 1.15, 2], [0, 1.15, -1.15, 5]].forEach(function (f) { var t = v.length; v.push([f[0], f[1], f[2]]); e.push([t, b + f[3]], [t, c + f[3]]); });
    var w = v.length; v.push([0, -0.75, 0.36]); e.push([w, a], [w, a + 1], [w, 0]);
    return { v: v, e: e };
  }

  /* ---------- drawing ---------- */
  function xf(p, o) {
    var cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch), cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
    var X = p[0] * cy - p[2] * sy, Z = p[0] * sy + p[2] * cy, Y = p[1] * cp - Z * sp; Z = p[1] * sp + Z * cp;
    var X2 = X * cr - Y * sr, Y2 = X * sr + Y * cr, f = 4.2 / (4.2 + Z);
    return [o.cx + X2 * o.s * f, o.cy + Y2 * o.s * f, Z];
  }
  function glow(x, y, r, c, a) {
    if (a <= 0) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, 0.42 * a)); g.addColorStop(0.42, rgba(c, 0.14 * a)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // Chrome edges: depth based silver gradient, a specular band from a slowly turning light, glow on near edges.
  function chrome(m, o, t, accent, assemble, alpha) {
    alpha = alpha == null ? 1 : alpha;
    var d = o.drift || 0;
    var P = m.v.map(function (v, i) {
      return xf([v[0] * (1 + d * Math.sin(t * 1.3 + i * 1.7)), v[1] * (1 + d * Math.sin(t * 1.1 + i * 2.3)), v[2] * (1 + d * Math.sin(t * 0.9 + i * 0.7))], o);
    });
    var Lx = Math.cos(t * 0.4 - 0.9), Ly = Math.sin(t * 0.4 - 0.9), Rz = 1.3;
    if (!m.off) m.off = m.e.map(function (x, k) { return [(hash(k, 1) - 0.5) * 700, (hash(k, 2) - 0.5) * 500, hash(k, 3) * 0.5, (hash(k, 4) - 0.5) * 3]; });
    var E = m.e.map(function (e, k) { return { a: P[e[0]], b: P[e[1]], z: (P[e[0]][2] + P[e[1]][2]) / 2, k: k }; }).sort(function (p, q) { return q.z - p.z; });
    E.forEach(function (E1) {
      var ax = E1.a[0], ay = E1.a[1], bx = E1.b[0], by = E1.b[1];
      if (assemble < 1) {
        var q = m.off[E1.k], p = easeOut(clamp((assemble - q[2] * 0.6) / (1 - q[2] * 0.6)));
        if (p <= 0) return;
        var mx = (ax + bx) / 2, my = (ay + by) / 2, ang = q[3] * (1 - p), ca = Math.cos(ang), sa = Math.sin(ang), ox = q[0] * (1 - p), oy = q[1] * (1 - p);
        var r1x = mx + ox + (ax - mx) * ca - (ay - my) * sa, r1y = my + oy + (ax - mx) * sa + (ay - my) * ca;
        var r2x = mx + ox + (bx - mx) * ca - (by - my) * sa, r2y = my + oy + (bx - mx) * sa + (by - my) * ca;
        ax = r1x; ay = r1y; bx = r2x; by = r2y;
      }
      var near = clamp(1 - (E1.z + Rz) / (2 * Rz)), dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      var spec = Math.pow(Math.abs(-dy / l * Lx + dx / l * Ly), 10), lw = lerp(0.55, 2.3, near * near) * LWK, base = lerp(70, 225, near);
      if (near > 0.45) {
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(accent, 0.07 * alpha * near); ctx.lineWidth = lw * 5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      }
      var g = ctx.createLinearGradient(ax, ay, bx, by), c0 = base | 0, c1 = Math.min(255, base + 30 + spec * 90) | 0, c2 = (c0 * 0.85) | 0;
      g.addColorStop(0, 'rgba(' + c0 + ',' + c0 + ',' + (c0 + 6) + ',' + alpha + ')');
      g.addColorStop(0.5, 'rgba(' + c1 + ',' + c1 + ',' + Math.min(255, c1 + 8) + ',' + alpha + ')');
      g.addColorStop(1, 'rgba(' + c2 + ',' + c2 + ',' + (c2 + 8) + ',' + alpha + ')');
      ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    if (assemble >= 1) P.forEach(function (p, i) {
      var near = clamp(1 - (p[2] + Rz) / (2 * Rz)); if (near < 0.55) return;
      var g = Math.pow(Math.max(0, Math.sin(t * 1.6 + i * 2.399)), 24) * near * alpha;
      ctx.fillStyle = 'rgba(235,236,240,' + (0.55 * near * alpha) + ')'; ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
      if (g > 0.05) {
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,' + g + ')'; ctx.lineWidth = LWK;
        var s = 7 * g + 3; ctx.beginPath(); ctx.moveTo(p[0] - s, p[1]); ctx.lineTo(p[0] + s, p[1]); ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0], p[1] + s); ctx.stroke();
        glow(p[0], p[1], 10, '#ffffff', g); ctx.globalCompositeOperation = 'source-over';
      }
    });
    return P;
  }
  // Breathing ring: silver ring, accent echo ring, glow, and a shine that travels the ring.
  function ring(cx, cy, r, t, accent, p) {
    if (p <= 0) return;
    var R1 = r * (1 + 0.012 * Math.sin(t * 2.1) + 0.01 * Math.sin(t * 3.4));
    glow(cx, cy, R1 * 1.25, accent, 0.8 * p);
    ctx.strokeStyle = 'rgba(192,192,196,' + 0.75 * p + ')'; ctx.lineWidth = 1.5 * LWK; ctx.beginPath(); ctx.arc(cx, cy, R1, -Math.PI / 2, -Math.PI / 2 + 6.2832 * p); ctx.stroke();
    ctx.strokeStyle = rgba(accent, 0.45 * p); ctx.lineWidth = 1.1 * LWK; ctx.beginPath(); ctx.arc(cx, cy, R1 * 1.035, 0, 6.2832 * p); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 14; k++) { var a = t * 0.7 + k * 0.025; ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * p * (1 - k / 14)) + ')'; ctx.lineWidth = 2 * LWK; ctx.beginPath(); ctx.arc(cx, cy, R1, a, a + 0.03); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // Branch tube from the ring to an end node, with cross section rings and packets that keep flowing.
  function branch(cx, cy, r0, b, t, accent, p, packets) {
    if (p <= 0) return;
    var an = b.an, sx = cx + Math.cos(an) * r0, sy = cy + Math.sin(an) * r0, ex = b.x, ey = b.y, len = Math.hypot(ex - sx, ey - sy), nx = -Math.sin(an), ny = Math.cos(an);
    function L(f) { return [lerp(sx, ex, f), lerp(sy, ey, f)]; }
    var q = L(p);
    [1, -1].forEach(function (s) {
      var g = ctx.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, 'rgba(220,222,228,.6)'); g.addColorStop(1, 'rgba(150,152,160,.35)');
      ctx.strokeStyle = g; ctx.lineWidth = 0.9 * LWK; ctx.beginPath(); ctx.moveTo(sx + nx * 3.5 * s, sy + ny * 3.5 * s); ctx.lineTo(q[0] + nx * 3.5 * s, q[1] + ny * 3.5 * s); ctx.stroke();
    });
    ctx.strokeStyle = rgba(accent, 0.32); ctx.lineWidth = 0.8 * LWK;
    for (var d = 10; d < len * p; d += 13) { var c = L(d / len); ctx.beginPath(); ctx.ellipse(c[0], c[1], 1.6, 4.2, an, 0, 6.2832); ctx.stroke(); }
    if (packets > 0) for (var j = 0; j < 3; j++) {
      var f = (t * 0.42 + j / 3 + b.k * 0.17) % 1, pt = L(f), a = Math.sin(f * Math.PI) * packets;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(accent, 0.9 * a); ctx.lineWidth = 1.8 * LWK; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], 2.4, 6.6, an, 0, 6.2832); ctx.stroke(); glow(pt[0], pt[1], 16, accent, a);
      var f2 = 1 - ((t * 0.3 + j / 3 + b.k * 0.29) % 1), p2 = L(f2);
      ctx.fillStyle = 'rgba(255,255,255,' + 0.8 * Math.sin(f2 * Math.PI) * packets + ')'; ctx.fillRect(p2[0] - 1.2, p2[1] - 1.2, 2.4, 2.4);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function stars(t, w, h) {
    for (var i = 0; i < 60; i++) {
      var d = 0.3 + hash(i, 3) * 0.7, x = ((hash(i, 1) * w - M.x * 18 * d) % w + w) % w, y = hash(i, 2) * h - M.y * 10 * d;
      ctx.fillStyle = 'rgba(200,202,210,' + (0.06 + 0.2 * d * (0.6 + 0.4 * Math.sin(t * 1.3 + i))) + ')'; ctx.fillRect(x, y, 1.2 * d + 0.4, 1.2 * d + 0.4);
    }
  }

  /* ---------- section scenes (virtual 820 x 620 box) ---------- */
  var VW = 820, VH = 620;
  var meshes = {
    winOuter: icosa(1), winInner: icosa(0.48), geo: geodesic(1), cb: cube(0.42), cb2: cube(0.22),
    ship: ship(), lattice: icosa(1), endCube: cube(0.9), endCube2: cube(0.8), endTet: tetra(1.1)
  };
  var SCENES = {
    windows: { accent: '#B5A4C9', endShape: meshes.endCube,
      ends: [['MODELS', -150], ['SKILLS', -82], ['CONNECTORS', -12], ['KNOWLEDGE', 58], ['MEMORY', 128]],
      core: function (t, o, a) {
        var m = 1 + 0.04 * Math.sin(t * 1.7);
        chrome(meshes.winInner, { cx: o.cx, cy: o.cy, s: 78 * m, yaw: -t * 0.7, pitch: 0.3 + M.y * 0.2, drift: 0.05 }, t, '#B5A4C9', a, 0.75);
        chrome(meshes.winOuter, { cx: o.cx, cy: o.cy, s: 80, yaw: t * 0.35 + M.x * 0.35, pitch: 0.42 + M.y * 0.2 + Math.sin(t * 0.5) * 0.08, drift: 0.035 }, t, '#B5A4C9', a);
      } },
    games: { accent: '#D4B86A', endShape: meshes.endTet,
      ends: [['SMALL AND ON-DEVICE', -145], ['FINE-TUNED FOR THE GAME', -35], ['CONTENT GUARDRAILS', 35], ['IOTA TALES ON GOOGLE PLAY', 145]],
      core: function (t, o, a) {
        var bob = Math.sin(t * 1.4) * 4;
        chrome(meshes.lattice, { cx: o.cx, cy: o.cy, s: 104, yaw: -t * 0.15, pitch: 0.3 }, t, '#D4B86A', a, 0.22);
        if (a >= 1) for (var j = 0; j < 22; j++) {
          var f = (t * 1.8 + j * 0.137) % 1, x = o.cx + Math.sin(j * 12.9 + t) * 10 * f, y = o.cy + 68 + bob + f * 46;
          glow(x, y, 8, '#D4B86A', (1 - f) * 0.8); ctx.fillStyle = 'rgba(255,236,200,' + (1 - f) + ')'; ctx.fillRect(x - 1, y - 1, 2, 2);
        }
        chrome(meshes.ship, { cx: o.cx, cy: o.cy - 6 + bob, s: 62, yaw: t * 0.6 + M.x * 0.4, pitch: 0.18 + M.y * 0.15, roll: Math.sin(t * 0.8) * 0.08, drift: 0.02 }, t, '#D4B86A', a);
      } },
    enterprise: { accent: '#8EB8D4', endShape: meshes.endCube2,
      ends: [['CHAT ASSISTANTS', -150], ['DOCUMENT SEARCH', -82], ['WORKFLOW TOOLS', -12], ['CLOUD HOSTING', 58], ['ON-PREMISES', 128]],
      core: function (t, o, a) {
        chrome(meshes.cb2, { cx: o.cx, cy: o.cy, s: 80, yaw: t * 0.9, pitch: t * 0.5 }, t, '#8EB8D4', a, 0.85);
        chrome(meshes.cb, { cx: o.cx, cy: o.cy, s: 80, yaw: -t * 0.5, pitch: 0.6 }, t, '#8EB8D4', a, 0.8);
        chrome(meshes.geo, { cx: o.cx, cy: o.cy, s: 84, yaw: t * 0.28 + M.x * 0.35, pitch: 0.35 + M.y * 0.2, drift: 0.025 }, t, '#8EB8D4', a, 0.95);
      } }
  };

  function drawWire(S, st, t) {
    var cx = VW / 2 + M.x * 8, cy = 290 + M.y * 5, ringR = 118, br = 235, fy = cy + ringR + 70;
    var asm = seg(t, 0.1, 1.5), ringP = easeOut(seg(t, 0.7, 1.7)), bp = easeOut(seg(t, 1.7, 2.6)), pk = seg(t, 2.5, 3.2);
    stars(t, VW, VH);
    // floor rings and the core's reflection
    for (var k = 0; k < 3; k++) {
      var rx = 150 + k * 70; ctx.strokeStyle = 'rgba(200,202,210,' + (0.07 - 0.018 * k) + ')'; ctx.lineWidth = LWK; ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = -t * (8 + k * 4) * (k % 2 ? 1 : -1); ctx.beginPath(); ctx.ellipse(cx, fy, rx, rx * 0.16, 0, 0, 6.2832); ctx.stroke();
    }
    ctx.setLineDash([]); glow(cx, fy, 180, S.accent, 0.25);
    var off = st.off, oc = st.offCtx, os = st.offScale, main = ctx;
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, off.width, off.height); oc.setTransform(os, 0, 0, os, 0, 0);
    ctx = oc; S.core(t, { cx: 260, cy: 260 }, asm); ctx = main;
    if (st.reflect) {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.translate(0, fy); ctx.scale(1, -0.42); ctx.translate(0, -fy); ctx.drawImage(off, cx - 260, cy - 260, 520, 520); ctx.restore();
      var fg = ctx.createLinearGradient(0, fy, 0, fy + 170); fg.addColorStop(0, 'rgba(5,5,6,.2)'); fg.addColorStop(1, 'rgba(5,5,6,1)'); ctx.fillStyle = fg; ctx.fillRect(cx - 300, fy, 600, 180);
    }
    ring(cx, cy, ringR, t, S.accent, ringP);
    var ends = S.ends.map(function (e, k) { var an = e[1] * Math.PI / 180; return { k: k, an: an, label: e[0], x: cx + Math.cos(an) * br, y: cy + Math.sin(an) * br * 0.92 }; });
    ends.forEach(function (b) { branch(cx, cy, ringR * 1.06, b, t, S.accent, bp, pk); });
    ctx.drawImage(off, cx - 260, cy - 260, 520, 520);
    ends.forEach(function (b) {
      var a = easeOut(seg(t, 2.5 + b.k * 0.08, 3.1 + b.k * 0.08)); if (a <= 0) return;
      ctx.globalAlpha = a; glow(b.x, b.y, 30, S.accent, 0.7);
      chrome(S.endShape, { cx: b.x, cy: b.y, s: 11, yaw: t * 0.9 + b.k, pitch: 0.5 + Math.sin(t * 0.7 + b.k) * 0.2 }, t, S.accent, 1, a);
      ctx.globalAlpha = 1;
    });
    return ends;
  }
  // Labels are drawn in screen pixels so they stay readable at any canvas size.
  function drawLabels(st, ends, t) {
    var fs = st.cssW < 420 ? 9.5 : 11, k = st.scale;
    ctx.save(); ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.font = '500 ' + fs + 'px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = '#CBCBCB';
    ends.forEach(function (b) {
      var a = easeOut(seg(t, 2.5 + b.k * 0.08, 3.1 + b.k * 0.08)); if (a <= 0) return;
      ctx.globalAlpha = a;
      var c = Math.cos(b.an), left = c < -0.2, mid = Math.abs(c) <= 0.2;
      ctx.textAlign = left ? 'right' : mid ? 'center' : 'left';
      var words = b.label.split(' '), lines = [b.label];
      if (b.label.length > 13 && words.length > 1) {
        var best = 1, bd = 1e9;
        for (var i = 1; i < words.length; i++) { var dd = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (dd < bd) { bd = dd; best = i; } }
        lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
      }
      var x = st.ox + (b.x + c * 24) * k, y = st.oy + (b.y + Math.sin(b.an) * 22) * k + fs * 0.35 - (lines.length - 1) * (Math.sin(b.an) < 0 ? fs * 1.25 : 0);
      lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * fs * 1.25); });
    });
    ctx.restore();
  }

  /* ---------- Orchestration: scan your files, light the matching passages, fly them into a grounded answer ---------- */
  var OW = 620, OH = 520, BLUE = '#8EB8D4';
  var odocs = [], orows = [];
  (function () {
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) odocs.push({ x: 10 + c * 124, y: 80 + r * 148, w: 104, h: 132, i: r * 3 + c });
    odocs.forEach(function (d) {
      for (var l = 0; l < 7; l++) {
        var words = [], x = d.x + 10, end = d.x + d.w - 10 - hash(d.i, l) * 28, n = 0;
        while (x < end - 8) { var w = Math.min(end - x, 6 + hash(d.i * 9 + l, n) * 20); words.push({ x: x, w: w }); x += w + 4; n++; }
        orows.push({ d: d.i, l: l, y: d.y + 22 + l * 15, words: words });
      }
    });
  })();
  var AX = 400, AY = 120, AW = 210, AH = 190, CYC = 4.2, T0 = 0.4;
  function ohits(c) { var out = [], k = 0; while (out.length < 4) { var r = Math.floor(hash(c + 3, k++) * orows.length); if (out.indexOf(r) < 0) out.push(r); } return out.sort(function (a, b) { return orows[a].y - orows[b].y || a - b; }); }
  function oslots(hs) {
    var S = {};
    hs.forEach(function (r, j) { var x = AX + 14, y = AY + 30 + j * 32; orows[r].words.forEach(function (w, k) { var ww = w.w * 1.2; if (x + ww > AX + AW - 14) { x = AX + 14; y += 8; } S[r + '_' + k] = [x, y, ww]; x += ww + 4; }); });
    return S;
  }
  function chromeRect(x, y, w, h, t, speed, acc) {
    var g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, 'rgba(230,231,235,.55)'); g.addColorStop(0.45, 'rgba(120,122,130,.28)'); g.addColorStop(1, 'rgba(200,202,210,.4)');
    ctx.fillStyle = 'rgba(13,13,15,.9)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = g; ctx.lineWidth = LWK; ctx.stroke();
    var per = 2 * (w + h), d = ((t * speed) % 1) * per, px, py;
    if (d < w) { px = x + d; py = y; } else if (d < w + h) { px = x + w; py = y + d - w; } else if (d < 2 * w + h) { px = x + w - (d - w - h); py = y + h; } else { px = x; py = y + h - (d - 2 * w - h); }
    var gg = ctx.createRadialGradient(px, py, 0, px, py, 16); gg.addColorStop(0, acc ? 'rgba(142,184,212,.6)' : 'rgba(255,255,255,.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.roundRect(x - 1, y - 1, w + 2, h + 2, 8); ctx.lineWidth = 2 * LWK; ctx.strokeStyle = gg; ctx.stroke();
  }
  function hline(x, y, w, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw * LWK; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
  function drawOrch(st, t) {
    var tc = Math.max(0, t - T0), c = Math.floor(tc / CYC), u = tc - c * CYC, hs = ohits(c), S = oslots(hs);
    stars(t, OW, OH);
    chromeRect(10, 14, 352, 28, t, 0.08, false);
    var qw = lerp(0, 220, easeOut(seg(u, 0, 0.5))) * (1 - seg(u, 3.9, 4.2)); hline(70, 28, qw, 'rgba(224,224,224,.7)', 2);
    if (Math.sin(t * 6) > 0) { ctx.fillStyle = '#E0E0E0'; ctx.fillRect(73 + qw, 21, 1.5, 14); }
    odocs.forEach(function (d) { chromeRect(d.x, d.y, d.w, d.h, t + d.i * 0.37, 0.12, false); });
    var ans = seg(u, 2.2, 2.9) * (1 - seg(u, 3.9, 4.2));
    glow(AX + AW / 2, AY + AH / 2, 190, BLUE, 0.35 + 0.35 * ans); chromeRect(AX, AY - 26, AW, AH + 20, t, 0.1, true);
    var sy = lerp(70, 520, ease(seg(u, 0.4, 2.0)));
    if (u > 0.4 && u < 2.05) {
      var g = ctx.createLinearGradient(0, sy - 40, 0, sy); g.addColorStop(0, 'rgba(142,184,212,0)'); g.addColorStop(1, 'rgba(142,184,212,.22)');
      ctx.fillStyle = g; ctx.fillRect(2, sy - 40, 368, 40); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = BLUE; ctx.fillRect(2, sy, 368, 1.4 * LWK);
      glow(2 + ((t * 0.5) % 1) * 368, sy, 24, BLUE, 0.8); ctx.globalCompositeOperation = 'source-over';
    }
    orows.forEach(function (r, ri) {
      var hi = hs.indexOf(ri), lit = hi >= 0 && ((u > 0.4 && r.y < sy) || u > 2.05) && u < 4.0, sh = 0.55 + 0.25 * Math.sin(t * 1.5 - r.y * 0.03 + r.d);
      r.words.forEach(function (w, k) {
        hline(w.x, r.y, w.w, lit ? 'rgba(142,184,212,.95)' : 'rgba(205,207,214,' + (0.28 * sh + 0.12) + ')', lit ? 1.8 : 1.4);
        if (hi >= 0 && u > 2.0) {
          var p = ease(seg(u, 2.0 + k * 0.03 + hi * 0.08, 2.9 + k * 0.03 + hi * 0.08)), q = S[ri + '_' + k], fd = 1 - seg(u, 3.9, 4.2);
          if (p > 0 && fd > 0) {
            var dx = q[0] - w.x, dy = q[1] - r.y, a = Math.sin(p * Math.PI) * 0.18, x = w.x + dx * p - dy * a, y = r.y + dy * p + dx * a, ww = lerp(w.w, q[2], p);
            ctx.globalAlpha = fd; if (p < 1) glow(x + ww / 2, y, 10, BLUE, 0.6 * Math.sin(p * Math.PI));
            hline(x, y - (1 - fd) * 10, ww, p < 1 ? 'rgba(190,215,232,1)' : 'rgba(224,226,232,.95)', 1.7); ctx.globalAlpha = 1;
          }
        }
      });
      if (lit) { glow(r.words[0].x - 6, r.y, 10, BLUE, 0.6); ctx.fillStyle = BLUE; ctx.fillRect(r.words[0].x - 8, r.y - 1.5, 3, 3); }
    });
    // labels in screen pixels
    var k = st.scale, fs = st.cssW < 420 ? 9 : 10.5;
    ctx.save(); ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); ctx.font = '500 ' + fs + 'px "Geist Mono", ui-monospace, monospace';
    function lab(s, x, y, col, al) { ctx.globalAlpha = al; ctx.fillStyle = col; ctx.fillText(s, st.ox + x * k, st.oy + y * k); }
    lab('QUERY', 20, 33, '#9A9A9A', 1); lab('YOUR FILES', 10, 68, '#707070', 1); lab('ANSWER', AX, 68, '#707070', 1);
    lab((st.cssW < 420 ? '' : 'GROUNDED IN ') + hs.length + ' PASSAGES', AX + 14, AY + AH - 14, BLUE, ans);
    ctx.restore();
  }

  /* ---------- canvas setup and loop ---------- */
  var states = canvases.map(function (cv) {
    var kind = cv.getAttribute('data-wf');
    var st = { cv: cv, kind: kind, ctx: cv.getContext('2d'), t: 0, visible: false, M: { x: 0, y: 0, tx: 0, ty: 0, real: false }, vw: kind === 'orchestration' ? OW : VW, vh: kind === 'orchestration' ? OH : VH };
    if (kind !== 'orchestration') { st.off = document.createElement('canvas'); st.offCtx = st.off.getContext('2d'); }
    cv.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); st.M.real = true; st.M.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; st.M.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; }, { passive: true });
    cv.addEventListener('pointerleave', function () { st.M.real = false; });
    return st;
  });
  function size(st) {
    var r = st.cv.getBoundingClientRect(); st.cssW = r.width; st.cssH = r.height;
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.cv.width = Math.max(1, Math.round(r.width * st.dpr)); st.cv.height = Math.max(1, Math.round(r.height * st.dpr));
    st.scale = Math.min(r.width / st.vw, r.height / st.vh); st.ox = (r.width - st.vw * st.scale) / 2; st.oy = (r.height - st.vh * st.scale) / 2;
    LWK = clamp(0.75 / st.scale, 1, 1.8); st.lwk = LWK;
    st.reflect = r.width >= 380;
    if (st.off) { st.offScale = Math.min(2, st.scale * st.dpr); st.off.width = st.off.height = Math.ceil(520 * st.offScale); }
  }
  function draw(st, t) {
    ctx = st.ctx; M = st.M; LWK = st.lwk;
    if (!M.real) { M.tx = Math.sin(t * 0.45) * 0.8; M.ty = Math.sin(t * 0.31 + 1) * 0.5; }
    M.x += (M.tx - M.x) * 0.06; M.y += (M.ty - M.y) * 0.06;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, st.cv.width, st.cv.height);
    ctx.setTransform(st.dpr * st.scale, 0, 0, st.dpr * st.scale, st.dpr * st.ox, st.dpr * st.oy);
    if (st.kind === 'orchestration') { drawOrch(st, t); return; }
    var ends = drawWire(SCENES[st.kind], st, t);
    drawLabels(st, ends, t);
  }
  states.forEach(size);
  var raf = 0, last = 0;
  function still(st) { draw(st, st.kind === 'orchestration' ? 3.5 : 6); }
  function loop(now) {
    raf = 0; if (document.hidden || reduceMq.matches) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
    var any = false;
    states.forEach(function (st) { if (!st.visible) return; any = true; st.t += dt; draw(st, st.t); });
    if (any) raf = requestAnimationFrame(loop); else last = 0;
  }
  function kick() {
    if (reduceMq.matches) { states.forEach(function (st) { if (st.visible) still(st); }); return; }
    if (!raf && !document.hidden && states.some(function (s) { return s.visible; })) { last = 0; raf = requestAnimationFrame(loop); }
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { var st = states.filter(function (s) { return s.cv === e.target; })[0]; if (st) st.visible = e.isIntersecting; });
      kick();
    }, { rootMargin: '80px 0px' });
    states.forEach(function (st) { io.observe(st.cv); });
  } else { states.forEach(function (st) { st.visible = true; }); }
  document.addEventListener('visibilitychange', kick);
  if (reduceMq.addEventListener) reduceMq.addEventListener('change', kick);
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { states.forEach(function (st) { size(st); if (reduceMq.matches || document.hidden) still(st); }); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { states.forEach(function (st) { if (reduceMq.matches && st.visible) still(st); }); });
  kick();
})();
