import {initGame} from '../js/shell.js';
import {esc} from '../js/util.js';
// Ludo, peer-validated. Every browser holds the full game state and applies the same ordered actions.
// A player rolls with their own browser and broadcasts {seq, n}; then broadcasts {seq, piece}. Every receiver verifies the
// sender is the player whose turn it is and that the roll/move is legal; invalid messages are ignored.
// Colours are assigned from join order (host = red); with 2 players: red + yellow (opposite corners).
const $=id=>document.getElementById(id);
const COLN=['Red','Green','Yellow','Blue'],DIE='⚀⚁⚂⚃⚄⚅';

// ---- board geometry (15x15 grid) ----
const TRACK=[],add=(r,c)=>TRACK.push([r,c]);
for(let c=1;c<=5;c++)add(6,c);
for(let r=5;r>=0;r--)add(r,6);
add(0,7);add(0,8);
for(let r=1;r<=5;r++)add(r,8);
for(let c=9;c<=14;c++)add(6,c);
add(7,14);add(8,14);
for(let c=13;c>=9;c--)add(8,c);
for(let r=9;r<=14;r++)add(r,8);
add(14,7);add(14,6);
for(let r=13;r>=9;r--)add(r,6);
for(let c=5;c>=0;c--)add(8,c);
add(7,0);add(6,0);
const START=[0,13,26,39],SAFE=new Set([0,8,13,21,26,34,39,47]);
const HOME=[[1,2,3,4,5].map(c=>[7,c]),[1,2,3,4,5].map(r=>[r,7]),[13,12,11,10,9].map(c=>[7,c]),[13,12,11,10,9].map(r=>[r,7])];
const YARD=[[[2,2],[2,3],[3,2],[3,3]],[[2,11],[2,12],[3,11],[3,12]],[[11,11],[11,12],[12,11],[12,12]],[[11,2],[11,3],[12,2],[12,3]]]; // 2x2 homes
const TR=new Map(TRACK.map(([r,c],i)=>[r+','+c,i])),HM=new Map(HOME.flatMap((a,k)=>a.map(([r,c])=>[r+','+c,k])));
const SLOT=new Map(YARD.flatMap((a,k)=>a.map(([r,c])=>[r+','+c,k])));
const cellOf=(col,p,i)=>p<0?YARD[col][i]:p<=50?TRACK[(START[col]+p)%52]:p<56?HOME[col][p-51]:null;

// ---- game state ----
const STEP=260; // ms per square when a piece moves
let send,myPid,hostPid,G=null,ORDER=[],pend={};
let ov={},animQ=[],animating=false,animTimer=null,flashUntil=0,lastFlash=-1; // UI-only animation state
const legal=(P,n)=>[0,1,2,3].filter(i=>{const p=P.pos[i];return p===-1?n===6:p+n<=56});
const shell=initGame({
  name:'Ludo',max:3,
  rules:`<p>2–4 players. Colours are assigned automatically in join order (the host is red).</p>
  <p>On your turn press <b>Roll</b> in the centre of the board. You need a <b>6</b> to bring a piece out of the yard. Then click a glowing piece to move it that many squares clockwise. A 6 gives you another roll (three 6s in a row lose the turn).</p>
  <p>Landing on an opponent's piece sends it back to its yard — except on ★ squares and start squares, which are safe. After a full lap your piece turns into your coloured home column, and you need the <b>exact</b> number to reach the centre. First to bring all four pieces home wins.</p>
  <p>Every player's browser rolls their own die and checks everyone else's moves. If you have no legal move the turn passes automatically.</p>`,
  onStart:({send:s,pid,host,players})=>{
    send=s;myPid=pid;hostPid=host.pid;
    ORDER=[{pid:host.pid,name:host.name},...players.map(p=>({pid:p.pid,name:p.name}))];
    reset(true);drain();
  },
  onPlayerLeft:pid=>{send('left',{pid});remove(pid);render()}, // host only: tells everyone
  onMessage:(t,d,from)=>{
    if(t==='rematch'){reset();return}
    if(t==='left'){if(from===hostPid){remove(d.pid);render()}return}
    if(t==='roll'||t==='move'){pend[d.seq]=[t,d,from];drain()}
  },
  onEnd:()=>{G=null;pend={};ORDER=[]},
});
shell.addButton('Rematch',()=>{if(!send||!G)return;send('rematch',{});reset()});

