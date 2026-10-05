import {initGame} from '../js/shell.js';
const R=6,C=7;
let board,turn,over,me,send,round=0,winCells=[];
const el=document.getElementById('board'),gs=()=>document.getElementById('gstatus');
const names=['Burgundy','Gold'];
const shell=initGame({
  name:'Connect 4',
  rules:`<p>Take turns dropping a disc into a column. It falls to the lowest free slot.</p>
  <p>First to line up <b>four</b> discs horizontally, vertically or diagonally wins. A full board is a draw.</p>
  <p>The host plays burgundy and moves first; Rematch alternates who starts.</p>`,
  onStart:({role,send:s})=>{me=role==='host'?0:1;send=s;round=0;newGame()},
  onMessage:(t,d)=>{
    if(t==='move')play(d.col,1-me);
    if(t==='rematch'){round++;newGame()}
  },
});
shell.addButton('Rematch',()=>{if(!send||!board)return;send('rematch');round++;newGame()});

function newGame(){
  board=Array.from({length:R},()=>Array(C).fill(-1));
  turn=round%2;over=false;winCells=[];render();
}
function play(col,who){
  if(over||turn!==who)return;
  let r=R-1;while(r>=0&&board[r][col]!==-1)r--;
  if(r<0)return;
  board[r][col]=who;
  winCells=check(r,col,who);
  if(winCells.length)over=who+1;else if(board.every(row=>row.every(x=>x!==-1)))over='draw';
  else turn=1-turn;
  render();
}
function check(r,c,w){
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
    const line=[[r,c]];
    for(const s of [1,-1]){let y=r+dr*s,x=c+dc*s;
      while(y>=0&&y<R&&x>=0&&x<C&&board[y][x]===w){line.push([y,x]);y+=dr*s;x+=dc*s}}
    if(line.length>=4)return line;
  }
  return [];
}
function render(){
  el.innerHTML='';
  el.classList.toggle('mine',!over&&turn===me);
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){
    const b=document.createElement('button');
    b.className='cell'+(board[r][c]>=0?' p'+board[r][c]:'')+(winCells.some(([y,x])=>y===r&&x===c)?' win':'');
    b.setAttribute('aria-label',`Column ${c+1}`);
    b.onclick=()=>{if(!over&&turn===me){send('move',{col:c});play(c,me)}};
    el.appendChild(b);
  }
  const dot=p=>`<span class=dot style="background:var(--p${p})"></span>`;
  gs().innerHTML=over==='draw'?'Draw!':over?`${dot(over-1)} ${over-1===me?'You win!':'Opponent wins'}`
    :turn===me?`${dot(me)} Your turn`:`${dot(turn)} Opponent's turn…`;
}
