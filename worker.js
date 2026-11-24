import { DurableObject } from 'cloudflare:workers';
const enc = new TextEncoder(), dec = new TextDecoder();
const MAX_IMAGE = 2 * 1024 * 1024, TTL = 8 * 3600;
const safeHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
function reply(data,status=200,headers={}) {return new Response(JSON.stringify(data),{status,headers:{...safeHeaders,'Content-Type':'application/json; charset=utf-8',...headers}})}
function fail(message,status=400){return reply({error:message},status)}
function html(body,url){const wsOrigin=url.origin.replace(/^http/,'ws');return new Response(body,{headers:{...safeHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'self' "+wsOrigin+"; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}})}
function hex(b){return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
async function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(a))),y=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b)));let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
async function sign(s,env){const secret=await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(['roham-session-v1',env.MASTER_TOKEN,env.PANEL_PASSWORD])));const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(s)))}
async function session(env){const value=Math.floor(Date.now()/1000+TTL)+'.'+crypto.randomUUID();return value+'.'+await sign(value,env)}
async function verifiedExpiry(req,env) {
  const token=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)roham_session=([^;]+)/)?.[1];
  if (!token) return 0;
  const m=token.match(/^(\d{10})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/);
  if (!m) return 0;
  const expiry=Number(m[1])*1000, now=Date.now();
  if (expiry<=now||expiry>now+(TTL+1)*1000) return 0;
  return await equal(m[3],await sign(m[1]+'.'+m[2],env))?expiry:0;
}
const cookie=(value,age)=>'roham_session='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+age;
async function smallJSON(req){const r=req.body?.getReader();if(!r)throw Error('Body required');let total=0;const parts=[];try{while(true){const {done,value}=await r.read();if(done)break;total+=value.length;if(total>4096){await r.cancel();throw Error('Body too large')}parts.push(value)}const b=new Uint8Array(total);let pos=0;for(const p of parts){b.set(p,pos);pos+=p.length}return JSON.parse(dec.decode(b))}finally{r.releaseLock()}}
function validCommand(x){if(!x||typeof x!=='object')return false;const a=x.arg;switch(x.op){case 'status':case 'discover':case 'remove':case 'capture':case 'frame':return a===undefined;case 'register':return typeof a==='string'&&/^(?:[a-f0-9]{12}|\d{1,3}(?:\.\d{1,3}){3})$/i.test(a);case 'mode':return ['clock','camera','auto','off'].includes(a);case 'quality':return ['fast','hd'].includes(a);case 'gallery':return Number.isInteger(a)&&a>=0&&a<=0xffffffff&&a%32===0;case 'photo':case 'delete':return typeof a==='string'&&/^IMG\d{1,10}\.jpg$/.test(a);default:return false}}
const TELEMETRY_LIMIT = 768;
const TELEMETRY_STALE_MS = 20000;

function normalizeTelemetry(data) {
  if (!data || typeof data !== 'object') return null;
  const keys = ['heap','minHeap','largestHeap','rssi','uptime','cloudConnections','cloudRttMs'];
  const result = {};
  for (const key of keys) {
    if (!Number.isSafeInteger(data[key]) || (key !== 'rssi' && data[key] < 0)) return null;
    result[key] = data[key];
  }
  if (data.camera === null) {
    result.camera = null;
  } else {
    const camera = data.camera;
    if (typeof camera?.ip !== 'string' ||
        !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(camera.ip) ||
        camera.ip.split('.').some(n => Number(n) > 255) ||
        (camera.online !== null && typeof camera.online !== 'boolean')) return null;
    result.camera = {name:'EYE SKY',ip:camera.ip,online:camera.online};
  }
  return result;
}

export class RohamHub extends DurableObject {
  pending = null;

  master(exclude) {
    return this.ctx.getWebSockets('master').find(ws => ws !== exclude && ws.readyState === 1);
  }

