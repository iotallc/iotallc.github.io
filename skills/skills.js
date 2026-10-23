/* Skills Library filters. The cards are built from skills.json into the page, so they show without JavaScript. */
(function(){
  var q=document.getElementById('sk-q'),cat=document.getElementById('sk-cat'),ed=document.getElementById('sk-ed'),net=document.getElementById('sk-net');
  var cards=[].slice.call(document.querySelectorAll('#sk-grid .skill')),empty=document.getElementById('sk-empty');
  if(!q||!cards.length)return;
  var p=new URLSearchParams(location.search);
  if(p.get('q'))q.value=p.get('q');
  [['category',cat],['edition',ed],['network',net]].forEach(function(x){var v=p.get(x[0]);if(v&&x[1].querySelector('option[value="'+v+'"]'))x[1].value=v;});
  function apply(){
    var t=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean),any=false;
    cards.forEach(function(c){
      var ok=t.every(function(w){return c.getAttribute('data-q').indexOf(w)>-1;})
        &&(!cat.value||c.getAttribute('data-cat')===cat.value)
        &&(!ed.value||(' '+c.getAttribute('data-ed')+' ').indexOf(' '+ed.value+' ')>-1)
        &&(!net.value||c.getAttribute('data-net')===net.value);
      c.hidden=!ok; if(ok)any=true;
    });
    empty.hidden=any;
    var s=new URLSearchParams();
    if(q.value.trim())s.set('q',q.value.trim()); if(cat.value)s.set('category',cat.value); if(ed.value)s.set('edition',ed.value); if(net.value)s.set('network',net.value);
    var u=location.pathname+(s.toString()?'?'+s:'')+location.hash; try{history.replaceState(null,'',u);}catch(e){}
  }
  q.addEventListener('input',apply);[cat,ed,net].forEach(function(e){e.addEventListener('change',apply);});
  apply();
})();
