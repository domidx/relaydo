// Shared theme handling (dark by default). Classic script: loaded in <head>, works everywhere.
(function(){
  var KEY='relaydo-theme',t='dark';
  try{t=localStorage.getItem(KEY)||'dark'}catch(e){}
  document.documentElement.dataset.theme=t;
  window.themeButton=function(){
    var b=document.createElement('button');
    function upd(){b.textContent=document.documentElement.dataset.theme==='dark'?'☀ Light':'☾ Dark'}
    b.onclick=function(){
      var n=document.documentElement.dataset.theme==='dark'?'light':'dark';
      document.documentElement.dataset.theme=n;try{localStorage.setItem(KEY,n)}catch(e){}upd();
    };
    upd();return b;
  };
  window.leftCluster=function(home){
    var d=document.createElement('div');d.className='left';
    var a=document.createElement('a');a.className='btn brand';a.href=home;a.textContent='⌂ Relaydo';a.title='Home';
    d.appendChild(a);d.appendChild(window.themeButton());return d;
  };
})();