  hubState(master = this.master()) {
    if (!master) return {type:'hub-state', state:'offline'};
    const attachment = master.deserializeAttachment();
    if (!attachment?.telemetry) return {type:'hub-state', state:'legacy'};
    if (!attachment.seenAt) return {type:'hub-state', state:'waiting'};
    const ageMs = Math.max(0, Date.now() - attachment.seenAt);
    return {
      type:'hub-state',
      state:ageMs >= TELEMETRY_STALE_MS ? 'stale' : 'live',
      seenAt:attachment.seenAt,
      ageMs,
      data:attachment.data
    };
  }

  broadcastState(state = this.hubState()) {
    const message = JSON.stringify(state);
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets('viewer')) {
      if (ws.readyState !== 1) continue;
      try {
        if (ws.deserializeAttachment().viewerUntil <= now) ws.close(4401, 'Sign in again');
        else ws.send(message);
      } catch {
        try { ws.close(1011, 'Status stream failed'); } catch {}
      }
    }
  }

  acceptMaster(req) {
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return fail('WebSocket required', 426);
    for (const ws of this.ctx.getWebSockets('master')) {
      this.finish(fail('Master reconnected', 503), ws);
      try { ws.close(1000, 'Replaced'); } catch {}
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, ['master']);
    server.serializeAttachment({telemetry:req.headers.get('X-Roham-Telemetry') === '1'});
    this.broadcastState(this.hubState(server));
    return new Response(null, {status:101,webSocket:client});
  }

  async serveStatus(req, path) {
    const expiry = await verifiedExpiry(req, this.env);
    if (!expiry) return fail('Unauthorized', 401);
    if (path === '/state') return reply(this.hubState());
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return fail('WebSocket required', 426);
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, ['viewer']);
    server.serializeAttachment({viewerUntil:expiry});
    server.send(JSON.stringify(this.hubState()));
    return new Response(null, {status:101,webSocket:client});
  }

  handleTelemetry(ws, value) {
    if (value.version !== 1 || ws !== this.master()) return;
    const data = normalizeTelemetry(value.data);
    if (!data) return;
    ws.serializeAttachment({telemetry:true,seenAt:Date.now(),data});
    this.broadcastState(this.hubState(ws));
  }

  async fetch(req){const path=new URL(req.url).pathname;
    if(path==='/login'){const data=await smallJSON(req).catch(()=>null);if(typeof data?.password!=='string'||data.password.length>512)return fail('Invalid password',400);const now=Date.now();const allowed=await this.ctx.storage.transaction(async t=>{let s=await t.get('loginLimit');if(!s||s.until<=now)s={n:0,until:now+300000};if(s.n>=5)return false;s.n++;await t.put('loginLimit',s);return true});if(!allowed)return fail('Too many attempts; retry in five minutes',429);if(!await equal(data.password,this.env.PANEL_PASSWORD))return fail('Invalid password',401);await this.ctx.storage.delete('loginLimit');return reply({ok:true},200,{'Set-Cookie':cookie(await session(this.env),TTL)});}
    if(path==='/master')return this.acceptMaster(req);
    if(path==='/live'||path==='/state')return this.serveStatus(req,path);
    if(path!=='/rpc')return fail('Not found',404);
    const data=await smallJSON(req).catch(()=>null);if(!validCommand(data))return fail('Invalid command');const ws=this.master();if(!ws)return fail('Master offline',503);if(this.pending)return fail('Master busy',409);
    return new Promise(resolve=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{if(this.pending?.id===id)this.finish(fail('Master timeout',504));},data.op==='photo'?45000:15000);this.pending={id,ws,resolve,timer,op:data.op,chunks:[],length:0,expected:0};try{ws.send(JSON.stringify({type:'request',id,op:data.op,...(data.arg===undefined?{}:{arg:data.arg})}));}catch{this.finish(fail('Master unavailable',503));}});
  }
  finish(response,ws){const p=this.pending;if(!p||(ws&&p.ws!==ws))return;this.pending=null;clearTimeout(p.timer);p.resolve(response);}
  webSocketMessage(ws,message){
    if(this.ctx.getTags(ws).includes('viewer')){
      ws.close(1008,'Read-only status stream');
      return;
    }
    const p=this.pending;
    if(typeof message==='string'){
      if(message==='ping'){try{ws.send('pong')}catch{}return}
      if(message.length>65536||((!p||p.ws!==ws)&&message.length>TELEMETRY_LIMIT))return;
      let m;
      try{m=JSON.parse(message)}catch{return}
      if(m?.type==='telemetry'){
        if(message.length<=TELEMETRY_LIMIT)this.handleTelemetry(ws,m);
        return;
      }
      if(!p||p.ws!==ws||m?.id!==p.id)return;
      if(m.type==='error'){this.finish(fail(typeof m.error==='string'?m.error.slice(0,250):'Device error',502));return}
      if(m.type==='result'&&!['frame','photo'].includes(p.op)){this.finish(reply(m.data??{}));return}
      if(m.type==='begin'&&['frame','photo'].includes(p.op)&&!p.expected&&Number.isInteger(m.size)&&m.size>=4&&m.size<=MAX_IMAGE){p.expected=m.size;return}
      if(m.type==='end'&&p.expected&&p.length===p.expected){const b=new Uint8Array(p.length);let offset=0;for(const c of p.chunks){b.set(c,offset);offset+=c.length}if(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217){this.finish(fail('Invalid JPEG',502));return}this.finish(new Response(b,{headers:{...safeHeaders,'Content-Type':'image/jpeg'}}));return}
      this.finish(fail('Invalid device response',502));return;
    }if(!p||p.ws!==ws||!p.expected)return;const b=new Uint8Array(message);if(b.length<37||dec.decode(b.subarray(0,36))!==p.id)return;const c=b.slice(36);if(c.length>16384||p.length+c.length>p.expected){this.finish(fail('Image too large',502));return}p.chunks.push(c);p.length+=c.length;
  }
  webSocketClose(ws,code){
    this.finish(fail('Master disconnected',503),ws);
    if(this.ctx.getTags(ws).includes('master'))this.broadcastState(this.hubState(this.master(ws)??null));
    try{ws.close(code>=1000&&code<5000&&![1004,1005,1006,1015].includes(code)?code:1000,'Closed')}catch{}
  }
  webSocketError(ws){
    this.finish(fail('Master disconnected',503),ws);
    if(this.ctx.getTags(ws).includes('master'))this.broadcastState(this.hubState(this.master(ws)??null));
    try{ws.close(1011,'Error')}catch{}
  }
}
export default {async fetch(req,env){try{if(!env.PANEL_PASSWORD||!env.MASTER_TOKEN||!env.ROHAM_HUB)return fail('Server configuration incomplete',503);const url=new URL(req.url),path=url.pathname;const stub=env.ROHAM_HUB.get(env.ROHAM_HUB.idFromName('master'));
  if(path==='/master'){if(req.method!=='GET'||!await equal(req.headers.get('Authorization'),'Bearer '+env.MASTER_TOKEN))return fail('Unauthorized',401);return stub.fetch(req);}
  if(path==='/'&&req.method==='GET')return html(await verifiedExpiry(req,env)?PANEL:LOGIN,url);
  if(req.method==='GET'&&path==='/state')return stub.fetch(req);
  if(req.method==='GET'&&path==='/live'){
    if(req.headers.get('Origin')!==url.origin)return fail('Forbidden',403);
    return stub.fetch(req);
  }
  if(req.method!=='POST')return fail('Not found',404);
  if(req.headers.get('Origin')!==url.origin||req.headers.get('X-Roham-Panel')!=='1')return fail('Forbidden',403);
  if(path==='/login')return stub.fetch(req);
  if(!await verifiedExpiry(req,env))return fail('Unauthorized',401);
  if(path==='/logout')return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
  if(path==='/rpc')return stub.fetch(req);
  return fail('Not found',404);
}catch{return fail('Server error',500)}}};
const CSS = `:root{color-scheme:dark;--mint:#8ce7d5;--muted:#a5b8cd}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 10% 0%,#17484e,transparent 50%),radial-gradient(ellipse at 90% 40%,#30274b,transparent 60%),#0b1524;color:#eef8ff;font:15px system-ui,sans-serif;min-height:100vh}main{max-width:760px;margin:auto;padding:25px 15px}header,.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.brand{direction:ltr;letter-spacing:3px;color:var(--mint);font-size:27px;font-weight:800}.glass{background:#ffffff0d;border:1px solid #ffffff25;border-radius:22px;padding:18px;margin:15px 0;box-shadow:0 15px 40px #0002;backdrop-filter:blur(14px)}h1,h2{font-size:19px;margin:0 0 12px}small,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stat{background:#ffffff09;padding:13px;border-radius:13px}.stat b{display:block;margin-top:6px;overflow-wrap:anywhere}button,input,a.btn{font:inherit;min-height:45px;border-radius:12px;padding:10px 14px;border:1px solid #ffffff30;background:#ffffff10;color:inherit}button,a.btn{cursor:pointer;text-align:center;text-decoration:none}button:disabled{opacity:.45;cursor:default}button.primary{background:var(--mint);color:#102927;font-weight:700}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--mint)}input{width:100%;direction:ltr}label{display:block;margin:12px 0 6px}.full{width:100%}nav{display:flex;gap:8px}nav button{flex:1}.view{aspect-ratio:4/3;background:#060c14;border-radius:16px;display:grid;place-items:center;overflow:hidden;margin:12px 0}.view img{width:100%;height:100%;object-fit:contain}img:not([src]){display:none}.danger{color:#ffc1c1}.file{padding:10px 0;border-bottom:1px solid #ffffff16}.file b{overflow-wrap:anywhere}.status{color:var(--mint);min-height:20px}footer{text-align:center;color:var(--muted);font-size:12px;margin:22px}[hidden]{display:none!important}.login{max-width:420px;margin:12vh auto}.login h1{margin-top:15px}`;
const LOGIN = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ROHAM OS · Login</title><style>${CSS}</style><main><section class="glass login"><div class="brand">ROHAM OS</div><small>PRIVATE CONTROL SYSTEM</small><h1>ورود به سرور مرکزی</h1><form id="login"><label for="pw">رمز عبور</label><input id="pw" type="password" autocomplete="current-password" required maxlength="512"><button class="primary full" style="margin-top:15px">ورود</button></form><p id="msg" role="status" class="status"></p></section></main><script>document.getElementById('login').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button'),m=document.getElementById('msg');b.disabled=true;try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify({password:document.getElementById('pw').value})});if(r.ok){location.reload();return}m.textContent=r.status===429?'تلاش بیش از حد؛ پنج دقیقه دیگر امتحان کن.':'ورود ناموفق است.'}catch{m.textContent='خطای ارتباط'}finally{b.disabled=false}};</script></html>`;
const PANEL = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ROHAM OS</title><style>${CSS}</style><main><header><div><div class="brand">ROHAM OS</div><small>PRIVATE CLOUD SYSTEM</small></div><button id="logout">خروج</button></header><nav><button id="home" class="primary">خانه</button><button id="devices">دستگاه‌ها</button></nav><p id="notice" class="status" role="status"></p><section id="dashboard"><div class="glass"><div class="row"><h1>سرور مرکزی</h1><b id="online">در انتظار اتصال</b></div><div class="grid"><div class="stat"><small>حافظه آزاد</small><b id="heap">—</b></div><div class="stat"><small>قدرت وای‌فای</small><b id="rssi">—</b></div><div class="stat"><small>زمان فعالیت</small><b id="uptime">—</b></div><div class="stat"><small>دستگاه ثبت شده</small><b id="count">—</b></div></div><p class="muted">آخرین دادهٔ هاب <b id="lastStatus">—</b></p><button id="refresh" class="full" style="margin-top:12px">تازه‌سازی وضعیت</button></div><div class="glass" id="cameraCard" hidden><h2>EYE SKY</h2><p id="cameraStatus" class="muted"></p><button id="openCam" class="primary full">ورود به پنل دوربین</button></div></section><section id="manager" hidden><div class="glass"><h2>افزودن دستگاه</h2><p class="muted">جست‌وجو فقط پس از فشردن دکمه آغاز می‌شود.</p><button id="discover" class="primary full">شروع جست‌وجو</button><div id="results"></div><form id="manual"><label for="ip">IP دستی دوربین (اختیاری)</label><input id="ip" placeholder="192.168.x.x"><button style="margin-top:10px" class="full">ثبت دستگاه</button></form><button id="remove" class="danger full" style="margin-top:14px">حذف دستگاه ثبت‌شده</button></div></section><section id="camera" hidden><div class="glass"><div class="row"><h2>EYE / SKY</h2><button id="back">بازگشت</button></div><div class="view"><img id="frame" alt="تصویر دوربین"><span id="hint">پخش زنده متوقف است</span></div><button id="live" class="primary full">شروع تصویر زنده</button><p class="muted">نمایش فریم‌های JPEG درخواستی؛ سرعت واقعی وابسته به شبکه و هاب است.</p><div class="grid"><button data-mode="clock">ساعت</button><button data-mode="camera">دوربین</button><button data-mode="auto">خودکار</button><button data-mode="off">OLED خاموش</button><button data-quality="fast">سرعت QVGA</button><button data-quality="hd">کیفیت VGA</button></div><button id="capture" class="primary full" style="margin-top:12px">ثبت عکس</button><button id="gallery" class="full" style="margin-top:10px">گالری کارت حافظه</button></div></section><section id="photos" hidden><div class="glass"><div class="row"><h2>گالری تصاویر</h2><button id="backCam">بازگشت به دوربین</button></div><div id="files"></div><div class="row"><button id="prev">قبلی</button><button id="next">بعدی</button></div><div id="photoBox" hidden><div class="view"><img id="photo" alt="عکس ذخیره‌شده"></div><a class="btn" id="download">دانلود عکس اصلی</a></div></div></section><footer>ROHAM OS · CLOUD 1.0</footer></main><script>
const $=id=>document.getElementById(id);let running=false,liveTask=null,busy=false,frameUrl='',photoUrl='',page=[0],next=null,hasCamera=false;const msg=t=>$('notice').textContent=t;
async function request(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify(body),cache:'no-store'});if(r.status===401){location.reload();throw Error('Session expired')}if(!r.ok){let d;try{d=await r.json()}catch{}throw Error(d?.error||'HTTP '+r.status)}return r}
async function rpc(op,arg){const r=await request('/rpc',arg===undefined?{op}:{op,arg});return ['frame','photo'].includes(op)?r.blob():r.json()}
function stop(){running=false;$('live').textContent='شروع تصویر زنده';$('frame').removeAttribute('src');$('hint').hidden=false;if(frameUrl){URL.revokeObjectURL(frameUrl);frameUrl=''}}
function clearPhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';$('photoBox').hidden=true;$('photo').removeAttribute('src');$('download').removeAttribute('href')}
function show(id){stop();clearPhoto();for(const p of ['dashboard','manager','camera','photos'])$(p).hidden=p!==id;$('home').classList.toggle('primary',id==='dashboard');$('devices').classList.toggle('primary',id!=='dashboard')}
async function action(fn){if(busy)return;busy=true;stop();try{if(liveTask)await liveTask;msg('در حال انجام…');await fn();}catch(e){msg('خطا: '+e.message)}finally{busy=false}}
let statusSocket=null, retryTimer=0, connectionTimer=0, staleTimer=0;
let statusAttempts=0, statusEpoch=0, paused=false, legacySeen=false;

