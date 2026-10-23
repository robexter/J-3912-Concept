// Atualização: altere CACHE_VERSION a cada publicação.
const CACHE_VERSION='j3912-concept-v1-2-2-fundamentos-accordion-mobile-20261023';
const CORE=['./','./index.html','./app.css','./app.js','./integrado.css','./integrado.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/icon.svg','./assets/tela-j3912.png','./assets/malha-completa-j3912.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION&&k.startsWith('j3912-concept')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
  if(r.mode==='navigate'||/\/(index\.html|app\.js|app\.css|integrado\.js|integrado\.css|manifest\.webmanifest)$/.test(new URL(r.url).pathname)){
    e.respondWith(fetch(r).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE_VERSION).then(c=>c.put(r,copy))}return resp}).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE_VERSION).then(c=>c.put(r,copy))}return resp})));
  }
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
