/* IOTA for Windows tree: visual layer for the interactive showcase.
   Gold pulses travel from the IOTA core up every branch, the selected branch gets a stronger trace,
   and hover lights the matching branch. Pulses pause when the tree is off screen or the tab is hidden.
   Reduced motion: no pulses, a steady trace on the selected branch only. Adds no text. No libraries. */
(function () {
  'use strict';
  var stage = document.querySelector('[data-stage]');
  if (!stage) return;
  var svg = stage.querySelector('svg.links');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  var card = stage.parentNode;
  var nodes = Array.prototype.slice.call(stage.querySelectorAll('button.node'));
  var branchNodes = nodes.filter(function (b) { return !b.classList.contains('root'); });
  var base = Array.prototype.slice.call(svg.querySelectorAll('path.lk:not(.hl)'));
  var fx = [], pulses = null;
  // One pulse path per branch, built from the same curve the site already draws.
  base.forEach(function (p, i) {
    var d = p.getAttribute('d');
    var glow = document.createElementNS(NS, 'path');
    glow.setAttribute('d', d); glow.setAttribute('class', 'tfx-trace'); glow.setAttribute('pathLength', '1'); glow.setAttribute('vector-effect', 'non-scaling-stroke');
    var pl = document.createElementNS(NS, 'path');
    // No non-scaling-stroke here: Chrome ignores pathLength for dashes on non-scaling strokes. Width is kept in pixels by fitWidth().
    pl.setAttribute('d', d); pl.setAttribute('class', 'tfx-pulse'); pl.setAttribute('pathLength', '1');
    pl.style.animationDelay = (-(i * 0.37) % 2.6).toFixed(2) + 's';
    var pl2 = pl.cloneNode(); pl2.setAttribute('class', 'tfx-pulse tfx-pulse-b'); pl2.style.animationDelay = (-(i * 0.37 + 1.3) % 2.6).toFixed(2) + 's';
    var pg = pl.cloneNode(); pg.setAttribute('class', 'tfx-pulse tfx-glow'); pg.style.animationDelay = pl.style.animationDelay;
    svg.appendChild(glow); svg.appendChild(pg); svg.appendChild(pl); svg.appendChild(pl2);
    fx.push({ node: branchNodes[i], els: [glow, pg, pl, pl2] });
  });
  function sync() {
    fx.forEach(function (f) {
      var on = f.node && f.node.getAttribute('aria-pressed') === 'true';
      f.els.forEach(function (el) { el.classList.toggle('on', on); });
    });
    if (typeof fitWidth === 'function' && pulses) fitWidth();
  }
  sync();
  pulses = Array.prototype.slice.call(svg.querySelectorAll('.tfx-pulse'));
  function fitWidth() {
    var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/), w = svg.clientWidth || 1, h = svg.clientHeight || 1;
    var u = Math.sqrt((+vb[2] / w) * (+vb[3] / h));
    pulses.forEach(function (el) { var px = el.classList.contains('tfx-glow') ? (el.classList.contains('on') ? 10 : 7) : el.classList.contains('on') ? 2.8 : el.classList.contains('tfx-pulse-b') ? 1.8 : 2.2; el.style.strokeWidth = (px * u).toFixed(3); });
  }
  fitWidth();
  if ('MutationObserver' in window) new MutationObserver(fitWidth).observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
  window.addEventListener('resize', fitWidth);
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(sync);
    nodes.forEach(function (b) { mo.observe(b, { attributes: true, attributeFilter: ['aria-pressed'] }); });
  }
  stage.addEventListener('pointerover', function (e) {
    var b = e.target.closest && e.target.closest('button.node');
    fx.forEach(function (f) { f.els.forEach(function (el) { el.classList.toggle('hot', !!b && f.node === b); }); });
  });
  stage.addEventListener('pointerleave', function () { fx.forEach(function (f) { f.els.forEach(function (el) { el.classList.remove('hot'); }); }); });
  // Run only while visible.
  card.classList.add('tfx');
  function setRun(v) { card.classList.toggle('tfx-paused', !v || document.hidden); }
  var seen = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { seen = en[0].isIntersecting; setRun(seen); }, { rootMargin: '60px 0px' }).observe(card);
  } else seen = true;
  setRun(seen);
  document.addEventListener('visibilitychange', function () { setRun(seen); });
})();
