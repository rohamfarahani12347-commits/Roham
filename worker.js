// scratch/roham-phone/github/site/panel.html
var panel_default = `<!doctype html>
<html lang="fa" dir="rtl" data-mode="local">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#111816">
<title>ROHAM | اتاق کنترل</title>
<style>
:root{color-scheme:dark;--bg:#101613;--surface:#17211d;--edge:#293a32;--ink:#eff5ed;--sub:#a5b8ac;--green:#bfe98d;--amber:#f3c473;--error:#ffaaa0;--base:#121b17;font:14px/1.65 Tahoma,"Segoe UI",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}button,input{font:inherit}a{color:var(--green)}[hidden]{display:none!important}.shell{max-width:1352px;padding:0 34px 42px;margin:auto}
header{display:flex;justify-content:space-between;align-items:center;min-height:82px;border-bottom:1px solid var(--edge);gap:12px}.brand{display:flex;align-items:center;gap:13px}.brand-mark{width:37px;height:37px;background:var(--green);color:#1d2a18;border-radius:12px;display:grid;place-items:center;font:900 24px/1 system-ui}.wordmark{font:800 16px/1 system-ui;letter-spacing:.17em}.subtitle{display:block;margin-top:4px;color:var(--sub);font-size:11px}.connection{display:flex;align-items:center;gap:8px;color:var(--sub)}.dot{background:#819288;border-radius:50%;width:7px;height:7px;display:inline-block;flex:none}.dot[data-state=up]{background:var(--green);box-shadow:0 0 10px #bfe98d5a}.dot[data-state=down]{background:var(--error)}
.hero{display:flex;justify-content:space-between;align-items:end;gap:16px;padding:27px 0 22px}.hero h1{margin:0;font-size:clamp(24px,3.4vw,40px);line-height:1.4}.hero p{margin:5px 0 0;color:var(--sub)}.hero button{white-space:nowrap}.access{padding:16px;margin-bottom:20px;border:1px solid var(--edge);border-radius:12px;background:var(--surface);display:flex;align-items:end;gap:10px;flex-wrap:wrap}.field{flex:1;min-width:185px;max-width:390px}.field label{display:block;margin-bottom:5px;color:var(--sub)}input{width:100%;min-height:40px;border:1px solid #3f5648;border-radius:8px;padding:6px 10px;background:#0f1813;color:var(--ink);direction:ltr}
.board{display:grid;grid-template-columns:minmax(0,1fr) minmax(268px,315px);gap:18px;align-items:start}.card{background:var(--surface);border:1px solid var(--edge);border-radius:14px;overflow:hidden;min-width:0}.card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 17px;border-bottom:1px solid var(--edge)}h2{font-size:16px;margin:0}.muted{color:var(--sub)}.num{font:500 12px/1.6 ui-monospace,monospace;direction:ltr;unicode-bidi:isolate}.stage{aspect-ratio:16/9;position:relative;display:grid;place-items:center;isolation:isolate;background-color:#0a100d;background-image:linear-gradient(#58766118 1px,transparent 1px),linear-gradient(90deg,#58766118 1px,transparent 1px);background-size:34px 34px;overflow:hidden}.stage:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse,#20302690,transparent 62%);z-index:-1}.stage img{width:100%;height:100%;object-fit:contain;position:absolute;inset:0;background:#090f0c}.empty{text-align:center;color:var(--sub);padding:14px}.empty-icon{display:block;margin:0 auto 14px;width:44px;height:32px;border:1px solid #799486;border-radius:9px;position:relative}.empty-icon:before{content:"";position:absolute;inset:7px 13px;border:1px solid #799486;border-radius:50%}.empty-icon:after{content:"";position:absolute;width:9px;height:3px;border-radius:3px 3px 0 0;top:-4px;right:9px;background:#799486}.empty strong{display:block;color:var(--ink);font-size:15px}.mode{display:flex;align-items:center;gap:8px}.toolbar{padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px}.toolbar button{flex:0 1 auto}.notice{min-height:26px;margin:0 16px 11px;color:var(--sub);overflow-wrap:anywhere}.notice[data-error=true]{color:var(--error)}
button{min-height:38px;padding:5px 13px;border:1px solid #3b5144;border-radius:8px;background:#202e27;color:var(--ink);cursor:pointer}button:hover:not(:disabled){background:#2c3d33}button:disabled{opacity:.44;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid var(--green);outline-offset:2px}.primary{background:var(--green);font-weight:700;color:#172314;border-color:var(--green)}.primary:hover:not(:disabled){background:#dbfabe}.quiet{background:transparent;color:var(--sub)}.danger{color:var(--error)}
.node-list{list-style:none;margin:0;padding:0 16px}.node{border-bottom:1px solid var(--edge);padding:12px 0}.node:last-child{border:0}.node-main{display:flex;justify-content:space-between;align-items:center;gap:8px}.node-name{display:flex;align-items:center;gap:8px;font-weight:bold}.node-id{color:var(--sub);font-size:10px}.node-state{font-size:12px;color:var(--sub);white-space:nowrap}.node-state[data-state=up]{color:var(--green)}.node-state[data-state=down]{color:var(--error)}.meter{height:3px;background:#314238;border-radius:9px;margin-top:8px;overflow:hidden}.meter i{display:block;height:100%;width:0;background:var(--green)}.node-meta{display:flex;justify-content:space-between;gap:6px;margin-top:5px;color:var(--sub);font-size:11px}.device-footer{padding:12px 16px;border-top:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center;gap:8px}.device-footer button{min-height:30px;font-size:11px}
.gallery{margin-top:18px}.gallery .card-head{flex-wrap:wrap}.gallery-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));list-style:none;margin:0;padding:13px 16px;gap:9px}.file{border:1px solid var(--edge);background:var(--base);border-radius:9px;padding:8px;min-width:0;display:flex;gap:6px;align-items:center}.file-main{flex:1;text-align:right;min-width:0;background:transparent;border:0;padding:3px 7px}.file-label{display:block;overflow-wrap:anywhere}.file small{display:block;color:var(--sub);margin-top:2px}.file .danger{border:0;padding-inline:7px;background:transparent;font-size:11px}.gallery-empty{color:var(--sub);padding:14px 17px;margin:0}.gallery-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:0 16px 13px;color:var(--sub)}.gallery-footer button{min-height:31px}
@media(max-width:880px){.shell{padding-inline:20px}.board{grid-template-columns:minmax(0,1fr) 245px}}@media(max-width:700px){.shell{padding-inline:13px}.board{grid-template-columns:1fr}.hero{padding:20px 0 15px}header{min-height:62px}.stage{aspect-ratio:4/3}.node-list{display:grid;grid-template-columns:1fr 1fr;gap:0 13px}.node:nth-child(3){border:0}.card-head{padding-inline:12px}.toolbar{padding-inline:12px}.gallery-items{grid-template-columns:repeat(auto-fill,minmax(170px,1fr));padding:10px}.device-footer{padding-inline:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
#uploadForm{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px 10px}
#phoneFile{width:min(100%,430px);direction:rtl;min-width:0;flex:1 1 210px}
#phoneFile::file-selector-button{font:inherit;border:0;border-radius:5px;background:#314638;color:var(--ink);padding:4px 8px;margin-inline-end:9px;cursor:pointer}
#phoneFiles .file{justify-content:space-between}
#phoneFiles .upload-name{min-width:0;overflow-wrap:anywhere}
#phoneFiles a{white-space:nowrap;padding:7px 4px}
#uploadLimit{font-size:12px;color:var(--sub)}
</style>
</head>
<body>
<div class="shell">
<header>
  <div class="brand"><span class="brand-mark" aria-hidden="true">R</span><div><span class="wordmark" dir="ltr">ROHAM</span><span class="subtitle">مدیریت دوربین و ذخیره‌سازی</span></div></div>
  <div class="connection"><i class="dot" id="linkDot" aria-hidden="true"></i><span id="connection">در انتظار اتصال</span></div>
</header>
<main>
  <div class="hero"><div><h1>اتاق کنترل</h1><p id="scope">شبکهٔ محلی</p></div><button id="logout" class="quiet" hidden>خروج</button></div>
  <form id="access" class="access"><div class="field"><label for="key">کلید خصوصی شبکه</label><input id="key" type="password" autocomplete="off" required></div><button type="submit" class="primary">اتصال</button><span id="authMessage" class="muted" role="status"></span></form>
  <div class="board">
    <section class="card" aria-labelledby="cameraTitle">
      <div class="card-head"><h2 id="cameraTitle">تصویر دوربین</h2><span class="mode"><i class="dot" id="frameDot" aria-hidden="true"></i><span id="frameMode" class="muted">آمادهٔ پیش‌نمایش</span></span></div>
      <div class="stage"><div class="empty" id="empty"><i class="empty-icon" aria-hidden="true"></i><strong>تصویر دوربین اینجا نمایش داده می‌شود</strong><span>پیش‌نمایش زنده را روشن کنید یا عکسی از گالری باز کنید.</span></div><img id="image" alt="تصویر انتخاب‌شده از دوربین ROHAM" hidden></div>
      <div class="toolbar">
        <button id="live" class="primary" disabled>تصویر زنده</button>
        <button id="capture" disabled>عکس و ذخیره</button>
        <button id="latest" disabled>آخرین عکس</button>
        <button id="download" disabled>دانلود تصویر</button>
      </div>
      <p id="notice" class="notice" role="status"></p>
    </section>
    <section class="card" aria-labelledby="nodesTitle">
      <div class="card-head"><h2 id="nodesTitle">وضعیت بردها</h2><span class="muted" id="onlineCount">—</span></div>
      <ul id="nodes" class="node-list"></ul>
      <div class="device-footer"><div class="muted"><div id="storage">کارت DATA · نامشخص</div><div id="cameraStorage">کارت CAM · نامشخص</div></div><button id="clock" disabled>تنظیم ساعت دوربین</button></div>
    </section>
  </div>
  <section class="card gallery" aria-labelledby="galleryTitle">
    <div class="card-head"><h2 id="galleryTitle">گالری دیتاسنتر</h2><button id="refresh" class="quiet" disabled>تازه‌سازی</button></div>
    <p class="gallery-empty" id="galleryEmpty">برای دیدن عکس‌ها متصل شوید.</p>
    <ul class="gallery-items" id="files" hidden></ul>
    <div class="gallery-footer" id="galleryFooter" hidden><button id="previous" disabled>صفحهٔ قبل</button><span id="page"></span><button id="next" disabled>صفحهٔ بعد</button></div>
  </section>
  <section class="card gallery" id="phoneStorage" aria-labelledby="uploadTitle" hidden>
    <div class="card-head"><h2 id="uploadTitle">فایل‌های کارت DATA</h2><button id="refreshUploads" class="quiet" disabled>تازه‌سازی</button></div>
    <form id="uploadForm">
      <label for="phoneFile">انتخاب فایل از گوشی</label>
      <input type="file" id="phoneFile" aria-describedby="uploadLimit" required>
      <button type="submit" id="uploadButton" class="primary" disabled>آپلود روی کارت</button>
      <span id="uploadLimit">حداکثر ۸ مگابایت برای هر فایل</span>
    </form>
    <p id="uploadNotice" class="notice" role="status">برای دیدن فایل‌های کارت، تازه‌سازی را بزنید.</p>
    <ul class="gallery-items" id="phoneFiles" hidden></ul>
    <div class="gallery-footer" id="uploadPages" hidden>
      <button id="previousUploads" disabled>صفحهٔ قبل</button><span id="uploadPage"></span><button id="nextUploads" disabled>صفحهٔ بعد</button>
    </div>
  </section>
</main>
</div>
<script>
'use strict';
const $ = id => document.getElementById(id);
const cloud = document.documentElement.dataset.mode === 'cloud';
const roles = {MEDIA:'پردازندهٔ مرکزی',DATA:'دیتاسنتر',CAM:'دوربین',WEB:'نمایشگر و سایت'};
const commands = ['live','capture','latest','clock','refresh'];
const SD_UPLOAD_MAX = 8 * 1024 * 1024;
let uploadOffset=0, moreUploads=false;
let token = '', unlocked = false, working = false, liveEpoch = 0, liveRunning = false, liveTask;
let storageOffset = 0, hasNext = false, imageUrl = '', imageName = '', polling = false, galleryLoaded = false, lastHub = false;
const nodeViews = {};
for (const [role,name] of Object.entries(roles)) {
  const node = document.createElement('li');
  node.className = 'node';
  node.innerHTML = '<div class="node-main"><span class="node-name"><i class="dot" aria-hidden="true"></i><span></span><small class="num node-id"></small></span><span class="node-state">نامشخص</span></div><div class="meter" aria-hidden="true"><i></i></div><div class="node-meta"><span>فعالیت</span><span class="num">—</span></div>';
  node.querySelector('.node-name span').textContent = name;
  node.querySelector('small').textContent = role;
  nodeViews[role] = node;
  $('nodes').append(node);
}
function say(text, error=false) { $('notice').textContent = text; $('notice').dataset.error = String(error); }
function syncButtons() {
  for (const id of commands) $(id).disabled = !unlocked || working;
  $('previous').disabled = !unlocked || working || !storageOffset;
  $('next').disabled = !unlocked || working || !hasNext;
  $('download').disabled = !imageUrl || working;
  $('live').textContent = liveRunning ? 'توقف تصویر زنده' : 'تصویر زنده';
  if (cloud) {
    $('phoneFile').disabled = !unlocked || working;
    $('uploadButton').disabled = !unlocked || working || !$('phoneFile').files.length;
    $('refreshUploads').disabled = !unlocked || working;
    $('previousUploads').disabled = !unlocked || working || !uploadOffset;
    $('nextUploads').disabled = !unlocked || working || !moreUploads;
  }
}
async function api(path, method='GET', timeout=24000, body) {
  const headers = {'X-Roham-Panel':'1'};
  if (!cloud) headers['X-Roham-Key'] = token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, {method,headers,body,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
    if (response.status === 401 && cloud) { location.reload(); throw new Error('نشست پایان یافته است.'); }
    if (!response.ok) {
      if (response.status === 413) throw new Error('حجم فایل بیشتر از ۸ مگابایت است.');
      if (response.status === 403) throw new Error('کلید شبکه معتبر نیست.');
      if (response.status === 404) throw new Error('عکس در دسترس نیست.');
      if (response.status === 409 || response.status === 429) throw new Error('سامانه مشغول است. دوباره امتحان کنید.');
      if (response.status === 502 || response.status === 503) throw new Error('برد یا کارت موردنیاز در دسترس نیست.');
      throw new Error('خطای ارتباط (' + response.status + ')');
    }
    return response.headers.get('content-type')?.startsWith('image/') ? await response.blob() : await response.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('مهلت پاسخ پایان یافت.');
    throw e;
  } finally { clearTimeout(timer); }
}
function updateNodes(data) {
  const byRole = Object.fromEntries((data.nodes || []).map(node => [node.role,node]));
  let count=0;
  for(const [role,view] of Object.entries(nodeViews)){
    const n=byRole[role];
    const state=n?.online?'up':n?'down':'unknown';
    if(n?.online) count++;
    view.querySelector('.dot').dataset.state=state;
    const label=view.querySelector('.node-state');
    label.dataset.state=state;
    label.textContent=state==='up'?'آنلاین':state==='down'?'آفلاین':'نامشخص';
    const busy=n?.online && Number.isFinite(n.busy) ? Math.min(100,Math.max(0,n.busy)) : null;
    view.querySelector('.meter i').style.width=(busy??0)+'%';
    view.querySelector('.node-meta .num').textContent=busy===null?'—':busy+'%';
  }
  $('onlineCount').textContent = count.toLocaleString('fa-IR') + ' از ۴ آنلاین';
  $('linkDot').dataset.state=data.hub?'up':'down';
  $('connection').textContent=data.hub?'پردازندهٔ مرکزی متصل':'پردازندهٔ مرکزی در دسترس نیست';
  const cardState=state=>state===true?'آماده':state===false?'در دسترس نیست':'نامشخص';
  $('storage').textContent='کارت DATA · '+cardState(data.dataSd);
  $('cameraStorage').textContent='کارت CAM · '+cardState(data.cameraSd);
}
async function poll() {
  if(!unlocked || polling || working || liveRunning) return;
  polling=true;
  try {
    const state=await api('/api/cluster','GET',7000);
    updateNodes(state);
    if(state.hub && !lastHub && !galleryLoaded && !working && !liveRunning) run(() => loadGallery(0));
    lastHub=state.hub;
  } catch(e) { updateNodes({}); $('connection').textContent=e.message; }
  finally { polling=false; }
}
function photoName(id) { return 'IMG'+String(id).padStart(5,'0')+'.jpg'; }
function show(blob,name) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error('تصویر قابل نمایش نیست.');
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl=URL.createObjectURL(blob); imageName=name;
  $('image').src=imageUrl; $('image').hidden=false; $('empty').hidden=true;
  syncButtons();
}
async function stopLive() {
  liveRunning=false; ++liveEpoch; syncButtons();
  if (liveTask) await liveTask;
  $('frameDot').dataset.state='unknown';
  $('frameMode').textContent=imageUrl?'تصویر ثابت':'آمادهٔ پیش‌نمایش';
}
async function preview(epoch) {
  let frames=0, started=performance.now(), failures=0, lastStatus=started;
  while(liveRunning && epoch===liveEpoch) {
    try {
      const frame=await api('/frame','GET',8500);
      if(!liveRunning || epoch!==liveEpoch) return;
      show(frame,'roham-frame.jpg');
      frames++; failures=0;
      const now=performance.now();
      if(now-lastStatus >= 5500){
        try { updateNodes(await api('/api/cluster','GET',3500)); } catch {}
        lastStatus=performance.now();
      }
      $('frameMode').textContent='زنده · '+(frames*1000/Math.max(1,now-started)).toFixed(1)+' fps';
      $('frameDot').dataset.state='up'; say('');
    } catch(e) {
      if(epoch!==liveEpoch) return;
      failures++; say(e.message,true);
      $('frameDot').dataset.state='down'; $('frameMode').textContent='تلاش برای دریافت تصویر';
    }
    await new Promise(resolve=>setTimeout(resolve,failures?Math.min(2500, failures*450):cloud?450:130));
  }
}
async function run(fn, onError=e=>say(e.message,true)) {
  if(!unlocked || working) return;
  working=true; syncButtons();
  try { if(liveRunning) await stopLive(); await fn(); }
  catch(e) { onError(e); }
  finally { working=false; syncButtons(); }
}
function renderGallery(data, offset) {
  const items=$('files'); items.replaceChildren();
  storageOffset=offset; hasNext=!!data.more; galleryLoaded=true;
  for(const file of data.files || []) {
    const name=file.name;
    if(!/^IMG\\d{5,9}\\.jpg$/i.test(name)) continue;
    const id=Number(name.slice(3,-4));
    const li=document.createElement('li'); li.className='file';
    const open=document.createElement('button'); open.className='file-main'; open.innerHTML='<span class="num file-label"></span><small></small>';
    open.firstElementChild.textContent=name; open.lastElementChild.textContent=Math.ceil(file.size/1024).toLocaleString('fa-IR')+' کیلوبایت';
    open.onclick=()=>run(async()=>{ show(await api('/photo/'+id),name); $('frameMode').textContent='عکس ذخیره‌شده'; say(name); });
    const del=document.createElement('button');del.className='danger';del.textContent='حذف';del.setAttribute('aria-label','حذف '+name);
    del.onclick=()=>run(async()=>{
      if(!confirm('عکس '+name+' حذف شود؟')) return;
      await api('/delete/'+id,'POST');
      await loadGallery(offset);
      if(!$('files').children.length && offset) await loadGallery(Math.max(0,offset-32));
      say('عکس حذف شد.');
    });
    li.append(open,del);items.append(li);
  }
  const any=items.children.length>0;
  items.hidden=!any; $('galleryEmpty').hidden=any;
  $('galleryEmpty').textContent='در این صفحه عکسی وجود ندارد.';
  $('galleryFooter').hidden=!any && !offset;
  $('page').textContent='صفحهٔ '+(Math.floor(offset/32)+1).toLocaleString('fa-IR');
  syncButtons();
}
async function loadGallery(offset) { renderGallery(await api('/gallery?offset='+offset),offset); }
$('access').onsubmit=async e=>{
  e.preventDefault();
  if (working) return;
  working=true; $('authMessage').textContent='در حال اتصال…';
  token=$('key').value;
  try {
    const state=await api('/api/cluster','GET',7000);
    unlocked=true; $('access').hidden=true; $('logout').hidden=false;
    $('key').value=''; $('authMessage').textContent=''; updateNodes(state);lastHub=state.hub;
  } catch(err) {unlocked=false;token='';$('authMessage').textContent=err.message;}
  finally {working=false;syncButtons();}
  if(unlocked && lastHub) run(()=>loadGallery(0));
};
$('logout').onclick=async()=>{
  if(cloud) { try { await api('/logout','POST');location.reload(); } catch(e){say(e.message,true);} }
  else location.reload();
};
$('live').onclick=async()=>{
  if(liveRunning) {await run(async()=>{});return;}
  if(working || !unlocked) return;
  liveRunning=true; syncButtons(); liveTask=preview(++liveEpoch);
};
$('capture').onclick=()=>run(async()=>{
  say('در حال عکس‌برداری و ذخیره…');
  const res=await api('/capture','POST');
  if(!res.id) throw new Error('شناسهٔ عکس دریافت نشد.');
  show(await api('/photo/'+res.id),photoName(res.id));$('frameMode').textContent='عکس ذخیره‌شده';
  say('در دیتاسنتر ذخیره شد · '+photoName(res.id));
  await loadGallery(0);
});
$('latest').onclick=()=>run(async()=>{
  show(await api('/latest'),'roham-latest.jpg');$('frameMode').textContent='آخرین عکس';say('');
});
$('clock').onclick=()=>run(async()=>{
  await api('/time?epoch='+Math.floor(Date.now()/1000),'POST');say('ساعت دوربین تنظیم شد.');
});
$('download').onclick=()=>{
  if(!imageUrl) return;
  const a=document.createElement('a');a.href=imageUrl;a.download=imageName;a.click();
};
$('refresh').onclick=()=>run(()=>loadGallery(storageOffset));
$('previous').onclick=()=>run(()=>loadGallery(Math.max(0,storageOffset-32)));
$('next').onclick=()=>run(()=>loadGallery(storageOffset+32));
function uploadNote(text,error=false) {
  $('uploadNotice').textContent=text;
  $('uploadNotice').dataset.error=String(error);
}
function runUpload(fn) { return run(fn,e=>uploadNote(e.message,true)); }

async function loadUploads(offset) {
  const page=await api('/uploads?offset='+offset);
  const list=$('phoneFiles');
  list.replaceChildren();
  for (const item of page.files || []) {
    const row=document.createElement('li');
    row.className='file';
    const label=document.createElement('span');
    label.className='upload-name';
    const fileName=document.createElement('bdi');
    fileName.textContent=item.name;
    label.append(fileName);
    const size=document.createElement('small');
    size.textContent=Math.ceil(item.size/1024).toLocaleString('fa-IR')+' کیلوبایت';
    label.append(size);
    const link=document.createElement('a');
    link.href='/uploads/'+encodeURIComponent(item.key);
    link.download=item.name;
    link.textContent='دانلود';
    link.onclick=e=>{if (working || liveRunning) {
      e.preventDefault();
      if (liveRunning && !working) runUpload(async()=>{location.assign(link.href);});
    }};
    row.append(label,link);list.append(row);
  }
  uploadOffset=offset;moreUploads=!!page.more;
  list.hidden=!list.children.length;
  $('uploadPages').hidden=list.hidden && !offset;
  $('uploadPage').textContent='صفحهٔ '+(Math.floor(offset/8)+1).toLocaleString('fa-IR');
  uploadNote(list.hidden?'فایلی در این صفحه نیست.':'فهرست فایل‌ها به‌روز شد.');
}

$('phoneFile').onchange=syncButtons;
$('refreshUploads').onclick=()=>runUpload(()=>loadUploads(uploadOffset));
$('previousUploads').onclick=()=>runUpload(()=>loadUploads(Math.max(0,uploadOffset-8)));
$('nextUploads').onclick=()=>runUpload(()=>loadUploads(uploadOffset+8));
$('uploadForm').onsubmit=e=>{
  e.preventDefault();
  if (!cloud) return;
  const file=$('phoneFile').files[0];
  if (!file) return;
  runUpload(async()=>{
    if (file.size>SD_UPLOAD_MAX) throw new Error('حداکثر حجم هر فایل ۸ مگابایت است.');
    if (new TextEncoder().encode(file.name).length>84) throw new Error('نام فایل را کوتاه‌تر کنید.');
    uploadNote('در حال ارسال و ذخیره روی کارت DATA…');
    const params=new URLSearchParams({name:file.name,size:String(file.size)});
    const result=await api('/uploads?'+params,'POST',600000,file);
    if (result.saved!==true) throw new Error('ذخیرهٔ فایل تأیید نشد.');
    $('phoneFile').value='';
    try { await loadUploads(0); } catch {}
    uploadNote('روی کارت DATA ذخیره شد · '+result.name);
  });
};

addEventListener('pagehide',()=>{ liveRunning=false; ++liveEpoch; if(imageUrl) URL.revokeObjectURL(imageUrl); });
if(cloud){
  $('phoneStorage').hidden=false;
  $('scope').textContent='اتصال ابری';$('access').hidden=true;$('logout').hidden=false;unlocked=true;syncButtons();poll();
}else $('key').focus();
setInterval(poll, 6000);
<\/script>
</body>
</html>
`;

