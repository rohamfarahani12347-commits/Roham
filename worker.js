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
async function verifiedSession(req,env) {
  const token=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)roham_session=([^;]+)/)?.[1];
  if (!token) return 0;
  const m=token.match(/^(\d{10})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/);
  if (!m) return 0;
  const expiry=Number(m[1])*1000, now=Date.now();
  if (expiry<=now||expiry>now+(TTL+1)*1000) return 0;
  return await equal(m[3],await sign(m[1]+'.'+m[2],env))?{id:m[2],expiry}:null;
}
async function verifiedExpiry(req,env){return (await verifiedSession(req,env))?.expiry||0;}
const cookie=(value,age)=>'roham_session='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+age;
async function smallJSON(req){const r=req.body?.getReader();if(!r)throw Error('Body required');let total=0;const parts=[];try{while(true){const {done,value}=await r.read();if(done)break;total+=value.length;if(total>6400){await r.cancel();throw Error('Body too large')}parts.push(value)}const b=new Uint8Array(total);let pos=0;for(const p of parts){b.set(p,pos);pos+=p.length}return JSON.parse(dec.decode(b))}finally{r.releaseLock()}}
const DC_UPLOAD_MAX=32*1024*1024, DC_BLOCK=65536;
function dcPath(p){if(p==='/')return true;if(typeof p!=='string'||!p.startsWith('/')||p.endsWith('/')||enc.encode(p).length>180)return false;return p.slice(1).split('/').every(x=>x.length&&enc.encode(x).length<=120&&!/^[ .]|[ .]$/.test(x)&&!/[\x00-\x1f\x7f\\:*?"<>|]/.test(x)&&x.toLowerCase()!=='_rohamdc')}
const dcInt=(x,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const dcToken=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
function dcCommand(x){const a=x.arg;switch(x.op){case 'dc_status':case 'dc_mount':return a===undefined;case 'dc_list':return dcPath(a?.path)&&dcInt(a?.cursor);case 'dc_stat':case 'dc_openread':case 'dc_photo':case 'dc_mkdir':case 'dc_remove':return dcPath(a?.path)&&a.path!=='/';case 'dc_rename':return dcPath(a?.path)&&a.path!=='/'&&dcPath(a?.to)&&a.to!=='/'&&a.path.slice(0,a.path.lastIndexOf('/')).toLowerCase()===a.to.slice(0,a.to.lastIndexOf('/')).toLowerCase();case 'dc_begin':return dcPath(a?.path)&&a.path!=='/'&&dcInt(a?.size,DC_UPLOAD_MAX);case 'dc_write':return dcToken(a?.token)&&dcInt(a?.offset,DC_UPLOAD_MAX)&&typeof a?.data==='string'&&a.data.length>0&&a.data.length<=5464&&a.data.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(a.data)&&(a.data.length/4*3-(a.data.endsWith('==')?2:a.data.endsWith('=')?1:0))<=4096;case 'dc_commit':case 'dc_abort':case 'dc_endread':return dcToken(a?.token);case 'dc_read':return dcToken(a?.token)&&dcPath(a?.path)&&a.path!=='/'&&dcInt(a?.offset)&&dcInt(a?.size)&&dcInt(a?.length,DC_BLOCK)&&a.length>0&&a.offset<=a.size-a.length;default:return false}}
const binaryOp=op=>['frame','photo','dc_read','dc_photo'].includes(op);

function validCommand(x){if(!x||typeof x!=='object')return false;const a=x.arg;if(typeof x.op==='string'&&x.op.startsWith('dc_'))return dcCommand(x);switch(x.op){case 'status':case 'discover':case 'remove':case 'capture':case 'frame':return a===undefined;case 'register':return typeof a==='string'&&/^(?:[a-f0-9]{12}|\d{1,3}(?:\.\d{1,3}){3})$/i.test(a);case 'mode':return ['clock','camera','auto','off'].includes(a);case 'quality':return ['fast','hd'].includes(a);case 'gallery':return Number.isInteger(a)&&a>=0&&a<=0xffffffff&&a%32===0;case 'photo':case 'delete':return typeof a==='string'&&/^IMG\d{1,10}\.jpg$/.test(a);default:return false}}
const TELEMETRY_LIMIT = 1024;
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
  if(data.storage&&typeof data.storage==='object'){
    const s=data.storage,keys=['total','free','card','fs','readBps','writeBps','readAge','writeAge','scanAge'];
    if(['mounted','writable','known','dirty','scanning'].every(k=>typeof s[k]==='boolean')&&keys.every(k=>dcInt(s[k]))&&s.free<=s.total){result.storage={};for(const k of ['mounted','writable','known','dirty','scanning',...keys])result.storage[k]=s[k];}
  }
  return result;
}

export class RohamHub extends DurableObject {
  pending = null;

  // Only signed session UUIDs and expiry are stored; no IP or user agent.
  async sessionRecords(add=null, remove=null) {
    return this.ctx.storage.transaction(async tx=>{
      const prior=await tx.get('panelSessionsV1')||{};
      const now=Date.now(), records={};
      for(const [id,expiry] of Object.entries(prior)) if(Math.abs(expiry)>now) records[id]=expiry;
      // Keep a logout marker until expiry to prevent a racing tab re-registering it.
      if(remove) records[remove.id]=-remove.expiry;
      if(add && add.expiry>now && !(records[add.id]<0)) records[add.id]=add.expiry;
      if(JSON.stringify(prior)!==JSON.stringify(records)) await tx.put('panelSessionsV1',records);
      return records;
    });
  }
  presence(records, exclude=null) {
    const now=Date.now(), online=new Set();
    for(const ws of this.ctx.getWebSockets('viewer')) {
      if(ws===exclude||ws.readyState!==1) continue;
      const a=ws.deserializeAttachment();
      if(a?.sessionId && a.viewerUntil>now && records[a.sessionId]>now) online.add(a.sessionId);
    }
    return {type:'panel-presence',signedIn:Object.values(records).filter(expiry=>expiry>now).length,online:online.size,seenAt:now};
  }
  async broadcastPresence(records=null, exclude=null) {
    records=records||await this.sessionRecords();
    const state=this.presence(records,exclude), message=JSON.stringify(state), now=Date.now();
    for(const ws of this.ctx.getWebSockets('viewer')) {
      if(ws===exclude||ws.readyState!==1) continue;
      try {
        const a=ws.deserializeAttachment();
        if(a?.viewerUntil<=now) ws.close(4401,'Sign in again');
        else if(a?.sessionId && records[a.sessionId]>now) ws.send(message);
      } catch {}
    }
    return state;
  }
  async logoutSession(req) {
    const auth=await verifiedSession(req,this.env);
    if(!auth) return fail('Unauthorized',401);
    const records=await this.sessionRecords(null,auth);
    for(const ws of this.ctx.getWebSockets('viewer')) {
      if(ws.deserializeAttachment()?.sessionId===auth.id) {
        try{ws.close(4401,'Signed out')}catch{}
      }
    }
    await this.broadcastPresence(records);
    return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
  }

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
    const auth = await verifiedSession(req, this.env);
    if (!auth) return fail('Unauthorized', 401);
    const records=await this.sessionRecords(auth);
    if(records[auth.id]<0) return reply({error:'Signed out'},401,{'Set-Cookie':cookie('',0)});
    if(path==='/state')return reply(this.hubState());
    if (path === '/sessions') return reply(this.presence(records));
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return fail('WebSocket required', 426);
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server, ['viewer']);
    server.serializeAttachment({viewerUntil:auth.expiry,sessionId:auth.id});
    server.send(JSON.stringify(this.hubState()));
    await this.broadcastPresence(records);
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
    if(path==='/login'){const data=await smallJSON(req).catch(()=>null);if(typeof data?.password!=='string'||data.password.length>512)return fail('Invalid password',400);const now=Date.now();const allowed=await this.ctx.storage.transaction(async t=>{let s=await t.get('loginLimit');if(!s||s.until<=now)s={n:0,until:now+300000};if(s.n>=5)return false;s.n++;await t.put('loginLimit',s);return true});if(!allowed)return fail('Too many attempts; retry in five minutes',429);if(!await equal(data.password,this.env.PANEL_PASSWORD))return fail('Invalid password',401);await this.ctx.storage.delete('loginLimit');const token=await session(this.env),parts=token.split('.');const records=await this.sessionRecords({id:parts[1],expiry:Number(parts[0])*1000});await this.broadcastPresence(records);return reply({ok:true},200,{'Set-Cookie':cookie(token,TTL)});}
    if(path==='/master')return this.acceptMaster(req);
    if(path==='/live'||path==='/state'||path==='/sessions')return this.serveStatus(req,path);
    if(path==='/logout')return this.logoutSession(req);
    if(path==='/dc-download')return this.download(req);
    if(path!=='/rpc')return fail('Not found',404);
    const data=await smallJSON(req).catch(()=>null);const auth=await verifiedSession(req,this.env);if(!auth)return fail('Unauthorized',401);const records=await this.ctx.storage.get('panelSessionsV1')||{};if(records[auth.id]<0)return fail('Unauthorized',401);return this.rpcCommand(data);
  }
  rpcCommand(data){if(!validCommand(data))return fail('Invalid command');const ws=this.master();if(!ws)return fail('Master offline',503);if(this.pending)return fail('Master busy',409);
    return new Promise(resolve=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{if(this.pending?.id===id)this.finish(fail('Master timeout',504));},data.op==='capture'?50000:['photo','dc_photo','dc_mount','dc_read'].includes(data.op)?45000:15000);this.pending={id,ws,resolve,timer,op:data.op,requested:data.op==='dc_read'?data.arg.length:0,chunks:[],length:0,expected:0};try{ws.send(JSON.stringify({type:'request',id,op:data.op,...(data.arg===undefined?{}:{arg:data.arg})}));}catch{this.finish(fail('Master unavailable',503));}});
  }
  async download(req){
    const auth=await verifiedSession(req,this.env);if(!auth)return fail('Unauthorized',401);
    const records=await this.sessionRecords(auth);if(records[auth.id]<0)return fail('Unauthorized',401);
    const path=new URL(req.url).searchParams.get('path');if(!dcPath(path)||path==='/')return fail('Invalid path');
    const query=async data=>{for(let i=0;;i++){const r=await this.rpcCommand(data);let busy=r.status===409;if(r.status===502){try{busy=/busy/i.test((await r.clone().json()).error||'')}catch{}}if(!busy||i>=7)return r;await new Promise(resolve=>setTimeout(resolve,250*(i+1)))}};
    const opened=await query({op:'dc_openread',arg:{path}});if(!opened.ok)return opened;const s=await opened.json();if(!dcInt(s.size)||!dcToken(s.token))return fail('Invalid file');
    const name=path.split('/').at(-1),headers={...safeHeaders,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())};
    const release=async()=>{try{await query({op:'dc_endread',arg:{token:s.token}})}catch{}};
    if(s.size===0){await release();return new Response(new Uint8Array(0),{headers});}
    const stream=new FixedLengthStream(s.size),writer=stream.writable.getWriter();
    const pump=async()=>{let offset=0,checked=Date.now();try{while(offset<s.size){
      if(Date.now()>=auth.expiry)throw Error('Session expired');
      if(Date.now()-checked>30000){const r=await this.ctx.storage.get('panelSessionsV1')||{};if(r[auth.id]<0)throw Error('Signed out');checked=Date.now();}
      const length=Math.min(DC_BLOCK,s.size-offset),r=await query({op:'dc_read',arg:{path,offset,length,size:s.size,token:s.token}});if(!r.ok)throw Error('Read failed: '+r.status);
      const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength!==length)throw Error('Truncated file');await writer.write(b);offset+=length;
    }await writer.close();}catch(e){try{await writer.abort(e)}catch{}}finally{await release();}};
    this.ctx.waitUntil(pump());return new Response(stream.readable,{headers});
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
      if(m.type==='result'&&!binaryOp(p.op)){this.finish(reply(m.data??{}));return}
      if(m.type==='begin'&&binaryOp(p.op)&&!p.expected&&Number.isInteger(m.size)&&m.size>=(p.op==='dc_read'?1:4)&&m.size<=MAX_IMAGE&&(p.op!=='dc_read'||m.size===p.requested)){p.expected=m.size;return}
      if(m.type==='end'&&p.expected&&p.length===p.expected){const b=new Uint8Array(p.length);let offset=0;for(const c of p.chunks){b.set(c,offset);offset+=c.length}if(p.op!=='dc_read'&&(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)){this.finish(fail('Invalid JPEG',502));return}this.finish(new Response(b,{headers:{...safeHeaders,'Content-Type':p.op==='dc_read'?'application/octet-stream':'image/jpeg'}}));return}
      this.finish(fail('Invalid device response',502));return;
    }if(!p||p.ws!==ws||!p.expected)return;const b=new Uint8Array(message);if(b.length<37||dec.decode(b.subarray(0,36))!==p.id)return;const c=b.slice(36);if(c.length>16384||p.length+c.length>p.expected){this.finish(fail('Image too large',502));return}p.chunks.push(c);p.length+=c.length;
  }
  async webSocketClose(ws,code){
    this.finish(fail('Master disconnected',503),ws);
    if(this.ctx.getTags(ws).includes('master'))this.broadcastState(this.hubState(this.master(ws)??null));
    try{ws.close(code>=1000&&code<5000&&![1004,1005,1006,1015].includes(code)?code:1000,'Closed')}catch{}
    if(this.ctx.getTags(ws).includes('viewer'))await this.broadcastPresence(null,ws);
  }
  async webSocketError(ws){
    this.finish(fail('Master disconnected',503),ws);
    if(this.ctx.getTags(ws).includes('master'))this.broadcastState(this.hubState(this.master(ws)??null));
    try{ws.close(1011,'Error')}catch{}
    if(this.ctx.getTags(ws).includes('viewer'))await this.broadcastPresence(null,ws);
  }
}
export default {async fetch(req,env){try{if(!env.PANEL_PASSWORD||!env.MASTER_TOKEN||!env.ROHAM_HUB)return fail('Server configuration incomplete',503);const url=new URL(req.url),path=url.pathname;const stub=env.ROHAM_HUB.get(env.ROHAM_HUB.idFromName('master'));
  if(path==='/master'){if(req.method!=='GET'||!await equal(req.headers.get('Authorization'),'Bearer '+env.MASTER_TOKEN))return fail('Unauthorized',401);return stub.fetch(req);}
  if(path==='/'&&req.method==='GET')return html(await verifiedExpiry(req,env)?PANEL:LOGIN,url);
  if(req.method==='GET'&&path==='/dc-download')return stub.fetch(req);
  if(req.method==='GET'&&(path==='/state'||path==='/sessions'))return stub.fetch(req);
  if(req.method==='GET'&&path==='/live'){
    if(req.headers.get('Origin')!==url.origin)return fail('Forbidden',403);
    return stub.fetch(req);
  }
  if(req.method!=='POST')return fail('Not found',404);
  if(req.headers.get('Origin')!==url.origin||req.headers.get('X-Roham-Panel')!=='1')return fail('Forbidden',403);
  if(path==='/login')return stub.fetch(req);
  if(!await verifiedExpiry(req,env))return fail('Unauthorized',401);
  if(path==='/logout')return stub.fetch(req);
  if(path==='/rpc')return stub.fetch(req);
  return fail('Not found',404);
}catch{return fail('Server error',500)}}};
const CSS = `:root{color-scheme:dark;--bg:#0b0b0c;--panel:#151516;--line:#2a2a2d;--muted:#a0a0a5;--red:#ff4545;--white:#f5f5f4;--mint:#f5f5f4}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--white);font:15px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif;-webkit-font-smoothing:antialiased}main{max-width:1100px;margin:auto;padding:26px 20px 32px;display:grid;grid-template-columns:76px minmax(0,1fr);gap:16px;direction:ltr}main>*{direction:rtl;min-width:0}header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 18px;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:11px;color:#f6f6f4;direction:ltr;width:max-content}.brand svg{width:clamp(142px,25vw,230px);height:auto;display:block}.brandMark{width:7px;height:7px;border-radius:100%;background:var(--red)}.brandSub{font:11px/1.5 ui-monospace,monospace;letter-spacing:.12em;color:var(--muted);display:block;margin-top:8px;text-align:left;direction:ltr}.headClock{direction:ltr;text-align:left;display:flex;align-items:center;gap:16px}.headClock time{font:24px/1.2 ui-monospace,monospace;letter-spacing:-1px;font-variant-numeric:tabular-nums}.headClock small{display:block;font:10px/1.4 ui-monospace,monospace;margin-top:5px;letter-spacing:.06em}.ico{width:22px;height:22px;flex:none;vertical-align:middle}nav{grid-column:1;grid-row:2/7;align-self:start;display:grid;gap:8px;border:1px solid var(--line);background:#111112;border-radius:25px;padding:7px;position:sticky;top:12px}nav button{display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;padding:11px 1px;min-height:61px;background:transparent;border-color:transparent;border-radius:18px;font-size:10px;color:#bbb}nav button.primary{background:#303033;color:#fff;border-color:#3e3e40}#notice,section:not(.login),#metricsPanel,footer{grid-column:2}#notice{margin:0;min-height:0;color:#d7d7db}#notice:empty{display:none}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.glass,.stat,.metric,.deviceTile{background:var(--panel);border:1px solid var(--line);border-radius:23px;padding:17px;min-width:0}.glass{margin:0 0 12px}.glass:last-child{margin-bottom:0}h1,h2{font-size:18px;line-height:1.4;margin:0 0 12px;font-weight:650}.row h1,.row h2{margin:0}small,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stat{background:#1b1b1d;padding:12px;border-radius:15px}.stat b{display:block;margin-top:6px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.devicesGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.deviceTile{display:flex;flex-direction:column;gap:12px;min-height:132px}.deviceTile .ico{width:35px;height:35px;color:#d4d4d5}.tileTop{display:flex;justify-content:space-between;align-items:center;gap:8px}.tileTop h1,.tileTop h2{margin:0}.tileTop b{font-size:13px;font-weight:500}.deviceTile .muted{font-size:12px;margin:0}.signal{display:inline-flex;align-items:center;gap:6px;color:#c9c9cb;font-size:12px}.signal:before{content:"";width:7px;height:7px;border-radius:50%;background:#777}.signal[data-state="live"]:before,.signal[data-state="legacy"]:before{background:var(--red)}.signal[data-state="offline"]:before,.signal[data-state="stale"]:before{background:#777}.tileName{font:11px ui-monospace,monospace;letter-spacing:.12em;direction:ltr;text-align:right;color:var(--muted)}.last{margin:13px 0 0;font-size:12px}.last b{font-variant-numeric:tabular-nums}button,input,a.btn{font:inherit;min-height:44px;border-radius:14px;padding:9px 14px;border:1px solid #343438;background:#1d1d1f;color:inherit}button,a.btn{cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px}button:hover:not(:disabled),a.btn:hover{border-color:#76767b}button:active:not(:disabled){background:#303032}button:disabled{opacity:.45;cursor:default}button.primary{background:#ededeb;color:#111;border-color:#ededeb;font-weight:650}button.primary:active:not(:disabled){background:#bdbdbd}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--red);outline-offset:3px}input{width:100%;direction:ltr}label{display:block;margin:12px 0 6px}.full{width:100%}.power{width:45px;padding:0;border-radius:50%;background:transparent}.power .ico{width:20px;height:20px}.view{aspect-ratio:4/3;position:relative;background:#070708;border:1px solid #303033;border-radius:19px;display:grid;place-items:center;overflow:hidden;margin:14px 0}.view img{width:100%;height:100%;object-fit:contain;min-height:0;position:absolute;inset:0}.view img:not([src]){display:none}.liveLabel{position:absolute;z-index:1;top:12px;left:12px;background:#111c;border:1px solid #ffffff30;padding:4px 9px;border-radius:20px;color:#ddd;font:12px ui-monospace,monospace;display:flex;align-items:center;gap:6px}.liveLabel:before{content:"";width:7px;height:7px;border-radius:100%;background:#777}.liveLabel[data-live="1"]:before{background:var(--red)}.danger{color:#ff8282}.file{padding:10px 0;border-bottom:1px solid #ffffff16}.file b{overflow-wrap:anywhere}.status{font-size:13px}.metricHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}.metricHead small{font:11px ui-monospace,monospace;letter-spacing:.06em}.metricHead b{font-size:12px;font-weight:500;color:var(--muted)}.metricsGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{padding:16px;direction:ltr;text-align:left}.metric .label{font:13px/1.5 ui-monospace,monospace;color:#d6d6d8}.metric .value{font:26px/1.2 ui-monospace,monospace;letter-spacing:-1px;margin:6px 0 12px;display:block;white-space:nowrap}.cameraLayout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:15px;direction:ltr;align-items:start;margin-top:12px}.cameraLayout>*{direction:rtl;min-width:0}.cameraLayout .view{margin:0 0 10px}.cameraLayout .controlPane{display:flex;flex-direction:column;gap:9px}.cameraLayout .controlPane p{margin:0;font-size:12px}.deviceTile p{margin:0}.deviceTile .tileTop{min-height:48px}#cameraCard{margin-bottom:12px}.metric .sub{font-size:11px;color:var(--muted);direction:rtl;text-align:left;display:block;min-height:17px;margin-top:8px}.dots{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;height:12px;direction:ltr;align-items:center}.dots i{display:block;width:100%;max-width:6px;aspect-ratio:1;border-radius:50%;background:#38383a;transition:background .18s}.dots i.on{background:#f1f1ef}.dots.high i.on{background:var(--red)}.metricsGrid[data-stale="1"] .dots i.on{background:#777}.metricsGrid[data-stale="1"] .value{color:#999}.extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.extra .stat{display:flex;align-items:center;justify-content:space-between;gap:8px}.extra .stat b{margin:0;font:13px ui-monospace,monospace;direction:ltr}.controls{margin-top:10px}footer{text-align:center;color:#777;font:11px/1.5 ui-monospace,monospace;letter-spacing:.11em;margin:8px 0 0;direction:ltr}[hidden]{display:none!important}main:has(.login){display:block;max-width:440px;padding-top:12vh}.login{max-width:420px;margin:auto;padding:24px}.login h1{margin:28px 0 16px}.login .brand svg{width:220px}.login .brandSub{margin:10px 0}.login .status{min-height:20px}.sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){.cameraLayout{grid-template-columns:1fr;gap:10px}.cameraLayout .view{margin-bottom:6px}main{display:flex;flex-direction:column;padding:19px 14px 24px;gap:13px}header{padding:4px 0 13px}.headClock{gap:8px}.headClock time{font-size:19px}.headClock small{display:none}.brand svg{width:144px}.brandSub{font-size:9px;letter-spacing:.06em}.brandMark{width:5px;height:5px}.power{width:38px;min-height:38px}nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:static;padding:5px;border-radius:20px;width:100%;gap:4px}nav button{min-height:53px;padding:7px 2px;border-radius:15px}.deviceTile{padding:13px;border-radius:19px;min-height:120px}.deviceTile .ico{width:28px;height:28px}.tileTop h1,.tileTop h2{font-size:15px}.devicesGrid{gap:9px}.tileTop{flex-wrap:wrap}.glass{padding:14px;border-radius:20px}.metricsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{padding:13px;border-radius:18px}.metric:last-child{grid-column:1/-1}.metric .value{font-size:23px}.dots{gap:2px}.extra{gap:7px}.extra .stat{padding:9px;font-size:12px}.last{font-size:11px}.login .brand svg{width:200px}}
@media(max-width:350px){.brand svg{width:118px}.headClock time{font-size:16px}.metricsGrid{grid-template-columns:1fr}.metric:last-child{grid-column:auto}.devicesGrid{grid-template-columns:1fr}}
/* 1.3.2 responsive panel: one scroll axis; native-size controls; safe-area padding. */
.presenceCard{margin-top:12px;padding:15px;border:1px solid var(--line);border-radius:20px;background:var(--panel)}
.presenceCard h2{margin:0;font-size:16px}.presenceCard .metricHead{margin-bottom:12px}
.presenceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.presenceStat{background:#1b1b1d;border:1px solid var(--line);border-radius:14px;padding:12px;min-width:0}
.presenceStat b{display:block;font:27px/1.3 ui-monospace,monospace;margin:5px 0 0;direction:ltr;text-align:right}
.presenceCard[data-stale="1"] .presenceStat b{color:#999}.presenceNote{font-size:11px;color:var(--muted);margin:9px 0 0;line-height:1.7}
@media(max-width:760px){
body{font-size:14px;min-height:100svh;overflow-wrap:anywhere}
main{width:100%;max-width:600px;padding: max(14px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) calc(22px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));display:flex;flex-direction:column;gap:12px}
header{gap:8px;min-width:0;padding:4px 0 13px;flex-wrap:nowrap}.brand{gap:6px;max-width:100%}.brand svg{width:clamp(112px,39vw,180px)}.brandSub{font-size:9px;letter-spacing:.04em}.headClock{gap:7px;flex-shrink:0}.headClock time{font-size:18px}.headClock small{display:none}.power{width:44px;min-height:44px;flex-shrink:0}
nav{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;padding:5px;gap:4px;border-radius:18px;direction:rtl}nav button{min-width:0;min-height:56px;font-size:11px;line-height:1.25;padding:6px 2px;border-radius:13px;white-space:normal}nav .ico{width:21px;height:21px}
.deviceTile{min-height:0;padding:14px;border-radius:19px;gap:8px}.tileTop{flex-wrap:nowrap}.deviceTile .tileTop{min-height:0}.tileTop h1,.tileTop h2{font-size:17px}.deviceTile .ico{width:28px;height:28px}
.glass{padding:13px;border-radius:18px}.metric{padding:12px;border-radius:16px}.metricsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.metric:last-child{grid-column:1/-1}.metric .value{font-size:clamp(20px,5.8vw,26px);margin:6px 0 8px}.metric .sub{font-size:10px;overflow-wrap:anywhere}.dots{gap:2px;height:9px}.extra{gap:7px}.extra .stat{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px}.extra .stat b{font-size:13px}.metricHead{flex-wrap:wrap}
.cameraLayout{grid-template-columns:minmax(0,1fr);gap:12px}.cameraLayout .view{margin:0 0 8px;border-radius:14px}.cameraLayout .controlPane{gap:8px}.grid{gap:8px}.grid button{min-width:0;min-height:46px;padding:8px 5px}.file{align-items:stretch}.file b{flex:1 0 100%}button,input,a.btn{min-height:44px}input{font-size:16px;min-width:0}.login{padding:20px}.login .brand svg{width:min(200px,56vw)}.login .brand{max-width:100%}.presenceCard{padding:13px}.presenceStat{padding:10px}footer{margin:4px 0}
}
@media(max-width:350px){.brand svg{width:112px}.brandSub{font-size:8px}.headClock time{font-size:15px}.headClock{gap:4px}.power{width:40px}.metric .value{font-size:20px}.dots{gap:1px}.presenceStat small{font-size:11px}nav button{font-size:10px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}.dcPanel{min-width:0}.dcStats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.dcStats .stat b{direction:ltr;text-align:right;overflow-wrap:anywhere}.dcMeter{display:flex;align-items:center;gap:12px;margin:15px 0}.dcMeter b{direction:ltr;white-space:nowrap}progress{width:100%;height:13px;accent-color:#ededeb;border:0;border-radius:8px;overflow:hidden}progress::-webkit-progress-bar{background:#303033}progress::-webkit-progress-value{background:#ededeb}progress::-moz-progress-bar{background:#ededeb}.dcTools,.dcFileButtons{display:flex;gap:6px;flex-wrap:wrap}.dcFile{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid #29292c}.dcFile b,.dcFile small{display:block;overflow-wrap:anywhere}.dcFile small{color:var(--muted)}.dcFileButtons button{min-height:36px;font-size:12px;padding:6px 10px}.dcTools{margin:14px 0}.dcTools button{flex:1}#dcPath{max-width:100%;overflow-wrap:anywhere;font:12px ui-monospace,monospace}#dcTransfer{padding:12px 0}#dcTransfer button{margin-top:10px}#dcPreview img{object-fit:contain}#navDC{font-size:11px;letter-spacing:.02em;direction:ltr}@media(max-width:760px){nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}nav button{min-width:0;padding:7px 2px;font-size:10px;white-space:normal;gap:3px}nav .ico{width:18px;height:18px}#navDC{font-size:9px;line-height:1.15}.dcFile{grid-template-columns:minmax(0,1fr)}.dcFileButtons button{flex:1}.dcStats .stat{padding:10px}.dcTools button{font-size:12px;padding:8px 4px}}
`;
const LOGIN = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ROHAM OS · Login</title><style>${CSS}</style><main><section class="glass login"><div class="brand" dir="ltr"><svg viewBox="0 0 46 7" role="img" aria-label="ROHAM OS" fill="currentColor"><circle cx="0.5" cy="0.5" r=".37"/><circle cx="1.5" cy="0.5" r=".37"/><circle cx="2.5" cy="0.5" r=".37"/><circle cx="3.5" cy="0.5" r=".37"/><circle cx="0.5" cy="1.5" r=".37"/><circle cx="4.5" cy="1.5" r=".37"/><circle cx="0.5" cy="2.5" r=".37"/><circle cx="4.5" cy="2.5" r=".37"/><circle cx="0.5" cy="3.5" r=".37"/><circle cx="1.5" cy="3.5" r=".37"/><circle cx="2.5" cy="3.5" r=".37"/><circle cx="3.5" cy="3.5" r=".37"/><circle cx="0.5" cy="4.5" r=".37"/><circle cx="2.5" cy="4.5" r=".37"/><circle cx="0.5" cy="5.5" r=".37"/><circle cx="3.5" cy="5.5" r=".37"/><circle cx="0.5" cy="6.5" r=".37"/><circle cx="4.5" cy="6.5" r=".37"/><circle cx="7.5" cy="0.5" r=".37"/><circle cx="8.5" cy="0.5" r=".37"/><circle cx="9.5" cy="0.5" r=".37"/><circle cx="6.5" cy="1.5" r=".37"/><circle cx="10.5" cy="1.5" r=".37"/><circle cx="6.5" cy="2.5" r=".37"/><circle cx="10.5" cy="2.5" r=".37"/><circle cx="6.5" cy="3.5" r=".37"/><circle cx="10.5" cy="3.5" r=".37"/><circle cx="6.5" cy="4.5" r=".37"/><circle cx="10.5" cy="4.5" r=".37"/><circle cx="6.5" cy="5.5" r=".37"/><circle cx="10.5" cy="5.5" r=".37"/><circle cx="7.5" cy="6.5" r=".37"/><circle cx="8.5" cy="6.5" r=".37"/><circle cx="9.5" cy="6.5" r=".37"/><circle cx="12.5" cy="0.5" r=".37"/><circle cx="16.5" cy="0.5" r=".37"/><circle cx="12.5" cy="1.5" r=".37"/><circle cx="16.5" cy="1.5" r=".37"/><circle cx="12.5" cy="2.5" r=".37"/><circle cx="16.5" cy="2.5" r=".37"/><circle cx="12.5" cy="3.5" r=".37"/><circle cx="13.5" cy="3.5" r=".37"/><circle cx="14.5" cy="3.5" r=".37"/><circle cx="15.5" cy="3.5" r=".37"/><circle cx="16.5" cy="3.5" r=".37"/><circle cx="12.5" cy="4.5" r=".37"/><circle cx="16.5" cy="4.5" r=".37"/><circle cx="12.5" cy="5.5" r=".37"/><circle cx="16.5" cy="5.5" r=".37"/><circle cx="12.5" cy="6.5" r=".37"/><circle cx="16.5" cy="6.5" r=".37"/><circle cx="19.5" cy="0.5" r=".37"/><circle cx="20.5" cy="0.5" r=".37"/><circle cx="21.5" cy="0.5" r=".37"/><circle cx="18.5" cy="1.5" r=".37"/><circle cx="22.5" cy="1.5" r=".37"/><circle cx="18.5" cy="2.5" r=".37"/><circle cx="22.5" cy="2.5" r=".37"/><circle cx="18.5" cy="3.5" r=".37"/><circle cx="19.5" cy="3.5" r=".37"/><circle cx="20.5" cy="3.5" r=".37"/><circle cx="21.5" cy="3.5" r=".37"/><circle cx="22.5" cy="3.5" r=".37"/><circle cx="18.5" cy="4.5" r=".37"/><circle cx="22.5" cy="4.5" r=".37"/><circle cx="18.5" cy="5.5" r=".37"/><circle cx="22.5" cy="5.5" r=".37"/><circle cx="18.5" cy="6.5" r=".37"/><circle cx="22.5" cy="6.5" r=".37"/><circle cx="24.5" cy="0.5" r=".37"/><circle cx="28.5" cy="0.5" r=".37"/><circle cx="24.5" cy="1.5" r=".37"/><circle cx="25.5" cy="1.5" r=".37"/><circle cx="27.5" cy="1.5" r=".37"/><circle cx="28.5" cy="1.5" r=".37"/><circle cx="24.5" cy="2.5" r=".37"/><circle cx="26.5" cy="2.5" r=".37"/><circle cx="28.5" cy="2.5" r=".37"/><circle cx="24.5" cy="3.5" r=".37"/><circle cx="26.5" cy="3.5" r=".37"/><circle cx="28.5" cy="3.5" r=".37"/><circle cx="24.5" cy="4.5" r=".37"/><circle cx="28.5" cy="4.5" r=".37"/><circle cx="24.5" cy="5.5" r=".37"/><circle cx="28.5" cy="5.5" r=".37"/><circle cx="24.5" cy="6.5" r=".37"/><circle cx="28.5" cy="6.5" r=".37"/><circle cx="35.5" cy="0.5" r=".37"/><circle cx="36.5" cy="0.5" r=".37"/><circle cx="37.5" cy="0.5" r=".37"/><circle cx="34.5" cy="1.5" r=".37"/><circle cx="38.5" cy="1.5" r=".37"/><circle cx="34.5" cy="2.5" r=".37"/><circle cx="38.5" cy="2.5" r=".37"/><circle cx="34.5" cy="3.5" r=".37"/><circle cx="38.5" cy="3.5" r=".37"/><circle cx="34.5" cy="4.5" r=".37"/><circle cx="38.5" cy="4.5" r=".37"/><circle cx="34.5" cy="5.5" r=".37"/><circle cx="38.5" cy="5.5" r=".37"/><circle cx="35.5" cy="6.5" r=".37"/><circle cx="36.5" cy="6.5" r=".37"/><circle cx="37.5" cy="6.5" r=".37"/><circle cx="41.5" cy="0.5" r=".37"/><circle cx="42.5" cy="0.5" r=".37"/><circle cx="43.5" cy="0.5" r=".37"/><circle cx="44.5" cy="0.5" r=".37"/><circle cx="40.5" cy="1.5" r=".37"/><circle cx="40.5" cy="2.5" r=".37"/><circle cx="41.5" cy="3.5" r=".37"/><circle cx="42.5" cy="3.5" r=".37"/><circle cx="43.5" cy="3.5" r=".37"/><circle cx="44.5" cy="4.5" r=".37"/><circle cx="44.5" cy="5.5" r=".37"/><circle cx="40.5" cy="6.5" r=".37"/><circle cx="41.5" cy="6.5" r=".37"/><circle cx="42.5" cy="6.5" r=".37"/><circle cx="43.5" cy="6.5" r=".37"/></svg><span class="brandMark" aria-hidden="true"></span></div><small class="brandSub">PRIVATE CONTROL SYSTEM</small><h1>ورود به سرور مرکزی</h1><form id="login"><label for="pw">رمز عبور</label><input id="pw" type="password" autocomplete="current-password" required maxlength="512"><button class="primary full" style="margin-top:15px">ورود</button></form><p id="msg" role="status" class="status"></p></section></main><script>document.getElementById('login').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button'),m=document.getElementById('msg');b.disabled=true;try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify({password:document.getElementById('pw').value})});if(r.ok){location.reload();return}m.textContent=r.status===429?'تلاش بیش از حد؛ پنج دقیقه دیگر امتحان کن.':'ورود ناموفق است.'}catch{m.textContent='خطای ارتباط'}finally{b.disabled=false}};</script></html>`;
const PANEL = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ROHAM OS</title><style>${CSS}</style><main><header><div><div class="brand" dir="ltr"><svg viewBox="0 0 46 7" role="img" aria-label="ROHAM OS" fill="currentColor"><circle cx="0.5" cy="0.5" r=".37"/><circle cx="1.5" cy="0.5" r=".37"/><circle cx="2.5" cy="0.5" r=".37"/><circle cx="3.5" cy="0.5" r=".37"/><circle cx="0.5" cy="1.5" r=".37"/><circle cx="4.5" cy="1.5" r=".37"/><circle cx="0.5" cy="2.5" r=".37"/><circle cx="4.5" cy="2.5" r=".37"/><circle cx="0.5" cy="3.5" r=".37"/><circle cx="1.5" cy="3.5" r=".37"/><circle cx="2.5" cy="3.5" r=".37"/><circle cx="3.5" cy="3.5" r=".37"/><circle cx="0.5" cy="4.5" r=".37"/><circle cx="2.5" cy="4.5" r=".37"/><circle cx="0.5" cy="5.5" r=".37"/><circle cx="3.5" cy="5.5" r=".37"/><circle cx="0.5" cy="6.5" r=".37"/><circle cx="4.5" cy="6.5" r=".37"/><circle cx="7.5" cy="0.5" r=".37"/><circle cx="8.5" cy="0.5" r=".37"/><circle cx="9.5" cy="0.5" r=".37"/><circle cx="6.5" cy="1.5" r=".37"/><circle cx="10.5" cy="1.5" r=".37"/><circle cx="6.5" cy="2.5" r=".37"/><circle cx="10.5" cy="2.5" r=".37"/><circle cx="6.5" cy="3.5" r=".37"/><circle cx="10.5" cy="3.5" r=".37"/><circle cx="6.5" cy="4.5" r=".37"/><circle cx="10.5" cy="4.5" r=".37"/><circle cx="6.5" cy="5.5" r=".37"/><circle cx="10.5" cy="5.5" r=".37"/><circle cx="7.5" cy="6.5" r=".37"/><circle cx="8.5" cy="6.5" r=".37"/><circle cx="9.5" cy="6.5" r=".37"/><circle cx="12.5" cy="0.5" r=".37"/><circle cx="16.5" cy="0.5" r=".37"/><circle cx="12.5" cy="1.5" r=".37"/><circle cx="16.5" cy="1.5" r=".37"/><circle cx="12.5" cy="2.5" r=".37"/><circle cx="16.5" cy="2.5" r=".37"/><circle cx="12.5" cy="3.5" r=".37"/><circle cx="13.5" cy="3.5" r=".37"/><circle cx="14.5" cy="3.5" r=".37"/><circle cx="15.5" cy="3.5" r=".37"/><circle cx="16.5" cy="3.5" r=".37"/><circle cx="12.5" cy="4.5" r=".37"/><circle cx="16.5" cy="4.5" r=".37"/><circle cx="12.5" cy="5.5" r=".37"/><circle cx="16.5" cy="5.5" r=".37"/><circle cx="12.5" cy="6.5" r=".37"/><circle cx="16.5" cy="6.5" r=".37"/><circle cx="19.5" cy="0.5" r=".37"/><circle cx="20.5" cy="0.5" r=".37"/><circle cx="21.5" cy="0.5" r=".37"/><circle cx="18.5" cy="1.5" r=".37"/><circle cx="22.5" cy="1.5" r=".37"/><circle cx="18.5" cy="2.5" r=".37"/><circle cx="22.5" cy="2.5" r=".37"/><circle cx="18.5" cy="3.5" r=".37"/><circle cx="19.5" cy="3.5" r=".37"/><circle cx="20.5" cy="3.5" r=".37"/><circle cx="21.5" cy="3.5" r=".37"/><circle cx="22.5" cy="3.5" r=".37"/><circle cx="18.5" cy="4.5" r=".37"/><circle cx="22.5" cy="4.5" r=".37"/><circle cx="18.5" cy="5.5" r=".37"/><circle cx="22.5" cy="5.5" r=".37"/><circle cx="18.5" cy="6.5" r=".37"/><circle cx="22.5" cy="6.5" r=".37"/><circle cx="24.5" cy="0.5" r=".37"/><circle cx="28.5" cy="0.5" r=".37"/><circle cx="24.5" cy="1.5" r=".37"/><circle cx="25.5" cy="1.5" r=".37"/><circle cx="27.5" cy="1.5" r=".37"/><circle cx="28.5" cy="1.5" r=".37"/><circle cx="24.5" cy="2.5" r=".37"/><circle cx="26.5" cy="2.5" r=".37"/><circle cx="28.5" cy="2.5" r=".37"/><circle cx="24.5" cy="3.5" r=".37"/><circle cx="26.5" cy="3.5" r=".37"/><circle cx="28.5" cy="3.5" r=".37"/><circle cx="24.5" cy="4.5" r=".37"/><circle cx="28.5" cy="4.5" r=".37"/><circle cx="24.5" cy="5.5" r=".37"/><circle cx="28.5" cy="5.5" r=".37"/><circle cx="24.5" cy="6.5" r=".37"/><circle cx="28.5" cy="6.5" r=".37"/><circle cx="35.5" cy="0.5" r=".37"/><circle cx="36.5" cy="0.5" r=".37"/><circle cx="37.5" cy="0.5" r=".37"/><circle cx="34.5" cy="1.5" r=".37"/><circle cx="38.5" cy="1.5" r=".37"/><circle cx="34.5" cy="2.5" r=".37"/><circle cx="38.5" cy="2.5" r=".37"/><circle cx="34.5" cy="3.5" r=".37"/><circle cx="38.5" cy="3.5" r=".37"/><circle cx="34.5" cy="4.5" r=".37"/><circle cx="38.5" cy="4.5" r=".37"/><circle cx="34.5" cy="5.5" r=".37"/><circle cx="38.5" cy="5.5" r=".37"/><circle cx="35.5" cy="6.5" r=".37"/><circle cx="36.5" cy="6.5" r=".37"/><circle cx="37.5" cy="6.5" r=".37"/><circle cx="41.5" cy="0.5" r=".37"/><circle cx="42.5" cy="0.5" r=".37"/><circle cx="43.5" cy="0.5" r=".37"/><circle cx="44.5" cy="0.5" r=".37"/><circle cx="40.5" cy="1.5" r=".37"/><circle cx="40.5" cy="2.5" r=".37"/><circle cx="41.5" cy="3.5" r=".37"/><circle cx="42.5" cy="3.5" r=".37"/><circle cx="43.5" cy="3.5" r=".37"/><circle cx="44.5" cy="4.5" r=".37"/><circle cx="44.5" cy="5.5" r=".37"/><circle cx="40.5" cy="6.5" r=".37"/><circle cx="41.5" cy="6.5" r=".37"/><circle cx="42.5" cy="6.5" r=".37"/><circle cx="43.5" cy="6.5" r=".37"/></svg><span class="brandMark" aria-hidden="true"></span></div><small class="brandSub">PRIVATE CLOUD SYSTEM</small></div><div class="headClock"><div><time id="wallClock">--:--</time><small>LOCAL TIME</small></div><button id="logout" class="power" aria-label="خروج" title="خروج"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10M6 5a9 9 0 1 0 12 0"/></svg></button></div></header><nav aria-label="ناوبری"><button id="home" class="primary"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>خانه</button><button id="devices"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/></svg>دستگاه‌ها</button><button id="navCam" disabled><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 9 4-3v12l-4-3"/></svg>دوربین</button><button id="navGallery"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>گالری</button><button id="navDC"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 14h10M7 10h.01M10 10h.01"/></svg>DATA CENTER</button></nav><p id="notice" class="status" role="status"></p><section id="dashboard"><div class="devicesGrid"><div class="deviceTile"><div class="tileTop"><div><span class="tileName">HUB / ESP32</span><h1>سرور مرکزی</h1></div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/></svg></div><b id="online" class="signal" data-state="waiting">در انتظار اتصال</b><p class="muted">آخرین داده: <b id="lastStatus">—</b></p></div></div><button id="refresh" class="full" style="margin-top:12px"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7a9 9 0 0 0-15-1L3 9m0-5v5h5M4 17a9 9 0 0 0 15 1l2-3m0 5v-5h-5"/></svg> تازه‌سازی وضعیت</button></section><section id="manager" hidden><div class="glass"><h2>افزودن دستگاه</h2><p class="muted">جست‌وجو فقط پس از فشردن دکمه آغاز می‌شود.</p><button id="discover" class="primary full">شروع جست‌وجو</button><div id="results"></div><form id="manual"><label for="ip">IP دستی دوربین (اختیاری)</label><input id="ip" placeholder="192.168.x.x"><button style="margin-top:10px" class="full">ثبت دستگاه</button></form><button id="remove" class="danger full" style="margin-top:14px">حذف دستگاه ثبت‌شده</button></div></section><section id="camera" hidden><div class="deviceTile" id="cameraCard" hidden><div class="tileTop"><div><span class="tileName">CAMERA / EYE SKY</span><h2>دوربین</h2></div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 9 4-3v12l-4-3"/></svg></div><p id="cameraStatus" class="signal">در انتظار داده</p><p id="cameraAddress" class="tileName">—</p></div><div class="glass"><div class="row"><h2>EYE / SKY</h2><button id="back" hidden>بازگشت</button></div><div class="cameraLayout"><div class="previewPane"><div class="view"><span class="liveLabel" id="liveLabel" data-live="0">STANDBY</span><img id="frame" alt="تصویر دوربین"><span id="hint">پخش زنده متوقف است</span></div><button id="live" class="primary full">شروع تصویر زنده</button></div><div class="controlPane"><p class="muted">نمایش فریم‌های JPEG درخواستی؛ سرعت واقعی وابسته به شبکه و هاب است.</p><div class="grid"><button data-mode="clock">ساعت</button><button data-mode="camera">دوربین</button><button data-mode="auto">خودکار</button><button data-mode="off">OLED خاموش</button><button data-quality="fast">سرعت QVGA</button><button data-quality="hd">کیفیت VGA</button></div><button id="capture" class="primary full" style="margin-top:12px"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3"/></svg> ثبت عکس</button><button id="gallery" class="full" style="margin-top:10px">گالری کارت حافظه</button></div></div></div></section><section id="photos" hidden><div class="glass"><div class="row"><h2>گالری تصاویر</h2><button id="backCam">بازگشت</button></div><div id="files"></div><div class="row"><button id="prev">قبلی</button><button id="next">بعدی</button></div><div id="photoBox" hidden><div class="view"><img id="photo" alt="عکس ذخیره‌شده"></div><a class="btn" id="download">دانلود عکس اصلی</a></div></div></section><section id="datacenter" hidden><div class="glass dcPanel"><div class="row"><div><span class="tileName">ROHAM / DATA CENTER</span><h1>مرکز داده</h1></div><b id="dcState" class="signal">در انتظار SD</b></div><div class="dcStats"><div class="stat"><small>ظرفیت قابل استفاده</small><b id="dcTotal">—</b></div><div class="stat"><small>فضای آزاد</small><b id="dcFree">—</b></div><div class="stat"><small>فضای مصرف‌شده</small><b id="dcUsed">—</b></div><div class="stat"><small>نوع فایل‌سیستم</small><b id="dcFs">—</b></div></div><div class="dcMeter"><progress id="dcUsage" max="100" aria-label="مصرف کارت حافظه"></progress><b id="dcPercent">—</b></div><p id="dcSpaceNote" class="muted"></p><div class="dcStats"><div class="stat"><small>نرخ خواندن SD (آخرین نمونه)</small><b id="dcReadRate">—</b></div><div class="stat"><small>نرخ نوشتن SD (آخرین نمونه)</small><b id="dcWriteRate">—</b></div></div><button id="dcRefresh" class="full">تازه‌سازی فهرست</button><button id="dcMount" class="full" style="margin-top:8px">بررسی / اتصال مجدد کارت</button></div><div class="glass dcPanel"><div class="row"><h2>فایل‌منیجر</h2><b id="dcPath" dir="ltr">/</b></div><div class="dcTools"><button id="dcUp">پوشه بالاتر</button><button id="dcMkdir">پوشه جدید</button><button id="dcPick" class="primary">آپلود فایل</button><input type="file" id="dcFile" hidden></div><small class="muted">حد آپلود هر فایل: ۳۲ MiB؛ پوشه‌ها فقط در صورت خالی بودن حذف می‌شوند.</small><div id="dcEntries"></div><div class="row"><button id="dcPrev">قبلی</button><button id="dcNext">بعدی</button></div><div id="dcTransfer" hidden><p id="dcProgressText" role="status"></p><progress id="dcProgress" max="100" value="0" aria-label="پیشرفت انتقال"></progress><button id="dcCancel">لغو انتقال</button></div><div id="dcPreview" hidden><div class="view"><img id="dcImage" alt="پیش‌نمایش تصویر"></div><button id="dcClose">بستن تصویر</button></div></div></section><section id="metricsPanel" aria-label="شاخص‌های هاب"><div class="metricHead"><small>SYSTEM / TELEMETRY</small><b id="metricFresh">در انتظار داده</b></div><div class="metricsGrid" id="metricsGrid" data-stale="1"><div class="metric"><span class="label">CPU</span><b class="value" id="cpu">—</b><div class="dots" id="cpuBar" role="meter" aria-label="مصرف پردازنده" aria-valuemin="0" aria-valuemax="100" aria-valuetext="ناموجود"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div><small class="sub" id="cores">میانگین هسته‌ها</small></div><div class="metric"><span class="label">Memory</span><b class="value" id="ramUsed">—</b><div class="dots" id="ramBar" role="meter" aria-label="مصرف حافظه" aria-valuemin="0" aria-valuemax="100" aria-valuetext="ناموجود"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div><small class="sub" id="ramDetail" style="direction:ltr">Heap آزاد / کل</small></div><div class="metric"><span class="label">Uptime</span><b class="value" id="uptime">—</b><small class="sub">زمان فعالیت هاب</small></div></div><div class="extra"><div class="stat"><small><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01"/></svg> قدرت وای‌فای</small><b id="rssi">—</b></div><div class="stat"><small><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/></svg> حافظه آزاد</small><b id="heap">—</b></div><div class="stat"><small>تأخیر دیتاسنتر</small><b id="rtt">—</b></div><div class="stat"><small>دستگاه ثبت‌شده</small><b id="count">—</b></div></div><div class="presenceCard" id="presenceCard" data-stale="1"><div class="metricHead"><h2>ورود به پنل</h2><small>ACCESS / SESSIONS</small></div><div class="presenceGrid"><div class="presenceStat"><small>نشست‌های معتبر</small><b id="signedInCount">—</b></div><div class="presenceStat"><small>آنلاین اکنون</small><b id="onlineCount">—</b></div></div><p id="presenceNote" class="presenceNote" role="status">در انتظار اطلاعات ورود…</p></div></section><footer>ROHAM OS · CLOUD 1.4.0 · DATA CENTER</footer></main><script>
const $=id=>document.getElementById(id);let running=false,liveTask=null,busy=false,frameUrl='',photoUrl='',page=[0],next=null,hasCamera=false,activePage='dashboard';const msg=t=>$('notice').textContent=t;

