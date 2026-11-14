(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    menu: $('menuScreen'), hud: $('hud'), playerPanel: $('playerPanel'), squadPanel: $('squadPanel'),
    objective: $('objectiveHint'), controls: $('controls'), roundScreen: $('roundScreen'), pauseScreen: $('pauseScreen'),
    pauseButton: $('pauseButton'), help: $('desktopHelp'), reticle: $('reticle'), toast: $('toast'),
    blueScore: $('blueScore'), redScore: $('redScore'), roundNumber: $('roundNumber'), clock: $('roundClock'),
    status: $('matchStatus'), health: $('healthValue'), healthBar: $('healthBar'), clip: $('ammoClip'), reserve: $('ammoReserve'),
    pips: $('squadPips'), feed: $('killFeed'), hit: $('hitMarker'), roundTitle: $('roundTitle'),
    roundCopy: $('roundCopy'), roundKicker: $('roundKicker'), resultScore: $('resultScore'), continue: $('continueButton')
  };
  const WORLD = { w: 1900, h: 1220 };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const obstacles = [
    {x:0,y:0,w:WORLD.w,h:34,kind:'wall'}, {x:0,y:WORLD.h-34,w:WORLD.w,h:34,kind:'wall'},
    {x:0,y:0,w:34,h:WORLD.h,kind:'wall'}, {x:WORLD.w-34,y:0,w:34,h:WORLD.h,kind:'wall'},
    {x:755,y:265,w:330,h:76,kind:'container',label:'CARGO 04'},
    {x:815,y:341,w:78,h:170,kind:'container',label:'04'},
    {x:1040,y:650,w:338,h:78,kind:'container',label:'CARGO 12'},
    {x:1299,y:728,w:79,h:190,kind:'container',label:'12'},
    {x:398,y:360,w:166,h:67,kind:'crate'}, {x:508,y:430,w:70,h:135,kind:'crate'},
    {x:1360,y:355,w:160,h:66,kind:'crate'}, {x:1285,y:427,w:70,h:115,kind:'crate'},
    {x:431,y:807,w:215,h:77,kind:'wall'}, {x:645,y:807,w:68,h:170,kind:'wall'},
    {x:1494,y:808,w:206,h:76,kind:'wall'}, {x:1494,y:694,w:76,h:115,kind:'wall'},
    {x:875,y:868,w:168,h:66,kind:'crate'}, {x:1060,y:358,w:128,h:60,kind:'crate'},
    {x:736,y:616,w:90,h:70,kind:'crate'}, {x:823,y:616,w:59,h:122,kind:'crate'},
    {x:1210,y:495,w:130,h:61,kind:'crate'}, {x:1238,y:958,w:160,h:67,kind:'crate'},
    {x:310,y:596,w:150,h:62,kind:'crate'}, {x:1580,y:553,w:130,h:65,kind:'crate'},
    {x:921,y:135,w:82,h:66,kind:'crate'}, {x:935,y:1020,w:92,h:66,kind:'crate'}
  ];
  let W = 0, H = 0, dpr = 1, last = 0, state = 'menu', player = null, units = [], bullets = [], particles = [];
  let scoreBlue = 0, scoreRed = 0, round = 1, roundTime = 120, camera = {x:950,y:610}, mouse = {x:0,y:0,down:false}, moveInput = {x:0,y:0};
  let fireHeld = false, reloadUntil = 0, toastTimer = 0, hitTimer = 0, shake = 0, elapsed = 0, cinematic = 0;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const botsAlive = (team) => units.filter(u => u.team === team && !u.dead).length;

  function resize(){
    const rect = canvas.getBoundingClientRect(); W = rect.width; H = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize); resize();
  function freshUnit(team, x, y, isPlayer=false, name=''){
    return {team,x,y,angle:team==='blue'?0:Math.PI,hp:100,maxHp:100,dead:false,isPlayer,name,
      radius:isPlayer?18:16,speed:isPlayer?222:(team==='blue'?144:137),cool:rand(.2,.8),flash:0,spawnX:x,spawnY:y,
      ammo:isPlayer?24:0,reserve:isPlayer?96:0,strafe:Math.random()<.5?-1:1,think:0,moveX:0,moveY:0};
  }
  function resetRound(){
    units=[]; bullets=[]; particles=[];
    player=freshUnit('blue',220,970,true,'YOU'); units.push(player);
    units.push(freshUnit('blue',315,865,false,'MICA')); units.push(freshUnit('blue',430,1010,false,'ROOK'));
    units.push(freshUnit('red',1650,245,false,'VEX')); units.push(freshUnit('red',1510,330,false,'KITE')); units.push(freshUnit('red',1710,420,false,'ASH'));
    roundTime=120; reloadUntil=0; fireHeld=false; moveInput={x:0,y:0};
    updateHUD();
  }
  function deploy(){scoreBlue=0;scoreRed=0;round=1;state='playing';ui.menu.classList.add('hidden');ui.roundScreen.classList.add('hidden');ui.pauseScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');ui.playerPanel.classList.remove('hidden');ui.squadPanel.classList.remove('hidden');ui.objective.classList.remove('hidden');ui.pauseButton.classList.remove('hidden');
    ui.controls.classList.toggle('hidden',!isTouch);ui.help.classList.toggle('hidden',isTouch);ui.reticle.classList.toggle('hidden',isTouch);ui.status.textContent='LIVE ENGAGEMENT';resetRound();last=performance.now();}
  $('startButton').addEventListener('click',deploy);
  $('continueButton').addEventListener('click',()=>{
    ui.roundScreen.classList.add('hidden');
    if(scoreBlue>=3||scoreRed>=3){state='menu';ui.menu.classList.remove('hidden');ui.hud.classList.add('hidden');ui.playerPanel.classList.add('hidden');ui.squadPanel.classList.add('hidden');ui.objective.classList.add('hidden');ui.pauseButton.classList.add('hidden');ui.controls.classList.add('hidden');ui.help.classList.add('hidden');return;}
    round++;state='playing';ui.status.textContent='LIVE ENGAGEMENT';resetRound();last=performance.now();
  });
  $('pauseButton').addEventListener('click',pause); $('resumeButton').addEventListener('click',resume);
  $('menuButton').addEventListener('click',()=>{state='menu';ui.pauseScreen.classList.add('hidden');ui.hud.classList.add('hidden');ui.playerPanel.classList.add('hidden');ui.squadPanel.classList.add('hidden');ui.objective.classList.add('hidden');ui.pauseButton.classList.add('hidden');ui.controls.classList.add('hidden');ui.help.classList.add('hidden');ui.menu.classList.remove('hidden');});
  function pause(){if(state!=='playing')return;state='paused';ui.pauseScreen.classList.remove('hidden');}
  function resume(){if(state!=='paused')return;state='playing';ui.pauseScreen.classList.add('hidden');last=performance.now();}
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'){state==='playing'?pause():state==='paused'?resume():null;}if(e.key.toLowerCase()==='r'&&state==='playing')reload();});
  function keyDown(k){return keys.has(k);}
  const keys=new Set();window.addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&state==='playing'){mouse.down=true;fireHeld=true;}});
  window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){mouse.down=false;fireHeld=false;}});
  $('fireButton').addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;$('fireButton').setPointerCapture(e.pointerId);});
  $('fireButton').addEventListener('pointerup',e=>{e.preventDefault();fireHeld=false;});$('fireButton').addEventListener('pointercancel',()=>fireHeld=false);
  $('reloadButton').addEventListener('pointerdown',e=>{e.preventDefault();reload();});
  const pad=$('movePad'),knob=$('moveKnob');let padPointer=null,padCenter=null;
  function updatePad(e){if(!padCenter)return;const dx=e.clientX-padCenter.x,dy=e.clientY-padCenter.y,len=Math.hypot(dx,dy),max=39,m=Math.min(1,len/max);moveInput={x:len?dx/len*m:0,y:len?dy/len*m:0};knob.style.left=`calc(50% + ${moveInput.x*max}px)`;knob.style.top=`calc(50% + ${moveInput.y*max}px)`;}
  pad.addEventListener('pointerdown',e=>{e.preventDefault();padPointer=e.pointerId;const r=pad.getBoundingClientRect();padCenter={x:r.left+r.width/2,y:r.top+r.height/2};pad.setPointerCapture(e.pointerId);updatePad(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)updatePad(e);});
  function releasePad(e){if(e.pointerId!==padPointer)return;padPointer=null;padCenter=null;moveInput={x:0,y:0};knob.style.left='50%';knob.style.top='50%';}
  pad.addEventListener('pointerup',releasePad);pad.addEventListener('pointercancel',releasePad);

  function updateHUD(){
    ui.blueScore.textContent=scoreBlue;ui.redScore.textContent=scoreRed;ui.roundNumber.textContent=String(round).padStart(2,'0');
    if(player){ui.health.textContent=Math.max(0,Math.ceil(player.hp));ui.healthBar.style.width=`${clamp(player.hp,0,100)}%`;ui.healthBar.style.background=player.hp<35?'#ed836b':'linear-gradient(90deg,#6dd9bd,#b4e6b5)';
      ui.clip.textContent=player.ammo??24;ui.reserve.textContent=player.reserve??96;}
    const blue=units.filter(u=>u.team==='blue');ui.pips.innerHTML=blue.map(u=>`<i class="squad-pip${u.dead?' dead':''}"></i>`).join('');
    const secs=Math.max(0,Math.ceil(roundTime));ui.clock.textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
  }
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=1.5;}
  function feed(killer,victim,team){const item=document.createElement('div');item.className=`feed-item ${team==='red'?'enemy':''}`;item.textContent=`${killer}  ›  ${victim}`;ui.feed.prepend(item);while(ui.feed.children.length>4)ui.feed.lastChild.remove();setTimeout(()=>item.remove(),3800);}
  function reload(){if(state!=='playing'||!player||player.dead||reloadUntil>elapsed||player.ammo>=24||player.reserve<=0)return;reloadUntil=elapsed+1.35;showToast('RELOADING');}
  function completeReload(){if(!player||reloadUntil===0||elapsed<reloadUntil)return;const n=Math.min(24-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;reloadUntil=0;updateHUD();}
  function circleHitsRect(x,y,r,o){const nx=clamp(x,o.x,o.x+o.w),ny=clamp(y,o.y,o.y+o.h);return (x-nx)**2+(y-ny)**2<r*r;}
  function blocked(x,y,r){return obstacles.some(o=>circleHitsRect(x,y,r,o));}
  function moveUnit(u,dx,dy){
    const nx=u.x+dx,ny=u.y+dy;
    if(!blocked(nx,u.y,u.radius))u.x=clamp(nx,45,WORLD.w-45);
    if(!blocked(u.x,ny,u.radius))u.y=clamp(ny,45,WORLD.h-45);
  }
  function lineClear(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,steps=Math.ceil(Math.hypot(dx,dy)/18);
    for(let i=1;i<steps;i++){const x=a.x+dx*i/steps,y=a.y+dy*i/steps;if(obstacles.some(o=>x>o.x&&x<o.x+o.w&&y>o.y&&y<o.y+o.h))return false;}return true;
  }
  function closestEnemy(u,max=760){let best=null,bd=max;for(const e of units){if(e.dead||e.team===u.team)continue;const d=dist(u,e);if(d<bd&&lineClear(u,e)){best=e;bd=d;}}return best;}
  function steerAngle(a,b,rate,dt){let diff=((b-a+Math.PI*3)%TAU)-Math.PI;return a+clamp(diff,-rate*dt,rate*dt);}
  function addParticle(x,y,color,n=5){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-100,100),vy:rand(-100,100),life:rand(.16,.42),max:.42,color,size:rand(1.3,3.2)});}
  function fire(u,angle,playerShot=false){
    if(u.dead||u.cool>0)return;
    if(u.isPlayer){if(u.ammo<=0){if(u.reserve>0)reload();else showToast('NO AMMO');u.cool=.22;return;}u.ammo--;u.cool=.145;updateHUD();}
    else u.cool=rand(.43,.72);
    const spread=u.isPlayer?(isTouch?.035:.018):.10;
    const a=angle+rand(-spread,spread),speed=u.isPlayer?790:610;
    const startX=u.x+Math.cos(a)*23,startY=u.y+Math.sin(a)*23;
    bullets.push({x:startX,y:startY,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,team:u.team,owner:u,life:1.35,damage:u.isPlayer?38:(u.team==='blue'?20:17),playerShot});
    u.flash=.075;addParticle(startX,startY,u.team==='blue'?'#ffcf88':'#ffd09d',2);if(u.isPlayer)shake=2.2;
  }
  function hurt(target,bullet){
    target.hp-=bullet.damage;target.flash=.12;addParticle(target.x,target.y,target.team==='blue'?'#8edbca':'#f09873',7);
    if(bullet.owner===player){hitTimer=.16;ui.hit.classList.remove('hidden');}
    if(target.hp<=0){target.dead=true;target.hp=0;feed(bullet.owner.isPlayer?'YOU':bullet.owner.name,target.isPlayer?'YOU':target.name,bullet.team);addParticle(target.x,target.y,target.team==='blue'?'#78d8c3':'#ed9273',16);if(target.isPlayer)showToast('OPERATOR DOWN — SQUAD STILL ACTIVE');updateHUD();}
  }
  function updatePlayer(dt){
    if(!player||player.dead)return;
    let x=moveInput.x,y=moveInput.y;
    if(keyDown('w')||keyDown('arrowup'))y-=1;if(keyDown('s')||keyDown('arrowdown'))y+=1;
    if(keyDown('a')||keyDown('arrowleft'))x-=1;if(keyDown('d')||keyDown('arrowright'))x+=1;
    const mag=Math.hypot(x,y);if(mag>1){x/=mag;y/=mag;}
    if(mag>.08)moveUnit(player,x*player.speed*dt,y*player.speed*dt);
    if(!isTouch){const wx=camera.x+(mouse.x-W/2),wy=camera.y+(mouse.y-H/2);player.angle=Math.atan2(wy-player.y,wx-player.x);}
    else if(fireHeld){const target=closestEnemy(player,900);if(target)player.angle=Math.atan2(target.y-player.y,target.x-player.x);}
    if(fireHeld&&player.cool<=0){let aim=player.angle;if(isTouch){const t=closestEnemy(player,900);if(t)aim=Math.atan2(t.y-player.y,t.x-player.x);}fire(player,aim,true);}
  }
  function updateBot(u,dt){
    if(u.dead)return;u.cool=Math.max(0,u.cool-dt);u.flash=Math.max(0,u.flash-dt);
    const target=closestEnemy(u,760);let dx=0,dy=0;
    if(target){const d=dist(u,target),desired=Math.atan2(target.y-u.y,target.x-u.x);u.angle=steerAngle(u.angle,desired,3.1,dt);
      if(d>300){dx=Math.cos(desired);dy=Math.sin(desired);}else if(d<205){dx=-Math.cos(desired)*.65+Math.cos(desired+Math.PI/2)*u.strafe*.48;dy=-Math.sin(desired)*.65+Math.sin(desired+Math.PI/2)*u.strafe*.48;}else{dx=Math.cos(desired+Math.PI/2)*u.strafe*.32;dy=Math.sin(desired+Math.PI/2)*u.strafe*.32;}
      if(d<660&&lineClear(u,target)&&u.cool<=0)fire(u,desired);
    }else{
      const tx=u.team==='blue'?730:1170,ty=u.team==='blue'?800:420,angle=Math.atan2(ty-u.y,tx-u.x);u.angle=steerAngle(u.angle,angle,1.6,dt);
      if(Math.hypot(tx-u.x,ty-u.y)>100){dx=Math.cos(angle)*.48;dy=Math.sin(angle)*.48;}
    }
    u.think-=dt;if(u.think<=0){u.think=rand(1.4,2.7);u.strafe*=-1;}
    const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}moveUnit(u,dx*u.speed*dt,dy*u.speed*dt);u.moveX=dx;u.moveY=dy;
  }
  function updateBullets(dt){
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.life<=0||b.x<35||b.y<35||b.x>WORLD.w-35||b.y>WORLD.h-35||obstacles.some(o=>b.x>o.x&&b.x<o.x+o.w&&b.y>o.y&&b.y<o.y+o.h)){addParticle(b.x,b.y,'#c7c9a6',2);bullets.splice(i,1);continue;}
      const hit=units.find(u=>!u.dead&&u.team!==b.team&&Math.hypot(u.x-b.x,u.y-b.y)<u.radius+3);
      if(hit){hurt(hit,b);bullets.splice(i,1);}
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;if(p.life<=0)particles.splice(i,1);}
  }
  function update(dt){
    elapsed+=dt;if(state==='menu'){cinematic+=dt;return;}if(state!=='playing')return;
    roundTime-=dt;player.cool=Math.max(0,player.cool-dt);completeReload();updatePlayer(dt);
    for(const u of units)if(!u.isPlayer)updateBot(u,dt);
    updateBullets(dt);camera.x+=(player.x-camera.x)*Math.min(1,dt*4);camera.y+=(player.y-camera.y)*Math.min(1,dt*4);
    camera.x=clamp(camera.x,W/2,WORLD.w-W/2);camera.y=clamp(camera.y,H/2,WORLD.h-H/2);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}if(hitTimer>0){hitTimer-=dt;if(hitTimer<=0)ui.hit.classList.add('hidden');}shake=Math.max(0,shake-dt*14);
    updateHUD();if(botsAlive('red')===0)endRound('blue');else if(botsAlive('blue')===0)endRound('red');else if(roundTime<=0)endRound(botsAlive('blue')>=botsAlive('red')?'blue':'red');
  }
  function endRound(winner){if(state!=='playing')return;state='roundend';if(winner==='blue')scoreBlue++;else scoreRed++;
    const matchOver=scoreBlue>=3||scoreRed>=3;ui.roundTitle.textContent=matchOver?(winner==='blue'?'MISSION COMPLETE':'MISSION FAILED'):(winner==='blue'?'ROUND WON':'ROUND LOST');
    ui.roundKicker.textContent=matchOver?'MISSION DEBRIEF':'AFTER ACTION REPORT';ui.roundCopy.textContent=winner==='blue'?'Your squad secured the yard. Keep the pressure on.':'The opposition held the line. Regroup and go again.';
    ui.resultScore.textContent=`${scoreBlue} — ${scoreRed}`;ui.continue.querySelector('span').textContent=matchOver?'RETURN TO BRIEFING':'NEXT ROUND';ui.status.textContent='ROUND COMPLETE';ui.roundScreen.classList.remove('hidden');updateHUD();}

  function drawFloor(){
    ctx.fillStyle='#56635b';ctx.fillRect(0,0,WORLD.w,WORLD.h);
    ctx.fillStyle='#5e6a60';ctx.fillRect(55,55,WORLD.w-110,WORLD.h-110);
    // Broad worn lanes and concrete pads
    ctx.fillStyle='rgba(190,177,139,.10)';ctx.fillRect(55,530,WORLD.w-110,132);ctx.fillRect(876,55,146,1100);
    ctx.fillStyle='rgba(26,39,39,.14)';ctx.fillRect(65,510,WORLD.w-130,4);ctx.fillRect(65,678,WORLD.w-130,4);
    // Floor seams, hazard markings and weathered dust patches
    ctx.lineWidth=1;
    for(let x=80;x<WORLD.w-60;x+=80){ctx.strokeStyle=x%240===0?'rgba(26,40,38,.22)':'rgba(220,213,181,.055)';ctx.beginPath();ctx.moveTo(x,65);ctx.lineTo(x,WORLD.h-65);ctx.stroke();}
    for(let y=80;y<WORLD.h-60;y+=80){ctx.strokeStyle='rgba(28,42,39,.17)';ctx.beginPath();ctx.moveTo(65,y);ctx.lineTo(WORLD.w-65,y);ctx.stroke();}
    for(let i=0;i<190;i++){const x=((i*197+79)%1780)+60,y=((i*331+117)%1080)+65,r=(i%5)+1;ctx.fillStyle=i%3?'rgba(27,37,34,.10)':'rgba(215,204,165,.10)';ctx.beginPath();ctx.ellipse(x,y,r*1.7,r,((i*17)%90)*Math.PI/180,0,TAU);ctx.fill();}
    // Restricted zone rings and field paint
    ctx.save();ctx.setLineDash([11,9]);ctx.lineWidth=2;ctx.strokeStyle='rgba(228,186,128,.29)';ctx.beginPath();ctx.arc(955,612,158,0,TAU);ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(212,224,210,.32)';ctx.lineWidth=2;ctx.strokeRect(856,520,198,184);
    ctx.fillStyle='rgba(228,235,213,.38)';ctx.font='800 16px system-ui';ctx.textAlign='center';ctx.fillText('YARD / 07',955,614);
    ctx.font='800 10px system-ui';ctx.fillStyle='rgba(215,225,209,.32)';ctx.textAlign='left';ctx.fillText('NORTH STORAGE',102,144);ctx.fillText('SERVICE LANE — 03',1402,1120);ctx.fillText('LOADING BAY',109,1094);
    // Edge curbs
    ctx.fillStyle='#313d3b';ctx.fillRect(34,34,WORLD.w-68,18);ctx.fillRect(34,WORLD.h-52,WORLD.w-68,18);ctx.fillRect(34,34,18,WORLD.h-68);ctx.fillRect(WORLD.w-52,34,18,WORLD.h-68);
    ctx.fillStyle='rgba(221,185,119,.44)';for(let x=65;x<WORLD.w-70;x+=40){ctx.fillRect(x,36,19,3);ctx.fillRect(x,WORLD.h-39,19,3);}for(let y=65;y<WORLD.h-70;y+=40){ctx.fillRect(36,y,3,19);ctx.fillRect(WORLD.w-39,y,3,19);}
  }
  function drawObstacle(o){
    ctx.save();ctx.fillStyle='rgba(10,18,18,.28)';ctx.fillRect(o.x+8,o.y+10,o.w,o.h);
    if(o.kind==='container'){
      ctx.fillStyle='#344b49';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#415b56';ctx.fillRect(o.x+3,o.y+3,o.w-6,o.h-8);
      ctx.fillStyle='rgba(210,201,158,.68)';ctx.fillRect(o.x+6,o.y+4,7,o.h-10);ctx.fillRect(o.x+17,o.y+4,2,o.h-10);
      ctx.fillStyle='rgba(22,39,39,.33)';for(let xx=o.x+29;xx<o.x+o.w-8;xx+=22)ctx.fillRect(xx,o.y+5,3,o.h-12);
      ctx.fillStyle='rgba(199,211,183,.55)';ctx.font='800 10px system-ui';ctx.textAlign='right';ctx.fillText(o.label||'CARGO',o.x+o.w-13,o.y+o.h/2+4);
      ctx.fillStyle='#293e3d';ctx.fillRect(o.x,o.y,o.w,4);ctx.fillRect(o.x,o.y+o.h-4,o.w,4);
    }else if(o.kind==='wall'){
      ctx.fillStyle='#414c48';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#56615a';ctx.fillRect(o.x+2,o.y+2,o.w-4,o.h-5);
      ctx.strokeStyle='rgba(204,207,179,.17)';ctx.lineWidth=2;ctx.strokeRect(o.x+5,o.y+5,o.w-10,o.h-10);
      ctx.fillStyle='rgba(223,189,120,.5)';for(let xx=o.x+13;xx<o.x+o.w-10;xx+=23)ctx.fillRect(xx,o.y+o.h-5,10,3);
    }else{
      ctx.fillStyle='#726d59';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#89816a';ctx.fillRect(o.x+3,o.y+3,o.w-6,o.h-8);
      ctx.strokeStyle='rgba(38,48,42,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(o.x+5,o.y+5);ctx.lineTo(o.x+o.w-5,o.y+o.h-5);ctx.moveTo(o.x+o.w-5,o.y+5);ctx.lineTo(o.x+5,o.y+o.h-5);ctx.stroke();
      ctx.fillStyle='rgba(214,193,142,.44)';ctx.fillRect(o.x+8,o.y+6,10,4);
    }
    ctx.restore();
  }
  function drawUnit(u){
    ctx.save();ctx.translate(u.x,u.y);const blue=u.team==='blue',color=blue?'#72caba':'#df8a6c',dark=blue?'#264b49':'#633f39';
    ctx.globalAlpha=u.dead?.35:1;
    ctx.fillStyle='rgba(9,15,14,.32)';ctx.beginPath();ctx.ellipse(2,8,18,13,0,0,TAU);ctx.fill();
    if(u.dead){ctx.rotate(-.8);ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(0,0,14,20,0,0,TAU);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,-14,6,0,TAU);ctx.fill();ctx.restore();return;}
    ctx.rotate(u.angle);
    // body armor and field pack
    ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(-3,0,12,15,0,0,TAU);ctx.fill();
    ctx.fillStyle=blue?'#467e72':'#9a5c48';ctx.beginPath();ctx.ellipse(0,0,10,13,0,0,TAU);ctx.fill();
    ctx.fillStyle=color;ctx.fillRect(-2,-8,5,16);ctx.fillStyle='rgba(222,235,214,.55)';ctx.fillRect(-9,-5,4,10);
    // helmet and visor face forward
    ctx.fillStyle=blue?'#7caaa0':'#b87861';ctx.beginPath();ctx.arc(8,0,7,0,TAU);ctx.fill();
    ctx.fillStyle='#243332';ctx.fillRect(11,-4,4,8);
    // rifle barrel
    ctx.fillStyle='#1b2525';ctx.fillRect(7,-2.1,22,4.2);ctx.fillStyle='#a5a894';ctx.fillRect(22,-1.2,8,2.4);
    ctx.fillStyle='#252e2d';ctx.fillRect(13,1,7,5);
    if(u.flash>0){ctx.fillStyle='#ffd38e';ctx.beginPath();ctx.moveTo(29,0);ctx.lineTo(39,-5);ctx.lineTo(36,0);ctx.lineTo(39,5);ctx.closePath();ctx.fill();}
    ctx.restore();
    if(!u.isPlayer&&!u.dead){ctx.fillStyle='rgba(11,19,18,.56)';ctx.fillRect(u.x-13,u.y-27,26,3);ctx.fillStyle=blue?'#80dac7':'#f0a184';ctx.fillRect(u.x-13,u.y-27,26*clamp(u.hp/100,0,1),3);}
    if(u.isPlayer){ctx.strokeStyle='rgba(129,228,203,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(u.x,u.y,22,0,TAU);ctx.stroke();}
  }
  function drawWorld(){
    const cx=state==='menu'?1110:camera.x,cy=state==='menu'?610:camera.y;
    ctx.save();let sx=W/2-cx,sy=H/2-cy;if(shake&&state==='playing'){sx+=rand(-shake,shake);sy+=rand(-shake,shake);}ctx.translate(sx,sy);
    drawFloor();for(const o of obstacles)drawObstacle(o);
    // ambient sweep lights
    const glow=ctx.createRadialGradient(956,612,65,956,612,540);glow.addColorStop(0,'rgba(189,197,158,.055)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(350,0,1200,WORLD.h);
    for(const b of bullets){ctx.strokeStyle=b.team==='blue'?'rgba(136,239,213,.9)':'rgba(255,176,132,.92)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.028,b.y-b.vy*.028);ctx.stroke();}
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    for(const u of units)drawUnit(u);
    if(state==='menu'){
      const preview=[{x:700,y:800,a:-.4,t:'blue'},{x:1400,y:370,a:2.7,t:'red'},{x:1250,y:290,a:2.5,t:'red'}];
      for(const q of preview){const u=freshUnit(q.t,q.x,q.y);u.angle=q.a;drawUnit(u);}
    }
    ctx.restore();
    // vignette and subtle tactical scan
    const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.24,W/2,H/2,Math.max(W,H)*.72);vg.addColorStop(0,'rgba(8,15,16,0)');vg.addColorStop(1,'rgba(6,12,14,.40)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
    if(state==='playing'&&!isTouch){ui.reticle.style.left=`${mouse.x}px`;ui.reticle.style.top=`${mouse.y}px`;}
  }
  function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);drawWorld();requestAnimationFrame(frame);}
  camera={x:1110,y:610};resetRound(); // title-screen field dressing
  requestAnimationFrame(t=>{last=t;requestAnimationFrame(frame);});
})();
