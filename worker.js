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
  // Optional v1.3 metrics; do not reject older v1.2 hubs.
  if (Number.isSafeInteger(data.heapTotal) && data.heapTotal > 0 && data.heapTotal >= data.heap) result.heapTotal=data.heapTotal;
  for (const key of ['cpuPct','cpu0','cpu1']) {
    if (Number.isInteger(data[key]) && data[key]>=0 && data[key]<=100) result[key]=data[key];
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
const CSS = `:root{color-scheme:dark;--bg:#0b0b0c;--panel:#151516;--line:#2a2a2d;--muted:#a0a0a5;--red:#ff4545;--white:#f5f5f4;--mint:#f5f5f4}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--white);font:15px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif;-webkit-font-smoothing:antialiased}main{max-width:1100px;margin:auto;padding:26px 20px 32px;display:grid;grid-template-columns:76px minmax(0,1fr);gap:16px;direction:ltr}main>*{direction:rtl;min-width:0}header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 18px;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:11px;color:#f6f6f4;direction:ltr;width:max-content}.brand svg{width:clamp(142px,25vw,230px);height:auto;display:block}.brandMark{width:7px;height:7px;border-radius:100%;background:var(--red)}.brandSub{font:11px/1.5 ui-monospace,monospace;letter-spacing:.12em;color:var(--muted);display:block;margin-top:8px;text-align:left;direction:ltr}.headClock{direction:ltr;text-align:left;display:flex;align-items:center;gap:16px}.headClock time{font:24px/1.2 ui-monospace,monospace;letter-spacing:-1px;font-variant-numeric:tabular-nums}.headClock small{display:block;font:10px/1.4 ui-monospace,monospace;margin-top:5px;letter-spacing:.06em}.ico{width:22px;height:22px;flex:none;vertical-align:middle}nav{grid-column:1;grid-row:2/7;align-self:start;display:grid;gap:8px;border:1px solid var(--line);background:#111112;border-radius:25px;padding:7px;position:sticky;top:12px}nav button{display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;padding:11px 1px;min-height:61px;background:transparent;border-color:transparent;border-radius:18px;font-size:10px;color:#bbb}nav button.primary{background:#303033;color:#fff;border-color:#3e3e40}#notice,section:not(.login),#metricsPanel,footer{grid-column:2}#notice{margin:0;min-height:0;color:#d7d7db}#notice:empty{display:none}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.glass,.stat,.metric,.deviceTile{background:var(--panel);border:1px solid var(--line);border-radius:23px;padding:17px;min-width:0}.glass{margin:0 0 12px}.glass:last-child{margin-bottom:0}h1,h2{font-size:18px;line-height:1.4;margin:0 0 12px;font-weight:650}.row h1,.row h2{margin:0}small,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stat{background:#1b1b1d;padding:12px;border-radius:15px}.stat b{display:block;margin-top:6px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.devicesGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.deviceTile{display:flex;flex-direction:column;gap:12px;min-height:132px}.deviceTile .ico{width:35px;height:35px;color:#d4d4d5}.tileTop{display:flex;justify-content:space-between;align-items:center;gap:8px}.tileTop h1,.tileTop h2{margin:0}.tileTop b{font-size:13px;font-weight:500}.deviceTile .muted{font-size:12px;margin:0}.signal{display:inline-flex;align-items:center;gap:6px;color:#c9c9cb;font-size:12px}.signal:before{content:"";width:7px;height:7px;border-radius:50%;background:#777}.signal[data-state="live"]:before,.signal[data-state="legacy"]:before{background:var(--red)}.signal[data-state="offline"]:before,.signal[data-state="stale"]:before{background:#777}.tileName{font:11px ui-monospace,monospace;letter-spacing:.12em;direction:ltr;text-align:right;color:var(--muted)}.last{margin:13px 0 0;font-size:12px}.last b{font-variant-numeric:tabular-nums}button,input,a.btn{font:inherit;min-height:44px;border-radius:14px;padding:9px 14px;border:1px solid #343438;background:#1d1d1f;color:inherit}button,a.btn{cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px}button:hover:not(:disabled),a.btn:hover{border-color:#76767b}button:active:not(:disabled){background:#303032}button:disabled{opacity:.45;cursor:default}button.primary{background:#ededeb;color:#111;border-color:#ededeb;font-weight:650}button.primary:active:not(:disabled){background:#bdbdbd}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--red);outline-offset:3px}input{width:100%;direction:ltr}label{display:block;margin:12px 0 6px}.full{width:100%}.power{width:45px;padding:0;border-radius:50%;background:transparent}.power .ico{width:20px;height:20px}.view{aspect-ratio:4/3;position:relative;background:#070708;border:1px solid #303033;border-radius:19px;display:grid;place-items:center;overflow:hidden;margin:14px 0}.view img{width:100%;height:100%;object-fit:contain;min-height:0;position:absolute;inset:0}.view img:not([src]){display:none}.liveLabel{position:absolute;z-index:1;top:12px;left:12px;background:#111c;border:1px solid #ffffff30;padding:4px 9px;border-radius:20px;color:#ddd;font:12px ui-monospace,monospace;display:flex;align-items:center;gap:6px}.liveLabel:before{content:"";width:7px;height:7px;border-radius:100%;background:#777}.liveLabel[data-live="1"]:before{background:var(--red)}.danger{color:#ff8282}.file{padding:10px 0;border-bottom:1px solid #ffffff16}.file b{overflow-wrap:anywhere}.status{font-size:13px}.metricHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}.metricHead small{font:11px ui-monospace,monospace;letter-spacing:.06em}.metricHead b{font-size:12px;font-weight:500;color:var(--muted)}.metricsGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{padding:16px;direction:ltr;text-align:left}.metric .label{font:13px/1.5 ui-monospace,monospace;color:#d6d6d8}.metric .value{font:26px/1.2 ui-monospace,monospace;letter-spacing:-1px;margin:6px 0 12px;display:block;white-space:nowrap}.cameraLayout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:15px;direction:ltr;align-items:start;margin-top:12px}.cameraLayout>*{direction:rtl;min-width:0}.cameraLayout .view{margin:0 0 10px}.cameraLayout .controlPane{display:flex;flex-direction:column;gap:9px}.cameraLayout .controlPane p{margin:0;font-size:12px}.deviceTile p{margin:0}.deviceTile .tileTop{min-height:48px}#cameraCard{margin-bottom:12px}.metric .sub{font-size:11px;color:var(--muted);direction:rtl;text-align:left;display:block;min-height:17px;margin-top:8px}.dots{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;height:12px;direction:ltr;align-items:center}.dots i{display:block;width:100%;max-width:6px;aspect-ratio:1;border-radius:50%;background:#38383a;transition:background .18s}.dots i.on{background:#f1f1ef}.dots.high i.on{background:var(--red)}.metricsGrid[data-stale="1"] .dots i.on{background:#777}.metricsGrid[data-stale="1"] .value{color:#999}.extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.extra .stat{display:flex;align-items:center;justify-content:space-between;gap:8px}.extra .stat b{margin:0;font:13px ui-monospace,monospace;direction:ltr}.controls{margin-top:10px}footer{text-align:center;color:#777;font:11px/1.5 ui-monospace,monospace;letter-spacing:.11em;margin:8px 0 0;direction:ltr}[hidden]{display:none!important}main:has(.login){display:block;max-width:440px;padding-top:12vh}.login{max-width:420px;margin:auto;padding:24px}.login h1{margin:28px 0 16px}.login .brand svg{width:220px}.login .brandSub{margin:10px 0}.login .status{min-height:20px}.sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){.cameraLayout{grid-template-columns:1fr;gap:10px}.cameraLayout .view{margin-bottom:6px}main{display:flex;flex-direction:column;padding:19px 14px 24px;gap:13px}header{padding:4px 0 13px}.headClock{gap:8px}.headClock time{font-size:19px}.headClock small{display:none}.brand svg{width:144px}.brandSub{font-size:9px;letter-spacing:.06em}.brandMark{width:5px;height:5px}.power{width:38px;min-height:38px}nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:static;padding:5px;border-radius:20px;width:100%;gap:4px}nav button{min-height:53px;padding:7px 2px;border-radius:15px}.deviceTile{padding:13px;border-radius:19px;min-height:120px}.deviceTile .ico{width:28px;height:28px}.tileTop h1,.tileTop h2{font-size:15px}.devicesGrid{gap:9px}.tileTop{flex-wrap:wrap}.glass{padding:14px;border-radius:20px}.metricsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{padding:13px;border-radius:18px}.metric:last-child{grid-column:1/-1}.metric .value{font-size:23px}.dots{gap:2px}.extra{gap:7px}.extra .stat{padding:9px;font-size:12px}.last{font-size:11px}.login .brand svg{width:200px}}
@media(max-width:350px){.brand svg{width:118px}.headClock time{font-size:16px}.metricsGrid{grid-template-columns:1fr}.metric:last-child{grid-column:auto}.devicesGrid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
const LOGIN = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ROHAM OS · Login</title><style>${CSS}</style><main><section class="glass login"><div class="brand" dir="ltr"><svg viewBox="0 0 46 7" role="img" aria-label="ROHAM OS" fill="currentColor"><circle cx="0.5" cy="0.5" r=".37"/><circle cx="1.5" cy="0.5" r=".37"/><circle cx="2.5" cy="0.5" r=".37"/><circle cx="3.5" cy="0.5" r=".37"/><circle cx="0.5" cy="1.5" r=".37"/><circle cx="4.5" cy="1.5" r=".37"/><circle cx="0.5" cy="2.5" r=".37"/><circle cx="4.5" cy="2.5" r=".37"/><circle cx="0.5" cy="3.5" r=".37"/><circle cx="1.5" cy="3.5" r=".37"/><circle cx="2.5" cy="3.5" r=".37"/><circle cx="3.5" cy="3.5" r=".37"/><circle cx="0.5" cy="4.5" r=".37"/><circle cx="2.5" cy="4.5" r=".37"/><circle cx="0.5" cy="5.5" r=".37"/><circle cx="3.5" cy="5.5" r=".37"/><circle cx="0.5" cy="6.5" r=".37"/><circle cx="4.5" cy="6.5" r=".37"/><circle cx="7.5" cy="0.5" r=".37"/><circle cx="8.5" cy="0.5" r=".37"/><circle cx="9.5" cy="0.5" r=".37"/><circle cx="6.5" cy="1.5" r=".37"/><circle cx="10.5" cy="1.5" r=".37"/><circle cx="6.5" cy="2.5" r=".37"/><circle cx="10.5" cy="2.5" r=".37"/><circle cx="6.5" cy="3.5" r=".37"/><circle cx="10.5" cy="3.5" r=".37"/><circle cx="6.5" cy="4.5" r=".37"/><circle cx="10.5" cy="4.5" r=".37"/><circle cx="6.5" cy="5.5" r=".37"/><circle cx="10.5" cy="5.5" r=".37"/><circle cx="7.5" cy="6.5" r=".37"/><circle cx="8.5" cy="6.5" r=".37"/><circle cx="9.5" cy="6.5" r=".37"/><circle cx="12.5" cy="0.5" r=".37"/><circle cx="16.5" cy="0.5" r=".37"/><circle cx="12.5" cy="1.5" r=".37"/><circle cx="16.5" cy="1.5" r=".37"/><circle cx="12.5" cy="2.5" r=".37"/><circle cx="16.5" cy="2.5" r=".37"/><circle cx="12.5" cy="3.5" r=".37"/><circle cx="13.5" cy="3.5" r=".37"/><circle cx="14.5" cy="3.5" r=".37"/><circle cx="15.5" cy="3.5" r=".37"/><circle cx="16.5" cy="3.5" r=".37"/><circle cx="12.5" cy="4.5" r=".37"/><circle cx="16.5" cy="4.5" r=".37"/><circle cx="12.5" cy="5.5" r=".37"/><circle cx="16.5" cy="5.5" r=".37"/><circle cx="12.5" cy="6.5" r=".37"/><circle cx="16.5" cy="6.5" r=".37"/><circle cx="19.5" cy="0.5" r=".37"/><circle cx="20.5" cy="0.5" r=".37"/><circle cx="21.5" cy="0.5" r=".37"/><circle cx="18.5" cy="1.5" r=".37"/><circle cx="22.5" cy="1.5" r=".37"/><circle cx="18.5" cy="2.5" r=".37"/><circle cx="22.5" cy="2.5" r=".37"/><circle cx="18.5" cy="3.5" r=".37"/><circle cx="19.5" cy="3.5" r=".37"/><circle cx="20.5" cy="3.5" r=".37"/><circle cx="21.5" cy="3.5" r=".37"/><circle cx="22.5" cy="3.5" r=".37"/><circle cx="18.5" cy="4.5" r=".37"/><circle cx="22.5" cy="4.5" r=".37"/><circle cx="18.5" cy="5.5" r=".37"/><circle cx="22.5" cy="5.5" r=".37"/><circle cx="18.5" cy="6.5" r=".37"/><circle cx="22.5" cy="6.5" r=".37"/><circle cx="24.5" cy="0.5" r=".37"/><circle cx="28.5" cy="0.5" r=".37"/><circle cx="24.5" cy="1.5" r=".37"/><circle cx="25.5" cy="1.5" r=".37"/><circle cx="27.5" cy="1.5" r=".37"/><circle cx="28.5" cy="1.5" r=".37"/><circle cx="24.5" cy="2.5" r=".37"/><circle cx="26.5" cy="2.5" r=".37"/><circle cx="28.5" cy="2.5" r=".37"/><circle cx="24.5" cy="3.5" r=".37"/><circle cx="26.5" cy="3.5" r=".37"/><circle cx="28.5" cy="3.5" r=".37"/><circle cx="24.5" cy="4.5" r=".37"/><circle cx="28.5" cy="4.5" r=".37"/><circle cx="24.5" cy="5.5" r=".37"/><circle cx="28.5" cy="5.5" r=".37"/><circle cx="24.5" cy="6.5" r=".37"/><circle cx="28.5" cy="6.5" r=".37"/><circle cx="35.5" cy="0.5" r=".37"/><circle cx="36.5" cy="0.5" r=".37"/><circle cx="37.5" cy="0.5" r=".37"/><circle cx="34.5" cy="1.5" r=".37"/><circle cx="38.5" cy="1.5" r=".37"/><circle cx="34.5" cy="2.5" r=".37"/><circle cx="38.5" cy="2.5" r=".37"/><circle cx="34.5" cy="3.5" r=".37"/><circle cx="38.5" cy="3.5" r=".37"/><circle cx="34.5" cy="4.5" r=".37"/><circle cx="38.5" cy="4.5" r=".37"/><circle cx="34.5" cy="5.5" r=".37"/><circle cx="38.5" cy="5.5" r=".37"/><circle cx="35.5" cy="6.5" r=".37"/><circle cx="36.5" cy="6.5" r=".37"/><circle cx="37.5" cy="6.5" r=".37"/><circle cx="41.5" cy="0.5" r=".37"/><circle cx="42.5" cy="0.5" r=".37"/><circle cx="43.5" cy="0.5" r=".37"/><circle cx="44.5" cy="0.5" r=".37"/><circle cx="40.5" cy="1.5" r=".37"/><circle cx="40.5" cy="2.5" r=".37"/><circle cx="41.5" cy="3.5" r=".37"/><circle cx="42.5" cy="3.5" r=".37"/><circle cx="43.5" cy="3.5" r=".37"/><circle cx="44.5" cy="4.5" r=".37"/><circle cx="44.5" cy="5.5" r=".37"/><circle cx="40.5" cy="6.5" r=".37"/><circle cx="41.5" cy="6.5" r=".37"/><circle cx="42.5" cy="6.5" r=".37"/><circle cx="43.5" cy="6.5" r=".37"/></svg><span class="brandMark" aria-hidden="true"></span></div><small class="brandSub">PRIVATE CONTROL SYSTEM</small><h1>ورود به سرور مرکزی</h1><form id="login"><label for="pw">رمز عبور</label><input id="pw" type="password" autocomplete="current-password" required maxlength="512"><button class="primary full" style="margin-top:15px">ورود</button></form><p id="msg" role="status" class="status"></p></section></main><script>document.getElementById('login').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button'),m=document.getElementById('msg');b.disabled=true;try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify({password:document.getElementById('pw').value})});if(r.ok){location.reload();return}m.textContent=r.status===429?'تلاش بیش از حد؛ پنج دقیقه دیگر امتحان کن.':'ورود ناموفق است.'}catch{m.textContent='خطای ارتباط'}finally{b.disabled=false}};</script></html>`;
const PANEL = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ROHAM OS</title><style>${CSS}</style><main><header><div><div class="brand" dir="ltr"><svg viewBox="0 0 46 7" role="img" aria-label="ROHAM OS" fill="currentColor"><circle cx="0.5" cy="0.5" r=".37"/><circle cx="1.5" cy="0.5" r=".37"/><circle cx="2.5" cy="0.5" r=".37"/><circle cx="3.5" cy="0.5" r=".37"/><circle cx="0.5" cy="1.5" r=".37"/><circle cx="4.5" cy="1.5" r=".37"/><circle cx="0.5" cy="2.5" r=".37"/><circle cx="4.5" cy="2.5" r=".37"/><circle cx="0.5" cy="3.5" r=".37"/><circle cx="1.5" cy="3.5" r=".37"/><circle cx="2.5" cy="3.5" r=".37"/><circle cx="3.5" cy="3.5" r=".37"/><circle cx="0.5" cy="4.5" r=".37"/><circle cx="2.5" cy="4.5" r=".37"/><circle cx="0.5" cy="5.5" r=".37"/><circle cx="3.5" cy="5.5" r=".37"/><circle cx="0.5" cy="6.5" r=".37"/><circle cx="4.5" cy="6.5" r=".37"/><circle cx="7.5" cy="0.5" r=".37"/><circle cx="8.5" cy="0.5" r=".37"/><circle cx="9.5" cy="0.5" r=".37"/><circle cx="6.5" cy="1.5" r=".37"/><circle cx="10.5" cy="1.5" r=".37"/><circle cx="6.5" cy="2.5" r=".37"/><circle cx="10.5" cy="2.5" r=".37"/><circle cx="6.5" cy="3.5" r=".37"/><circle cx="10.5" cy="3.5" r=".37"/><circle cx="6.5" cy="4.5" r=".37"/><circle cx="10.5" cy="4.5" r=".37"/><circle cx="6.5" cy="5.5" r=".37"/><circle cx="10.5" cy="5.5" r=".37"/><circle cx="7.5" cy="6.5" r=".37"/><circle cx="8.5" cy="6.5" r=".37"/><circle cx="9.5" cy="6.5" r=".37"/><circle cx="12.5" cy="0.5" r=".37"/><circle cx="16.5" cy="0.5" r=".37"/><circle cx="12.5" cy="1.5" r=".37"/><circle cx="16.5" cy="1.5" r=".37"/><circle cx="12.5" cy="2.5" r=".37"/><circle cx="16.5" cy="2.5" r=".37"/><circle cx="12.5" cy="3.5" r=".37"/><circle cx="13.5" cy="3.5" r=".37"/><circle cx="14.5" cy="3.5" r=".37"/><circle cx="15.5" cy="3.5" r=".37"/><circle cx="16.5" cy="3.5" r=".37"/><circle cx="12.5" cy="4.5" r=".37"/><circle cx="16.5" cy="4.5" r=".37"/><circle cx="12.5" cy="5.5" r=".37"/><circle cx="16.5" cy="5.5" r=".37"/><circle cx="12.5" cy="6.5" r=".37"/><circle cx="16.5" cy="6.5" r=".37"/><circle cx="19.5" cy="0.5" r=".37"/><circle cx="20.5" cy="0.5" r=".37"/><circle cx="21.5" cy="0.5" r=".37"/><circle cx="18.5" cy="1.5" r=".37"/><circle cx="22.5" cy="1.5" r=".37"/><circle cx="18.5" cy="2.5" r=".37"/><circle cx="22.5" cy="2.5" r=".37"/><circle cx="18.5" cy="3.5" r=".37"/><circle cx="19.5" cy="3.5" r=".37"/><circle cx="20.5" cy="3.5" r=".37"/><circle cx="21.5" cy="3.5" r=".37"/><circle cx="22.5" cy="3.5" r=".37"/><circle cx="18.5" cy="4.5" r=".37"/><circle cx="22.5" cy="4.5" r=".37"/><circle cx="18.5" cy="5.5" r=".37"/><circle cx="22.5" cy="5.5" r=".37"/><circle cx="18.5" cy="6.5" r=".37"/><circle cx="22.5" cy="6.5" r=".37"/><circle cx="24.5" cy="0.5" r=".37"/><circle cx="28.5" cy="0.5" r=".37"/><circle cx="24.5" cy="1.5" r=".37"/><circle cx="25.5" cy="1.5" r=".37"/><circle cx="27.5" cy="1.5" r=".37"/><circle cx="28.5" cy="1.5" r=".37"/><circle cx="24.5" cy="2.5" r=".37"/><circle cx="26.5" cy="2.5" r=".37"/><circle cx="28.5" cy="2.5" r=".37"/><circle cx="24.5" cy="3.5" r=".37"/><circle cx="26.5" cy="3.5" r=".37"/><circle cx="28.5" cy="3.5" r=".37"/><circle cx="24.5" cy="4.5" r=".37"/><circle cx="28.5" cy="4.5" r=".37"/><circle cx="24.5" cy="5.5" r=".37"/><circle cx="28.5" cy="5.5" r=".37"/><circle cx="24.5" cy="6.5" r=".37"/><circle cx="28.5" cy="6.5" r=".37"/><circle cx="35.5" cy="0.5" r=".37"/><circle cx="36.5" cy="0.5" r=".37"/><circle cx="37.5" cy="0.5" r=".37"/><circle cx="34.5" cy="1.5" r=".37"/><circle cx="38.5" cy="1.5" r=".37"/><circle cx="34.5" cy="2.5" r=".37"/><circle cx="38.5" cy="2.5" r=".37"/><circle cx="34.5" cy="3.5" r=".37"/><circle cx="38.5" cy="3.5" r=".37"/><circle cx="34.5" cy="4.5" r=".37"/><circle cx="38.5" cy="4.5" r=".37"/><circle cx="34.5" cy="5.5" r=".37"/><circle cx="38.5" cy="5.5" r=".37"/><circle cx="35.5" cy="6.5" r=".37"/><circle cx="36.5" cy="6.5" r=".37"/><circle cx="37.5" cy="6.5" r=".37"/><circle cx="41.5" cy="0.5" r=".37"/><circle cx="42.5" cy="0.5" r=".37"/><circle cx="43.5" cy="0.5" r=".37"/><circle cx="44.5" cy="0.5" r=".37"/><circle cx="40.5" cy="1.5" r=".37"/><circle cx="40.5" cy="2.5" r=".37"/><circle cx="41.5" cy="3.5" r=".37"/><circle cx="42.5" cy="3.5" r=".37"/><circle cx="43.5" cy="3.5" r=".37"/><circle cx="44.5" cy="4.5" r=".37"/><circle cx="44.5" cy="5.5" r=".37"/><circle cx="40.5" cy="6.5" r=".37"/><circle cx="41.5" cy="6.5" r=".37"/><circle cx="42.5" cy="6.5" r=".37"/><circle cx="43.5" cy="6.5" r=".37"/></svg><span class="brandMark" aria-hidden="true"></span></div><small class="brandSub">PRIVATE CLOUD SYSTEM</small></div><div class="headClock"><div><time id="wallClock">--:--</time><small>LOCAL TIME</small></div><button id="logout" class="power" aria-label="خروج" title="خروج"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10M6 5a9 9 0 1 0 12 0"/></svg></button></div></header><nav aria-label="ناوبری"><button id="home" class="primary"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>خانه</button><button id="devices"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/></svg>دستگاه‌ها</button><button id="navCam" disabled><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 9 4-3v12l-4-3"/></svg>دوربین</button><button id="navGallery" disabled><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>گالری</button></nav><p id="notice" class="status" role="status"></p><section id="dashboard"><div class="devicesGrid"><div class="deviceTile"><div class="tileTop"><div><span class="tileName">HUB / ESP32</span><h1>سرور مرکزی</h1></div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/></svg></div><b id="online" class="signal" data-state="waiting">در انتظار اتصال</b><p class="muted">آخرین داده: <b id="lastStatus">—</b></p></div></div><button id="refresh" class="full" style="margin-top:12px"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7a9 9 0 0 0-15-1L3 9m0-5v5h5M4 17a9 9 0 0 0 15 1l2-3m0 5v-5h-5"/></svg> تازه‌سازی وضعیت</button></section><section id="manager" hidden><div class="glass"><h2>افزودن دستگاه</h2><p class="muted">جست‌وجو فقط پس از فشردن دکمه آغاز می‌شود.</p><button id="discover" class="primary full">شروع جست‌وجو</button><div id="results"></div><form id="manual"><label for="ip">IP دستی دوربین (اختیاری)</label><input id="ip" placeholder="192.168.x.x"><button style="margin-top:10px" class="full">ثبت دستگاه</button></form><button id="remove" class="danger full" style="margin-top:14px">حذف دستگاه ثبت‌شده</button></div></section><section id="camera" hidden><div class="deviceTile" id="cameraCard" hidden><div class="tileTop"><div><span class="tileName">CAMERA / EYE SKY</span><h2>دوربین</h2></div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 9 4-3v12l-4-3"/></svg></div><p id="cameraStatus" class="signal">در انتظار داده</p><p id="cameraAddress" class="tileName">—</p></div><div class="glass"><div class="row"><h2>EYE / SKY</h2><button id="back" hidden>بازگشت</button></div><div class="cameraLayout"><div class="previewPane"><div class="view"><span class="liveLabel" id="liveLabel" data-live="0">STANDBY</span><img id="frame" alt="تصویر دوربین"><span id="hint">پخش زنده متوقف است</span></div><button id="live" class="primary full">شروع تصویر زنده</button></div><div class="controlPane"><p class="muted">نمایش فریم‌های JPEG درخواستی؛ سرعت واقعی وابسته به شبکه و هاب است.</p><div class="grid"><button data-mode="clock">ساعت</button><button data-mode="camera">دوربین</button><button data-mode="auto">خودکار</button><button data-mode="off">OLED خاموش</button><button data-quality="fast">سرعت QVGA</button><button data-quality="hd">کیفیت VGA</button></div><button id="capture" class="primary full" style="margin-top:12px"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3"/></svg> ثبت عکس</button><button id="gallery" class="full" style="margin-top:10px">گالری کارت حافظه</button></div></div></div></section><section id="photos" hidden><div class="glass"><div class="row"><h2>گالری تصاویر</h2><button id="backCam">بازگشت به دوربین</button></div><div id="files"></div><div class="row"><button id="prev">قبلی</button><button id="next">بعدی</button></div><div id="photoBox" hidden><div class="view"><img id="photo" alt="عکس ذخیره‌شده"></div><a class="btn" id="download">دانلود عکس اصلی</a></div></div></section><section id="metricsPanel" aria-label="شاخص‌های هاب"><div class="metricHead"><small>SYSTEM / TELEMETRY</small><b id="metricFresh">در انتظار داده</b></div><div class="metricsGrid" id="metricsGrid" data-stale="1"><div class="metric"><span class="label">CPU</span><b class="value" id="cpu">—</b><div class="dots" id="cpuBar" role="meter" aria-label="مصرف پردازنده" aria-valuemin="0" aria-valuemax="100" aria-valuetext="ناموجود"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div><small class="sub" id="cores">میانگین هسته‌ها</small></div><div class="metric"><span class="label">Memory</span><b class="value" id="ramUsed">—</b><div class="dots" id="ramBar" role="meter" aria-label="مصرف حافظه" aria-valuemin="0" aria-valuemax="100" aria-valuetext="ناموجود"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div><small class="sub" id="ramDetail" style="direction:ltr">Heap آزاد / کل</small></div><div class="metric"><span class="label">Uptime</span><b class="value" id="uptime">—</b><small class="sub">زمان فعالیت هاب</small></div></div><div class="extra"><div class="stat"><small><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01"/></svg> قدرت وای‌فای</small><b id="rssi">—</b></div><div class="stat"><small><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/></svg> حافظه آزاد</small><b id="heap">—</b></div><div class="stat"><small>تأخیر دیتاسنتر</small><b id="rtt">—</b></div><div class="stat"><small>دستگاه ثبت‌شده</small><b id="count">—</b></div></div></section><footer>ROHAM OS / NOTHING · CLOUD 1.3.1</footer></main><script>
const $=id=>document.getElementById(id);let running=false,liveTask=null,busy=false,frameUrl='',photoUrl='',page=[0],next=null,hasCamera=false,activePage='dashboard';const msg=t=>$('notice').textContent=t;

function wallTime(){const t=new Date();$('wallClock').textContent=t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}
wallTime();setInterval(wallTime,1000);
function drawDots(id, value){const el=$(id),valid=Number.isFinite(value)&&value>=0&&value<=100;const n=valid?Math.round(value*el.children.length/100):0;for(let i=0;i<el.children.length;i++)el.children[i].classList.toggle('on',i<n);el.classList.toggle('high',valid&&value>=85);if(valid){el.setAttribute('aria-valuenow',String(value));el.setAttribute('aria-valuetext',String(value)+'%')}else{el.removeAttribute('aria-valuenow');el.setAttribute('aria-valuetext','ناموجود')}}
function markMetrics(state){$('metricsGrid').dataset.stale=state==='live'?'0':'1';$('metricFresh').textContent=state==='live'?'داده زنده':state==='legacy'?'آخرین نمونهٔ دستی':state==='offline'?'هاب آفلاین':state==='waiting'?'در انتظار داده':'داده قدیمی / در حال اتصال';$('online').dataset.state=state;}
function formatUptime(sec){if(!Number.isFinite(sec)||sec<0)return '—';const t=Math.floor(sec),p=n=>String(n).padStart(2,'0');return p(Math.floor(t/3600))+':'+p(Math.floor(t/60)%60)+':'+p(t%60)}
function renderMeters(s){const validCpu=Number.isInteger(s.cpuPct)&&s.cpuPct>=0&&s.cpuPct<=100;const total=Number.isFinite(s.heapTotal)&&s.heapTotal>0?s.heapTotal:null;const free=Number.isFinite(s.heap)&&s.heap>=0?s.heap:null;const validRam=total!==null&&free!==null&&free<=total;const percent=validRam?Math.round(100*(total-free)/total):null;$('cpu').textContent=validCpu?s.cpuPct+'%':'—';drawDots('cpuBar',validCpu?s.cpuPct:null);const cores=[s.cpu0,s.cpu1].map((v,i)=>Number.isInteger(v)&&v>=0&&v<=100?'C'+i+' '+v+'%':null).filter(Boolean);$('cores').textContent=cores.length?cores.join(' · '):'نمونه‌برداری CPU ناموجود';$('ramUsed').textContent=validRam?percent+'%':'—';drawDots('ramBar',percent);$('ramDetail').textContent=validRam?'Free '+Math.round(free/1024)+' / '+Math.round(total/1024)+' KB':free!==null?'Free '+Math.round(free/1024)+' KB · total unavailable':'در انتظار دادهٔ حافظه';$('heap').textContent=free!==null?Math.round(free/1024)+' KB':'—';$('rssi').textContent=Number.isFinite(s.rssi)?s.rssi+' dBm':'—';$('rtt').textContent=Number.isFinite(s.cloudRttMs)&&s.cloudRttMs>0?s.cloudRttMs+' ms':'—';$('uptime').textContent=formatUptime(s.uptime);hasCamera=!!s.camera;$('count').textContent=hasCamera?'۱':'۰';$('cameraCard').hidden=!hasCamera;$('navCam').disabled=!hasCamera;$('navGallery').disabled=!hasCamera;$('cameraAddress').textContent=s.camera?.ip||'—';$('cameraStatus').textContent=s.camera?.online===null?'در حال بررسی دوربین':s.camera?.online?'دوربین متصل':'دوربین آفلاین';$('cameraStatus').dataset.state=s.camera?.online?'live':'offline';if(!hasCamera&&(activePage==='camera'||activePage==='photos'))show('dashboard');}

async function request(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify(body),cache:'no-store'});if(r.status===401){location.reload();throw Error('Session expired')}if(!r.ok){let d;try{d=await r.json()}catch{}throw Error(d?.error||'HTTP '+r.status)}return r}
async function rpc(op,arg){const r=await request('/rpc',arg===undefined?{op}:{op,arg});return ['frame','photo'].includes(op)?r.blob():r.json()}
function stop(){running=false;$('liveLabel').textContent='STANDBY';$('liveLabel').dataset.live='0';$('live').textContent='شروع تصویر زنده';$('frame').removeAttribute('src');$('hint').hidden=false;if(frameUrl){URL.revokeObjectURL(frameUrl);frameUrl=''}}
function clearPhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';$('photoBox').hidden=true;$('photo').removeAttribute('src');$('download').removeAttribute('href')}
function show(id){stop();clearPhoto();activePage=id;for(const p of ['dashboard','manager','camera','photos'])$(p).hidden=p!==id;$('back').hidden=id!=='camera';$('home').classList.toggle('primary',id==='dashboard');$('devices').classList.toggle('primary',id==='manager');$('navCam').classList.toggle('primary',id==='camera');$('navGallery').classList.toggle('primary',id==='photos')}
async function action(fn){if(busy)return;busy=true;stop();try{if(liveTask)await liveTask;msg('در حال انجام…');await fn();}catch(e){msg('خطا: '+e.message)}finally{busy=false}}
let statusSocket=null, retryTimer=0, connectionTimer=0, staleTimer=0;
let statusAttempts=0, statusEpoch=0, paused=false, legacySeen=false;