function renderMetrics(s) {
  $('heap').textContent=Number.isFinite(s.heap)?Math.round(s.heap/1024)+' KB':'—';
  $('rssi').textContent=Number.isFinite(s.rssi)?s.rssi+' dBm':'—';
  $('uptime').textContent=Number.isFinite(s.uptime)?Math.floor(s.uptime/60)+' دقیقه':'—';
  hasCamera=!!s.camera;
  $('count').textContent=hasCamera?'۱':'۰';
  $('cameraCard').hidden=!hasCamera;
  $('cameraStatus').textContent=s.camera?.online===null?'در حال بررسی دوربین':s.camera?.online?'دوربین متصل':'دوربین آفلاین';
}

function applyHubState(message, loadLegacy=true) {
  if (message?.type!=='hub-state') return;
  ++statusEpoch;
  clearTimeout(staleTimer);
  if (message.data) {
    renderMetrics(message.data);
    $('lastStatus').textContent=new Date(message.seenAt).toLocaleTimeString('fa-IR');
  }
  switch(message.state) {
    case 'live':
      legacySeen=false;
      $('online').textContent='متصل · زنده';
      staleTimer=setTimeout(()=>{
        $('online').textContent='دادهٔ تازه نرسیده';
        verifySilentStream();
      },Math.max(0,${TELEMETRY_STALE_MS}-message.ageMs));
      break;
    case 'offline':
      legacySeen=false;
      $('online').textContent='ارتباط هاب قطع است';
      break;
    case 'stale':
      $('online').textContent='دادهٔ تازه نرسیده';
      break;
    case 'waiting':
      legacySeen=false;
      $('online').textContent='در انتظار دادهٔ هاب…';
      break;
    case 'legacy':
      if (!legacySeen) {
        legacySeen=true;
        $('online').textContent='متصل';
        if (loadLegacy&&!busy&&!liveTask&&!$('dashboard').hidden) status().catch(()=>{});
      }
      break;
  }
}

