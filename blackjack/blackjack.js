import {initGame} from '../js/shell.js';
// Host's browser runs the (automated) dealer and is the single source of truth; the host also plays as a normal seat. Guests send {act: hit|stand}; host broadcasts the public table state.
// The dealer's hole card is only included in the broadcast once it is revealed.
const SU=['♠','♥','♦','♣'],RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
let host=false,send,myPid,S=null,deck=[],dealer=[],hole=true,players=[],turn=null,phase='idle',timer=null;

const val=h=>{let t=0,a=0;for(const [r] of h){if(r===0){a++;t+=11}else t+=Math.min(r+1,10)}while(t>21&&a){t-=10;a--}return t};
const newDeck=()=>{const d=[];for(let s=0;s<4;s++)for(let r=0;r<13;r++)d.push([r,s]);
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d};

initGame({
  name:'Blackjack',max:5,
  rules:`<p>Up to 6 players sit at the table: the host plus up to 5 guests. The dealer is automatic (run by the host's browser). Everyone plays against the dealer, not each other.</p>
  <p>Get closer to <b>21</b> than the dealer without going over. Cards 2–10 count face value, J/Q/K are 10, an ace is 11 or 1. On your turn: <b>Hit</b> to take a card, or <b>Stand</b> to stop.</p>
  <p>The dealer draws until reaching 17 or more. A two-card 21 is a <b>Blackjack</b> and beats any other 21. Same total = push (tie). No betting, splitting or doubling — the table just keeps a Win–Lose–Push tally.</p>`,
  onStart:({role,send:s,pid,players:pl})=>{
    host=role==='host';send=s;myPid=pid;S=null;phase='idle';dealer=[];hole=true;turn=null;
    if(host){const hn=($('myname')&&$('myname').value.trim())||'Host';
      players=[{pid:myPid,name:hn.slice(0,16)},...pl].map(x=>({pid:x.pid,name:x.name,hand:[],st:'wait',res:null,w:0,l:0,p:0}));push()}
    render();
  },
  onPlayerLeft:pid=>{
    if(!host)return;
    players=players.filter(p=>p.pid!==pid);
    if(phase==='players')advance();else push();
  },
  onMessage:(t,d,from)=>{
    if(t==='state'&&!host){S=d;render()}
    else if(t==='act'&&host)act(from,d.move);
  },
  onEnd:()=>{clearTimeout(timer);S=null;players=[]},
});

const pub=()=>({phase,turn,dealer:dealer.map((c,i)=>i===1&&hole?null:c),dv:dealer.length?val(hole?[dealer[0]]:dealer):0,
  players:players.map(p=>({pid:p.pid,name:p.name,hand:p.hand,st:p.st,res:p.res,w:p.w,l:p.l,p:p.p,v:val(p.hand)}))});
function push(){S=pub();send('state',S);render()}

function deal(){
  if(!host||!players.length||(phase!=='idle'&&phase!=='done'))return;
  deck=newDeck();hole=true;
  players.forEach(p=>{p.hand=[deck.pop(),deck.pop()];p.res=null;p.st=val(p.hand)===21?'bj':'play'});
  dealer=[deck.pop(),deck.pop()];phase='players';turn=null;
  if(val(dealer)===21){hole=false;resolve();return} // dealer blackjack ends the round at once
  advance();
}
function advance(){
  const p=players.find(x=>x.st==='play');
  if(p){turn=p.pid;push()}else{turn=null;dealerPlay()}
}
function act(pid,move){
  if(phase!=='players'||turn!==pid)return;
  const p=players.find(x=>x.pid===pid);if(!p)return;
  if(move==='hit'){p.hand.push(deck.pop());const v=val(p.hand);if(v>21)p.st='bust';else if(v===21)p.st='stand'}
  else if(move==='stand')p.st='stand';else return;
  if(p.st==='play')push();else advance();
}
function dealerPlay(){
  phase='dealer';hole=false;push();
  const step=()=>{
    if(players.some(p=>p.st==='stand')&&val(dealer)<17){dealer.push(deck.pop());push();timer=setTimeout(step,900)}
    else resolve();
  };
  timer=setTimeout(step,900);
}
function resolve(){
  const dv=val(dealer),dbj=dealer.length===2&&dv===21;
  players.forEach(p=>{
    const v=val(p.hand);let r;
    if(p.st==='bust')r='Lose';
    else if(p.st==='bj')r=dbj?'Push':'Blackjack!';
    else if(dbj)r='Lose';
    else if(dv>21||v>dv)r='Win';else if(v===dv)r='Push';else r='Lose';
    p.res=r;if(r==='Lose')p.l++;else if(r==='Push')p.p++;else p.w++;
  });
  phase='done';turn=null;hole=false;push();
}

const card=c=>c?`<span class="card${c[1]===1||c[1]===2?' red':''}">${RK[c[0]]}<small>${SU[c[1]]}</small></span>`:'<span class="card back"></span>';
function render(){
  const g=$('gstatus');
  if(!S){g.textContent=host?'Setting up the table…':'Waiting for the host to deal…';$('deal').classList.add('hidden');$('hit').classList.add('hidden');$('stand').classList.add('hidden');return}
  const tp=S.players.find(p=>p.pid===S.turn),mine=S.turn===myPid;
  g.textContent=S.phase==='idle'?(host?'Press Deal to start a round':'Waiting for the host to deal…')
    :S.phase==='players'?(mine?'Your turn — hit or stand?':`Waiting for ${tp?tp.name:'player'}…`)
    :S.phase==='dealer'?'Dealer is playing…':'Round over';
  $('dealer').innerHTML=`<div class="nm">Dealer</div><div class="hand">${S.dealer.map(card).join('')}</div><div class="tot">${S.dealer.length?'Total: '+S.dv:''}</div>`;
  $('seats').innerHTML=S.players.map(p=>{
    const b=p.res||(p.st==='bust'?'Bust':p.st==='bj'?'Blackjack!':'');
    return `<div class="seat${p.pid===S.turn?' turn':''}"><span class="nm">${esc(p.name)}${p.pid===myPid?' (you)':''}</span>${b?`<span class="badge ${b.replace('!','').toLowerCase()}">${b}</span>`:''}
      <div class="hand">${p.hand.map(card).join('')}</div><div class="tot">${p.hand.length?'Total: '+p.v:''} <span class="tally">· W ${p.w} – L ${p.l} – P ${p.p}</span></div></div>`;
  }).join('');
  $('deal').textContent=S.phase==='done'?'Next round':'Deal';
  $('deal').classList.toggle('hidden',!(host&&(S.phase==='idle'||S.phase==='done')&&S.players.length));
  const my=S.phase==='players'&&mine;
  $('hit').classList.toggle('hidden',!my);$('stand').classList.toggle('hidden',!my);
}
$('deal').onclick=deal;
const play=m=>host?act(myPid,m):send('act',{move:m});
$('hit').onclick=()=>play('hit');
$('stand').onclick=()=>play('stand');
