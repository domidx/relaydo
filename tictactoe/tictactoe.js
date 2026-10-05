import {initGame} from '../js/shell.js';
const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],SYM=['X','O'];
let b,turn,over,me,send,round=0,win=[];
const el=document.getElementById('ttt'),gs=()=>document.getElementById('gstatus');
const shell=initGame({
  name:'Tic-tac-toe',
  rules:`<p>Take turns placing your mark in an empty square.</p>
  <p>First to get <b>three in a row</b> — across, down or diagonally — wins. A full board is a draw.</p>
  <p>The host plays X. Rematch alternates who starts.</p>`,
  onStart:({role,send:s})=>{me=role==='host'?0:1;send=s;round=0;newGame()},
  onMessage:(t,d)=>{
    if(t==='move')play(d.i,1-me);
    if(t==='rematch'){round++;newGame()}
  },
});
shell.addButton('Rematch',()=>{if(!send||!b)return;send('rematch');round++;newGame()});

function newGame(){b=Array(9).fill(-1);turn=round%2;over=false;win=[];render()}
function play(i,who){
  if(over||turn!==who||b[i]!==-1)return;
  b[i]=who;
  const l=L.find(l=>l.every(k=>b[k]===who));
  if(l){win=l;over=who+1}else if(b.every(x=>x!==-1))over='draw';else turn=1-turn;
  render();
}
function render(){
  el.innerHTML='';el.classList.toggle('mine',!over&&turn===me);
  b.forEach((v,i)=>{
    const c=document.createElement('button');
    c.className='sq'+(v>=0?' p'+v:'')+(win.includes(i)?' win':'');
    c.textContent=v>=0?SYM[v]:'';
    c.setAttribute('aria-label',`Square ${i+1}`);
    c.onclick=()=>{if(!over&&turn===me&&b[i]===-1){send('move',{i});play(i,me)}};
    el.appendChild(c);
  });
  const m=p=>`<b style="color:var(--p${p})">${SYM[p]}</b>`;
  gs().innerHTML=over==='draw'?'Draw!':over?(over-1===me?'You win!':'Opponent wins')+` (${m(over-1)})`
    :turn===me?`Your turn — you are ${m(me)}`:`Opponent's turn (${m(turn)})…`;
}