async function readHubState() {
  const response=await fetch('/state',{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if (response.status===401) {
    location.reload();
    throw Error('نشست ورود پایان یافت');
  }
  if (!response.ok) throw Error('وضعیت هاب در دسترس نیست');
  return response.json();
}

async function verifySilentStream() {
  const socket=statusSocket, epoch=statusEpoch;
  if (!socket) return;
  try {
    const snapshot=await readHubState();
    if (paused||statusSocket!==socket||epoch!==statusEpoch) return;
    applyHubState(snapshot);
    if (snapshot.state==='live') socket.close();
  } catch {
    if (!paused&&statusSocket===socket&&epoch===statusEpoch) socket.close();
  }
}

function retryStatusStream() {
  if (paused || retryTimer) return;
  const delay=Math.min(15000,750*2**Math.min(statusAttempts++,5));
  retryTimer=setTimeout(()=>{
    retryTimer=0;
    connectStatusStream();
  },delay+Math.random()*300);
  const epoch=statusEpoch;
  readHubState().then(state=>{
    if (!paused&&epoch===statusEpoch) applyHubState(state);
  }).catch(()=>{});
}

function connectStatusStream() {
  if (paused || statusSocket) return;
  const url=new URL('/live',location.href);
  url.protocol=location.protocol==='https:'?'wss:':'ws:';
  const socket=new WebSocket(url);
  statusSocket=socket;
  connectionTimer=setTimeout(()=>socket.close(),8000);
  socket.onmessage=e=>{
    if (statusSocket!==socket) return;
    let state;
    try { state=JSON.parse(e.data); } catch { return; }
    clearTimeout(connectionTimer);
    statusAttempts=0;
    applyHubState(state);
  };
  socket.onclose=e=>{
    if (statusSocket!==socket) return;
    statusSocket=null;
    clearTimeout(connectionTimer);
    if (e.code===4401) {
      location.reload();
      return;
    }
    clearTimeout(staleTimer);
    $('online').textContent='در حال اتصال دوباره به سایت…';
    retryStatusStream();
  };
}

function pauseStatusStream() {
  paused=true;
  clearTimeout(retryTimer);
  clearTimeout(connectionTimer);
  clearTimeout(staleTimer);
  retryTimer=0;
  const socket=statusSocket;
  statusSocket=null;
  socket?.close();
}

async function status(useSnapshot=false) {
  let epoch=statusEpoch;
  try {
    if (useSnapshot) {
      const state=await readHubState();
      if (epoch!==statusEpoch) return;
      applyHubState(state,false);
      if (state.state!=='legacy') return;
      epoch=statusEpoch;
    }
    const data=await rpc('status');
    if (epoch===statusEpoch) {
      renderMetrics(data);
      if (legacySeen) $('online').textContent='متصل';
    }
  } catch (error) {
    if (legacySeen && epoch===statusEpoch) $('online').textContent='وضعیت هاب در دسترس نیست';
    throw error;
  }
}
function refreshStatus(){return action(async()=>{await status(true);msg('')})}
$('home').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('devices').onclick=()=>show('manager');$('refresh').onclick=refreshStatus;$('openCam').onclick=()=>show('camera');$('back').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('logout').onclick=async()=>{stop();try{await request('/logout',{});pauseStatusStream();location.reload()}catch(e){msg(e.message)}};
async function register(a){await rpc('register',a);msg('دستگاه ثبت شد.');await status();show('dashboard')}
$('discover').onclick=()=>action(async()=>{const d=await rpc('discover');$('results').replaceChildren();for(const item of (Array.isArray(d.devices)?d.devices:[]).slice(0,16)){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=item.name||'EYE';const b=document.createElement('button');b.textContent='افزودن';b.onclick=()=>action(()=>register(item.id||item.ip));row.append(label,b);$('results').append(row)}msg($('results').children.length?'دستگاه را انتخاب کن.':'دستگاهی پیدا نشد.')});$('manual').onsubmit=e=>{e.preventDefault();action(()=>register($('ip').value.trim()))};$('remove').onclick=()=>{if(confirm('دوربین از فهرست حذف شود؟ عکس‌ها پاک نمی‌شوند.'))action(async()=>{await rpc('remove');await status()})};
async function liveLoop(){while(running&&!document.hidden){try{const b=await rpc('frame');if(!running)break;const u=URL.createObjectURL(b);$('frame').src=u;$('hint').hidden=true;if(frameUrl)URL.revokeObjectURL(frameUrl);frameUrl=u;await new Promise(r=>setTimeout(r,100))}catch(e){msg(e.message);stop()}}}
$('live').onclick=()=>{if(running){stop();return}if(busy||liveTask)return;running=true;$('live').textContent='توقف تصویر';liveTask=liveLoop().finally(()=>{liveTask=null})};document.querySelectorAll('[data-mode],[data-quality]').forEach(b=>b.onclick=()=>action(async()=>{await rpc(b.dataset.mode?'mode':'quality',b.dataset.mode||b.dataset.quality);msg('فرمان انجام شد.')}));$('capture').onclick=()=>action(async()=>{const r=await rpc('capture');msg(r.saved?'عکس ذخیره شد.':'فرمان عکاسی ارسال شد؛ گالری را بررسی کن.')});
async function gallery(){clearPhoto();const d=await rpc('gallery',page.at(-1));next=d.more?d.next:null;$('files').replaceChildren();for(const f of (d.files||[])){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=f.name+' · '+Math.round(f.size/1024)+' KB';const view=document.createElement('button');view.textContent='مشاهده';view.onclick=()=>action(async()=>{clearPhoto();photoUrl=URL.createObjectURL(await rpc('photo',f.name));$('photo').src=photoUrl;$('download').href=photoUrl;$('download').download=f.name;$('photoBox').hidden=false;msg('عکس آماده است.')});const del=document.createElement('button');del.className='danger';del.textContent='حذف';del.onclick=()=>{if(confirm('حذف دائمی '+f.name+'؟'))action(async()=>{await rpc('delete',f.name);page=[0];await gallery()})};row.append(label,view,del);$('files').append(row)}$('prev').disabled=page.length===1;$('next').disabled=next===null;msg('')}
$('gallery').onclick=()=>{show('photos');page=[0];action(gallery)};$('backCam').onclick=()=>show('camera');$('prev').onclick=()=>action(async()=>{if(page.length>1)page.pop();await gallery()});$('next').onclick=()=>action(async()=>{if(next!==null)page.push(next);await gallery()});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',()=>{stop();pauseStatusStream()});
window.addEventListener('pageshow',()=>{paused=false;connectStatusStream()});
window.addEventListener('online',()=>{
  if(paused)return;
  if(statusSocket)statusSocket.close();
  else if(!retryTimer)connectStatusStream();
});
connectStatusStream();
</script></html>`;
