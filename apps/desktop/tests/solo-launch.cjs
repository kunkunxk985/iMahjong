const { app, ipcMain, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const scenario = process.env.SOLO_SCENARIO || 'normal';
// Finder launches packaged apps with / as cwd, not the repository directory.
process.chdir('/');
const handle = ipcMain.handle.bind(ipcMain);
let calls = 0;
ipcMain.handle = (channel, handler) => handle(channel, (...args) => {
  if (channel === 'local-server:url' && ++calls === 1) {
    if (scenario === 'failure') throw new Error('simulated startup failure');
    if (scenario === 'timeout') return new Promise(() => {});
  }
  return handler(...args);
});
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mahjong-solo-')));
const deadline = setTimeout(() => { console.error('solo launch timed out'); app.exit(1); }, 30000);
app.on('browser-window-created', (_event, win) => {
  let seeded = false;
  win.webContents.on('did-finish-load', async () => {
    try {
      if (!seeded) {
        seeded = true;
        session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({cancel: /^(https:|wss:)/.test(details.url)}));
        await win.webContents.executeJavaScript(`localStorage.setItem('pizhou.auth_token_v1','test-only');localStorage.setItem('pizhou.auth_user_v1', JSON.stringify({userId:'local-test',username:'local-test',nickname:'本地测试',isGuest:true}));`);
        win.reload();
        return;
      }
      await new Promise(r => setTimeout(r, 500));
      await win.webContents.executeJavaScript(`window.__views=[]; window.__urls=[]; const Original=window.WebSocket; window.WebSocket=class extends Original {constructor(...args){super(...args);window.__urls.push(args[0]);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.view)window.__views.push(m.view)}catch{}})}}; const timer=window.setTimeout;window.setTimeout=(fn,delay,...args)=>timer(fn,delay===15000?1000:delay,...args); const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('单机')); if(!b)throw new Error(document.body.innerText); b.click();`);
      let retried = false;
      for (let i=0;i<150;i++) {
        const result = await win.webContents.executeJavaScript(`({playing:window.__views.some(v=>v.phase==='playing'&&v.players.length===4&&v.players.filter(p=>p.isBot).length===3),urls:window.__urls,text:document.body.innerText.slice(-900)})`);
        if (!retried && ['failure','timeout'].includes(scenario) && result.text.includes('请重新点击单机练习')) {
          retried = true;
          await win.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('单机练习')&&!b.disabled).click()`);
        }
        if(result.playing){
          if(['failure','timeout'].includes(scenario)&&!retried)throw new Error('retry was not exercised');
          if(scenario==='occupied'&&result.urls.some(url=>/^ws:\/\/127\.0\.0\.1:878[7-9]|^ws:\/\/127\.0\.0\.1:8790/.test(url)))throw new Error('occupied port used');
          if(process.env.SOLO_SCREENSHOT) {
            await win.webContents.executeJavaScript('document.fonts.ready');
            await new Promise(r=>setTimeout(r,300));
            fs.writeFileSync(process.env.SOLO_SCREENSHOT,(await win.webContents.capturePage()).toPNG());
          }
          console.log(JSON.stringify({scenario,retried,...result}));clearTimeout(deadline);app.exit(0);return;
        }
        if(i===149)throw new Error(JSON.stringify(result));
        await new Promise(r=>setTimeout(r,100));
      }
    } catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
  });
});
async function boot() {
  if(scenario==='occupied') {
    for(const port of [8787,8788,8789,8790]) {
      const server=http.createServer((_req,res)=>{res.writeHead(404);res.end('occupied');});
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});
    }
  }
  require(process.env.SOLO_APP_ROOT + '/dist-electron/main.js');
}
boot().catch(error=>{console.error(error);app.exit(1);});
