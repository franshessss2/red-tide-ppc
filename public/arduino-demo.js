const $ = id => document.getElementById(id);
let port=null, reader=null, readTask=null, ready=false, closing=false, queue=Promise.resolve();
let handshakeTimer, heartbeat, lastSample=0;
const buttons=[];
for(let i=1;i<=10;i++) {
  const b=document.createElement('button'); b.textContent=String(i); b.disabled=true;
  b.onclick=()=>send(`LED ${i}`).catch(fail); $('leds').append(b); buttons.push(b);
}
function controls() {
  const kind=$('kind').value;
  const led=ready && (kind==='LED' || kind==='COMBINED');
  buttons.forEach(b=>b.disabled=!led); $('off').disabled=!led;
  for(const id of ['start','stop','beep']) $(id).disabled=!(ready && (kind==='SCANNER' || kind==='COMBINED'));
  $('connect').disabled=!!port || closing; $('disconnect').disabled=!port || closing;
  $('kind').disabled=!!port || closing;
}
function send(line) {
  const target=port;
  queue=queue.catch(()=>{}).then(async()=>{
    if(!target || target!==port || !target.writable) throw Error('USB is disconnected.');
    const writer=target.writable.getWriter();
    try { await writer.write(new TextEncoder().encode(line+'\n')); }
    finally { writer.releaseLock(); }
  });
  return queue;
}
async function disconnect() {
  if(closing) return;
  closing=true; ready=false; clearTimeout(handshakeTimer); clearInterval(heartbeat); controls();
  const target=port;
  try {
    if(target?.writable) await send($('kind').value==='LED'?'OFF':'STOP').catch(()=>{});
    await reader?.cancel().catch(()=>{});
    await readTask?.catch(()=>{});
    await queue.catch(()=>{});
    await target?.close().catch(()=>{});
  } finally {
    port=null; reader=null; readTask=null; closing=false;
    $('reading').textContent='No live connection'; $('status').textContent='Disconnected'; controls();
  }
}
async function fail(error) {
  const message=error?.message || String(error);
  await disconnect(); $('status').textContent=message;
}
function lineReceived(line) {
  $('log').textContent=line;
  if(line===`RT1 ${$('kind').value} READY`) {
    ready=true; clearTimeout(handshakeTimer); $('status').textContent='Connected · firmware identified'; controls();
  }
  const match=/^RT1 SAMPLE (\d{1,3}) (-?\d{1,3})$/.exec(line);
  if(ready && $('kind').value!=='LED' && match) {
    const angle=Number(match[1]), distance=Number(match[2]);
    if(angle<30 || angle>150 || (distance!==-1 && (distance<2 || distance>400))) return;
    lastSample=Date.now();
    $('reading').textContent=`${angle}° · ${distance===-1?'No valid echo':distance+' cm'}`;
  }
}
$('connect').onclick=async()=>{
  if(!navigator.serial || !window.isSecureContext) {
    $('status').textContent='Web Serial requires desktop Chrome/Edge and HTTPS or localhost.'; return;
  }
  $('connect').disabled=true;
  try {
    port=await navigator.serial.requestPort(); controls();
    await port.open({baudRate:9600});
    $('status').textContent='Waiting for firmware identification…';
    reader=port.readable.getReader();
    readTask=(async()=>{
      const decoder=new TextDecoder(); let buffer='';
      try {
        while(true) {
          const {value,done}=await reader.read(); if(done) break;
          buffer+=decoder.decode(value,{stream:true});
          let end;
          while((end=buffer.indexOf('\n'))>=0) {
            const line=buffer.slice(0,end).trim(); buffer=buffer.slice(end+1);
            if(line.length<=128) lineReceived(line);
          }
          if(buffer.length>128) throw Error('Unexpected device data. Check sketch and baud rate.');
        }
      } finally { reader.releaseLock(); }
    })();
    // Opening an Uno serial port can reset it. Query repeatedly during startup.
    heartbeat=setInterval(()=>{
      if(!ready) send('HELLO').catch(fail);
      else if($('kind').value!=='LED') send('KEEP').catch(fail);
      if(lastSample && Date.now()-lastSample>2000) $('reading').textContent='No recent reading · scan stopped or unavailable';
    },1000);
    handshakeTimer=setTimeout(()=>{ if(!ready) void fail(Error('Firmware not identified. Upload the matching Red Tide sketch.')); },8000);
    // Schedule cleanup outside the read task to avoid awaiting itself.
    readTask.then(()=>{if(!closing) void fail(Error('USB connection ended.'));},e=>{if(!closing) void fail(e);});
  } catch(e) { await fail(e); }
};
$('disconnect').onclick=()=>void disconnect();
$('off').onclick=()=>send('OFF').catch(fail);
$('start').onclick=()=>{lastSample=0; $('reading').textContent='Starting scan…'; send('START').catch(fail);};
$('stop').onclick=()=>{lastSample=0; $('reading').textContent='Scan stopped'; send('STOP').catch(fail);};
$('beep').onclick=()=>send('BEEP').catch(fail);
document.addEventListener('visibilitychange',()=>{if(document.hidden && port) void disconnect();});
controls();
