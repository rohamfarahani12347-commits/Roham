import panel from '../site/panel.html';
import login from '../site/login.html';

const cloudPanel = panel.replace('data-mode="local"', 'data-mode="cloud"');
const SESSION = 'roham_session';
const SESSION_SECONDS = 12 * 3600;
const MAX_PHOTO = 2_000_000;
const MAX_UPLOAD = 8 * 1024 * 1024;
const UPLOAD_BLOCK = 4096;
const FILE_KEY = /^[a-f0-9]{32}\.[A-Za-z0-9_-]{1,112}$/;
const HEADER_BYTES = 36;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const standard = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status, headers: {...standard, 'Content-Type':'application/json; charset=utf-8', ...headers},
  });
}

function html(source) {
  return new Response(source, {
    headers: {...standard, 'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"},
  });
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
}

function constantEqual(left,right) {
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}

async function digest(text) {
  return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
}

function settings(env) {
  return {master:env.MASTER_TOKEN||'', password:env.SITE_PASSWORD||env.PASSWORD||''};
}

async function signature(value, {master,password}) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(JSON.stringify(['ROHAM V4',master,password])),
                                         {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}

function cookie(value) {
  return `${SESSION}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value?SESSION_SECONDS:0}`;
}

async function hasSession(request, secrets) {
  if(!secrets.master||!secrets.password)return false;
  const item=request.headers.get('Cookie')?.split(';').map(part=>part.trim())
    .find(part=>part.startsWith(SESSION+'='));
  const value=item?.slice(SESSION.length+1)||'';
  const match=/^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if(!match)return false;
  const now=Math.floor(Date.now()/1000), expiry=Number(match[1]);
  return expiry>now && expiry<=now+SESSION_SECONDS &&
    constantEqual(match[3],await signature(match[1]+'.'+match[2],secrets));
}

function safePost(request, url) {
  const origin=request.headers.get('Origin');
  return request.headers.get('X-Roham-Panel')==='1' && (!origin||origin===url.origin);
}

async function readSmallJson(request) {
  const reader=request.body?.getReader();
  if(!reader)return null;
  const buffer=new Uint8Array(2048);
  let used=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value.length>buffer.length-used){await reader.cancel();return null;}
      buffer.set(value,used);used+=value.length;
    }
    return JSON.parse(decoder.decode(buffer.subarray(0,used)));
  }catch{return null;}
}

function hub(env) {return env.HUB.get(env.HUB.idFromName('cluster'));}

async function checkLogin(request, env, secrets) {
  if(!secrets.master||!secrets.password)return json({error:'configuration missing'},503);
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  const limiter=env.LOGIN_LIMIT.get(env.LOGIN_LIMIT.idFromName(await digest(ip)));
  const permit=await limiter.fetch('https://internal/check',{method:'POST'});
  if(!permit.ok)return json({error:'try again later'},429,{'Retry-After':'300'});
  const values=await readSmallJson(request);
  if(typeof values?.password!=='string'||values.password.length>200||
     !constantEqual(await digest(values.password),await digest(secrets.password))){
    return json({error:'invalid login'},401);
  }
  await limiter.fetch('https://internal/reset',{method:'POST'});
  const expiry=Math.floor(Date.now()/1000)+SESSION_SECONDS;
  const value=expiry+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  return json({ok:true},200,{'Set-Cookie':cookie(value+'.'+await signature(value,secrets))});
}

function photoName(id) {return 'IMG'+String(id).padStart(5,'0')+'.jpg';}

function makeFileKey(name) {
  if (typeof name !== 'string' || !name.trim() || /[\x00-\x1f\x7f/\\]/.test(name)) return null;
  const bytes = encoder.encode(name);
  if (bytes.length > 84) return null;
  const label = btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  return crypto.randomUUID().replaceAll('-','') + '.' + label;
}

function fileName(key) {
  if (!FILE_KEY.test(key)) return null;
  try {
    const name = decoder.decode(Uint8Array.from(atob(key.slice(33).replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0)));
    return name && !/[\x00-\x1f\x7f/\\]/.test(name) ? name : null;
  } catch { return null; }
}

