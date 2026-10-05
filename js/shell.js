// Shared game page shell: toolbar, host/join lobby, handshake. Games only supply rules + gameplay.
// Options: max = number of guests the host accepts (1 = classic two-player game).
let Room;
async function loadNet(){if(!Room)({Room}=await import('./net.js'))}

export function initGame({name,rules,max=1,onStart,onMessage,onPlayerLeft,onEnd}){
  let room=null,peer=false,started=false,lastSeen=0,peers=new Map(),roster=[],seat=0;
  const multi=max>1;
  const $=id=>document.getElementById(id);
  const bar=$('bar');
  bar.appendChild(window.leftCluster('../'));
  const t=document.createElement('span');t.className='title';t.textContent=name;bar.appendChild(t);
  const actions=document.createElement('div');actions.className='actions';bar.appendChild(actions);
  const mk=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;if(cls)b.className=cls;actions.appendChild(b);return b};
  mk('Rules',()=>$('rules').showModal());
  const leaveBtn=mk('Leave',()=>leave());leaveBtn.disabled=true;
  $('rules').innerHTML=`<h3>${name} rules</h3>${rules}<form method=dialog><button class=primary>Got it</button></form>`;
  const nameBox=$('myname');
  if(nameBox)try{nameBox.value=localStorage.getItem('relaydo-name')||''}catch{}

  const status=s=>$('status').textContent=s;
  const notice=m=>{const d=document.createElement('dialog');d.innerHTML=`<p><b>${m}</b></p><form method=dialog><button class=primary>OK</button></form>`;document.body.appendChild(d);d.onclose=()=>d.remove();d.showModal()};
  const list=()=>[...peers.values()];
  const reset=(msg,note)=>{
    if(room){clearInterval(room.hb);clearInterval(room.hello);room.close();room=null}
    peer=started=false;peers=new Map();roster=[];seat=0;leaveBtn.disabled=true;
    $('lobby').classList.remove('hidden');$('game').classList.add('hidden');
    $('invite-box').classList.add('hidden');$('start').classList.add('hidden');
    $('choose').classList.remove('hidden');status(msg||'');
    history.replaceState(null,'',location.pathname);
    onEnd&&onEnd();
    if(note)notice(note);
  };
  function leave(){if(room){room.send('leave');setTimeout(()=>reset('You left the game.'),400)}else reset()}
  const hostStatus=()=>{
    if(!peers.size){status('Share the invite link, then wait here…');$('start').classList.add('hidden')}
    else{status(multi?`Players joined (${peers.size}/${max}): ${list().map(p=>p.name).join(', ')}`:'Opponent connected!');$('start').classList.remove('hidden')}
  };
  const guestStatus=()=>status(multi?`Connected. Players: ${roster.map(p=>p.name).join(', ')}. Waiting for the host to start…`:'Connected. Waiting for host to start…');

  function wire(){
    leaveBtn.disabled=false;$('choose').classList.add('hidden');
    room.onStatus=n=>$('relays').textContent=`Relays connected: ${n}/4`;
    room.onMessage((type,data,from)=>{
      lastSeen=Date.now();
      const host=room.role==='host';
      if(type==='hello'&&host){
        if(!peers.has(from)){
          if(started||peers.size>=max){room.send('full',{to:from,started});return}
          peers.set(from,{pid:from,name:((data&&data.name)||'').trim().slice(0,16)||`Player ${++seat}`});
          room.send('roster',{players:list()});
        }
        room.send('welcome',{to:from,players:list()});
        if(!started)hostStatus();
      }else if(type==='welcome'&&!host&&!peer&&data.to===room.pid){
        peer=true;room.hostPid=from;clearInterval(room.hello);roster=data.players||[];guestStatus();
      }else if(type==='roster'&&!host&&peer&&!started){roster=data.players||[];guestStatus()}
      else if(type==='full'&&!host&&data.to===room.pid){clearInterval(room.hello);reset(data.started?'This game has already started.':'This game is full.')}
      else if(type==='start'&&!host&&peer&&from===room.hostPid){roster=data.players||[];begin()}
      else if(type==='leave'){
        if(host){
          if(!peers.has(from))return;
          peers.delete(from);
          if(!multi){reset('Your opponent left the game.','Your opponent left the game.');return}
          room.send('roster',{players:list()});
          if(started)onPlayerLeft&&onPlayerLeft(from);else hostStatus();
        }else if(from===room.hostPid){
          const m=multi?'The host left the game.':'Your opponent left the game.';reset(m,m);
        }
      }
      else if(type==='ping'){}
      else if(peer||host)onMessage&&onMessage(type,data,from);
    });
    room.connect();
    lastSeen=Date.now();
    /* HEARTBEAT (disabled for now) - detects a closed tab or lost connection.
       Re-enable by uncommenting; consider a timeout much longer than 20s.
    room.hb=setInterval(()=>{
      if(!peer)return;
      room.send('ping');
      if(Date.now()-lastSeen>20000)reset('Your opponent disconnected.','Your opponent disconnected (no signal for 20 seconds).');
    },5000);
    */
  }
  function begin(){
    started=true;$('lobby').classList.add('hidden');$('game').classList.remove('hidden');
    onStart({role:room.role,send:(t,d)=>room.send(t,d),pid:room.pid,players:room.role==='host'?list():roster});
  }

  $('host').onclick=async()=>{
    try{await loadNet()}catch{status('Could not load the network library (check your internet connection / use a web server, not file://).');return}
    room=Room.host();wire();
    $('invite').value=room.invite();$('invite-box').classList.remove('hidden');
    hostStatus();
  };
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);$('copy').textContent='Copied'}catch{$('invite').select()}};
  $('start').onclick=()=>{room.send('start',{players:list()});begin()};
  const join=async link=>{
    try{await loadNet()}catch{status('Could not load the network library (check your internet connection / use a web server, not file://).');return}
    try{room=Room.fromInvite(link)}catch{status('That invite link is not valid.');return}
    if(nameBox)try{localStorage.setItem('relaydo-name',nameBox.value)}catch{}
    wire();status('Invite found. Connecting to host…');
    const r=room,hello=()=>room.send('hello',{name:nameBox?nameBox.value:''});
    setTimeout(()=>{if(room===r&&!peer)status('No answer from the host yet. Make sure the host still has the game page open, then try again.')},15000);
    room.hello=setInterval(hello,2000);
    setTimeout(hello,1200);
  };
  $('join').onclick=()=>join($('joinlink').value.trim());
  const auto=()=>{
    if(room||!location.hash.includes('r='))return;
    if(nameBox){$('joinlink').value=location.href;status('Invite found. Enter your name and press Join.');return}
    join(location.hash);
  };
  auto();
  addEventListener('hashchange',auto); // invite pasted into a tab that is already on this page
  addEventListener('pagehide',()=>room&&room.send('leave'));
  return {addButton:mk,status:s=>$('gstatus').textContent=s};
}