function renderMetrics(s) { renderMeters(s); }

function applyHubState(message, loadLegacy=true) {
  if (message?.type!=='hub-state') return;
  ++statusEpoch;
  clearTimeout(staleTimer);
  if (message.data) {
    renderMetrics(message.data);
    $('lastStatus').textContent=new Date(message.seenAt).toLocaleTimeString('fa-IR');
  }
  markMetrics(message.state);
  switch(message.state) {
    case 'live':
      legacySeen=false;
      $('online').textContent='متصل · زنده';
      staleTimer=setTimeout(()=>{
        $('online').textContent='دادهٔ تازه نرسیده';
        markMetrics('stale');
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
    markMetrics('stale');
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
      if(legacySeen){markMetrics('legacy');$('lastStatus').textContent=new Date().toLocaleTimeString('fa-IR');}
      if (legacySeen) $('online').textContent='متصل';
    }
  } catch (error) {
    if (legacySeen && epoch===statusEpoch) {$('online').textContent='وضعیت هاب در دسترس نیست';markMetrics('stale');}
    throw error;
  }
}
function refreshStatus(){return action(async()=>{await status(true);msg('')})}
$('home').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('devices').onclick=()=>show('manager');$('refresh').onclick=refreshStatus;$('back').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('logout').onclick=async()=>{stop();try{await request('/logout',{});pauseStatusStream();location.reload()}catch(e){msg(e.message)}};
async function register(a){await rpc('register',a);msg('دستگاه ثبت شد.');await status();show('dashboard')}
$('discover').onclick=()=>action(async()=>{const d=await rpc('discover');$('results').replaceChildren();for(const item of (Array.isArray(d.devices)?d.devices:[]).slice(0,16)){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=item.name||'EYE';const b=document.createElement('button');b.textContent='افزودن';b.onclick=()=>action(()=>register(item.id||item.ip));row.append(label,b);$('results').append(row)}msg($('results').children.length?'دستگاه را انتخاب کن.':'دستگاهی پیدا نشد.')});$('manual').onsubmit=e=>{e.preventDefault();action(()=>register($('ip').value.trim()))};$('remove').onclick=()=>{if(confirm('دوربین از فهرست حذف شود؟ عکس‌ها پاک نمی‌شوند.'))action(async()=>{await rpc('remove');await status()})};
async function liveLoop(){while(running&&!document.hidden){try{const b=await rpc('frame');if(!running)break;const u=URL.createObjectURL(b);$('frame').src=u;$('hint').hidden=true;$('liveLabel').textContent='LIVE';$('liveLabel').dataset.live='1';if(frameUrl)URL.revokeObjectURL(frameUrl);frameUrl=u;await new Promise(r=>setTimeout(r,100))}catch(e){msg(e.message);stop()}}}
$('live').onclick=()=>{if(running){stop();return}if(busy||liveTask)return;running=true;$('live').textContent='توقف تصویر';liveTask=liveLoop().finally(()=>{liveTask=null})};document.querySelectorAll('[data-mode],[data-quality]').forEach(b=>b.onclick=()=>action(async()=>{await rpc(b.dataset.mode?'mode':'quality',b.dataset.mode||b.dataset.quality);msg('فرمان انجام شد.')}));$('capture').onclick=()=>action(async()=>{const r=await rpc('capture');msg(r.saved?'عکس ذخیره شد.':'فرمان عکاسی ارسال شد؛ گالری را بررسی کن.')});
async function gallery(){clearPhoto();const d=await rpc('gallery',page.at(-1));next=d.more?d.next:null;$('files').replaceChildren();for(const f of (d.files||[])){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=f.name+' · '+Math.round(f.size/1024)+' KB';const view=document.createElement('button');view.textContent='مشاهده';view.onclick=()=>action(async()=>{clearPhoto();photoUrl=URL.createObjectURL(await rpc('photo',f.name));$('photo').src=photoUrl;$('download').href=photoUrl;$('download').download=f.name;$('photoBox').hidden=false;msg('عکس آماده است.')});const del=document.createElement('button');del.className='danger';del.textContent='حذف';del.onclick=()=>{if(confirm('حذف دائمی '+f.name+'؟'))action(async()=>{await rpc('delete',f.name);page=[0];await gallery()})};row.append(label,view,del);$('files').append(row)}$('prev').disabled=page.length===1;$('next').disabled=next===null;msg('')}
$('gallery').onclick=()=>{show('photos');page=[0];action(gallery)};$('navCam').onclick=()=>show('camera');$('navGallery').onclick=()=>{show('photos');page=[0];action(gallery)};$('backCam').onclick=()=>show('camera');$('prev').onclick=()=>action(async()=>{if(page.length>1)page.pop();await gallery()});$('next').onclick=()=>action(async()=>{if(next!==null)page.push(next);await gallery()});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',()=>{stop();pauseStatusStream()});
window.addEventListener('pageshow',()=>{paused=false;connectStatusStream()});
window.addEventListener('online',()=>{
  if(paused)return;
  if(statusSocket)statusSocket.close();
  else if(!retryTimer)connectStatusStream();
});
connectStatusStream();
</script></html>`;