function wallTime(){const t=new Date();$('wallClock').textContent=t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}
wallTime();setInterval(wallTime,1000);
function drawDots(id, value){const el=$(id),valid=Number.isFinite(value)&&value>=0&&value<=100;const n=valid?Math.round(value*el.children.length/100):0;for(let i=0;i<el.children.length;i++)el.children[i].classList.toggle('on',i<n);el.classList.toggle('high',valid&&value>=85);if(valid){el.setAttribute('aria-valuenow',String(value));el.setAttribute('aria-valuetext',String(value)+'%')}else{el.removeAttribute('aria-valuenow');el.setAttribute('aria-valuetext','ناموجود')}}
function markMetrics(state){if(state!=='live')dcOffline();$('metricsGrid').dataset.stale=state==='live'?'0':'1';$('metricFresh').textContent=state==='live'?'داده زنده':state==='legacy'?'آخرین نمونهٔ دستی':state==='offline'?'هاب آفلاین':state==='waiting'?'در انتظار داده':'داده قدیمی / در حال اتصال';$('online').dataset.state=state;}
function formatUptime(sec){if(!Number.isFinite(sec)||sec<0)return '—';const t=Math.floor(sec),p=n=>String(n).padStart(2,'0');return p(Math.floor(t/3600))+':'+p(Math.floor(t/60)%60)+':'+p(t%60)}
function renderMeters(s){const validCpu=Number.isInteger(s.cpuPct)&&s.cpuPct>=0&&s.cpuPct<=100;const total=Number.isFinite(s.heapTotal)&&s.heapTotal>0?s.heapTotal:null;const free=Number.isFinite(s.heap)&&s.heap>=0?s.heap:null;const validRam=total!==null&&free!==null&&free<=total;const percent=validRam?Math.round(100*(total-free)/total):null;$('cpu').textContent=validCpu?s.cpuPct+'%':'—';drawDots('cpuBar',validCpu?s.cpuPct:null);const cores=[s.cpu0,s.cpu1].map((v,i)=>Number.isInteger(v)&&v>=0&&v<=100?'C'+i+' '+v+'%':null).filter(Boolean);$('cores').textContent=cores.length?cores.join(' · '):'نمونه‌برداری CPU ناموجود';$('ramUsed').textContent=validRam?percent+'%':'—';drawDots('ramBar',percent);$('ramDetail').textContent=validRam?'Free '+Math.round(free/1024)+' / '+Math.round(total/1024)+' KB':free!==null?'Free '+Math.round(free/1024)+' KB · total unavailable':'در انتظار دادهٔ حافظه';$('heap').textContent=free!==null?Math.round(free/1024)+' KB':'—';$('rssi').textContent=Number.isFinite(s.rssi)?s.rssi+' dBm':'—';$('rtt').textContent=Number.isFinite(s.cloudRttMs)&&s.cloudRttMs>0?s.cloudRttMs+' ms':'—';$('uptime').textContent=formatUptime(s.uptime);hasCamera=!!s.camera;$('count').textContent=hasCamera?'۱':'۰';$('cameraCard').hidden=!hasCamera;$('navCam').disabled=!hasCamera;$('cameraAddress').textContent=s.camera?.ip||'—';$('cameraStatus').textContent=s.camera?.online===null?'در حال بررسی دوربین':s.camera?.online?'دوربین متصل':'دوربین آفلاین';$('cameraStatus').dataset.state=s.camera?.online?'live':'offline';if(!hasCamera&&(activePage==='camera'||activePage==='photos'))show('dashboard');}

