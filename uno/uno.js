import {initGame} from '../js/shell.js';
import {shuffle,esc} from '../js/util.js';
// Host-authoritative Uno. The host keeps every hand and sends each guest only their own ('hand' addressed with `to`).
// card = {c: 0..3 colour | 4 wild, v: 0-9 | 'S' skip | 'R' reverse | 'D' draw two | 'W' wild | 'F' wild draw four}
const $=id=>document.getElementById(id);
const COLN=['Red','Yellow','Green','Blue'];
let host=false,send,myPid,S=null,hand=[],pend=null;
let players=[],deck=[],disc=[],top=null,col=0,cur=null,dir=1,drew=false,phase='idle',winner=null,round=0;

const mkDeck=()=>{const d=[];
  for(let c=0;c<4;c++){d.push({c,v:0});for(let v=1;v<=9;v++)d.push({c,v},{c,v});for(const v of ['S','R','D'])d.push({c,v},{c,v})}
  for(let i=0;i<4;i++)d.push({c:4,v:'W'},{c:4,v:'F'});return shuffle(d)};
const ok=(k,t,cl)=>k.c===4||k.c===cl||(t.c!==4&&k.v===t.v);
const lbl=k=>typeof k.v==='number'?k.v:{S:'⊘',R:'⇄',D:'+2',W:'W',F:'+4'}[k.v];

initGame({
  name:'Uno',max:5,
  rules:`<p>2–6 players (the host plays too). Be the first to get rid of all your cards.</p>
  <p>Play a card matching the top card's <b>colour</b>, <b>number</b> or <b>symbol</b>. Can't (or don't want to) play? <b>Draw</b> one card, then play it or <b>Pass</b>.</p>
  <p><b>⊘ Skip</b>: next player misses a turn. <b>⇄ Reverse</b>: direction flips (with 2 players it acts as Skip). <b>+2</b>: next player draws 2 and misses a turn. <b>W Wild</b>: choose a colour. <b>+4</b>: choose a colour, next player draws 4 and misses a turn.</p>
  <p>House rules: no stacking, and wilds may be played any time. When someone has one card left, "UNO!" appears automatically. First to empty their hand wins the round; wins are tallied.</p>`,
  onStart:({role,send:s,pid,players:pl})=>{
    host=role==='host';send=s;myPid=pid;S=null;hand=[];pend=null;phase='idle';
    if(host){
      const hn=(($('myname')&&$('myname').value.trim())||'Host').slice(0,16);
      players=[{pid:myPid,name:hn},...pl].map(x=>({pid:x.pid,name:x.name,hand:[],w:0,dirty:true}));
      sync();
    }
    render();
  },
  onPlayerLeft:pid=>{
    if(!host)return;
    const i=players.findIndex(p=>p.pid===pid);if(i<0)return;
    const was=cur===pid;disc.push(...players[i].hand);players.splice(i,1);
    if(players.length<2){if(phase==='play')phase='idle';cur=null;sync();return}
    if(was){cur=players[(i+(dir===1?0:-1)+players.length)%players.length].pid;drew=false}
    sync();
  },
  onMessage:(t,d,from)=>{
    if(t==='state'&&!host){S=d;render()}
    else if(t==='hand'&&d.to===myPid){hand=d.cards;render()}
    else if(host&&t==='play')play(from,d.i,d.color);
    else if(host&&t==='draw')drawOne(from);
    else if(host&&t==='pass')pass(from);
  },
  onEnd:()=>{S=null;players=[];hand=[]},
});

