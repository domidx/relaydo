import {initGame} from '../js/shell.js';
import {shuffle} from '../js/util.js';
// Host-authoritative War. Host = seat 0, guest = seat 1. Either player flips; a round resolves when both have flipped
// (or have Auto on). Ties start a "war": up to 3 cards face down, then 1 face up. Winnings are shuffled to the bottom.
const $=id=>document.getElementById(id);
const SU=['♠','♥','♦','♣'],RN={11:'J',12:'Q',13:'K',14:'A'};
let host=false,send,me=0,S=null,timer=null;
let A=[],B=[],phase='wait',rdy=[false,false],auto=[false,false],show={a:[],b:[]},w=-2,wars=0,over=null;

const shell=initGame({
  name:'War',
  rules:`<p>The deck is split evenly. Each round both players <b>Flip</b> their top card; the higher card (ace high) takes both.</p>
  <p>On a tie it's <b>WAR</b>: each player puts up to three cards face down and flips one more; the higher card wins everything on the table.</p>
  <p>Win all 52 cards to win the game. It can take a while — use <b>Auto</b> to flip automatically each round.</p>`,
  onStart:({role,send:s})=>{host=role==='host';me=host?0:1;send=s;S=null;if(host){auto=[false,false];newGame()}render()},
  onMessage:(t,d)=>{
    if(t==='state'&&!host){S=d;render()}
    else if(host&&t==='flip')flip(1);
    else if(host&&t==='auto')setAuto(1,d.on);
    else if(host&&t==='rematch')newGame();
  },
  onEnd:()=>{clearTimeout(timer);S=null},
});
shell.addButton('Rematch',()=>{if(!send)return;host?newGame():send('rematch')});

function newGame(){
  clearTimeout(timer);
  const d=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)d.push([r,s]);shuffle(d);
  A=d.slice(0,26);B=d.slice(26);phase='wait';rdy=[false,false];show={a:[],b:[]};w=-2;wars=0;over=null;check();
}
const pub=()=>({phase,n:[A.length,B.length],show,w,wars,rdy,auto,over});
function sync(){S=pub();send('state',S);render()}
function check(){
  if(phase==='wait'){auto.forEach((a,i)=>{if(a)rdy[i]=true});if(rdy[0]&&rdy[1]){resolve();return}}
  sync();
}
function flip(i){if(phase!=='wait')return;rdy[i]=true;check()}
function setAuto(i,on){auto[i]=!!on;check()}
function resolve(){
  phase='show';rdy=[false,false];
  const pot=[],sa=[],sb=[];
  let a=A.shift(),b=B.shift();pot.push(a,b);sa.push({c:a});sb.push({c:b});wars=0;
  while(a[0]===b[0]&&A.length&&B.length){
    wars++;
    const n=Math.min(3,A.length-1,B.length-1);
    for(let i=0;i<n;i++){const x=A.shift(),y=B.shift();pot.push(x,y);sa.push({c:x,down:1});sb.push({c:y,down:1})}
    a=A.shift();b=B.shift();pot.push(a,b);sa.push({c:a});sb.push({c:b});
  }
  w=a[0]>b[0]?0:b[0]>a[0]?1:A.length?0:B.length?1:-1;
  const P=shuffle(pot);
  if(w===0)A.push(...P);else if(w===1)B.push(...P);else{A.push(...P.slice(0,P.length>>1));B.push(...P.slice(P.length>>1))}
  show={a:sa,b:sb};
  if(!A.length||!B.length){phase='over';over=A.length?0:1}
  else timer=setTimeout(()=>{phase='wait';check()},wars?2800:1600);
  sync();
}

const card=x=>x.down?'<span class="card back"></span>':`<span class="card${x.c[1]===1||x.c[1]===2?' red':''}">${RN[x.c[0]]||x.c[0]}<small>${SU[x.c[1]]}</small></span>`;
function render(){
  const g=$('gstatus');
  if(!S){g.textContent='Setting up…';return}
  const mine=me===0?S.show.a:S.show.b,opp=me===0?S.show.b:S.show.a;
  $('opp').innerHTML=opp.map(card).join('');$('mine').innerHTML=mine.map(card).join('');
  $('oppn').textContent=`Opponent · ${S.n[1-me]} cards`;$('men').textContent=`You · ${S.n[me]} cards`;
  g.textContent=S.phase==='over'?(S.over===me?'You win the game! 🎉':'You lost the game.')
    :S.phase==='show'?((S.wars?'WAR! ':'')+(S.w===-1?'Tie!':S.w===me?'You win the round':'Opponent wins the round'))
    :S.rdy[me]?'Waiting for opponent to flip…':'Flip your card!';
  $('flip').classList.toggle('hidden',!(S.phase==='wait'&&!S.rdy[me]));
  $('auto').textContent='Auto: '+(S.auto[me]?'On':'Off');
}
$('flip').onclick=()=>host?flip(0):send('flip');
$('auto').onclick=()=>{const on=!(S&&S.auto[me]);host?setAuto(0,on):send('auto',{on})};