async function request(path,body,signal){const ctl=signal?null:new AbortController(),timer=ctl?setTimeout(()=>ctl.abort(),65000):0;let r;try{r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify(body),cache:'no-store',signal:signal||ctl.signal})}finally{if(timer)clearTimeout(timer)};if(r.status===401){location.reload();throw Error('Session expired')}if(!r.ok){let d;try{d=await r.json()}catch{}throw Error(d?.error||'HTTP '+r.status)}return r}
async function rpc(op,arg){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),65000);try{const r=await request('/rpc',arg===undefined?{op}:{op,arg},ctl.signal);return await (['frame','photo','dc_read','dc_photo'].includes(op)?r.blob():r.json())}finally{clearTimeout(timer)}}
function stop(){running=false;$('liveLabel').textContent='STANDBY';$('liveLabel').dataset.live='0';$('live').textContent='شروع تصویر زنده';$('frame').removeAttribute('src');$('hint').hidden=false;if(frameUrl){URL.revokeObjectURL(frameUrl);frameUrl=''}}
function clearPhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';$('photoBox').hidden=true;$('photo').removeAttribute('src');$('download').removeAttribute('href')}
function show(id){if(dcTransferActive)return;stop();clearPhoto();activePage=id;$('metricsPanel').hidden=id!=='dashboard';for(const p of ['dashboard','manager','camera','photos','datacenter'])$(p).hidden=p!==id;$('back').hidden=id!=='camera';$('home').classList.toggle('primary',id==='dashboard');$('devices').classList.toggle('primary',id==='manager');$('navCam').classList.toggle('primary',id==='camera');$('navGallery').classList.toggle('primary',id==='photos');$('navDC').classList.toggle('primary',id==='datacenter');dcResetPreview()}
async function action(fn){if(busy)return;busy=true;stop();try{if(liveTask)await liveTask;msg('در حال انجام…');await fn();}catch(e){msg('خطا: '+e.message)}finally{busy=false}}
let statusSocket=null, retryTimer=0, connectionTimer=0, staleTimer=0;
let statusAttempts=0, statusEpoch=0, paused=false, legacySeen=false;