// ---------- host logic ----------
const pub=()=>({phase,cur,dir,col,top,drew,winner,players:players.map(p=>({pid:p.pid,name:p.name,n:p.hand.length,w:p.w}))});
function sync(){
  players.forEach(p=>{if(p.pid===myPid)hand=p.hand;else if(p.dirty)send('hand',{to:p.pid,cards:p.hand});p.dirty=false});
  S=pub();send('state',S);render();
}
function take(n){const out=[];while(out.length<n){if(!deck.length){if(!disc.length)break;deck=shuffle(disc.splice(0))}out.push(deck.pop())}return out}
const ix=()=>players.findIndex(p=>p.pid===cur);
const next=k=>{const n=players.length;return players[((ix()+dir*k)%n+n)%n].pid};
function startRound(){
  if(!host||players.length<2||(phase!=='idle'&&phase!=='done'))return;
  deck=mkDeck();disc=[];
  players.forEach(p=>{p.hand=take(7);p.dirty=true});
  do{top=deck.pop();if(typeof top.v!=='number')disc.push(top)}while(typeof top.v!=='number');
  col=top.c;dir=1;drew=false;winner=null;phase='play';cur=players[round++%players.length].pid;sync();
}
function play(pid,i,color){
  if(phase!=='play'||pid!==cur)return;
  const p=players.find(x=>x.pid===pid),k=p&&p.hand[i];
  if(!k||!ok(k,top,col))return;
  if(k.c===4&&!(color>=0&&color<4))return;
  p.hand.splice(i,1);p.dirty=true;disc.push(top);top=k;col=k.c===4?color:k.c;drew=false;
  if(!p.hand.length){phase='done';winner=p.name;p.w++;cur=null;sync();return}
  let skip=1;
  if(k.v==='R'){dir=-dir;if(players.length===2)skip=2}
  else if(k.v==='S')skip=2;
  else if(k.v==='D'||k.v==='F'){const v=players.find(x=>x.pid===next(1));v.hand.push(...take(k.v==='D'?2:4));v.dirty=true;skip=2}
  cur=next(skip);sync();
}
function drawOne(pid){
  if(phase!=='play'||pid!==cur||drew)return;
  const p=players.find(x=>x.pid===pid);p.hand.push(...take(1));p.dirty=true;drew=true;sync();
}
function pass(pid){if(phase!=='play'||pid!==cur||!drew)return;drew=false;cur=next(1);sync()}

// ---------- UI ----------
const act=(t,d={})=>host?({play:()=>play(myPid,d.i,d.color),draw:()=>drawOne(myPid),pass:()=>pass(myPid)})[t]():send(t,d);
function render(){
  const g=$('gstatus');
  if(!S){g.textContent=host?'Setting up the table…':'Waiting for the host…';['deal','draw','pass','colors'].forEach(i=>$(i).classList.add('hidden'));return}
  const mine=S.phase==='play'&&S.cur===myPid;if(!mine)pend=null;
  const cp=S.players.find(p=>p.pid===S.cur);
  g.textContent=S.phase==='idle'?(host?(S.players.length<2?'Waiting for players…':'Press Start round'):'Waiting for the host to start the round…')
    :S.phase==='done'?`${S.winner} wins the round! 🎉`
    :mine?(S.drew?'Play the card or Pass':'Your turn'):`${cp?cp.name:'…'}'s turn`;
  $('plist').innerHTML=(S.phase==='play'?`<span class="pl">${S.dir===1?'⟳':'⟲'}</span>`:'')+S.players.map(p=>
    `<span class="pl${p.pid===S.cur?' cur':''}">${esc(p.name)}${p.pid===myPid?' (you)':''} · ${p.n} 🂠${p.n===1&&S.phase==='play'?' · UNO!':''} · W ${p.w}</span>`).join('');
  $('topcard').innerHTML=S.top?`<span class="uc c${S.top.c}">${lbl(S.top)}</span><span class="uc dot c${S.col}" title="${COLN[S.col]}"></span>`:'';
  $('hand').innerHTML=hand.map((k,i)=>`<button class="uc c${k.c}${mine&&ok(k,S.top,S.col)?'':' dim'}" data-i="${i}">${lbl(k)}</button>`).join('');
  $('colors').innerHTML=COLN.map((n,c)=>`<button class="uc c${c}" data-c="${c}" title="${n}">${n[0]}</button>`).join('');
  $('colors').classList.toggle('hidden',pend===null);
  $('deal').textContent=S.phase==='done'?'Next round':'Start round';
  $('deal').classList.toggle('hidden',!(host&&(S.phase==='idle'||S.phase==='done')&&S.players.length>1));
  $('draw').classList.toggle('hidden',!(mine&&!S.drew));
  $('pass').classList.toggle('hidden',!(mine&&S.drew));
}
$('hand').onclick=e=>{
  const b=e.target.closest('button');if(!b||!S||S.phase!=='play'||S.cur!==myPid)return;
  const i=+b.dataset.i,k=hand[i];if(!k||!ok(k,S.top,S.col))return;
  if(k.c===4){pend=i;render()}else act('play',{i});
};
$('colors').onclick=e=>{const b=e.target.closest('button');if(!b||pend===null)return;const i=pend;pend=null;act('play',{i,color:+b.dataset.c})};
$('deal').onclick=startRound;
$('draw').onclick=()=>act('draw');
$('pass').onclick=()=>act('pass');
