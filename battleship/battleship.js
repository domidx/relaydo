import {initGame} from '../js/shell.js';
const N=10,FLEET=[['Carrier',5],['Battleship',4],['Cruiser',3],['Submarine',3],['Destroyer',2]];
const $=id=>document.getElementById(id),grid=v=>Array.from({length:N},()=>Array(N).fill(v));
let me,send,round=0,oppRound=-1,phase='setup',ships,mine,inc,en,turn,waiting,myReady,over,horiz=true,sel=0;
const shell=initGame({
  name:'Battleship',
  rules:`<p>Each player secretly places a fleet of five ships (lengths 5, 4, 3, 3, 2) on a 10×10 grid — by hand, or with <b>Random</b>. Press <b>Ready</b> when happy.</p>
  <p>Then take turns firing at a square of the enemy grid. You are told whether it was a hit or a miss, and when a ship is sunk. The first to sink the whole enemy fleet wins.</p>
  <p>The host fires first; Rematch alternates who starts.</p>`,
  onStart:({role,send:s})=>{me=role==='host'?0:1;send=s;round=0;oppRound=-1;setup()},
  onMessage:(t,d)=>{
    if(t==='ready'){oppRound=d.round;check()}
    else if(t==='rematch'){round=Math.max(round,d.round);setup()}
    else if(t==='shot')incoming(d.r,d.c);
    else if(t==='result')outcome(d);
  },
});
shell.addButton('Rematch',()=>{if(!send)return;round++;send('rematch',{round});setup()});

function setup(){
  ships=FLEET.map(([name,len])=>({name,len,cells:null,hits:0}));
  inc=grid(0);en=grid(0);phase='setup';myReady=false;over=false;waiting=false;sel=0;refresh();log('');render();
}
const log=m=>$('log').textContent=m;
function refresh(){mine=grid(-1);ships.forEach((s,i)=>s.cells&&s.cells.forEach(([r,c])=>mine[r][c]=i))}
function fits(len,r,c,h){for(let k=0;k<len;k++){const y=r+(h?0:k),x=c+(h?k:0);if(y>=N||x>=N||mine[y][x]!==-1)return false}return true}
function put(i,r,c,h){const s=ships[i];s.cells=Array.from({length:s.len},(_,k)=>[r+(h?0:k),c+(h?k:0)]);refresh()}
const nextFree=()=>{const i=ships.findIndex(s=>!s.cells);return i<0?null:i};
function random(){
  ships.forEach(s=>s.cells=null);refresh();
  ships.forEach((s,i)=>{let h,r,c;do{h=Math.random()<.5;r=Math.floor(Math.random()*N);c=Math.floor(Math.random()*N)}while(!fits(s.len,r,c,h));put(i,r,c,h)});
  sel=null;render();
}
function ownClick(r,c){
  if(phase!=='setup'||myReady)return;
  if(mine[r][c]>=0){const i=mine[r][c];ships[i].cells=null;refresh();sel=i}
  else if(sel!==null&&fits(ships[sel].len,r,c,horiz)){put(sel,r,c,horiz);sel=nextFree()}
  render();
}
$('rot').onclick=()=>{horiz=!horiz;render()};
$('rand').onclick=()=>{if(!myReady)random()};
$('clear').onclick=()=>{if(myReady)return;ships.forEach(s=>s.cells=null);refresh();sel=0;render()};
$('ready').onclick=()=>{myReady=true;send('ready',{round});check();render()};
function check(){if(phase==='setup'&&myReady&&oppRound===round){phase='play';turn=round%2;render()}}

function fire(r,c){
  if(phase!=='play'||over||turn!==me||waiting||en[r][c])return;
  waiting=true;send('shot',{r,c});render();
}
function incoming(r,c){
  if(!ships||over||inc[r][c])return;
  const i=mine[r][c];let res={r,c,hit:i>=0};
  if(i<0){inc[r][c]=1;log('Opponent fired and missed.')}
  else{
    inc[r][c]=2;const s=ships[i];s.hits++;
    if(s.hits===s.len){res.sunk={name:s.name,cells:s.cells};log(`Your ${s.name} was sunk!`)}else log('Opponent scored a hit!');
    res.lost=ships.every(x=>x.hits===x.len);
  }
  send('result',res);
  if(res.lost)over=true;else turn=me;
  render();
}
function outcome(d){
  waiting=false;en[d.r][d.c]=d.hit?2:1;
  log(d.sunk?`You sank their ${d.sunk.name}!`:d.hit?'Hit!':'Miss.');
  if(d.sunk)d.sunk.cells.forEach(([y,x])=>en[y][x]=3);
  if(d.lost)over=true;else turn=1-me;
  render();
}

function draw(el,cls,click){
  el.innerHTML='';
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const b=document.createElement('button');b.className='bc '+cls(r,c);
    b.setAttribute('aria-label',`Row ${r+1}, column ${c+1}`);b.onclick=()=>click(r,c);el.appendChild(b);
  }
}
function render(){
  $('setup').classList.toggle('hidden',phase!=='setup'||myReady);
  $('enemywrap').classList.toggle('hidden',phase!=='play');
  $('ships').innerHTML='';
  ships.forEach((s,i)=>{
    const b=document.createElement('button');b.className='sb'+(s.cells?' placed':'')+(sel===i?' sel':'');
    b.textContent=`${s.name} (${s.len})`;
    b.onclick=()=>{if(s.cells){s.cells=null;refresh()}sel=i;render()};$('ships').appendChild(b);
  });
  $('rot').textContent='Direction: '+(horiz?'Horizontal':'Vertical');
  $('ready').disabled=ships.some(s=>!s.cells);
  draw($('own'),(r,c)=>{
    const i=mine[r][c],v=inc[r][c];
    return (i>=0?'ship ':'')+(v===1?'miss ':v===2?(ships[i].hits===ships[i].len?'sunk ':'hit '):'');
  },ownClick);
  draw($('enemy'),(r,c)=>['','miss','hit','sunk'][en[r][c]],fire);
  $('enemy').classList.toggle('mine',phase==='play'&&!over&&turn===me&&!waiting);
  $('gstatus').textContent=over?(ships.every(s=>s.hits===s.len)?'You lost — your fleet is sunk.':'You win! Enemy fleet sunk.')
    :phase==='setup'?(myReady?'Waiting for opponent to get ready…':'Place your fleet'):
    (turn===me&&!waiting?'Your turn — fire!':"Opponent's turn…");
}
