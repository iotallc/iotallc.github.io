(function () {
  var q = document.getElementById("ib-q");
  var cat = document.getElementById("ib-cat");
  var cards = Array.prototype.slice.call(document.querySelectorAll("#ib-grid article"));
  var count = document.getElementById("ib-count");
  var empty = document.getElementById("ib-empty");
  if (!q || !cards.length) return;
  var params = new URLSearchParams(location.search);
  if (params.get("group") && cat) cat.value = params.get("group");

  function apply() {
    var query = (q.value || "").trim().toLowerCase();
    var group = cat ? cat.value : "";
    var shown = 0;
    cards.forEach(function (card) {
      var ok = (!group || card.getAttribute("data-cat") === group) &&
        (!query || (card.getAttribute("data-q") || "").indexOf(query) >= 0);
      card.hidden = !ok;
      if (ok) shown++;
    });
    if (count) count.textContent = shown + (shown === 1 ? " info bank" : " info banks");
    if (empty) empty.hidden = shown !== 0;
  }
  q.addEventListener("input", apply);
  if (cat) cat.addEventListener("change", apply);
  apply();
})();
