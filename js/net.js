// Relaydo network layer: ephemeral, AES-GCM encrypted Nostr events over public relays.
// The invite link carries room id + secret key in the URL #fragment (never sent to any server).
import {schnorr} from 'https://esm.sh/@noble/curves@1.4.0/secp256k1';

export const RELAYS=['wss://relay.damus.io','wss://nos.lol','wss://relay.primal.net','wss://offchain.pub'];
const KIND=24242; // 20000-29999 = ephemeral: relays forward but don't store
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const sha=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));

export class Room{
  constructor(id,keyBytes,role){
    Object.assign(this,{id,keyBytes,role,handlers:[],seen:new Set(),socks:[],queue:[],closed:false});
    this.sk=rnd(32);this.pk=hex(schnorr.getPublicKey(this.sk)); // throwaway identity
    this.pid=hex(rnd(4));
  }
  static host(){return new Room(hex(rnd(8)),rnd(32),'host')}
  static fromInvite(link){
    const p=new URLSearchParams((link.includes('#')?link.split('#')[1]:link));
    if(!p.get('r')||!p.get('k'))throw new Error('Invalid invite');
    return new Room(p.get('r'),unb64(p.get('k')),'guest');
  }
  invite(){return location.origin+location.pathname+'#r='+this.id+'&k='+b64(this.keyBytes)}
  onMessage(fn){this.handlers.push(fn)}
  async connect(){
    this.key=await crypto.subtle.importKey('raw',this.keyBytes,'AES-GCM',false,['encrypt','decrypt']);
    RELAYS.forEach(u=>this._open(u));
  }
  _open(url){
    if(this.closed)return;
    let ws;try{ws=new WebSocket(url)}catch{return}
    this.socks.push(ws);
    ws.onopen=()=>{
      ws.send(JSON.stringify(['REQ','rx',{kinds:[KIND],'#r':[this.id],since:Math.floor(Date.now()/1000)-20}]));
      this.queue.forEach(m=>ws.send(m));this._status();
    };
    ws.onmessage=e=>this._recv(e.data);
    ws.onclose=ws.onerror=()=>{this.socks=this.socks.filter(s=>s!==ws);this._status();setTimeout(()=>this._open(url),4000)};
  }
  _status(){this.onStatus&&this.onStatus(this.socks.filter(s=>s.readyState===1).length)}
  async _recv(raw){
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m[0]!=='EVENT')return;
    const ev=m[2];
    if(!ev||this.seen.has(ev.id)||ev.pubkey===this.pk)return;
    this.seen.add(ev.id);
    try{
      const buf=unb64(ev.content);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:buf.slice(0,12)},this.key,buf.slice(12));
      const msg=JSON.parse(new TextDecoder().decode(plain));
      this.handlers.forEach(h=>h(msg.type,msg.data,msg.from));
    }catch{/* not for us / wrong key */}
  }
  async send(type,data={}){
    if(this.closed)return;
    const iv=rnd(12);
    const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},this.key,
      new TextEncoder().encode(JSON.stringify({type,data,from:this.pid,n:Math.random()}))));
    const content=b64(Uint8Array.from([...iv,...ct]));
    const ev={pubkey:this.pk,created_at:Math.floor(Date.now()/1000),kind:KIND,tags:[['r',this.id]],content};
    const id=await sha(JSON.stringify([0,ev.pubkey,ev.created_at,ev.kind,ev.tags,ev.content]));
    ev.id=hex(id);ev.sig=hex(schnorr.sign(id,this.sk));
    const frame=JSON.stringify(['EVENT',ev]);
    const open=this.socks.filter(s=>s.readyState===1);
    if(!open.length)this.queue.push(frame);else open.forEach(s=>s.send(frame));
    setTimeout(()=>{this.queue=this.queue.filter(f=>f!==frame)},15000);
  }
  close(){this.closed=true;this.socks.forEach(s=>{try{s.close()}catch{}})}
}
