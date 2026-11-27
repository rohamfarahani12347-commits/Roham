// scratch/roham-datacenter/src/panel.html
var panel_default = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101c38">
<title>ROHAM DATA | دیتاسنتر</title>
<style>
:root {
  color-scheme:light; --bg:#eff3f9; --paper:#fff; --ink:#182441; --muted:#536581;
  --line:#dce4f0; --navy:#132347; --blue:#304fbc; --sky:#6dd9ec;
  --green:#14664d; --red:#a22e49; --soft:#f6f8fc;
  font:14px/1.75 "Noto Sans Arabic",Tahoma,"Segoe UI",Arial,sans-serif;
}
* {box-sizing:border-box}
[hidden] {display:none!important}
body {margin:0;background:var(--bg);color:var(--ink)}
button,input {font:inherit}
button,a,input {touch-action:manipulation}
button:focus-visible,a:focus-visible,input:focus-visible,.drop:focus-within {outline:3px solid #648bff;outline-offset:3px}
button:disabled {opacity:.48;cursor:default}
.top {background:#101c38;color:#f5f8ff;border-bottom:1px solid #2f426d}
.bar {max-width:1260px;margin:auto;padding:14px clamp(15px,4vw,48px);display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand {display:flex;align-items:center;gap:10px}
.mark {background:#72e0ec;color:#101c38;font:900 15px/1 system-ui;display:grid;place-items:center;width:36px;height:36px;border-radius:10px}
.brandword {font:700 15px/1.45 system-ui;letter-spacing:.12em}
.top .logout {border-color:#567093;color:#f5f8ff;background:transparent}
.top .logout:hover:not(:disabled),.top .logout:focus-visible:not(:disabled) {background:#22385e;border-color:#678bc9}
.shell {max-width:1260px;margin:auto;padding:26px clamp(15px,4vw,48px) 40px}
.overview {position:relative;isolation:isolate;overflow:hidden;background:#182e5b;border:1px solid #355080;border-radius:18px;padding:26px 24px;display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,.95fr);gap:20px;align-items:end;color:#f8fbff}
.overview::before {content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 10% 110%,#244fa5 0,transparent 60%),linear-gradient(#84afe52a 1px,transparent 1px),linear-gradient(90deg,#84afe52a 1px,transparent 1px);background-size:auto,28px 28px,28px 28px;opacity:.6;mask-image:linear-gradient(to left,transparent,#000)}
h1,h2,p {margin:0}
h1 {font-size:clamp(30px,4vw,52px);line-height:1.45}
.intro p {color:#d6e3ff;margin-top:3px;font-size:14px}
.signals {display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}
.signal {background:#101f43cc;border:1px solid #557aaa94;border-radius:12px;padding:12px}
.signal dt {color:#c2d4f4;font-size:12px}
.signal dd {display:flex;align-items:center;gap:7px;margin:3px 0 0;font-weight:700;min-width:0}
.dot {width:8px;height:8px;flex:none;border-radius:50%;background:#c1cadb}
.signal[data-state=up] .dot {background:#71edcf;box-shadow:0 0 8px #78ead380}
.signal[data-state=down] .dot {background:#ff9fad}
.workspace {display:grid;grid-template-columns:minmax(240px,330px) minmax(0,1fr);gap:16px;margin-top:17px;align-items:start}
.card {min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:15px;box-shadow:0 8px 28px #172a5620}
.heading {min-height:61px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line)}
.heading h2 {font-size:17px}
.heading p,.hint {color:var(--muted);font-size:12px}
.button {display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:37px;padding:4px 12px;color:var(--ink);border:1px solid #bdcbe0;border-radius:8px;background:white;cursor:pointer;text-decoration:none;white-space:nowrap}
.button:hover:not(:disabled),.button:focus-visible:not(:disabled) {border-color:#6e8bbf;background:#eef3fc}
.button.primary {background:#304fbc;color:white;border-color:#304fbc;font-weight:700}
.button.primary:hover:not(:disabled) {background:#203d9e}
.upload-body {padding:15px}
.drop {position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:123px;padding:14px 10px;text-align:center;border:1px dashed #7795d6;border-radius:12px;background:#eef3ff;color:#193a86;cursor:pointer;overflow:hidden}
.drop:is(:hover,[data-drag=true]) {background:#dfeaff;border-color:#304fbc}
.drop input {position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.upload-symbol {font:700 21px/1 system-ui;display:grid;place-items:center;width:32px;height:32px;background:#dbe6ff;border-radius:9px;color:#2847ac}
.choice {padding:9px 0 0;min-height:38px;color:var(--muted);overflow-wrap:anywhere}
.choice bdi {color:var(--ink);font-weight:700}
.upload-actions {display:flex;align-items:center;gap:8px;margin-top:10px}
.upload-actions .primary {flex:1}
.notice {margin-top:10px;color:var(--muted);overflow-wrap:anywhere;font-size:13px}
.notice:empty {display:none}
.notice[data-error=true] {color:var(--red)}
.search {margin:13px 15px 10px;display:flex;align-items:center;gap:9px}
.search input {width:100%;background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--ink)}
.table {width:100%;border-collapse:collapse;table-layout:fixed}
.table th,.table td {text-align:start;padding:10px 12px}
.table th {background:var(--soft);font-size:12px;color:var(--muted)}
.table td {border-bottom:1px solid #e6ebf4}
.table th:first-child,.table td:first-child {padding-inline-start:16px}
.table th:nth-child(2) {width:106px}
.table th:last-child {width:96px}
.name {display:inline-block;max-width:100%;overflow-wrap:anywhere;font-weight:600;vertical-align:middle}
.size {white-space:nowrap;color:var(--muted);font-size:12px}
.download {font-size:12px;min-height:32px;padding:3px 8px;color:#254092}
.list-note {padding:8px 16px;color:var(--muted);font-size:13px}
.list-note[data-error=true] {color:var(--red)}
.pager {display:flex;justify-content:space-between;align-items:center;gap:7px;padding:11px 14px;color:var(--muted);font-size:12px}
.pager button {min-height:34px}
@media(max-width:780px) {
  .shell {padding-top:16px}
  .workspace {grid-template-columns:1fr;gap:12px}
  .overview {grid-template-columns:1fr;gap:12px;padding:17px 14px}
  .signal {padding:7px 10px}
  .drop {min-height:99px}
}
@media(max-width:415px) {
  .heading {padding-inline:12px}
  .table th,.table td {padding-inline:6px}
  .table th:nth-child(2) {width:82px}
  .table th:last-child {width:76px}
}
</style>
</head>
<body>
<header class="top">
  <div class="bar">
    <div class="brand"><span class="mark" aria-hidden="true">R</span><bdi class="brandword" dir="ltr">ROHAM DATA</bdi></div>
    <button type="button" id="logout" class="button logout">خروج</button>
  </div>
</header>
<main class="shell">
  <section class="overview" aria-labelledby="pageTitle">
    <div class="intro">
      <h1 id="pageTitle">دیتاسنتر</h1>
      <p>ارسال و دریافت فایل از کارت حافظهٔ DATA</p>
    </div>
    <dl class="signals" aria-label="وضعیت دیتاسنتر">
      <div class="signal" id="dataSignal"><dt>اتصال DATA</dt><dd><i class="dot" aria-hidden="true"></i><span id="dataValue">در حال بررسی</span></dd></div>
      <div class="signal" id="sdSignal"><dt>کارت حافظه</dt><dd><i class="dot" aria-hidden="true"></i><span id="sdValue">در حال بررسی</span></dd></div>
    </dl>
  </section>
  <div class="workspace">
    <section class="card" aria-labelledby="uploadTitle">
      <div class="heading"><div><h2 id="uploadTitle">آپلود روی کارت</h2><p id="uploadLimit">حداکثر ۸ مگابایت برای هر فایل</p></div></div>
      <form id="uploadForm" class="upload-body">
        <label class="drop" id="drop">
          <input type="file" id="phoneFile" aria-describedby="uploadLimit">
          <span class="upload-symbol" aria-hidden="true">↑</span>
          <strong>انتخاب فایل</strong>
          <span class="hint">برای انتخاب ضربه بزنید</span>
        </label>
        <div class="choice" id="selection" aria-live="polite">فایلی انتخاب نشده است.</div>
        <div class="upload-actions">
          <button type="submit" id="uploadButton" class="button primary" disabled>ارسال به DATA</button>
          <button type="button" class="button" id="clearFile" hidden>پاک‌کردن انتخاب</button>
        </div>
        <p id="uploadNotice" class="notice" role="status"></p>
      </form>
    </section>
    <section class="card" aria-labelledby="filesTitle">
      <div class="heading"><div><h2 id="filesTitle">فایل‌های کارت</h2><p id="fileCount">آمادهٔ دریافت فهرست</p></div><button type="button" id="refresh" class="button">تازه‌سازی</button></div>
      <div class="search"><input id="filter" type="search" placeholder="جست‌وجو در این صفحه" aria-label="جست‌وجو در فایل‌های همین صفحه"></div>
      <table class="table" id="table" hidden>
        <thead><tr><th scope="col">نام فایل</th><th scope="col">حجم</th><th scope="col">دریافت</th></tr></thead>
        <tbody id="fileRows"></tbody>
      </table>
      <p id="listNote" class="list-note" role="status"></p>
      <div class="pager" id="pager" hidden>
        <button type="button" class="button" id="prev">صفحهٔ قبل</button>
        <span id="pageNumber"></span>
        <button type="button" class="button" id="next">صفحهٔ بعد</button>
      </div>
    </section>
  </div>
</main>
<script>
'use strict';
const $=id=>document.getElementById(id);
const MAX_BYTES=8*1024*1024;
const number=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1});
let selected=null, working=false, checking=false, dataState, loaded=false;
let offset=0, more=false, items=[];

function formatSize(bytes) {
  if (bytes<1024) return number.format(bytes)+' بایت';
  if (bytes<1024*1024) return number.format(bytes/1024)+' کیلوبایت';
  return number.format(bytes/(1024*1024))+' مگابایت';
}
function message(element,text,error=false) {
  $(element).textContent=text;
  $(element).dataset.error=String(error);
}
function syncActions() {
  $('phoneFile').disabled=working;
  $('uploadButton').disabled=working||!selected;
  $('clearFile').hidden=!selected;
  $('clearFile').disabled=working;
  $('refresh').disabled=working;
  $('prev').disabled=working||offset===0;
  $('next').disabled=working||!more;
  $('logout').disabled=working;
}
function setFile(file) {
  selected=file||null;
  const place=$('selection');
  place.replaceChildren();
  if (selected) {
    const name=document.createElement('bdi');
    name.textContent=selected.name;
    place.append(name,' · '+formatSize(selected.size));
  } else {
    $('phoneFile').value='';
    place.textContent='فایلی انتخاب نشده است.';
  }
  message('uploadNotice','');
  syncActions();
}
function signal(element,label,state) {
  $(element+'Signal').dataset.state=state;
  $(element+'Value').textContent=label;
}
function renderStatus(state) {
  dataState=state;
  const connected=state.online;
  signal('data',connected===true?'آنلاین':connected===false?'آفلاین':'نامشخص',
         connected===true?'up':connected===false?'down':'unknown');
  const mounted=state.mounted;
  signal('sd',mounted===true?'آماده':mounted===false?'در دسترس نیست':'نامشخص',
         mounted===true?'up':mounted===false?'down':'unknown');
}

async function api(path,{method='GET',body,timeout=24000}={}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(path,{method,body,signal:controller.signal,credentials:'same-origin',
      cache:'no-store',headers:{'X-Roham-Panel':'1'}});
    if (response.status===401) {location.assign('/');throw new Error('نشست پایان یافته است.');}
    if (!response.ok) {
      if (response.status===400) throw new Error('نام یا اندازهٔ فایل قابل استفاده نیست.');
      if (response.status===409||response.status===429) throw new Error('دیتاسنتر مشغول است. دوباره امتحان کنید.');
      if (response.status===413) throw new Error('حجم فایل بیشتر از ۸ مگابایت است.');
      if (response.status===502||response.status===503) throw new Error('دیتاسنتر یا کارت حافظه در دسترس نیست.');
      if (response.status===504) throw new Error('مهلت پاسخ دیتاسنتر تمام شد.');
      throw new Error('ارتباط با سایت ناموفق بود ('+response.status+').');
    }
    return await response.json();
  } catch(error) {
    if (error.name==='AbortError') throw new Error('مهلت پاسخ تمام شد.');
    if (error instanceof TypeError) throw new Error('ارتباط با Cloudflare برقرار نشد.');
    throw error;
  } finally {clearTimeout(timer);}
}

function makeDownload(file,label) {
  const link=document.createElement('a');
  link.href='/uploads/'+encodeURIComponent(file.key);
  link.download=file.name;
  link.className='button download';
  link.textContent=label;
  link.setAttribute('aria-label','دانلود '+file.name);
  link.onclick=event=>{if(working)event.preventDefault();};
  return link;
}
function renderFiles() {
  const match=$('filter').value.trim().toLocaleLowerCase('fa-IR');
  const visible=items.filter(file=>file.name.toLocaleLowerCase('fa-IR').includes(match));
  const rows=$('fileRows');
  rows.replaceChildren();
  for (const file of visible) {
    const row=document.createElement('tr');
    const nameCell=row.insertCell();
    const label=document.createElement('bdi');
    label.className='name';
    label.textContent=file.name;
    nameCell.append(label);
    const size=row.insertCell();
    size.className='size';
    size.textContent=formatSize(file.size);
    row.insertCell().append(makeDownload(file,'دانلود'));
    rows.append(row);
  }
  $('fileCount').textContent=number.format(visible.length)+' فایل در این صفحه';
  $('table').hidden=visible.length===0;
  $('pager').hidden=offset===0&&!more;
  $('pageNumber').textContent='صفحهٔ '+number.format(Math.floor(offset/8)+1);
  message('listNote',visible.length?'':match?'فایلی با این نام در صفحه نیست.':'این صفحه فایلی ندارد.');
  syncActions();
}
async function loadFiles(pageOffset) {
  const page=await api('/uploads?offset='+pageOffset);
  offset=pageOffset;
  more=!!page.more;
  items=page.files;
  loaded=true;
  renderFiles();
}
async function run(fn,report='listNote') {
  if (working) return;
  working=true;syncActions();
  try {await fn();}
  catch(error) {message(report,error.message,true);}
  finally {working=false;syncActions();}
}
async function status() {
  if (checking) return;
  checking=true;
  try {
    const previous=dataState;
    renderStatus(await api('/api/storage',{timeout:7000}));
    if (previous?.mounted===true && dataState.mounted!==true) loaded=false;
    if (dataState.mounted===true && !loaded && !working) run(()=>loadFiles(offset));
    else if (!loaded && !working && !items.length && dataState.mounted===false)
      message('listNote','پس از آماده شدن کارت، فهرست اینجا نمایش داده می‌شود.');
  } catch {
    renderStatus({});
    if (!loaded && !working) message('listNote','وضعیت دیتاسنتر دریافت نشد. دوباره تازه‌سازی کنید.',true);
  } finally {checking=false;}
}

$('phoneFile').onchange=()=>setFile($('phoneFile').files[0]);
$('clearFile').onclick=()=>setFile(null);
for (const event of ['dragenter','dragover']) {
  $('drop').addEventListener(event,e=>{e.preventDefault();if(!working)$('drop').dataset.drag='true';});
}
for (const event of ['dragleave','drop']) {
  $('drop').addEventListener(event,e=>{e.preventDefault();$('drop').dataset.drag='false';});
}
$('drop').addEventListener('drop',e=>{if(!working&&e.dataTransfer?.files.length)setFile(e.dataTransfer.files[0]);});
$('filter').oninput=()=>{if(loaded)renderFiles();};
$('refresh').onclick=async()=>{
  await status();
  if(!working) run(()=>{
    message('listNote','در حال دریافت فهرست…');
    return loadFiles(offset);
  });
};
$('prev').onclick=()=>run(()=>loadFiles(Math.max(0,offset-8)));
$('next').onclick=()=>run(()=>loadFiles(offset+8));
$('logout').onclick=()=>run(async()=>{await api('/logout',{method:'POST'});location.assign('/');});

$('uploadForm').onsubmit=event=>{
  event.preventDefault();
  const file=selected;
  if(!file)return;
  run(async()=>{
    if(file.size>MAX_BYTES)throw new Error('حداکثر حجم هر فایل ۸ مگابایت است.');
    if(new TextEncoder().encode(file.name).length>84)throw new Error('نام فایل را کوتاه‌تر کنید.');
    message('uploadNotice','در حال ارسال و ذخیره روی کارت…');
    const params=new URLSearchParams({name:file.name,size:String(file.size)});
    const result=await api('/uploads?'+params,{method:'POST',body:file,timeout:600000});
    if(result.saved!==true)throw new Error('ذخیرهٔ فایل تأیید نشد.');
    setFile(null);
    $('filter').value='';
    try {await loadFiles(0);}
    catch {message('listNote','برای دیدن فایل جدید، فهرست را تازه‌سازی کنید.',true);}
    message('uploadNotice','روی کارت ذخیره شد · '+result.name+' ');
    $('uploadNotice').append(makeDownload(result,'دانلود فایل'));
  },'uploadNotice');
};
syncActions();
status();
setInterval(status,10000);
<\/script>
</body>
</html>
`;

// scratch/roham-datacenter/src/login.html
var login_default = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101c38">
<title>ورود به ROHAM DATA</title>
<style>
:root{color-scheme:light;font:14px/1.85 "Noto Sans Arabic",Tahoma,"Segoe UI",Arial,sans-serif;color:#182441;background:#eff3f9}
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;padding:17px;background:radial-gradient(ellipse at 50% 0,#263e78 0,#101c38 52%)}
main{width:min(100%,421px);background:#fff;border:1px solid #c4d2ec;border-radius:19px;padding:28px;box-shadow:0 22px 74px #080e27a6}
.brand{display:flex;align-items:center;gap:9px;margin-bottom:17px}
.mark{background:#72e0ec;color:#101c38;font:900 15px/1 system-ui;display:grid;place-items:center;width:36px;height:36px;border-radius:10px}
.word{font:700 15px/1.45 system-ui;letter-spacing:.12em}
h1,p{margin:0}
h1{font-size:27px}
label{display:block;margin:14px 0 4px;color:#435572}
input,button{font:inherit;width:100%;border-radius:9px;min-height:43px}
input{direction:ltr;border:1px solid #b9c9e3;padding:5px 9px;background:#f6f8fc;color:#182441}
button{margin-top:12px;border:1px solid #304fbc;background:#304fbc;color:#fff;font-weight:bold;cursor:pointer}
button:hover{background:#213e9c}
button:disabled{opacity:.55;cursor:default}
:focus-visible{outline:3px solid #648bff;outline-offset:3px}
#message{color:#a22e49;margin-top:9px}
#message:empty{display:none}
</style>
</head>
<body>
<main>
  <div class="brand"><span class="mark" aria-hidden="true">R</span><bdi class="word" dir="ltr">ROHAM DATA</bdi></div>
  <h1>ورود به دیتاسنتر</h1>
  <form id="login">
    <label for="password">رمز سایت</label>
    <input id="password" type="password" required maxlength="200" autocomplete="current-password">
    <button type="submit">ورود</button>
  </form>
  <p id="message" role="status"></p>
</main>
<script>
'use strict';
document.getElementById('login').onsubmit=async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector('button'), message=document.getElementById('message');
  button.disabled=true;
  message.textContent='';
  try {
    const response=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json','X-Roham-Panel':'1'},body:JSON.stringify({password:document.getElementById('password').value})});
    if(response.ok){location.replace('/');return;}
    message.textContent=response.status===429?'تعداد تلاش زیاد است. پنج دقیقه دیگر امتحان کنید.':response.status===503?'تنظیمات سرور کامل نیست.':'رمز سایت پذیرفته نشد.';
  }catch{message.textContent='ارتباط با سرور برقرار نشد.';}
  finally{button.disabled=false;}
};
<\/script>
</body>
</html>
`;

// scratch/roham-datacenter/src/worker.js
var SESSION = "roham_session";
var SESSION_SECONDS = 12 * 3600;
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
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
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
    return stub.fetch("https://internal/command", { method: "POST", body: JSON.stringify({ op: "fileDownload", arg: key }) });
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
      return html(session ? panel_default : login_default);
    if (!session) return json({ error: "login required" }, 401);
    if (method === "POST" && !safePost(request, url)) return json({ error: "forbidden" }, 403);
    if (method === "POST" && url.pathname === "/logout") return json({ ok: true }, 200, { "Set-Cookie": cookie("") });
    if (method === "GET" && url.pathname === "/api/storage") {
      return hub(env).fetch("https://internal/status");
    }
    if (url.pathname === "/uploads" || url.pathname.startsWith("/uploads/")) return handleFileRoute(request, url, env);
    return json({ error: "unknown route" }, 404);
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
    if (!this.socket()) return { online: false, mounted: null };
    if (this.telemetry && Date.now() - this.telemetryAt < 15e3) return this.telemetry;
    return { online: null, mounted: null };
  }
  request(socket, command, chunk) {
    if (!socket || socket !== this.socket() || socket.readyState !== 1) return Promise.resolve(json({ error: "MEDIA unavailable" }, 503));
    if (this.pending) return Promise.resolve(json({ error: "MEDIA busy" }, 409));
    const id = crypto.randomUUID();
    const timeout = command.op === "fileDownload" ? 18e4 : command.op.startsWith("upload") ? 13e3 : 22e3;
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.finish(json({ error: "MEDIA response timeout" }, 504)), timeout);
      this.pending = { id, socket, resolve, timer, op: command.op, key: command.arg, expectsFile: command.op === "fileDownload", buffer: null, used: 0 };
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
        const snapshot = m.data?.cluster;
        const board = Array.isArray(snapshot?.nodes) && snapshot.nodes.find((node) => node?.role === "DATA");
        if (board && typeof board.online === "boolean") {
          this.telemetry = {
            online: board.online,
            mounted: board.online && typeof snapshot.dataSd === "boolean" ? snapshot.dataSd : null
          };
          this.telemetryAt = Date.now();
        }
        return;
      }
      if (!pending || pending.socket !== socket || m.id !== pending.id) return;
      if (m.type === "error") {
        const message2 = typeof m.error === "string" ? m.error : "";
        const missing = pending.op === "fileDownload" && message2 === "File unavailable";
        const code = missing ? 404 : message2.includes("busy") ? 409 : 502;
        this.finish(json({ error: m.error || "MEDIA failed" }, code));
        return;
      }
      if (!pending.expectsFile) {
        if (m.type === "result") this.finish(json(m.data ?? {}));
        return;
      }
      if (m.type === "begin") {
        if (pending.buffer || !Number.isInteger(m.size) || m.size < 0 || m.size > MAX_UPLOAD) {
          this.finish(json({ error: "invalid file length" }, 502));
          return;
        }
        pending.buffer = new Uint8Array(m.size);
      } else if (m.type === "end") {
        if (!pending.buffer || pending.used !== pending.buffer.length) {
          this.finish(json({ error: "incomplete file" }, 502));
          return;
        }
        const headers = { ...standard, "Content-Type": "application/octet-stream", "Content-Disposition": attachment(pending.key) };
        this.finish(new Response(pending.buffer, { headers }));
      }
      return;
    }
    if (!pending || pending.socket !== socket || !pending.expectsFile) return;
    const bytes = new Uint8Array(message);
    if (bytes.length <= HEADER_BYTES || decoder.decode(bytes.subarray(0, HEADER_BYTES)) !== pending.id) return;
    const chunk = bytes.subarray(HEADER_BYTES);
    if (!pending.buffer || chunk.length > 2048 || pending.used + chunk.length > pending.buffer.length) {
      this.finish(json({ error: "invalid file block" }, 502));
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