function reset(keep){
  if(!keep)pend={};
  clearTimeout(animTimer);animQ=[];animating=false;ov={};lastFlash=-1;flashUntil=0;
  const n=ORDER.length,cols=n===2?[0,2]:[0,1,2,3];
  G={seq:0,turn:0,phase:'roll',roll:null,sixes:0,again:false,flash:null,over:null,log:'',
     players:ORDER.map((x,i)=>({pid:x.pid,name:x.name,col:cols[i],pos:[-1,-1,-1,-1]}))};
  render();
}
function remove(pid){
  if(!G)return;
  const i=G.players.findIndex(p=>p.pid===pid);if(i<0)return;
  const was=i===G.turn,name=G.players[i].name;
  G.players.splice(i,1);ORDER=ORDER.filter(x=>x.pid!==pid);G.log=`${name} left the game.`;
  if(G.players.length<2){G.phase='over';G.over=G.players[0]||null;return}
  if(i<G.turn)G.turn--;else if(was){G.turn%=G.players.length;G.phase='roll';G.roll=null;G.sixes=0;G.again=false}
}
function drain(){
  if(!G)return;
  while(pend[G.seq+1]){const [t,d,f]=pend[G.seq+1];delete pend[G.seq+1];const before=G.seq;apply(t,d,f);if(G.seq===before)break} // invalid: dropped
  if(G.flash&&G.flash.seq!==lastFlash){lastFlash=G.flash.seq;flashUntil=Date.now()+1300;setTimeout(render,1350)}
  runAnim();render();
}
function submit(t,d){const m={seq:G.seq+1,...d};send(t,m);pend[m.seq]=[t,m,myPid];drain()}

const nextTurn=()=>{G.turn=(G.turn+1)%G.players.length;G.phase='roll';G.roll=null;G.sixes=0;G.again=false};
function apply(t,d,from){
  if(G.phase==='over')return;
  const P=G.players[G.turn];if(!P||from!==P.pid)return;
  if(t==='roll'){
    if(G.phase!=='roll'||!Number.isInteger(d.n)||d.n<1||d.n>6)return;
    G.seq++;G.roll=d.n;G.again=false;G.flash=null;G.log=`${P.name} rolled ${d.n}.`;
    if(d.n===6){G.sixes++;if(G.sixes>=3){G.log+=' Three sixes in a row — turn lost.';G.flash={n:6,name:P.name,msg:'turn lost',seq:G.seq};nextTurn();return}}else G.sixes=0;
    if(legal(P,d.n).length)G.phase='move';
    else{
      G.log+=' No legal move.';G.flash={n:d.n,name:P.name,msg:'no move',seq:G.seq};
      if(d.n===6){G.phase='roll';G.roll=null;G.again=true}else nextTurn();
    }
  }else if(t==='move'){
    if(G.phase!=='move'||!legal(P,G.roll).includes(d.piece))return;
    G.seq++;
    const i=d.piece,n=G.roll,from=P.pos[i],np=from===-1?0:from+n,caps=[];P.pos[i]=np;
    G.log=`${P.name} rolled ${n}.`;
    if(np===56)G.log+=' A piece reached home!';
    else if(np<=50){
      const g=(START[P.col]+np)%52;
      if(!SAFE.has(g))G.players.forEach(Q=>{if(Q!==P)Q.pos.forEach((q,j)=>{if(q>=0&&q<=50&&(START[Q.col]+q)%52===g){caps.push({pid:Q.pid,j,pos:q});Q.pos[j]=-1;G.log+=` Captured ${Q.name}'s piece!`}})});
    }
    animQ.push({pid:P.pid,i,from,to:np,caps});
    if(P.pos.every(x=>x===56)){G.phase='over';G.over=P;return}
    if(n===6){G.phase='roll';G.roll=null;G.again=true}else nextTurn();
  }
}