// scratch/roham-phone/github/site/login.html
var login_default = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101613">
<title>ROHAM | ورود</title>
<style>
:root{color-scheme:dark;font:15px/1.75 Tahoma,"Segoe UI",system-ui,sans-serif;color:#eff5ed;background:#101613}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 35%,#213229 0,transparent 58%)}main{width:min(100%,420px);padding:32px;background:#17211d;border:1px solid #2d4135;border-radius:16px}.brand{display:flex;gap:12px;align-items:center;font:800 15px/1 system-ui;letter-spacing:.18em;margin-bottom:22px}.mark{display:grid;place-items:center;background:#bfe98d;color:#172314;width:36px;height:36px;border-radius:11px;font:900 22px/1 system-ui}h1{margin:0;font-size:26px}p,label{color:#a5b8ac}p{margin:5px 0 22px}label{display:block;margin-bottom:5px}input,button{display:block;width:100%;font:inherit;border-radius:8px;min-height:44px}input{background:#101613;border:1px solid #425b4c;padding:8px;color:#eff5ed;direction:ltr}button{border:0;background:#bfe98d;color:#172314;font-weight:700;margin-top:12px;cursor:pointer}button:disabled{opacity:.5}button:focus-visible,input:focus-visible{outline:2px solid #bfe98d;outline-offset:2px}#message{min-height:24px;color:#ffaaa0;margin-bottom:0}
</style>
</head>
<body>
<main>
<div class="brand"><span class="mark" aria-hidden="true">R</span><span dir="ltr">ROHAM</span></div>
<h1>ورود به اتاق کنترل</h1><p>رمز سایت را برای اتصال ابری وارد کنید.</p>
<form id="login"><label for="password">رمز سایت</label><input id="password" type="password" required maxlength="200" autocomplete="current-password"><button type="submit">ورود</button></form>
<p id="message" role="status"></p>
</main>
<script>
'use strict';
document.getElementById('login').onsubmit=async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector('button'), message=document.getElementById('message');
  button.disabled=true;message.textContent='';
  try {
    const response=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify({password:document.getElementById('password').value})});
    if(response.ok)location.replace('/');
    else message.textContent=response.status===429?'تلاش بیش از حد. پنج دقیقه دیگر امتحان کنید.':response.status===503?'تنظیمات سرور کامل نیست.':'رمز سایت معتبر نیست.';
  }catch{message.textContent='ارتباط با سرور برقرار نشد.';}
  finally{button.disabled=false;}
};
<\/script>
</body>
</html>
`;

// scratch/roham-phone/github/src/worker.js
var cloudPanel = panel_default.replace('data-mode="local"', 'data-mode="cloud"');
var SESSION = "roham_session";
var SESSION_SECONDS = 12 * 3600;
var MAX_PHOTO = 2e6;
var MAX_UPLOAD = 8 * 1024 * 1024;
var UPLOAD_BLOCK = 4096;
var FILE_KEY = /^[a-f0-9]{32}\.[A-Za-z0-9_-]{1,112}$/;
var HEADER_BYTES = 36;
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var standard = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY"
};
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...standard, "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
function html(source) {
  return new Response(source, {
    headers: {
      ...standard,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    }
  });
}
function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function constantEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
async function digest(text) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}
function settings(env) {
  return { master: env.MASTER_TOKEN || "", password: env.SITE_PASSWORD || env.PASSWORD || "" };
}
async function signature(value, { master, password }) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JSON.stringify(["ROHAM V4", master, password])),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
function cookie(value) {
  return `${SESSION}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value ? SESSION_SECONDS : 0}`;
}
async function hasSession(request, secrets) {
  if (!secrets.master || !secrets.password) return false;
  const item = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(SESSION + "="));
  const value = item?.slice(SESSION.length + 1) || "";
  const match = /^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const now = Math.floor(Date.now() / 1e3), expiry = Number(match[1]);
  return expiry > now && expiry <= now + SESSION_SECONDS && constantEqual(match[3], await signature(match[1] + "." + match[2], secrets));
}
function safePost(request, url) {
  const origin = request.headers.get("Origin");
  return request.headers.get("X-Roham-Panel") === "1" && (!origin || origin === url.origin);
}
async function readSmallJson(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const buffer = new Uint8Array(2048);
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.length > buffer.length - used) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, used);
      used += value.length;
    }
    return JSON.parse(decoder.decode(buffer.subarray(0, used)));
  } catch {
    return null;
  }
}
function hub(env) {
  return env.HUB.get(env.HUB.idFromName("cluster"));
}
async function checkLogin(request, env, secrets) {
  if (!secrets.master || !secrets.password) return json({ error: "configuration missing" }, 503);
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const limiter = env.LOGIN_LIMIT.get(env.LOGIN_LIMIT.idFromName(await digest(ip)));
  const permit = await limiter.fetch("https://internal/check", { method: "POST" });
  if (!permit.ok) return json({ error: "try again later" }, 429, { "Retry-After": "300" });
  const values = await readSmallJson(request);
  if (typeof values?.password !== "string" || values.password.length > 200 || !constantEqual(await digest(values.password), await digest(secrets.password))) {
    return json({ error: "invalid login" }, 401);
  }
  await limiter.fetch("https://internal/reset", { method: "POST" });
  const expiry = Math.floor(Date.now() / 1e3) + SESSION_SECONDS;
  const value = expiry + "." + hex(crypto.getRandomValues(new Uint8Array(16)));
  return json({ ok: true }, 200, { "Set-Cookie": cookie(value + "." + await signature(value, secrets)) });
}
function photoName(id) {
  return "IMG" + String(id).padStart(5, "0") + ".jpg";
}
function makeFileKey(name) {
  if (typeof name !== "string" || !name.trim() || /[\x00-\x1f\x7f/\\]/.test(name)) return null;
  const bytes = encoder.encode(name);
  if (bytes.length > 84) return null;
  const label = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return crypto.randomUUID().replaceAll("-", "") + "." + label;
}
function fileName(key) {
  if (!FILE_KEY.test(key)) return null;
  try {
    const name = decoder.decode(Uint8Array.from(atob(key.slice(33).replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));
    return name && !/[\x00-\x1f\x7f/\\]/.test(name) ? name : null;
  } catch {
    return null;
  }
}
function attachment(key) {
  const encoded = encodeURIComponent(fileName(key) || "download").replace(/['()*!]/g, (c) => "%" + c.charCodeAt(0).toString(16));
  return "attachment; filename=download; filename*=UTF-8''" + encoded;
}
async function handleFileRoute(request, url, env) {
  const stub = hub(env);
  if (url.pathname === "/uploads" && request.method === "POST") {
    const name = url.searchParams.get("name");
    const key = makeFileKey(name);
    const declared = url.searchParams.get("size");
    if (!key || !/^\d{1,8}$/.test(declared || "")) return json({ error: "invalid filename or size" }, 400);
    const size = Number(declared);
    if (size > MAX_UPLOAD) return json({ error: "file too large" }, 413);
    const length = request.headers.get("Content-Length");
    if (length !== null && Number(length) !== size) return json({ error: "upload size mismatch" }, 400);
    const target = new URL("https://internal/upload");
    target.searchParams.set("key", key);
    target.searchParams.set("size", String(size));
    return stub.fetch(target.toString(), { method: "POST", body: request.body });
  }
  if (url.pathname === "/uploads" && request.method === "GET") {
    const offset = url.searchParams.get("offset") ?? "0";
    if (!/^\d{1,7}$/.test(offset) || Number(offset) > 1e6) return json({ error: "invalid offset" }, 400);
    const result = await stub.fetch("https://internal/command", {
      method: "POST",
      body: JSON.stringify({ op: "fileList", arg: Number(offset) })
    });
    if (!result.ok) return result;
    const output = await result.json();
    if (!Array.isArray(output.files)) return json({ error: "invalid file list" }, 502);
    const files = output.files.flatMap((item) => {
      const name = typeof item?.key === "string" ? fileName(item.key) : null;
      return name && Number.isInteger(item.size) && item.size >= 0 && item.size <= MAX_UPLOAD ? [{ key: item.key, name, size: item.size }] : [];
    });
    return json({ files, more: output.more === true, next: Number(offset) + 8 });
  }
  if (request.method === "GET" && url.pathname.startsWith("/uploads/")) {
    const key = url.pathname.slice("/uploads/".length);
    if (!fileName(key)) return json({ error: "invalid file key" }, 404);
    return stub.fetch("https://internal/command", { method: "POST", body: JSON.stringify({ op: "fileDownload", arg: key, image: true }) });
  }
  return json({ error: "unknown file route" }, 404);
}
function timedRead(reader) {
  let timer;
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("upload stream stalled")), 1e4);
    })
  ]).finally(() => clearTimeout(timer));
}
function commandFor(method, url) {
  const path = url.pathname;
  if (method === "GET") {
    if (path === "/frame") return { op: "frame", image: true };
    if (path === "/latest") return { op: "photo", arg: "latest", image: true };
    if (path === "/gallery") {
      const offset = url.searchParams.get("offset") ?? "0";
      if (/^\d{1,7}$/.test(offset) && Number(offset) <= 1e6) return { op: "gallery", arg: Number(offset) };
    }
    const photo = /^\/photo\/([1-9]\d{0,8})$/.exec(path);
    if (photo) return { op: "photo", arg: photoName(photo[1]), image: true };
  } else if (method === "POST") {
    if (path === "/capture") return { op: "capture" };
    const target = /^\/delete\/([1-9]\d{0,8})$/.exec(path);
    if (target) return { op: "delete", arg: photoName(target[1]) };
    const epoch = url.searchParams.get("epoch");
    if (path === "/time" && /^\d{10}$/.test(epoch || "") && Number(epoch) >= 17e8 && Number(epoch) <= 2147483647)
      return { op: "time", arg: epoch };
  }
  return null;
}
function offlineState() {
  return { hub: false, dataSd: null, cameraSd: null, last: 0, nodes: ["MEDIA", "DATA", "CAM", "WEB"].map((role) => ({ role, online: false })) };
}
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url), method = request.method, secrets = settings(env);
    if (url.pathname === "/master") {
      const bearer = request.headers.get("Authorization") || "";
      if (!secrets.master || !constantEqual(await digest(bearer), await digest("Bearer " + secrets.master)))
        return json({ error: "unauthorized" }, 401);
      if (method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return json({ error: "websocket required" }, 426);
      return hub(env).fetch("https://internal/master", { headers: { Upgrade: "websocket" } });
    }
    if (method === "POST" && url.pathname === "/login") {
      if (!safePost(request, url)) return json({ error: "forbidden" }, 403);
      return checkLogin(request, env, secrets);
    }
    const session = await hasSession(request, secrets);
    if (method === "GET" && (url.pathname === "/" || url.pathname === "/login" || url.pathname === "/panel"))
      return html(session ? cloudPanel : login_default);
    if (!session) return json({ error: "login required" }, 401);
    if (method === "POST" && !safePost(request, url)) return json({ error: "forbidden" }, 403);
    if (method === "POST" && url.pathname === "/logout") return json({ ok: true }, 200, { "Set-Cookie": cookie("") });
    if (method === "GET" && (url.pathname === "/api/cluster" || url.pathname === "/data-status")) {
      const state = await (await hub(env).fetch("https://internal/status")).json();
      return json(url.pathname === "/api/cluster" ? state : { sd: state.dataSd, last: state.last });
    }
    if (url.pathname === "/uploads" || url.pathname.startsWith("/uploads/")) return handleFileRoute(request, url, env);
    const command = commandFor(method, url);
    if (!command) return json({ error: "unknown command" }, 404);
    return hub(env).fetch("https://internal/command", { method: "POST", body: JSON.stringify(command) });
  }
};
var LoginLimit = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  async fetch(request) {
    if (new URL(request.url).pathname === "/reset") {
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }
    const now = Date.now();
    const result = await this.ctx.storage.transaction(async (txn) => {
      let window = await txn.get("window");
      if (!window || window.until <= now) window = { count: 0, until: now + 3e5 };
      if (window.count >= 5) return { allow: false, until: window.until };
      window.count++;
      await txn.put("window", window);
      return { allow: true, until: window.until };
    });
    await this.ctx.storage.setAlarm(result.until);
    return json({ ok: result.allow }, result.allow ? 200 : 429);
  }
  async alarm() {
    const window = await this.ctx.storage.get("window");
    if (window?.until > Date.now()) await this.ctx.storage.setAlarm(window.until);
    else await this.ctx.storage.deleteAll();
  }
};
var RohamHub = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.pending = null;
    this.uploading = false;
    this.telemetry = null;
    this.telemetryAt = 0;
  }
  socket() {
    return this.ctx.getWebSockets("media").find((socket) => socket.readyState === 1);
  }
  finish(response) {
    const op = this.pending;
    if (!op) return;
    this.pending = null;
    clearTimeout(op.timer);
    op.resolve(response);
  }
  state() {
    const result = offlineState(), socket = this.socket();
    if (!socket || socket.readyState !== 1) return result;
    if (this.telemetry && Date.now() - this.telemetryAt < 15e3) return { ...this.telemetry, hub: true };
    result.hub = true;
    result.nodes[0].online = true;
    return result;
  }
  request(socket, command, chunk) {
    if (!socket || socket !== this.socket() || socket.readyState !== 1) return Promise.resolve(json({ error: "MEDIA unavailable" }, 503));
    if (this.pending) return Promise.resolve(json({ error: "MEDIA busy" }, 409));
    const id = crypto.randomUUID();
    const timeout = command.op === "frame" ? 8e3 : command.op === "fileDownload" ? 18e4 : command.op.startsWith("upload") ? 13e3 : 22e3;
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.finish(json({ error: "MEDIA response timeout" }, 504)), timeout);
      this.pending = { id, socket, resolve, timer, op: command.op, key: command.arg, expectsImage: !!command.image, buffer: null, used: 0 };
      try {
        if (chunk) {
          const frame = new Uint8Array(HEADER_BYTES + chunk.length);
          frame.set(encoder.encode(id));
          frame.set(chunk, HEADER_BYTES);
          socket.send(frame);
        } else {
          socket.send(JSON.stringify({ type: "request", id, op: command.op, arg: command.arg, size: command.size }));
        }
      } catch {
        this.finish(json({ error: "MEDIA unavailable" }, 503));
      }
    });
  }
  async uploadStep(socket, command, chunk) {
    for (let attempt = 0; ; ++attempt) {
      const result = await this.request(socket, command, chunk);
      if (result.status !== 409 || attempt === 3) return result;
      result.body?.cancel().catch(() => {
      });
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  async upload(request, url) {
    if (this.uploading || this.pending) return json({ error: "MEDIA busy" }, 409);
    const socket = this.socket();
    if (!socket) return json({ error: "MEDIA unavailable" }, 503);
    const key = url.searchParams.get("key"), size = Number(url.searchParams.get("size"));
    if (!key || !FILE_KEY.test(key) || !Number.isInteger(size) || size < 0 || size > MAX_UPLOAD)
      return json({ error: "invalid upload" }, 400);
    this.uploading = true;
    const reader = request.body?.getReader();
    let committed = false;
    try {
      const begin = await this.uploadStep(socket, { op: "uploadBegin", arg: key, size });
      if (!begin.ok) return begin;
      const block = new Uint8Array(UPLOAD_BLOCK);
      let used = 0, limit = 0;
      while (reader) {
        const { value, done } = await timedRead(reader);
        if (done) break;
        limit += value.length;
        if (limit > size) return json({ error: "upload size mismatch" }, 400);
        let pos = 0;
        while (pos < value.length) {
          const n = Math.min(block.length - used, value.length - pos);
          block.set(value.subarray(pos, pos + n), used);
          used += n;
          pos += n;
          if (used === block.length) {
            const result2 = await this.uploadStep(socket, { op: "uploadBlock" }, block);
            if (!result2.ok) return result2;
            used = 0;
          }
        }
      }
      if (limit !== size) return json({ error: "upload size mismatch" }, 400);
      if (used) {
        const result2 = await this.uploadStep(socket, { op: "uploadBlock" }, block.subarray(0, used));
        if (!result2.ok) return result2;
      }
      const result = await this.uploadStep(socket, { op: "uploadEnd" });
      if (!result.ok) return result;
      const reply = await result.json();
      if (reply.saved !== true) return json({ error: "SD commit was not acknowledged" }, 502);
      committed = true;
      return json({ saved: true, key, name: fileName(key), size }, 201);
    } catch {
      return json({ error: "upload interrupted" }, 502);
    } finally {
      if (reader) {
        if (!committed) reader.cancel().catch(() => {
        });
        reader.releaseLock();
      }
      if (!committed) await this.uploadStep(socket, { op: "uploadAbort" });
      this.uploading = false;
    }
  }
  async fetch(request) {
    switch (new URL(request.url).pathname) {
      case "/master": {
        this.finish(json({ error: "MEDIA reconnected" }, 503));
        for (const old of this.ctx.getWebSockets("media")) old.close(1e3, "New MEDIA session");
        this.telemetry = null;
        this.telemetryAt = 0;
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server, ["media"]);
        return new Response(null, { status: 101, webSocket: client });
      }
      case "/status":
        return json(this.state());
      case "/upload":
        return this.upload(request, new URL(request.url));
      case "/command": {
        if (this.uploading) return json({ error: "MEDIA busy" }, 409);
        const command = await request.json();
        if (this.uploading) return json({ error: "MEDIA busy" }, 409);
        return this.request(this.socket(), command);
      }
      default:
        return json({ error: "unknown route" }, 404);
    }
  }
  webSocketMessage(socket, message) {
    if (socket !== this.socket()) return;
    if (message === "ping") {
      try {
        socket.send("pong");
      } catch {
      }
      return;
    }
    const pending = this.pending;
    if (typeof message === "string") {
      let m;
      try {
        m = JSON.parse(message);
      } catch {
        return;
      }
      if (!m || typeof m !== "object") return;
      if (m.type === "telemetry") {
        if (m.data?.cluster?.nodes?.length === 4) {
          this.telemetry = m.data.cluster;
          this.telemetryAt = Date.now();
        }
        return;
      }
      if (!pending || pending.socket !== socket || m.id !== pending.id) return;
      if (m.type === "error") {
        const message2 = typeof m.error === "string" ? m.error : "";
        const missing = pending.op === "photo" && message2 === "Photo unavailable" || pending.op === "fileDownload" && message2 === "File unavailable";
        const code = missing ? 404 : message2.includes("busy") ? 409 : 502;
        this.finish(json({ error: m.error || "MEDIA failed" }, code));
        return;
      }
      if (!pending.expectsImage) {
        if (m.type === "result") this.finish(json(m.data ?? {}));
        return;
      }
      const file = pending.op === "fileDownload";
      if (m.type === "begin") {
        if (pending.buffer || !Number.isInteger(m.size) || m.size < (file ? 0 : 4) || m.size > (file ? MAX_UPLOAD : MAX_PHOTO)) {
          this.finish(json({ error: "invalid image length" }, 502));
          return;
        }
        pending.buffer = new Uint8Array(m.size);
      } else if (m.type === "end") {
        if (!pending.buffer || pending.used !== pending.buffer.length) {
          this.finish(json({ error: "incomplete image" }, 502));
          return;
        }
        const headers = { ...standard, "Content-Type": file ? "application/octet-stream" : "image/jpeg" };
        if (file) headers["Content-Disposition"] = attachment(pending.key);
        this.finish(new Response(pending.buffer, { headers }));
      }
      return;
    }
    if (!pending || pending.socket !== socket || !pending.expectsImage) return;
    const bytes = new Uint8Array(message);
    if (bytes.length <= HEADER_BYTES || decoder.decode(bytes.subarray(0, HEADER_BYTES)) !== pending.id) return;
    const chunk = bytes.subarray(HEADER_BYTES);
    if (!pending.buffer || chunk.length > 2048 || pending.used + chunk.length > pending.buffer.length) {
      this.finish(json({ error: "invalid image block" }, 502));
      return;
    }
    pending.buffer.set(chunk, pending.used);
    pending.used += chunk.length;
  }
  webSocketClose(socket, code, reason) {
    if (this.pending?.socket === socket) this.finish(json({ error: "MEDIA disconnected" }, 503));
    try {
      socket.close(code, reason);
    } catch {
    }
  }
  webSocketError(socket) {
    if (this.pending?.socket === socket) this.finish(json({ error: "MEDIA disconnected" }, 503));
    try {
      socket.close(1011, "Media I/O error");
    } catch {
    }
  }
};
export {
  LoginLimit,
  RohamHub,
  worker_default as default
};