function renderMetrics(s) { renderMeters(s); if(s.storage)dcDraw(s.storage);else dcOffline(); }
let presenceSeen=0, presenceTimer=0;
function markPresenceStale(){ $('presenceCard').dataset.stale='1'; $('presenceNote').textContent='آخرین شمارش معتبر نیست؛ در حال به‌روزرسانی'; }
function renderPresence(data){
  if(data?.type!=='panel-presence'||!Number.isSafeInteger(data.signedIn)||!Number.isSafeInteger(data.online)||data.signedIn<0||data.online<0||data.online>data.signedIn||!Number.isFinite(data.seenAt)||data.seenAt<presenceSeen)return;
  presenceSeen=data.seenAt;
  $('signedInCount').textContent=data.signedIn.toLocaleString('fa-IR');
  $('onlineCount').textContent=data.online.toLocaleString('fa-IR');
  $('presenceCard').dataset.stale='0';
  $('presenceNote').textContent='آخرین شمارش: '+new Date(data.seenAt).toLocaleTimeString('fa-IR')+' · چند تب یک نشست است.';
  clearTimeout(presenceTimer);presenceTimer=setTimeout(markPresenceStale,90000);
}
let presencePending=false;
async function refreshPresence(){
  if(presencePending||document.hidden||paused)return;
  presencePending=true;
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),5000);
  try{const response=await fetch('/sessions',{cache:'no-store',signal:ctrl.signal});if(response.status===401){location.reload();return}if(!response.ok)throw Error('Sessions unavailable');renderPresence(await response.json());}
  catch{markPresenceStale()}finally{clearTimeout(timer);presencePending=false}
}
setInterval(refreshPresence,60000);

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
    if(state?.type==='panel-presence'){renderPresence(state);return;}
    clearTimeout(connectionTimer);
    statusAttempts=0;
    applyHubState(state);
  };
  socket.onclose=e=>{
    if (statusSocket!==socket) return;
    statusSocket=null;
    markPresenceStale();
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
function refreshStatus(){refreshPresence();return action(async()=>{await status(true);msg('')})}
$('home').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('devices').onclick=()=>show('manager');$('refresh').onclick=refreshStatus;$('back').onclick=()=>{show('dashboard');if(legacySeen)refreshStatus()};$('logout').onclick=async()=>{stop();pauseStatusStream();try{await request('/logout',{});location.reload()}catch(e){paused=false;connectStatusStream();refreshPresence();msg(e.message)}};
async function register(a){await rpc('register',a);msg('دستگاه ثبت شد.');await status();show('dashboard')}
$('discover').onclick=()=>action(async()=>{const d=await rpc('discover');$('results').replaceChildren();for(const item of (Array.isArray(d.devices)?d.devices:[]).slice(0,16)){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=item.name||'EYE';const b=document.createElement('button');b.textContent='افزودن';b.onclick=()=>action(()=>register(item.id||item.ip));row.append(label,b);$('results').append(row)}msg($('results').children.length?'دستگاه را انتخاب کن.':'دستگاهی پیدا نشد.')});$('manual').onsubmit=e=>{e.preventDefault();action(()=>register($('ip').value.trim()))};$('remove').onclick=()=>{if(confirm('دوربین از فهرست حذف شود؟ عکس‌ها پاک نمی‌شوند.'))action(async()=>{await rpc('remove');await status()})};
async function liveLoop(){while(running&&!document.hidden){try{const b=await rpc('frame');if(!running)break;const u=URL.createObjectURL(b);$('frame').src=u;$('hint').hidden=true;$('liveLabel').textContent='LIVE';$('liveLabel').dataset.live='1';if(frameUrl)URL.revokeObjectURL(frameUrl);frameUrl=u;await new Promise(r=>setTimeout(r,100))}catch(e){msg(e.message);stop()}}}
$('live').onclick=()=>{if(running){stop();return}if(busy||liveTask)return;running=true;$('live').textContent='توقف تصویر';liveTask=liveLoop().finally(()=>{liveTask=null})};document.querySelectorAll('[data-mode],[data-quality]').forEach(b=>b.onclick=async()=>{if(busy)return;const resume=running;let ok=false;await action(async()=>{await rpc(b.dataset.mode?'mode':'quality',b.dataset.mode||b.dataset.quality);ok=true;msg('فرمان انجام شد.')});if(resume&&ok&&activePage==='camera'&&!document.hidden&&!running&&!busy&&!liveTask)$('live').click()});$('capture').onclick=()=>action(async()=>{const r=await rpc('capture');msg(r.saved?'عکس روی SD دیتاسنتر ذخیره شد: '+(r.path||''):'ذخیره تأیید نشد؛ گالری را بررسی کن.')});
async function gallery(){clearPhoto();let d=await rpc('gallery',page.at(-1));for(let i=0;i<4&&!d.files?.length&&d.more&&d.next!==page.at(-1);i++){page[page.length-1]=d.next;d=await rpc('gallery',d.next)}next=d.more?d.next:null;$('files').replaceChildren();for(const f of (d.files||[])){const row=document.createElement('div');row.className='row file';const label=document.createElement('b');label.textContent=f.name+' · '+Math.round(f.size/1024)+' KB';const view=document.createElement('button');view.textContent='مشاهده';view.onclick=()=>action(async()=>{clearPhoto();photoUrl=URL.createObjectURL(await (f.path?rpc('dc_photo',{path:f.path}):rpc('photo',f.name)));$('photo').src=photoUrl;$('download').href=photoUrl;$('download').download=f.name;$('photoBox').hidden=false;msg('عکس آماده است.')});const del=document.createElement('button');del.className='danger';del.textContent='حذف';del.onclick=()=>{if(confirm('حذف دائمی '+f.name+'؟'))action(async()=>{await (f.path?rpc('dc_remove',{path:f.path}):rpc('delete',f.name));page=[0];await gallery()})};row.append(label,view,del);$('files').append(row)}$('prev').disabled=page.length===1;$('next').disabled=next===null;msg('')}
$('gallery').onclick=()=>{show('photos');page=[0];action(gallery)};$('navCam').onclick=()=>show('camera');$('navGallery').onclick=()=>{show('photos');page=[0];action(gallery)};$('backCam').onclick=()=>show(hasCamera?'camera':'dashboard');$('prev').onclick=()=>action(async()=>{if(page.length>1)page.pop();await gallery()});$('next').onclick=()=>action(async()=>{if(next!==null)page.push(next);await gallery()});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',()=>{stop();pauseStatusStream()});
window.addEventListener('pageshow',()=>{paused=false;connectStatusStream();refreshPresence()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPresence()});
window.addEventListener('online',()=>{
  if(paused)return;
  refreshPresence();
  if(statusSocket)statusSocket.close();
  else if(!retryTimer)connectStatusStream();
});
// Data Center UI. Reads and uploads have bounded blocks; no whole file on hub RAM.
let dcFolder='/',dcCursors=[0],dcNextCursor=null,dcPreviewURL='',dcCancelled=false,dcTransferActive=false,dcPollBusy=false;
const dcFmt=n=>!Number.isFinite(n)||n<0?'—':n>=1073741824?(n/1073741824).toFixed(2)+' GiB':n>=1048576?(n/1048576).toFixed(2)+' MiB':n>=1024?(n/1024).toFixed(1)+' KiB':n+' B';
const dcJoin=(p,n)=>p==='/'?'/'+n:p+'/'+n;
function dcDraw(s){
 if(!s||typeof s.mounted!=='boolean')return;
 $('dcState').textContent=s.scanning?'در حال بررسی SD…':s.mounted?(s.writable?'SD متصل':'فقط خواندن'):'SD در دسترس نیست';$('dcState').dataset.state=s.scanning?'stale':s.mounted?'live':'offline';
 const ok=s.mounted&&s.known&&Number.isSafeInteger(s.total)&&Number.isSafeInteger(s.free)&&s.total>0&&s.free>=0&&s.free<=s.total;
 $('dcTotal').textContent=ok?dcFmt(s.total):'—';$('dcFree').textContent=ok?dcFmt(s.free):'—';$('dcUsed').textContent=ok?dcFmt(s.total-s.free):'—';$('dcFs').textContent=s.mounted?(s.fs===64?'exFAT':'FAT'+s.fs):'—';
 const pct=ok?100*(s.total-s.free)/s.total:null;if(pct===null)$('dcUsage').removeAttribute('value');else $('dcUsage').value=pct;$('dcPercent').textContent=pct===null?'—':pct.toFixed(1)+'%';
 $('dcSpaceNote').textContent=ok?'ظرفیت فیزیکی: '+dcFmt(s.card)+(s.dirty?' · فضای آزاد آخرین اندازه‌گیری است؛ محاسبه مجدد در زمان بیکاری':' · فضای آزاد اندازه‌گیری‌شده'):'کارت یا اطلاعات ظرفیت هنوز آماده نیست.';
 $('dcReadRate').textContent=s.mounted&&s.readBps?dcFmt(s.readBps)+'/s · '+Math.round(s.readAge/1000)+'s پیش':'—';$('dcWriteRate').textContent=s.mounted&&s.writeBps?dcFmt(s.writeBps)+'/s · '+Math.round(s.writeAge/1000)+'s پیش':'—';
}
function dcOffline(){ $('dcState').textContent='ارتباط یا داده SD قدیمی';$('dcState').dataset.state='stale';$('dcSpaceNote').textContent='اطلاعات فعلی ممکن است قدیمی باشد.'; }
async function dcCall(op,arg){return rpc(op,arg)}
async function dcRetry(op,arg){for(let i=0;;i++){try{return await dcCall(op,arg)}catch(e){if(i>=5||!/(busy|409)/i.test(e.message))throw e;await new Promise(r=>setTimeout(r,300*(i+1)))}}}
function dcResetPreview(){if(dcPreviewURL)URL.revokeObjectURL(dcPreviewURL);dcPreviewURL='';$('dcImage').removeAttribute('src');$('dcPreview').hidden=true}
function dcProgress(done,total,start,label){const percent=total?100*done/total:100;$('dcProgress').value=percent;$('dcProgressText').textContent=label+' · '+dcFmt(done)+' / '+dcFmt(total)+' · '+percent.toFixed(1)+'% · '+dcFmt(Math.round(done*1000/Math.max(1,Date.now()-start)))+'/s';}
function dcTransferStart(){dcCancelled=false;dcTransferActive=true;$('dcTransfer').hidden=false;$('dcProgress').value=0;$('dcCancel').disabled=false}
function dcTransferEnd(){dcTransferActive=false;$('dcCancel').disabled=true}
function dcButton(label,handler,cls=''){const b=document.createElement('button');b.textContent=label;if(cls)b.className=cls;b.onclick=()=>action(handler);return b;}
async function dcListFiles(){
 dcResetPreview();$('dcPath').textContent=dcFolder;$('dcEntries').replaceChildren();$('dcNext').disabled=true;
 const d=await dcRetry('dc_list',{path:dcFolder,cursor:dcCursors.at(-1)});dcNextCursor=d.more?d.next:null;
 for(const f of d.files||[]){const p=dcJoin(dcFolder,f.name),row=document.createElement('div');row.className='dcFile';const info=document.createElement('div');const title=document.createElement('b'),detail=document.createElement('small');title.textContent=(f.dir?'▸ ':'')+f.name;detail.textContent=f.dir?'پوشه':dcFmt(f.size);info.append(title,detail);const buttons=document.createElement('div');buttons.className='dcFileButtons';
 if(f.dir)buttons.append(dcButton('باز کردن',async()=>{dcFolder=p;dcCursors=[0];await dcListFiles()}));else{if(/\\.(jpe?g|png|gif|webp)$/i.test(f.name))buttons.append(dcButton('مشاهده',()=>dcGet(p,true)));buttons.append(dcButton('دانلود',()=>dcGet(p,false)));}
 buttons.append(dcButton('تغییر نام',async()=>{const n=prompt('نام جدید',f.name);if(!n||n===f.name)return;if(n.includes('/'))throw Error('نام پوشه یا فایل نباید / داشته باشد');await dcRetry('dc_rename',{path:p,to:dcJoin(dcFolder,n)});dcCursors=[0];await dcListFiles()}));
 buttons.append(dcButton('حذف',async()=>{if(!confirm('حذف دائمی '+f.name+'؟'))return;await dcRetry('dc_remove',{path:p});dcCursors=[0];await dcListFiles()},'danger'));row.append(info,buttons);$('dcEntries').append(row);}
 if(!$('dcEntries').children.length){const t=document.createElement('p');t.className='muted';t.textContent=d.more?'صفحه بعد را بررسی کن.':'پوشه خالی است.';$('dcEntries').append(t)}
 $('dcUp').disabled=dcFolder==='/';$('dcPrev').disabled=dcCursors.length===1;$('dcNext').disabled=dcNextCursor===null;
}
async function dcOpen(){if(busy)return;show('datacenter');await action(async()=>{dcDraw(await dcRetry('dc_status'));await dcListFiles();msg('')})}
$('navDC').onclick=dcOpen;$('dcRefresh').onclick=()=>action(async()=>{dcCursors=[0];dcDraw(await dcRetry('dc_status'));await dcListFiles();msg('')});$('dcMount').onclick=()=>{if(confirm('در زمان اتصال مجدد کارت، انتقال فعال نباشد. ادامه؟'))action(async()=>{dcDraw(await dcRetry('dc_mount'));dcCursors=[0];msg('در حال بررسی کارت؛ پس از آماده شدن فهرست را تازه کن.')})};
$('dcUp').onclick=()=>action(async()=>{dcFolder=dcFolder.slice(0,dcFolder.lastIndexOf('/'))||'/';dcCursors=[0];await dcListFiles()});$('dcPrev').onclick=()=>action(async()=>{if(dcCursors.length>1)dcCursors.pop();await dcListFiles()});$('dcNext').onclick=()=>action(async()=>{if(dcNextCursor!==null)dcCursors.push(dcNextCursor);await dcListFiles()});
$('dcMkdir').onclick=()=>action(async()=>{const n=prompt('نام پوشه');if(!n)return;if(n.includes('/'))throw Error('نام نامعتبر');await dcRetry('dc_mkdir',{path:dcJoin(dcFolder,n)});dcCursors=[0];await dcListFiles()});
$('dcPick').onclick=()=>{if(!busy)$('dcFile').click()};$('dcCancel').onclick=()=>{dcCancelled=true;$('dcCancel').disabled=true};$('dcClose').onclick=dcResetPreview;
$('dcFile').onchange=()=>{const f=$('dcFile').files[0];$('dcFile').value='';if(f)action(()=>dcPut(f))};
async function dcPut(file){
 if(file.size>32*1024*1024)throw Error('حد آپلود ۳۲ MiB است');let token='',committed=false;const start=Date.now(),path=dcJoin(dcFolder,file.name);dcTransferStart();dcProgress(0,file.size,start,'آپلود');
 try{const r=await dcRetry('dc_begin',{path,size:file.size});token=r.token;if(!/^[0-9a-f]{32}$/.test(token))throw Error('Upload token invalid');let off=0;while(off<file.size){if(dcCancelled)throw Error('انتقال لغو شد');const bytes=new Uint8Array(await file.slice(off,off+4096).arrayBuffer());let str='';for(const byte of bytes)str+=String.fromCharCode(byte);const a=await dcRetry('dc_write',{token,offset:off,data:btoa(str)});if(a.offset!==off+bytes.length)throw Error('Upload acknowledgement mismatch');off=a.offset;dcProgress(off,file.size,start,'آپلود');}if(dcCancelled)throw Error('انتقال لغو شد');await dcRetry('dc_commit',{token});committed=true;dcProgress(file.size,file.size,start,'ذخیره تأیید شد');dcCursors=[0];await dcListFiles();msg('فایل روی SD ذخیره شد.');}finally{if(token&&!committed)try{await dcRetry('dc_abort',{token})}catch{}dcTransferEnd();}
}
async function dcGet(path,preview){
 const stat=await dcRetry('dc_stat',{path});const size=stat.size;if(stat.dir||!Number.isSafeInteger(size)||size<0)throw Error('فایل نامعتبر');
 if(preview&&size>16*1024*1024)throw Error('حد پیش‌نمایش ۱۶ MiB است؛ فایل را دانلود کن.');
 const name=path.slice(path.lastIndexOf('/')+1);const start=Date.now();dcTransferStart();dcProgress(0,size,start,'دانلود');
 let token='',parts=[];
 try{
   // iOS/browser fallback: large files are streamed directly to native download manager.
   if(!preview&&size>16*1024*1024){const a=document.createElement('a');a.href='/dc-download?path='+encodeURIComponent(path);a.download=name;document.body.append(a);a.click();a.remove();$('dcProgressText').textContent='دانلود به مدیر دانلود مرورگر تحویل شد؛ پیشرفت را آنجا ببین.';$('dcProgress').removeAttribute('value');return;}
   const opened=await dcRetry('dc_openread',{path});token=opened.token;if(!/^[a-f0-9]{32}$/.test(token)||opened.size!==size)throw Error('فایل تغییر کرده است');let off=0;while(off<size){if(dcCancelled)throw Error('انتقال لغو شد');const length=Math.min(65536,size-off),blob=await dcRetry('dc_read',{path,offset:off,length,size,token});if(blob.size!==length)throw Error('بلوک ناقص');parts.push(blob);off+=length;dcProgress(off,size,start,'دانلود');}
   if(dcCancelled)throw Error('انتقال لغو شد');const suffix=name.split('.').pop().toLowerCase();const types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp'};const blob=new Blob(parts,{type:preview?(types[suffix]||'application/octet-stream'):'application/octet-stream'});const url=URL.createObjectURL(blob);if(preview){dcResetPreview();dcPreviewURL=url;$('dcImage').src=url;$('dcPreview').hidden=false}else{const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}dcProgress(size,size,start,'دریافت کامل');
 }finally{if(token)try{await dcRetry('dc_endread',{token})}catch{}dcTransferEnd();}
}
// SD metrics arrive in the existing telemetry stream; no extra polling RPC.

connectStatusStream();refreshPresence();
</script></html>`;
