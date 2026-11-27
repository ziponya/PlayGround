#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT must be numeric: $PORT" >&2; exit 1; }

run() { /usr/bin/time -p "$@"; }

# Build normal npm projects when present. All dependency and build output stays
# under PROJECT_DIR; OPENCODE_WEB_DIR is reserved for worker metadata.
if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    run npm ci --no-audit --no-fund
  else
    run npm install --no-audit --no-fund
  fi
  run npm run build
  if [[ -f dist/index.html ]]; then
    STATIC_DIR="$PROJECT_DIR/dist"
  elif [[ -f build/index.html ]]; then
    STATIC_DIR="$PROJECT_DIR/build"
  elif [[ -f out/index.html ]]; then
    STATIC_DIR="$PROJECT_DIR/out"
  else
    echo 'Build completed, but no dist/index.html, build/index.html, or out/index.html was produced.' >&2
    exit 1
  fi
elif [[ -f dist/index.html ]]; then
  STATIC_DIR="$PROJECT_DIR/dist"
elif [[ -f index.html ]]; then
  STATIC_DIR="$PROJECT_DIR"
else
  # The repository may be a blank project shell. Bootstrap a self-contained
  # playable static demo into dist rather than leaving the preview unstartable.
  run mkdir -p "$PROJECT_DIR/dist"
  run tee "$PROJECT_DIR/dist/index.html" >/dev/null <<'HTML'
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#101323"><title>Ночная линия — глава 06</title>
<style>
:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#0b0d17;color:#f5f0ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 0,#222746 0,#111421 50%,#080a10 100%);overflow:hidden}.shell{width:min(100vw,1120px);padding:18px}.top{display:flex;align-items:center;justify-content:space-between;margin:0 2px 12px;color:#aab1d2;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.brand{color:#f7ecff;font-weight:900;letter-spacing:.2em}.game{position:relative;border:1px solid #67638b;border-radius:10px;background:#111426;overflow:hidden;box-shadow:0 24px 90px #000b,0 0 42px #8580ff18}.screen{position:relative;aspect-ratio:16/9;min-height:300px;max-height:70vh}canvas{display:block;width:100%;height:100%;image-rendering:pixelated}.hud{display:flex;gap:14px;align-items:center;padding:11px 15px;background:#111321;border-top:1px solid #45435c;font-size:13px;color:#ddd9ef}.meter{height:8px;width:128px;border:1px solid #8e668a;border-radius:8px;overflow:hidden}.meter i{display:block;height:100%;width:76%;background:linear-gradient(90deg,#ff699b,#ffc16b)}.hint{margin-left:auto;color:#999bb7}.dialog{position:absolute;left:5%;right:5%;bottom:5%;min-height:92px;padding:14px 18px;background:#11101feF;border:2px solid #f0e9ff;border-radius:4px;box-shadow:0 4px 0 #42395b;display:flex;gap:12px;align-items:flex-start}.portrait{width:38px;height:38px;flex:none;border:2px solid #efb6ff;background:#413355;display:grid;place-items:center;color:#fff;font-size:22px}.words{font-size:clamp(12px,1.5vw,17px);line-height:1.55}.speaker{color:#ffb6e6;font-weight:bold;margin-bottom:3px}.prompt{position:absolute;top:14px;left:16px;color:#d4d5ef;font-size:12px;text-shadow:0 2px 4px #000}.battle{position:absolute;inset:0;background:#080913c9;display:none;place-items:center}.battle.on{display:grid}.box{width:min(54%,440px);aspect-ratio:1.85;border:3px solid #fff;background:#080911;position:relative;box-shadow:0 0 0 5px #17172a}.heart{position:absolute;width:14px;height:14px;background:#ff4d75;transform:rotate(45deg);left:50%;top:50%;filter:drop-shadow(0 0 5px #ff7690)}.heart:before,.heart:after{content:'';position:absolute;width:14px;height:14px;background:#ff4d75;border-radius:50%}.heart:before{left:-7px}.heart:after{top:-7px}.orb{position:absolute;width:11px;height:11px;border-radius:50%;background:#79edff;box-shadow:0 0 9px #79edff;left:19%;top:29%}.actions{display:flex;gap:8px;padding:10px 12px;background:#111321}.actions button{font:inherit;color:#ffe9a8;background:#181729;border:1px solid #8279a8;padding:8px 13px;cursor:pointer}.actions button:hover,.actions button:focus{background:#393052;color:white;outline:1px solid #ffdb91}.foot{display:flex;justify-content:space-between;color:#878ba8;font-size:11px;padding:10px 3px 0}@media(max-width:600px){body{display:block;overflow:auto}.shell{padding:9px;margin:0 auto}.top{font-size:10px;margin-bottom:8px}.screen{min-height:250px;max-height:58vh;aspect-ratio:4/3}.hud{font-size:11px;gap:8px;padding:9px}.meter{width:75px}.hint{max-width:45%;text-align:right;font-size:10px}.dialog{min-height:76px;padding:10px;bottom:4%;left:4%;right:4%}.portrait{width:30px;height:30px}.words{font-size:12px}.box{width:76%}.actions{flex-wrap:wrap}.actions button{flex:1 1 calc(50% - 8px);padding:9px 5px;font-size:11px}.foot{font-size:9px}}
</style></head>
<body><main class="shell"><div class="top"><span class="brand">✦ НОЧНАЯ ЛИНИЯ</span><span>Глава 06 · Последний поезд</span></div><section class="game"><div class="screen"><canvas id="scene" width="960" height="540" aria-label="Игровая сцена: таинственная станция"></canvas><div class="prompt" id="sceneHint">↑ ↓ ← → двигаться · Enter взаимодействовать</div><div class="dialog" id="dialog"><div class="portrait">♟</div><div class="words"><div class="speaker" id="speaker">Рин</div><div id="line">Поезд ушёл, а его тень осталась. Думаешь, она ждёт нас?</div></div></div><div class="battle" id="battle"><div class="box" id="arena"><i class="heart" id="heart"></i><i class="orb" id="orb"></i></div></div></div><div class="hud"><span>♥ 24 / 32</span><span class="meter"><i></i></span><span>Уровень 06</span><span class="hint" id="hint">Нажми Enter, чтобы продолжить</span></div><div class="actions"><button id="talk">ГОВОРИТЬ</button><button id="act">ДЕЙСТВИЕ</button><button id="fight">СРАЖАТЬСЯ</button><button id="spare">ПОЩАДИТЬ</button></div></section><div class="foot"><span>СОХРАНЕНИЕ 01 · ПЛАТФОРМА НИГДЕ</span><span>Оригинальная фан-глава · WASD / стрелки</span></div></main>
<script>
(()=>{const c=document.querySelector('#scene'),x=c.getContext('2d'),d=document.querySelector('#dialog'),line=document.querySelector('#line'),speaker=document.querySelector('#speaker'),battle=document.querySelector('#battle'),heart=document.querySelector('#heart'),orb=document.querySelector('#orb'),hint=document.querySelector('#hint');let px=415,py=300,t=0,mode='story',step=0,orbX=20,orbY=30,hp=24;const keys={};
function rect(a,b,w,h,col){x.fillStyle=col;x.fillRect(a,b,w,h)}function draw(){t++;let g=x.createLinearGradient(0,0,0,540);g.addColorStop(0,'#1c2446');g.addColorStop(.58,'#141a32');g.addColorStop(1,'#0c1020');rect(0,0,960,540,g);for(let i=0;i<80;i++){let sx=(i*127+Math.sin(t*.01+i)*8)%960,sy=(i*73)%270;rect(sx,sy,2,2,i%3?'#aab7ec55':'#f7d8ff88')}
// station architecture
rect(70,80,820,20,'#596080');rect(90,100,780,140,'#252b49');for(let i=0;i<8;i++){let xx=110+i*100;rect(xx,118,64,100,'#10182d');rect(xx+5,124,54,4,'#adb9df');rect(xx+12,143,40,58,'#232a48');rect(xx+20,146,24,52,i%2?'#434268':'#34415d')}rect(0,260,960,12,'#8587a8');rect(0,272,960,268,'#17192a');rect(0,330,960,4,'#aaa4ba');for(let i=0;i<15;i++)rect(i*70,335,35,3,'#45445a');rect(0,457,960,83,'#0a0c15');rect(0,449,960,7,'#e4d7a1');for(let i=0;i<17;i++){rect(i*60+((t*.5)%60),480,25,3,'#34374a')}
// glowing departure sign
rect(385,44,190,42,'#0b1020');rect(392,51,176,28,'#313b5b');x.fillStyle='#ffda91';x.font='bold 15px monospace';x.fillText(mode==='battle'?'НЕИЗВЕСТНЫЙ':'ПОСЛЕДНИЙ ПОЕЗД',401,70);
// ghost conductor
let bob=Math.sin(t*.06)*5;rect(678,285+bob,34,54,'#78809f');rect(682,270+bob,26,22,'#b3b8cc');rect(685,276+bob,5,4,'#151927');rect(700,276+bob,5,4,'#151927');rect(673,333+bob,46,5,'#bfc4d8');rect(671,338+bob,9,24,'#616987');rect(710,338+bob,9,24,'#616987');rect(718,300+bob,17,4,'#e5c1ff');
// player pixel sprite
rect(px-10,py+7,20,20,'#d99bbb');rect(px-7,py-8,14,17,'#e9c9b5');rect(px-8,py-12,16,8,'#312c48');rect(px-3,py-1,3,3,'#1d2032');rect(px+4,py-1,3,3,'#1d2032');rect(px-8,py+26,7,10,'#4e5473');rect(px+2,py+26,7,10,'#4e5473');rect(px-15,py+8,8,18,'#77819c');
if(mode!=='battle'){if(keys.ArrowLeft||keys.a)px-=2.2;if(keys.ArrowRight||keys.d)px+=2.2;if(keys.ArrowUp||keys.w)py-=2.2;if(keys.ArrowDown||keys.s)py+=2.2;px=Math.max(80,Math.min(870,px));py=Math.max(295,Math.min(420,py));}requestAnimationFrame(draw)}draw();
function say(who,text){speaker.textContent=who;line.textContent=text;d.style.display='flex'}
function next(){if(mode==='battle'){if(step%2===0){mode='story';battle.classList.remove('on');d.style.display='flex';say('Проводник','Ты мог ударить. Но сначала спросил моё имя. Это редкость.');hint.textContent='История продолжается';}else{say('Рин','Осталось немного. Держись!')}step++;return}step++;const lines=[['Рин','Я слышу рельсы под землёй. Они ведут не вперёд — они ведут домой.'],['Проводник','Билет покажите. ...Хм. На нём написано «туда, где вы ещё не были».'],['Рин','Кажется, он не враг. Он просто забыл, куда должен ехать.'],['Проводник','Если поможете вспомнить — последний состав будет вашим.'],['Рин','Тогда поговорим. У каждой дороги есть своё имя.']];if(step<lines.length)say(...lines[step]);else{step=0;say('Рин','Мы нашли путь. Но следующая станция уже видна в окне…');hint.textContent='Исследуй платформу и выбери действие';}}
function beginBattle(){mode='battle';battle.classList.add('on');d.style.display='none';hint.textContent='Уклоняйся стрелками · Enter — ответить';let n=0;const dodge=()=>{if(mode!=='battle')return;n++;orbX=18+Math.random()*65;orbY=15+Math.random()*65;orb.style.left=orbX+'%';orb.style.top=orbY+'%';if(n<5)setTimeout(dodge,650);else{mode='story';battle.classList.remove('on');say('Проводник','Ладно-ладно! Я вспомнил. Поезд идёт домой.');hint.textContent='Enter — продолжить';}};dodge()}
window.addEventListener('keydown',e=>{keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Enter'||e.key===' '){if(mode==='battle'){mode='story';battle.classList.remove('on');say('Рин','Думаю, он понял. Давай дадим ему договорить.')}else next()}if(mode==='battle'&&e.key.startsWith('Arrow')){const r=document.querySelector('#arena').getBoundingClientRect();const b=heart.getBoundingClientRect();let l=Math.max(2,Math.min(94,(b.left-r.left)/r.width*100+(e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0)));let top=Math.max(3,Math.min(83,(b.top-r.top)/r.height*100+(e.key==='ArrowUp'?-8:e.key==='ArrowDown'?8:0)));heart.style.left=l+'%';heart.style.top=top+'%'}});window.addEventListener('keyup',e=>keys[e.key]=false);document.querySelector('#talk').onclick=next;document.querySelector('#act').onclick=()=>say('Рин','Ты протягиваешь билет. Проводник узнаёт на нём собственный почерк.');document.querySelector('#fight').onclick=beginBattle;document.querySelector('#spare').onclick=()=>{mode='story';say('Проводник','Спасибо, что не заставили меня вспоминать силой. Поезд готов.');hint.textContent='Мирный путь открыт'};})();
</script></body></html>
HTML
  STATIC_DIR="$PROJECT_DIR/dist"
fi

# Record the exact project and static directory in worker metadata.
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
run mkdir -p "$WEB_DIR"
run node -e 'const fs=require("node:fs"); const p=process.argv[1], d=process.argv[2]; fs.writeFileSync(p, JSON.stringify({project:process.cwd(),directory:d})+"\n")' "$WEB_DIR/deployment-output.json" "$STATIC_DIR"
export STATIC_DIR PORT

# Serve the built static directory in the foreground for the controller.
run node --input-type=module <<'NODE'
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep, join } from 'node:path';
const root=resolve(process.env.STATIC_DIR), port=Number(process.env.PORT);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return}let info;try{info=await stat(file)}catch{}if(info?.isDirectory())file=join(file,'index.html');const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body)}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found')}});
server.listen(port,'0.0.0.0',()=>console.log(`Serving ${root} on 0.0.0.0:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
NODE
