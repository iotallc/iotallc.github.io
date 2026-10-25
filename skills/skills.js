/* Skills Library: filters plus the skill types tree.
   The cards and a grouped list are static HTML built from skills.json, so the page works without JavaScript.
   Created by IOTA - Joseph Bryant. */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q=document.getElementById('sk-q'),cat=document.getElementById('sk-cat'),ed=document.getElementById('sk-ed'),net=document.getElementById('sk-net');
  var cards=[].slice.call(document.querySelectorAll('#sk-grid .skill')),empty=document.getElementById('sk-empty');
  if(!q||!cards.length)return;
  var OLD={docs:'everyday',data:'everyday',read:'everyday',files:'everyday'};
  var p=new URLSearchParams(location.search);
  if(p.get('q'))q.value=p.get('q');
  [['category',cat],['edition',ed],['network',net]].forEach(function(x){var v=p.get(x[0]);if(x[0]==='category'&&OLD[v])v=OLD[v];if(v&&x[1].querySelector('option[value="'+v+'"]'))x[1].value=v;});
  function apply(){
    var t=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean),any=false;
    cards.forEach(function(c){
      var ok=t.every(function(w){return c.getAttribute('data-q').indexOf(w)>-1;})
        &&(!cat.value||c.getAttribute('data-cat')===cat.value)
        &&(!ed.value||(' '+c.getAttribute('data-ed')+' ').indexOf(' '+ed.value+' ')>-1)
        &&(!net.value||c.getAttribute('data-net')===net.value);
      c.hidden=!ok; if(ok)any=true;
    });
    var shown=cards.filter(function(c){return !c.hidden;}).length;
    var count=document.getElementById('sk-count');
    if(count)count.textContent=shown+' '+(shown===1?'skill':'skills');
    empty.hidden=any;
    var s=new URLSearchParams();
    if(q.value.trim())s.set('q',q.value.trim()); if(cat.value)s.set('category',cat.value); if(ed.value)s.set('edition',ed.value); if(net.value)s.set('network',net.value);
    var u=location.pathname+(s.toString()?'?'+s:'')+location.hash; try{history.replaceState(null,'',u);}catch(e){}
  }
  q.addEventListener('input',apply);[ed,net].forEach(function(e){e.addEventListener('change',apply);});
  var tree=initTree();
  cat.addEventListener('change',function(){apply();if(tree)tree.show(cat.value||null,false);});
  apply();
  if(tree&&cat.value)tree.show(cat.value,false,true);

  /* ---------- skill types tree: root, branches, and leaves; clicking a branch zooms to it and filters the cards ---------- */
  function initTree(){
    var list=document.getElementById('sk-tree-list'),card=document.querySelector('[data-sktree]'),stage=document.querySelector('[data-skstage]');
    if(!list||!card||!stage)return null;
    card.hidden=false; list.classList.add('enhanced');
    var NS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(NS,'svg');svg.setAttribute('class','links');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    stage.appendChild(svg);
    var branches=[].slice.call(list.children),n=branches.length,RY=8,BY=26,L0=38,L1=92;
    var nodes={},order=[],root=mk('root',null,50,RY,'<img src="../assets/img/iota-chevron-sm.png" alt="" width="48" height="32"><span>IOTA Skills</span>','node root','Show the full tree and all skills');
    order.push('root');
    branches.forEach(function(li,i){
      var key=li.getAttribute('data-branch'),label=li.querySelector('.tb').textContent,bx=100*(i+0.5)/n;
      var leaves=[].slice.call(li.querySelectorAll('[data-leaf]'));
      line('M50 '+(RY+4)+' C 50 '+(RY+12)+', '+bx+' '+(BY-12)+', '+bx+' '+(BY-3),'lk br',key);
      var b=mk(key,key,bx,BY,'<span class="bd"></span><span>'+label+'</span>','node branch br-'+key,'Show '+label+' skills');
      b.leaves=[];order.push(key);
      var tx=bx-100/n*0.36;
      leaves.forEach(function(lf,j){
        var y=L0+(L1-L0)*(leaves.length===1?0:j/(leaves.length-1));
        if(leaves.length<6)y=L0+j*((L1-L0)/5);
        line('M'+tx+' '+(BY+3)+' L'+tx+' '+y+' L'+(tx+1.6)+' '+y,'lk lf',key);
        var a=lf.querySelector('a'),slash=a.querySelector('code').textContent,name=a.textContent.replace(slash,'').trim();
        var id=lf.getAttribute('data-leaf'),soon=lf.getAttribute('data-soon')==='1',guide=lf.getAttribute('data-kind')==='guide';
        var l=mk('leaf-'+id,key,tx+1.8,y,'<code>'+slash+'</code><span class="nm">'+name+'</span>'+(soon?'<span class="tg">soon</span>':guide?'<span class="tg md">.md</span>':''),'node leaf br-'+key+(soon?' soon':''),slash+' '+name+(soon?', coming soon':guide?', skill guide':', skill package')+'. Go to its card');
        l.cardId='skill-'+id; l.tabIndex=-1; b.leaves.push(l);
      });
    });
    var reset=document.createElement('button');reset.type='button';reset.className='zoom-reset';reset.setAttribute('aria-label','Show the full tree');reset.innerHTML='&larr; Full tree <kbd>Esc</kbd>';
    reset.addEventListener('click',function(){show(null,true);});card.appendChild(reset);
    var live=document.createElement('p');live.className='vh';live.setAttribute('aria-live','polite');card.appendChild(live);

    function line(d,cls,key){var e=document.createElementNS(NS,'path');e.setAttribute('d',d);e.setAttribute('class',cls);e.setAttribute('data-k',key);e.setAttribute('vector-effect','non-scaling-stroke');svg.appendChild(e);}
    function mk(id,key,x,y,html,cls,label){
      var b=document.createElement('button');b.type='button';b.className=cls;b.innerHTML=html;b.setAttribute('aria-label',label);
      b.px=x;b.py=y;b.key=key;nodes[id]=b;stage.appendChild(b);
      b.addEventListener('click',function(){
        if(id==='root'){show(null,true);return;}
        if(b.cardId){go(b);return;}
        show(key,true);
      });
      return b;
    }
    // Camera: the visible rectangle of the 0..100 plane. x and y zoom separately so a tall branch fits.
    var cam={x0:0,x1:100,y0:0,y1:100},anim=null,cur=null,DUR=620;
    function place(c){
      svg.setAttribute('viewBox',c.x0+' '+c.y0+' '+(c.x1-c.x0)+' '+(c.y1-c.y0));
      Object.keys(nodes).forEach(function(k){var b=nodes[k];
        b.style.left=((b.px-c.x0)/(c.x1-c.x0)*100)+'%';b.style.top=((b.py-c.y0)/(c.y1-c.y0)*100)+'%';});
    }
    function ease(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
    function moveTo(t,instant){
      if(anim)cancelAnimationFrame(anim);
      if(reduce||instant){cam=t;place(cam);return;}
      var f={x0:cam.x0,x1:cam.x1,y0:cam.y0,y1:cam.y1},t0=performance.now();
      (function step(now){var k=Math.min(1,(now-t0)/DUR),e=ease(k);
        cam={x0:f.x0+(t.x0-f.x0)*e,x1:f.x1+(t.x1-f.x1)*e,y0:f.y0+(t.y0-f.y0)*e,y1:f.y1+(t.y1-f.y1)*e};place(cam);
        anim=k<1?requestAnimationFrame(step):null;})(t0);
    }
    function target(key){
      if(!key)return{x0:0,x1:100,y0:0,y1:100};
      var b=nodes[key],w=stage.clientWidth<720?100/n*1.15:Math.min(100,100/n*1.9),tx=b.leaves.length?b.leaves[0].px-1.8:b.px;
      var x0=tx-w*0.14;x0=Math.max(0,Math.min(100-w,x0));
      return{x0:x0,x1:x0+w,y0:BY-10,y1:100};
    }
    function show(key,user,instant){
      if(key&&!nodes[key])key=null;
      var was=cur;cur=key;
      card.classList.toggle('zoomed',!!key);stage.setAttribute('data-zoom',key||'');
      Object.keys(nodes).forEach(function(k){var b=nodes[k];
        if(b.cardId){var on=b.key===key;b.tabIndex=on?0:-1;b.classList.toggle('in',on);}
        else if(k!=='root')b.setAttribute('aria-pressed',k===key?'true':'false');});
      [].forEach.call(svg.querySelectorAll('path'),function(pth){pth.classList.toggle('on',!!key&&pth.getAttribute('data-k')===key);});
      moveTo(target(key),instant);
      if(user){
        if((cat.value||null)!==key){cat.value=key||'';apply();}
        live.textContent=key?nodes[key].textContent.trim()+' skills shown':'All skills shown';
        if(!key&&was&&nodes[was])nodes[was].focus({preventScroll:true});
      }
    }
    function go(leaf){
      if(cur!==leaf.key)show(leaf.key,true);
      var c=document.getElementById(leaf.cardId);if(!c)return;
      if(c.hidden){q.value='';ed.value='';net.value='';apply();}
      c.setAttribute('tabindex','-1');c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');
      setTimeout(function(){c.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});c.focus({preventScroll:true});},reduce?0:DUR*0.6);
    }
    // keyboard: Left and Right move between branches, Down enters a branch's skills, Up goes back, Esc zooms out
    stage.addEventListener('keydown',function(e){
      var a=document.activeElement,i=order.indexOf(Object.keys(nodes).filter(function(k){return nodes[k]===a;})[0]),nx=null;
      if(a&&a.cardId){
        var ls=nodes[a.key].leaves,j=ls.indexOf(a);
        if(e.key==='ArrowDown')nx=ls[Math.min(ls.length-1,j+1)];
        if(e.key==='ArrowUp')nx=j===0?nodes[a.key]:ls[j-1];
        if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var bi=order.indexOf(a.key)+(e.key==='ArrowRight'?1:-1);bi=Math.max(1,Math.min(order.length-1,bi));nx=nodes[order[bi]];show(order[bi],true);}
      }else if(i>-1){
        if(e.key==='ArrowRight')nx=nodes[order[Math.min(order.length-1,i+1)]];
        if(e.key==='ArrowLeft')nx=nodes[order[Math.max(0,i-1)]];
        if(e.key==='ArrowDown'&&i>0){show(order[i],true);nx=nodes[order[i]].leaves[0];}
        if(e.key==='ArrowDown'&&i===0)nx=nodes[order[1]];
        if(e.key==='ArrowUp'&&i>0)nx=nodes.root;
        if(nx&&cur&&!nx.cardId&&nx!==nodes.root&&(e.key==='ArrowRight'||e.key==='ArrowLeft'))show(nx.key,true);
      }
      if(nx){e.preventDefault();nx.focus({preventScroll:true});}
    });
    document.addEventListener('keydown',function(e){
      if((e.key==='Escape'||e.key==='Esc')&&cur&&(card.contains(document.activeElement)||document.activeElement===document.body)){e.preventDefault();show(null,true);}
    });
    var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){moveTo(target(cur),true);},120);});
    stage.addEventListener('pointerover',function(e){
      var b=e.target.closest&&e.target.closest('button');
      if(!b||!stage.contains(b))return;
      var key=b.cardId?b.key:(b.classList.contains('branch')?b.key:null);
      [].forEach.call(svg.querySelectorAll('path'),function(pth){
        pth.classList.toggle('hot',!!key&&pth.getAttribute('data-k')===key);
      });
    });
    stage.addEventListener('pointerleave',function(){
      [].forEach.call(svg.querySelectorAll('path.hot'),function(p){p.classList.remove('hot');});
    });
    place(cam);
    return{show:show};
  }
})();