function attachment(key) {
  const encoded=encodeURIComponent(fileName(key)||'download').replace(/['()*!]/g,c=>'%'+c.charCodeAt(0).toString(16));
  return "attachment; filename=download; filename*=UTF-8''"+encoded;
}

async function handleFileRoute(request,url,env) {
  const stub=hub(env);
  if (url.pathname==='/uploads' && request.method==='POST') {
    const name=url.searchParams.get('name');
    const key=makeFileKey(name);
    const declared=url.searchParams.get('size');
    if (!key || !/^\d{1,8}$/.test(declared||'')) return json({error:'invalid filename or size'},400);
    const size=Number(declared);
    if (size>MAX_UPLOAD) return json({error:'file too large'},413);
    const length=request.headers.get('Content-Length');
    if (length!==null && Number(length)!==size) return json({error:'upload size mismatch'},400);
    const target=new URL('https://internal/upload');
    target.searchParams.set('key',key);
    target.searchParams.set('size',String(size));
    return stub.fetch(target.toString(),{method:'POST',body:request.body});
  }
  if (url.pathname==='/uploads' && request.method==='GET') {
    const offset=url.searchParams.get('offset')??'0';
    if (!/^\d{1,7}$/.test(offset) || Number(offset)>1_000_000) return json({error:'invalid offset'},400);
    const result=await stub.fetch('https://internal/command',{
      method:'POST',body:JSON.stringify({op:'fileList',arg:Number(offset)})
    });
    if (!result.ok) return result;
    const output=await result.json();
    if (!Array.isArray(output.files)) return json({error:'invalid file list'},502);
    const files=output.files.flatMap(item=>{
      const name=typeof item?.key==='string' ? fileName(item.key) : null;
      return name && Number.isInteger(item.size) && item.size>=0 && item.size<=MAX_UPLOAD
        ? [{key:item.key,name,size:item.size}] : [];
    });
    return json({files,more:output.more===true,next:Number(offset)+8});
  }
  if (request.method==='GET' && url.pathname.startsWith('/uploads/')) {
    const key=url.pathname.slice('/uploads/'.length);
    if (!fileName(key)) return json({error:'invalid file key'},404);
    return stub.fetch('https://internal/command',{method:'POST',body:JSON.stringify({op:'fileDownload',arg:key,image:true})});
  }
  return json({error:'unknown file route'},404);
}

function timedRead(reader) {
  let timer;
  return Promise.race([
    reader.read(),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('upload stream stalled')),10000);})
  ]).finally(()=>clearTimeout(timer));
}

function commandFor(method,url) {
  const path=url.pathname;
  if(method==='GET'){
    if(path==='/frame')return {op:'frame',image:true};
    if(path==='/latest')return {op:'photo',arg:'latest',image:true};
    if(path==='/gallery'){
      const offset=url.searchParams.get('offset')??'0';
      if(/^\d{1,7}$/.test(offset)&&Number(offset)<=1_000_000)return {op:'gallery',arg:Number(offset)};
    }
    const photo=/^\/photo\/([1-9]\d{0,8})$/.exec(path);
    if(photo)return {op:'photo',arg:photoName(photo[1]),image:true};
  }else if(method==='POST'){
    if(path==='/capture')return {op:'capture'};
    const target=/^\/delete\/([1-9]\d{0,8})$/.exec(path);
    if(target)return {op:'delete',arg:photoName(target[1])};
    const epoch=url.searchParams.get('epoch');
    if(path==='/time'&&/^\d{10}$/.test(epoch||'')&&Number(epoch)>=1_700_000_000&&Number(epoch)<=2_147_483_647)
      return {op:'time',arg:epoch};
  }
  return null;
}

function offlineState() {
  return {hub:false,dataSd:null,cameraSd:null,last:0,nodes:['MEDIA','DATA','CAM','WEB'].map(role=>({role,online:false}))};
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url), method=request.method, secrets=settings(env);
    if(url.pathname==='/master'){
      const bearer=request.headers.get('Authorization')||'';
      if(!secrets.master||!constantEqual(await digest(bearer),await digest('Bearer '+secrets.master)))
        return json({error:'unauthorized'},401);
      if(method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
        return json({error:'websocket required'},426);
      return hub(env).fetch('https://internal/master',{headers:{Upgrade:'websocket'}});
    }
    if(method==='POST'&&url.pathname==='/login'){
      if(!safePost(request,url))return json({error:'forbidden'},403);
      return checkLogin(request,env,secrets);
    }
    const session=await hasSession(request,secrets);
    if(method==='GET'&&(url.pathname==='/'||url.pathname==='/login'||url.pathname==='/panel'))
      return html(session?cloudPanel:login);
    if(!session)return json({error:'login required'},401);
    if(method==='POST'&&!safePost(request,url))return json({error:'forbidden'},403);
    if(method==='POST'&&url.pathname==='/logout')return json({ok:true},200,{'Set-Cookie':cookie('')});
    if(method==='GET'&&(url.pathname==='/api/cluster'||url.pathname==='/data-status')){
      const state=await (await hub(env).fetch('https://internal/status')).json();
      return json(url.pathname==='/api/cluster'?state:{sd:state.dataSd,last:state.last});
    }
    if(url.pathname==='/uploads'||url.pathname.startsWith('/uploads/')) return handleFileRoute(request,url,env);
    const command=commandFor(method,url);
    if(!command)return json({error:'unknown command'},404);
    return hub(env).fetch('https://internal/command',{method:'POST',body:JSON.stringify(command)});
  }
};