// ---- UI ----
function runAnim(){ // hop the piece one square at a time; captured pieces stay visible until it lands
  if(animating||!animQ.length)return;
  const a=animQ.shift(),key=a.pid+':'+a.i;let q=a.from;
  animating=true;ov[key]=a.from;a.caps.forEach(c=>ov[c.pid+':'+c.j]=c.pos);render();
  const step=()=>{
    q=q===-1?0:q+1;ov[key]=q;render();
    if(q>=a.to){delete ov[key];a.caps.forEach(c=>delete ov[c.pid+':'+c.j]);animating=false;render();runAnim();return}
    animTimer=setTimeout(step,STEP);
  };
  animTimer=setTimeout(step,STEP);
}
const big=n=>`<b class="big">${n}${n===6?'!':''}</b>`;
function centre(P,mine){
  if(G.phase==='over')return `<b class="big">🏆</b><small>${G.over?esc(G.over.name):''}</small>`;
  if(G.flash&&Date.now()<flashUntil)return big(G.flash.n)+`<small>${G.flash.msg}</small>`;
  if(G.phase==='move')return big(G.roll)+`<small>${mine?'Pick a piece':'picking…'}</small>`;
  if(mine)return animating?'':`<button id="rollbtn" class="primary">${G.again?'6! Roll again':'🎲 Roll'}</button>`;
  return `<i style="background:var(--k${P.col})"></i><small>${G.again?'rolls again':'to roll'}</small>`;
}
// Size the board so every cell is a whole number of device pixels AND an exact multiple of 1/64 CSS px (the browser's
// layout unit). Otherwise rows drift by a device pixel here and there and a divider can look missing.
function fit(){
  const b=$('board'),d=window.devicePixelRatio||1,pad=2;
  const avail=Math.min(540,b.parentElement.clientWidth||window.innerWidth-48);
  let cell=Math.max(8,Math.floor((avail-2*pad)*d/15));
  for(let k=0;k<40&&cell-k>8;k++){const c=(cell-k)/d*64;if(Math.abs(c-Math.round(c))<1e-6){cell-=k;break}}
  b.style.setProperty('--c',(cell/d)+'px');
  b.style.setProperty('--p',pad+'px');
}
addEventListener('resize',()=>{if(G)fit()});
function render(){
  const g=$('gstatus');
  if(!G){g.textContent='Setting up…';return}
  fit();
  const P=G.players[G.turn],mine=!!P&&P.pid===myPid&&G.phase!=='over';
  g.textContent=G.phase==='over'?(G.over?`${G.over.name} wins! 🎉`:'Game over'):
    G.phase==='roll'?(mine?'Your turn — roll the dice':`${P.name}'s turn (${COLN[P.col]})`):
    (mine?'Pick a piece to move':`${P.name} is choosing a piece…`);
  $('log').textContent=G.log;
  $('plist').innerHTML=G.players.map((p,i)=>`<span class="pl${i===G.turn&&G.phase!=='over'?' cur':''}"><i style="background:var(--k${p.col})"></i>${esc(p.name)}${p.pid===myPid?' (you)':''} · ${p.pos.filter(x=>x===56).length}/4 home</span>`).join('');
  const sel=mine&&G.phase==='move'?legal(P,G.roll):[],by={};
  G.players.forEach(p=>p.pos.forEach((q,i)=>{
    const k=p.pid+':'+i,c=cellOf(p.col,ov[k]!==undefined?ov[k]:q,i);
    if(c)(by[c[0]+','+c[1]]=by[c[0]+','+c[1]]||[]).push([p,i]);
  }));
  let h=`<div id="centre"><div class="cc">${centre(P,mine)}</div></div>`;
  for(let r=0;r<15;r++)for(let c=0;c<15;c++){
    if(r>=6&&r<=8&&c>=6&&c<=8)continue; // centre is one element
    const k=r+','+c,ti=TR.get(k),hc=HM.get(k),yc=SLOT.get(k);
    let cls=ti!==undefined?'tr'+(START.includes(ti)?' st'+START.indexOf(ti):SAFE.has(ti)?' star':''):hc!==undefined?'hm hc'+hc
      :yc!==undefined?'yd yc'+yc:'blank';
    const ps=by[k]||[];if(ps.length>1)cls+=' multi';
    h+=`<div class="cell ${cls}">${ps.map(([p,i])=>`<button class="pc k${p.col}${p===P&&sel.includes(i)?' sel':''}" data-i="${i}" aria-label="${COLN[p.col]} piece"></button>`).join('')}</div>`;
  }
  $('board').innerHTML=h;
}
$('board').onclick=e=>{
  if(!G)return;
  const t=e.target.closest('#rollbtn,button.sel'),P=G.players[G.turn];
  if(!t||!P||P.pid!==myPid)return;
  if(t.id==='rollbtn'){if(G.phase==='roll'&&!animating)submit('roll',{n:1+Math.floor(Math.random()*6)})}
  else if(G.phase==='move')submit('move',{piece:+t.dataset.i});
};
