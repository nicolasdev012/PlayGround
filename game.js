(() => {
  const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
  const ui={lives:document.querySelector('#lives'),cash:document.querySelector('#cash'),wave:document.querySelector('#wave'),wavecap:document.querySelector('#wavecap'),status:document.querySelector('#status'),toast:document.querySelector('#toast'),overlay:document.querySelector('#overlay'),progress:document.querySelector('#progress'),start:document.querySelector('#startwave'),next:document.querySelector('#nextwave'),desc:document.querySelector('#wavedesc'),list:document.querySelector('#towerlist'),box:document.querySelector('#selectedbox'),sname:document.querySelector('#selectedname'),slevel:document.querySelector('#selectedlevel'),upgrade:document.querySelector('#upgrade'),sell:document.querySelector('#sell'),auto:document.querySelector('#autowave'),autonote:document.querySelector('#autonote')};
  const kinds=[{id:'pipoca',name:'Pipoqueira',emoji:'🍿',cost:60,range:112,rate:.75,damage:16,color:'#f5c95d',desc:'Rápida • alcance médio'}, {id:'pizza',name:'Pizza giratória',emoji:'🍕',cost:95,range:142,rate:1.28,damage:37,color:'#ff8959',desc:'Forte • alcance longo'}, {id:'soda',name:'Canhão de refri',emoji:'🥤',cost:125,range:97,rate:.42,damage:10,color:'#8de0c2',desc:'Rajada • alcance curto'}];
  const path=[[-28,148],[112,148],[112,333],[278,333],[278,118],[455,118],[455,385],[625,385],[625,202],[785,202],[785,300],[930,300]];
  let W=900,H=514,scale=1,towers=[],enemies=[],shots=[],particles=[],selectedType=null,selectedTower=null,cash=180,lives=10,wave=0,wavePattern=1,active=false,ended=false,paused=false,speed=1,spawnLeft=0,spawnTimer=0,spawnTotal=0,last=0,clock=0,toastTimer=0,autoTimer=0,difficulty='normal';
  const difficulties={easy:{name:'Fácil',cost:0.82,hp:0.78},normal:{name:'Normal',cost:1,hp:1},hard:{name:'Difícil',cost:1.35,hp:1.6}};
  const MAX_ACTIVE_ENEMIES=48,MAX_WAVE_SPAWNS=280;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(canvas.width/900,0,0,canvas.height/514,0,0);}
  new ResizeObserver(resize).observe(canvas); resize();
  function setToast(s){ui.toast.textContent=s;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1650)}
  function log(s){const row=document.createElement('div');row.innerHTML=`<b>${String(12+Math.floor(clock/30)).padStart(2,'0')}:${String(Math.floor(clock*2)%60).padStart(2,'0')}</b><span>${s}</span>`;document.querySelector('#log').prepend(row);while(document.querySelector('#log').children.length>4)document.querySelector('#log').lastChild.remove()}
  function updateHud(){
    ui.cash.textContent=cash;ui.lives.textContent=lives;ui.wave.textContent=wave;
    ui.wavecap.textContent=wave>100?'/∞':'/100';
    ui.next.textContent=wave>=100?`INFINITO ${wave+1}`:`ONDA ${wave+1}`;
    ui.progress.style.width=spawnTotal?`${Math.max(0,100*(1-(spawnLeft+enemies.length)/spawnTotal))}%`:'0%';
    if(active){
      ui.start.disabled=true;
      ui.start.textContent='⏳ HORDA A CAMINHO';
    }else if(!ended){
      ui.start.disabled=autoTimer>0;
      ui.start.textContent=autoTimer>0?`⏳ ${Math.ceil(autoTimer)} s`:wave>=100?'♾  PRÓXIMA ONDA':'▶  COMEÇAR ONDA';
      ui.desc.textContent=wave>=100?`Horda aleatória baseada na onda ${wavePattern}, com mais vida e inimigos.`:'Uma horda faminta está farejando o lanche.';
      ui.autonote.textContent=autoTimer>0?`Próxima onda em ${Math.ceil(autoTimer)} s — desmarque para cancelar.`:ui.auto.checked?'Pausa de 5 segundos entre ondas para você se preparar.':'Avance manualmente quando estiver pronto.';
    }
  }
  function buildList(){ui.list.innerHTML='';for(const k of kinds){const b=document.createElement('button');b.className='tower'+(selectedType===k.id?' selected':'');b.innerHTML=`<span class="foodicon">${k.emoji}</span><span><h3>${k.name}</h3><p>${k.desc}</p><small>Dano ${k.damage} · alcance ${k.range}</small></span><b class="cost">● ${towerCost(k)}</b>`;b.onclick=()=>{selectedType=selectedType===k.id?null:k.id;selectedTower=null;refreshSelection();buildList()};ui.list.appendChild(b)}}
  function refreshSelection(){ui.box.classList.toggle('active',!!selectedTower);if(selectedTower){const t=selectedTower,k=kinds.find(x=>x.id===t.kind);ui.sname.textContent=k.emoji+' '+k.name;ui.slevel.textContent='Nível '+t.level;const price=upgradePrice(t);ui.upgrade.textContent=`⬆ Melhorar • ● ${price}`;ui.upgrade.disabled=cash<price||t.level>=4;ui.sell.textContent=`↗ Vender por ● ${Math.floor(towerCost(k)*.55+(t.level-1)*upgradePrice({kind:t.kind,level:t.level-1})*.6)}`} }
  function towerCost(k){return Math.round(k.cost*difficulties[difficulty].cost)}
  function upgradePrice(t){return Math.floor(towerCost(kinds.find(k=>k.id===t.kind))*(.65+t.level*.35))}
  buildList();
  function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/l));return Math.hypot(p.x-(a[0]+t*dx),p.y-(a[1]+t*dy))}
  function onRoad(p){for(let i=0;i<path.length-1;i++)if(pointSegment(p,path[i],path[i+1])<37)return true;return false}
  function mapClick(e){const r=canvas.getBoundingClientRect(),p={x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*514/r.height};let hit=[...towers].reverse().find(t=>dist(t,p)<23);if(hit){selectedTower=hit;selectedType=null;buildList();refreshSelection();return}selectedTower=null;refreshSelection();if(!selectedType){return}const k=kinds.find(x=>x.id===selectedType);p.x=Math.round(p.x/42)*42;p.y=Math.round(p.y/42)*42;if(p.x<24||p.y<25||p.x>875||p.y>490){setToast('Não dá pra montar aí!');return}if(onRoad(p)){setToast('A estrada é dos zumbis!');return}if(towers.some(t=>dist(t,p)<43)){setToast('Muito perto de outra torre!');return}const price=towerCost(k);if(cash<price){setToast('Faltam petiscos pra essa torre!');return}cash-=price;towers.push({...p,kind:k.id,level:1,cool:0,aim:0});selectedType=null;buildList();updateHud();setToast(`${k.name} pronta!`);}
  canvas.addEventListener('pointerdown',mapClick);
  ui.upgrade.onclick=()=>{if(!selectedTower)return;let p=upgradePrice(selectedTower);if(cash>=p&&selectedTower.level<4){cash-=p;selectedTower.level++;updateHud();refreshSelection();setToast('Torre melhorada!');}};
  ui.sell.onclick=()=>{if(!selectedTower)return;let t=selectedTower,k=kinds.find(x=>x.id===t.kind);cash+=Math.floor(towerCost(k)*.55+(t.level-1)*upgradePrice({kind:t.kind,level:t.level-1})*.6);towers=towers.filter(x=>x!==t);selectedTower=null;refreshSelection();updateHud();setToast('Torre vendida por petiscos.');};
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>{
    if(wave>0||active)return;
    difficulty=button.dataset.difficulty;
    document.querySelectorAll('[data-difficulty]').forEach(option=>option.classList.toggle('selected',option===button));
    buildList();refreshSelection();
  });
  document.querySelector('#begin').onclick=()=>ui.overlay.classList.add('hidden');
  ui.auto.onchange=()=>{if(!ui.auto.checked)autoTimer=0;updateHud()};
  ui.start.onclick=()=>startWave();
  function startWave(){
    if(active||ended)return;
    autoTimer=0;
    wave++;
    if(wave>100)wavePattern=1+Math.floor(Math.random()*100);else wavePattern=wave;
    const baseCount=6+wavePattern*2;
    const endlessScale=wave>100?1+(wave-100)*.06:1;
    spawnLeft=Math.min(MAX_WAVE_SPAWNS,Math.ceil(baseCount*endlessScale));
    spawnTotal=spawnLeft;spawnTimer=.25;active=true;paused=false;
    ui.status.textContent=wave>100?`Onda infinita ${wave} (padrão ${wavePattern})`: `Onda ${wave}: segura essa fome!`;
    log(wavePattern%5===0?'ALERTA: CHEFE ZUMBI DETECTADO!':'Zumbis avistados na estrada!');
    setToast(wavePattern%5===0?'CHEFE ZUMBI NA ÁREA!':'Lá vêm eles!');updateHud();
  }
  document.querySelector('#pause').onclick=e=>{paused=!paused;e.currentTarget.textContent=paused?'▶ Retomar':'Ⅱ Pausar'};
  document.querySelector('#speed').onclick=e=>{speed=speed===1?2:1;e.currentTarget.textContent=`▶ ${speed}×`};
  function spawnEnemy(){
    if(spawnLeft<=0||enemies.length>=MAX_ACTIVE_ENEMIES)return;
    const boss=wavePattern%5===0&&spawnLeft===1;
    const tier=wave>100?wavePattern:wave;
    const roll=Math.random();
    const type=boss?'boss':tier>=15&&roll<.12?'tank':tier>2&&roll<.38?'runner':tier>1&&roll<.63?'brute':'walker';
    const data={walker:[48,36,31,9,'🧟'],runner:[32,24,55,12,'🧟‍♀️'],brute:[115,80,22,17,'🧟‍♂️'],tank:[210,115,15,24,'🧟‍♂️'],boss:[470+tier*24,140,17,45,'🧟‍♂️']}[type];
    const endlessScale=wave>100?1+(wave-100)*.12:1;
    const hpScale=difficulties[difficulty].hp*(1+(tier-1)*.025)*endlessScale;
    const hp=Math.round(data[0]*hpScale);
    enemies.push({x:path[0][0],y:path[0][1],seg:0,progress:0,hp,max:hp,speed:data[2],reward:data[3]+Math.floor(tier/10),emoji:data[4],type,r:boss?23:type==='brute'||type==='tank'?19:14});
    spawnLeft--;
  }
  function makeParticles(x,y,color,n=6){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*95,vy:(Math.random()-.7)*95,life:.45+Math.random()*.35,color,r:2+Math.random()*3})}
  function update(dt){
    clock+=dt;
    if(active&&!paused&&!ended){
      const gameDt=dt*speed;
      spawnTimer-=gameDt;
      if(spawnLeft>0&&enemies.length<MAX_ACTIVE_ENEMIES&&spawnTimer<=0){
        spawnEnemy();spawnTimer=Math.max(.35,1.05-wavePattern*.035);
      }
      for(const e of enemies){
        let left=e.speed*gameDt;
        while(left>0&&e.seg<path.length-1){
          const a=path[e.seg],b=path[e.seg+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
          const rem=len-e.progress,step=Math.min(left,rem);e.progress+=step;left-=step;
          e.x=a[0]+(b[0]-a[0])*e.progress/len;e.y=a[1]+(b[1]-a[1])*e.progress/len;
          if(e.progress>=len){e.seg++;e.progress=0;}
        }
        if(e.seg>=path.length-1){e.escaped=true;lives--;makeParticles(e.x,e.y,'#ff7465',12);log('Um zumbi passou! Miguel perdeu uma vida.');}
      }
      enemies=enemies.filter(e=>!e.escaped);
      for(const t of towers){
        const k=kinds.find(x=>x.id===t.kind),range=k.range+(t.level-1)*12;t.cool-=gameDt;
        const target=enemies.filter(e=>dist(t,e)<=range).sort((a,b)=>b.seg*1000+b.progress-a.seg*1000-a.progress)[0];
        if(target){
          t.aim=Math.atan2(target.y-t.y,target.x-t.x);
          if(t.cool<=0){const bonus=1+(t.level-1)*.52;shots.push({x:t.x,y:t.y,target,kind:t.kind,damage:k.damage*bonus,speed:390,emoji:t.kind==='soda'?'🫧':t.kind==='pizza'?'🍕':'🍿'});t.cool=k.rate*(1-(t.level-1)*.12);}
        }
      }
      for(const s of shots){
        if(!enemies.includes(s.target)){s.dead=true;continue;}
        const dx=s.target.x-s.x,dy=s.target.y-s.y,d=Math.hypot(dx,dy),step=s.speed*gameDt;
        if(d<step+7){
          s.target.hp-=s.damage;s.dead=true;makeParticles(s.target.x,s.target.y,kinds.find(k=>k.id===s.kind).color,3);
          if(s.target.hp<=0){cash+=s.target.reward;makeParticles(s.target.x,s.target.y,'#d7f36a',9);log(`${s.target.type==='boss'?'Chefe':'Zumbi'} distraído com a comida! +${s.target.reward} petiscos`);s.target.dead=true;}
        }else{s.x+=dx/d*step;s.y+=dy/d*step;}
      }
      shots=shots.filter(s=>!s.dead);enemies=enemies.filter(e=>!e.dead);
      if(lives<=0){lives=0;ended=true;active=false;autoTimer=0;showEnd(false);}
      else if(spawnLeft===0&&enemies.length===0){
        active=false;cash+=30+wave*5;log(`Onda ${wave} vencida! Bônus de ${30+wave*5} petiscos.`);
        setToast(wave===100?'100 ondas vencidas! O modo infinito começou.':`Onda vencida! +${30+wave*5} petiscos`);
        ui.status.textContent=wave>=100?'Modo infinito desbloqueado!':'Onda limpa! Reforce suas torres.';
        autoTimer=ui.auto.checked?5:0;
      }
    }
    if(autoTimer>0&&!active&&!ended&&ui.auto.checked){
      autoTimer=Math.max(0,autoTimer-dt);
      if(autoTimer===0)startWave();
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.97;p.vy*=.97;}
    particles=particles.filter(p=>p.life>0);updateHud();
  }
  function showEnd(win){ui.overlay.classList.remove('hidden');ui.overlay.querySelector('.big').textContent=win?'🏆':'🧟';ui.overlay.querySelector('.eyebrow').textContent=win?'LENDA DO BAIRRO':'A LANCHONETE CAIU';ui.overlay.querySelector('h2').textContent=win?'Miguel salvou o bairro!':'A horda levou a melhor.';ui.overlay.querySelector('p').textContent=win?'100 ondas vencidas e o modo infinito desbloqueado!':'Miguel ficou sem vidas, mas ainda tem comida. Tente outra estratégia!';ui.overlay.querySelector('.difficulty-picker').style.display='none';const b=ui.overlay.querySelector('#begin');b.textContent=win?'JOGAR DE NOVO':'TENTAR DE NOVO';b.onclick=()=>location.reload()}
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
  function draw(){ctx.clearRect(0,0,900,514);ctx.fillStyle='#243b2b';ctx.fillRect(0,0,900,514);ctx.save();ctx.globalAlpha=.16;for(let i=0;i<90;i++){const x=(i*113+27)%900,y=(i*79+41)%514;ctx.fillStyle=i%3?'#a1bb70':'#b1aa68';ctx.beginPath();ctx.arc(x,y,1+(i%3),0,Math.PI*2);ctx.fill()}ctx.restore();
    // neighborhood details
    for(const [x,y,emoji] of [[45,62,'🏚️'],[204,70,'🌳'],[348,260,'🏚️'],[538,60,'🌳'],[724,82,'🏚️'],[858,425,'🌳'],[50,444,'🌳'],[386,453,'🏚️'],[708,463,'🌳']]){ctx.globalAlpha=.45;ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText(emoji,x,y);ctx.globalAlpha=1}
    // road shadow and pavement
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle='#18221b';ctx.lineWidth=83;ctx.stroke();ctx.strokeStyle='#b9a876';ctx.lineWidth=69;ctx.stroke();ctx.strokeStyle='#8c805b';ctx.lineWidth=2;ctx.setLineDash([5,12]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle='#d5c596';ctx.lineWidth=3;ctx.globalAlpha=.35;ctx.stroke();ctx.globalAlpha=1;
    // start and Miguel's stand
    rounded(10,106,38,30,7,'#435f38');ctx.font='17px sans-serif';ctx.textAlign='center';ctx.fillText('☣',29,127);rounded(844,263,48,68,11,'#e1c662');rounded(850,270,36,37,8,'#3b4e31');ctx.font='23px sans-serif';ctx.fillText('🧑🏻‍🍳',868,299);ctx.font='8px ui-monospace';ctx.fillStyle='#182018';ctx.fillText('MIGUEL',868,321);
    // placement preview/grid
    if(selectedType){ctx.save();ctx.strokeStyle='#d3f36b';ctx.globalAlpha=.16;ctx.lineWidth=1;for(let x=0;x<900;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,514);ctx.stroke()}for(let y=0;y<514;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(900,y);ctx.stroke()}ctx.restore()}
    for(const t of towers){const k=kinds.find(a=>a.id===t.kind);if(t===selectedTower){ctx.beginPath();ctx.arc(t.x,t.y,k.range+(t.level-1)*12,0,7);ctx.fillStyle='#d3f36b16';ctx.fill();ctx.strokeStyle='#d3f36b77';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([])}ctx.beginPath();ctx.ellipse(t.x,t.y+15,19,7,0,0,Math.PI*2);ctx.fillStyle='#142018';ctx.fill();ctx.fillStyle='#374d31';ctx.beginPath();ctx.arc(t.x,t.y,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle=t===selectedTower?'#d3f36b':'#718554';ctx.lineWidth=t===selectedTower?3:2;ctx.stroke();ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.aim);ctx.fillStyle='#c7d893';ctx.fillRect(0,-5,22,10);ctx.restore();ctx.font='23px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(k.emoji,t.x-3,t.y-2);if(t.level>1){rounded(t.x+10,t.y-24,18,14,5,'#182018');ctx.fillStyle='#d3f36b';ctx.font='9px ui-monospace';ctx.fillText('+'+(t.level-1),t.x+19,t.y-17)}}
    for(const s of shots){ctx.font='16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.emoji,s.x,s.y)}
    for(const e of enemies){ctx.beginPath();ctx.ellipse(e.x,e.y+12,e.r*.9,5,0,0,Math.PI*2);ctx.fillStyle='#172019';ctx.fill();ctx.font=`${e.r*1.65}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e.emoji,e.x,e.y);let bw=e.r*2.15,bh=4;rounded(e.x-bw/2,e.y-e.r-10,bw,bh,3,'#151c16');rounded(e.x-bw/2,e.y-e.r-10,bw*Math.max(0,e.hp/e.max),bh,3,e.type==='boss'?'#ff665e':'#b8e15b');if(e.type==='boss'){ctx.font='8px ui-monospace';ctx.fillStyle='#ffcb73';ctx.fillText('CHEFÃO',e.x,e.y-e.r-15)}}
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    if(paused&&active){rounded(366,226,168,56,13,'#111a15dd');ctx.fillStyle='#f1eedf';ctx.font='bold 17px sans-serif';ctx.fillText('PAUSADO',450,260)}
  }
  function frame(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);updateHud();
})();