export class LoginLimit {
  constructor(ctx){this.ctx=ctx;}
  async fetch(request){
    if(new URL(request.url).pathname==='/reset'){
      await this.ctx.storage.deleteAll();
      return json({ok:true});
    }
    const now=Date.now();
    const result=await this.ctx.storage.transaction(async txn=>{
      let window=await txn.get('window');
      if(!window||window.until<=now)window={count:0,until:now+300000};
      if(window.count>=5)return {allow:false,until:window.until};
      window.count++;
      await txn.put('window',window);
      return {allow:true,until:window.until};
    });
    await this.ctx.storage.setAlarm(result.until);
    return json({ok:result.allow},result.allow?200:429);
  }
  async alarm(){
    const window=await this.ctx.storage.get('window');
    if(window?.until>Date.now())await this.ctx.storage.setAlarm(window.until);
    else await this.ctx.storage.deleteAll();
  }
}

export class RohamHub {
  constructor(ctx){this.ctx=ctx;this.pending=null;this.uploading=false;this.telemetry=null;this.telemetryAt=0;}
  socket(){return this.ctx.getWebSockets('media').find(socket=>socket.readyState===1);}
  finish(response){
    const op=this.pending;
    if(!op)return;
    this.pending=null;clearTimeout(op.timer);op.resolve(response);
  }
  state(){
    const result=offlineState(), socket=this.socket();
    if(!socket||socket.readyState!==1)return result;
    if(this.telemetry&&Date.now()-this.telemetryAt<15000)return {...this.telemetry,hub:true};
    result.hub=true;result.nodes[0].online=true;
    return result;
  }
  request(socket,command,chunk) {
    if (!socket || socket!==this.socket() || socket.readyState!==1) return Promise.resolve(json({error:'MEDIA unavailable'},503));
    if (this.pending) return Promise.resolve(json({error:'MEDIA busy'},409));
    const id=crypto.randomUUID();
    const timeout=command.op==='frame'?8000:command.op==='fileDownload'?180000:command.op.startsWith('upload')?13000:22000;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>this.finish(json({error:'MEDIA response timeout'},504)),timeout);
      this.pending={id,socket,resolve,timer,op:command.op,key:command.arg,expectsImage:!!command.image,buffer:null,used:0};
      try {
        if (chunk) {
          const frame=new Uint8Array(HEADER_BYTES+chunk.length);
          frame.set(encoder.encode(id));frame.set(chunk,HEADER_BYTES);
          socket.send(frame);
        } else {
          socket.send(JSON.stringify({type:'request',id,op:command.op,arg:command.arg,size:command.size}));
        }
      } catch {this.finish(json({error:'MEDIA unavailable'},503));}
    });
  }

  async uploadStep(socket, command, chunk) {
    for (let attempt=0;;++attempt) {
      const result=await this.request(socket,command,chunk);
      // A busy response is sent before the board handles the frame. Timeouts
      // are ambiguous, so they abort instead of replaying a possibly written block.
      if (result.status!==409 || attempt===3) return result;
      result.body?.cancel().catch(()=>{});
      await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
    }
  }

  async upload(request,url) {
    if (this.uploading||this.pending) return json({error:'MEDIA busy'},409);
    const socket=this.socket();
    if (!socket) return json({error:'MEDIA unavailable'},503);
    const key=url.searchParams.get('key'), size=Number(url.searchParams.get('size'));
    if (!key || !FILE_KEY.test(key) || !Number.isInteger(size) || size<0 || size>MAX_UPLOAD)
      return json({error:'invalid upload'},400);
    this.uploading=true;
    const reader=request.body?.getReader();
    let committed=false;
    try {
      const begin=await this.uploadStep(socket,{op:'uploadBegin',arg:key,size});
      if (!begin.ok) return begin;
      const block=new Uint8Array(UPLOAD_BLOCK);
      let used=0,limit=0;
      while (reader) {
        const {value,done}=await timedRead(reader);
        if (done) break;
        limit+=value.length;
        if (limit>size) return json({error:'upload size mismatch'},400);
        let pos=0;
        while (pos<value.length) {
          const n=Math.min(block.length-used,value.length-pos);
          block.set(value.subarray(pos,pos+n),used);
          used+=n;pos+=n;
          if (used===block.length) {
            const result=await this.uploadStep(socket,{op:'uploadBlock'},block);
            if (!result.ok) return result;
            used=0;
          }
        }
      }
      if (limit!==size) return json({error:'upload size mismatch'},400);
      if (used) {
        const result=await this.uploadStep(socket,{op:'uploadBlock'},block.subarray(0,used));
        if (!result.ok) return result;
      }
      const result=await this.uploadStep(socket,{op:'uploadEnd'});
      if (!result.ok) return result;
      const reply=await result.json();
      if (reply.saved!==true) return json({error:'SD commit was not acknowledged'},502);
      committed=true;
      return json({saved:true,key,name:fileName(key),size},201);
    } catch {
      return json({error:'upload interrupted'},502);
    } finally {
      if (reader) {
        if (!committed) reader.cancel().catch(()=>{});
        reader.releaseLock();
      }
      if (!committed) await this.uploadStep(socket,{op:'uploadAbort'});
      this.uploading=false;
    }
  }

  async fetch(request){
    switch(new URL(request.url).pathname){
      case '/master':{
        this.finish(json({error:'MEDIA reconnected'},503));
        for(const old of this.ctx.getWebSockets('media'))old.close(1000,'New MEDIA session');
        this.telemetry=null;this.telemetryAt=0;
        const [client,server]=Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server,['media']);
        return new Response(null,{status:101,webSocket:client});
      }
      case '/status':
        return json(this.state());
      case '/upload':
        return this.upload(request,new URL(request.url));
      case '/command':{
        if(this.uploading)return json({error:'MEDIA busy'},409);
        const command=await request.json();
        if(this.uploading)return json({error:'MEDIA busy'},409);
        return this.request(this.socket(),command);
      }
      default:return json({error:'unknown route'},404);
    }
  }
  webSocketMessage(socket,message){
    if(socket!==this.socket())return;
    if(message==='ping'){try{socket.send('pong');}catch{}return;}
    const pending=this.pending;
    if(typeof message==='string'){
      let m;
      try{m=JSON.parse(message);}catch{return;}
      if (!m || typeof m!=='object') return;
      if(m.type==='telemetry'){
        if(m.data?.cluster?.nodes?.length===4){
          this.telemetry=m.data.cluster;this.telemetryAt=Date.now();
        }
        return;
      }
      if(!pending||pending.socket!==socket||m.id!==pending.id)return;
      if(m.type==='error'){
        const message=typeof m.error==='string'?m.error:'';
        const missing=(pending.op==='photo'&&message==='Photo unavailable')||
          (pending.op==='fileDownload'&&message==='File unavailable');
        const code=missing?404:message.includes('busy')?409:502;
        this.finish(json({error:m.error||'MEDIA failed'},code));return;
      }
      if(!pending.expectsImage){
        if(m.type==='result')this.finish(json(m.data??{}));
        return;
      }
      const file=pending.op==='fileDownload';
      if(m.type==='begin'){
        if(pending.buffer||!Number.isInteger(m.size)||m.size<(file?0:4)||m.size>(file?MAX_UPLOAD:MAX_PHOTO)){
          this.finish(json({error:'invalid image length'},502));return;
        }
        pending.buffer=new Uint8Array(m.size);
      }else if(m.type==='end'){
        if(!pending.buffer||pending.used!==pending.buffer.length){
          this.finish(json({error:'incomplete image'},502));return;
        }
        const headers={...standard,'Content-Type':file?'application/octet-stream':'image/jpeg'};
        if (file) headers['Content-Disposition']=attachment(pending.key);
        this.finish(new Response(pending.buffer,{headers}));
      }
      return;
    }
    if(!pending||pending.socket!==socket||!pending.expectsImage)return;
    const bytes=new Uint8Array(message);
    if(bytes.length<=HEADER_BYTES||decoder.decode(bytes.subarray(0,HEADER_BYTES))!==pending.id)return;
    const chunk=bytes.subarray(HEADER_BYTES);
    if(!pending.buffer||chunk.length>2048||pending.used+chunk.length>pending.buffer.length){
      this.finish(json({error:'invalid image block'},502));return;
    }
    pending.buffer.set(chunk,pending.used);pending.used+=chunk.length;
  }
  webSocketClose(socket,code,reason){if(this.pending?.socket===socket)this.finish(json({error:'MEDIA disconnected'},503));try{socket.close(code,reason);}catch{}}
  webSocketError(socket){if(this.pending?.socket===socket)this.finish(json({error:'MEDIA disconnected'},503));try{socket.close(1011,'Media I/O error');}catch{}}
}
