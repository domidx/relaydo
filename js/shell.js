// Shared game page shell: toolbar, host/join lobby, handshake. Games only supply rules + gameplay.
let Room;
async function loadNet(){if(!Room)({Room}=await import('./net.js'))}

export function initGame({name,rules,onStart,onMessage,onEnd}){
  let room=null,peer=false,started=false,lastSeen=0;
  const $=id=>document.getElementById(id);
  const bar=$('bar');
  bar.appendChild(window.leftCluster('../'));
  const t=document.createElement('span');t.className='title';t.textContent=name;bar.appendChild(t);
  const actions=document.createElement('div');actions.className='actions';bar.appendChild(actions);
  const mk=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;if(cls)b.className=cls;actions.appendChild(b);return b};
  mk('Rules',()=>$('rules').showModal());
  const leaveBtn=mk('Leave',()=>leave());leaveBtn.disabled=true;
  $('rules').innerHTML=`<h3>${name} rules</h3>${rules}<form method=dialog><button class=primary>Got it</button></form>`;

  const status=s=>$('status').textContent=s;
  const notice=m=>{const d=document.createElement('dialog');d.innerHTML=`<p><b>${m}</b></p><form method=dialog><button class=primary>OK</button></form>`;document.body.appendChild(d);d.onclose=()=>d.remove();d.showModal()};
  const reset=(msg,note)=>{
    if(room){clearInterval(room.hb);clearInterval(room.hello);room.close();room=null}
    peer=started=false;leaveBtn.disabled=true;
    $('lobby').classList.remove('hidden');$('game').classList.add('hidden');
    $('invite-box').classList.add('hidden');$('start').classList.add('hidden');
    $('choose').classList.remove('hidden');status(msg||'');
    history.replaceState(null,'',location.pathname);
    onEnd&&onEnd();
    if(note)notice(note);
  };
  function leave(){if(room){room.send('leave');setTimeout(()=>reset('You left the game.'),400)}else reset()}

  function wire(){
    leaveBtn.disabled=false;$('choose').classList.add('hidden');
    room.onStatus=n=>$('relays').textContent=`Relays connected: ${n}/4`;
    room.onMessage((type,data,from)=>{
      lastSeen=Date.now();
      if(type==='hello'&&room.role==='host'){
        if(peer&&room.peerId!==from){room.send('full');return}
        room.peerId=from;room.send('welcome');
        if(!peer){peer=true;status('Opponent connected!');$('start').classList.remove('hidden');}
      }else if(type==='welcome'&&room.role==='guest'&&!peer){
        peer=true;clearInterval(room.hello);status('Connected. Waiting for host to start…');
      }else if(type==='full'&&room.role==='guest'){clearInterval(room.hello);reset('This game already has two players.')}
      else if(type==='start'&&room.role==='guest'){begin()}
      else if(type==='leave'){reset('Your opponent left the game.','Your opponent left the game.')}
      else if(type==='ping'){}
      else onMessage&&onMessage(type,data);
    });
    room.connect();
    lastSeen=Date.now();
    /* HEARTBEAT (disabled for now) - detects a closed tab or lost connection.
       Re-enable by uncommenting; consider a timeout much longer than 20s.
    room.hb=setInterval(()=>{ // heartbeat: detects a closed tab or lost connection
      if(!peer)return;
      room.send('ping');
      if(Date.now()-lastSeen>20000)reset('Your opponent disconnected.','Your opponent disconnected (no signal for 20 seconds).');
    },5000);
    */
  }
  function begin(){started=true;$('lobby').classList.add('hidden');$('game').classList.remove('hidden');onStart({role:room.role,send:(t,d)=>room.send(t,d)})}

  $('host').onclick=async()=>{
    try{await loadNet()}catch{status('Could not load the network library (check your internet connection / use a web server, not file://).');return}
    room=Room.host();wire();
    $('invite').value=room.invite();$('invite-box').classList.remove('hidden');
    status('Share the invite link with your opponent, then wait here…');
  };
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);$('copy').textContent='Copied'}catch{$('invite').select()}};
  $('start').onclick=()=>{room.send('start');begin()};
  const join=async link=>{
    try{await loadNet()}catch{status('Could not load the network library (check your internet connection / use a web server, not file://).');return}
    try{room=Room.fromInvite(link)}catch{status('That invite link is not valid.');return}
    wire();status('Invite found. Connecting to host…');
    const r=room;
    setTimeout(()=>{if(room===r&&!peer)status('No answer from the host yet. Make sure the host still has the game page open, then try again.')},15000);
    room.hello=setInterval(()=>room.send('hello'),2000);
    setTimeout(()=>room.send('hello'),1200);
  };
  $('join').onclick=()=>join($('joinlink').value.trim());
  const auto=()=>{if(!room&&location.hash.includes('r='))join(location.hash)};
  auto();
  addEventListener('hashchange',auto); // invite pasted into a tab that is already on this page
  addEventListener('pagehide',()=>room&&room.send('leave'));
  return {addButton:mk,status:s=>$('gstatus').textContent=s};
}
