import { app, BrowserWindow, dialog, ipcMain, Menu, clipboard, powerSaveBlocker } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTray } from './tray';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverReady = false;
let powerSaveId: number | null = null;
const PORT = 3000;

interface IPInfo {
  name: string;
  address: string;
}

interface ServerInfo {
  port: number;
  localURL: string;
  networkURL: string | null;
  allIPs: IPInfo[];
  hostname: string;
}

function getLocalIPs(): IPInfo[] {
  const interfaces = os.networkInterfaces();
  const ips: IPInfo[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push({ name, address: addr.address });
      }
    }
  }
  return ips;
}

function getServerInfo(): ServerInfo {
  const ips = getLocalIPs();
  const primaryIP = ips.length > 0 ? ips[0].address : null;
  return {
    port: PORT,
    localURL: `http://localhost:${PORT}`,
    networkURL: primaryIP ? `http://${primaryIP}:${PORT}` : null,
    allIPs: ips,
    hostname: os.hostname(),
  };
}

function getUserDataPath() {
  return app.getPath('userData');
}

function getDbPath() {
  return path.join(getUserDataPath(), 'data.db');
}

function getConfigPath() {
  return path.join(getUserDataPath(), 'config.json');
}

function loadOrCreateConfig(): Record<string, string> {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveConfig(config: Record<string, string>) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function getOrCreateJwtSecret(): string {
  const config = loadOrCreateConfig();
  if (config.jwtSecret) {
    return config.jwtSecret;
  }
  const crypto = require('crypto');
  const secret = crypto.randomBytes(64).toString('hex');
  config.jwtSecret = secret;
  saveConfig(config);
  return secret;
}

function getResourcePath(...parts: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  return path.join(__dirname, '..', ...parts);
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverDir = getResourcePath('.next', 'standalone');
    const serverScript = path.join(serverDir, 'server.js');

    if (!fs.existsSync(serverScript)) {
      reject(new Error(`Server script not found: ${serverScript}`));
      return;
    }

    const dbPath = getDbPath();
    const jwtSecret = getOrCreateJwtSecret();

    const modulesDir = path.join(serverDir, '_modules');
    const nodeModulesDir = path.join(serverDir, 'node_modules');
    const resolvedModules = fs.existsSync(modulesDir) ? modulesDir : nodeModulesDir;

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NODE_PATH: resolvedModules,
      PORT: String(PORT),
      HOSTNAME: '0.0.0.0',
      DB_PROVIDER: 'sqlite',
      DATABASE_URL: `file:${dbPath}`,
      JWT_SECRET: jwtSecret,
      NEXT_PUBLIC_DB_PROVIDER: 'sqlite',
    };

    serverProcess = spawn(process.execPath, [serverScript], {
      cwd: serverDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 15000);

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('[server]', output);
      if (!started && (output.includes('Ready') || output.includes('started') || output.includes(`${PORT}`))) {
        started = true;
        clearTimeout(timeout);
        setTimeout(resolve, 1000);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[server:err]', data.toString());
    });

    serverProcess.on('error', (err) => {
      if (!started) {
        started = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverProcess = null;
      if (serverReady && !(app as typeof app & { isQuitting?: boolean }).isQuitting) {
        dialog.showErrorBox(
          'HR SYSTEM 서버 오류',
          `서버가 예기치 않게 종료되었습니다. (코드: ${code})\n앱을 다시 시작해주세요.`
        );
        (app as typeof app & { isQuitting?: boolean }).isQuitting = true;
        app.quit();
      }
    });
  });
}

function injectServerInfoUI(win: BrowserWindow) {
  const info = getServerInfo();
  const networkUrl = info.networkURL || '';
  const hostnameUrl = `http://${info.hostname}:${PORT}`;
  const js = `
    (function() {
        if (document.getElementById('__server-info-bar')) return;

        function generateQR(text, size) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) + '&format=svg';
            return img;
        }

        var style = document.createElement('style');
        style.textContent = \`
            @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
            #__qr-modal { display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:100000;
                background:rgba(0,0,0,0.7); align-items:center; justify-content:center; }
            #__qr-modal.show { display:flex; }
            #__qr-card { background:#fff; border-radius:16px; padding:32px; text-align:center;
                box-shadow:0 25px 60px rgba(0,0,0,0.4); max-width:400px; width:90%; }
            #__qr-card h3 { margin:0 0 4px; font-size:18px; color:#1e293b; }
            #__qr-card .subtitle { color:#64748b; font-size:13px; margin-bottom:20px; }
            #__qr-card .qr-wrap { background:#f8fafc; border-radius:12px; padding:20px; margin-bottom:16px; display:inline-block; }
            #__qr-card .url-display { background:#f1f5f9; border-radius:8px; padding:10px 16px;
                font-family:monospace; font-size:15px; color:#0369a1; cursor:pointer;
                border:2px dashed #cbd5e1; transition:all 0.2s; }
            #__qr-card .url-display:hover { border-color:#0369a1; background:#e0f2fe; }
            #__qr-card .hint { color:#94a3b8; font-size:11px; margin-top:8px; }
            #__qr-card .close-btn { margin-top:16px; background:#1e293b; color:#fff; border:none;
                padding:8px 24px; border-radius:8px; cursor:pointer; font-size:14px; }
            #__qr-card .close-btn:hover { background:#334155; }
        \`;
        document.head.appendChild(style);

        var modal = document.createElement('div');
        modal.id = '__qr-modal';
        modal.innerHTML = \`
            <div id="__qr-card">
                <h3>모바일 접속</h3>
                <div class="subtitle">카메라로 QR 코드를 스캔하세요</div>
                <div class="qr-wrap" id="__qr-container"></div>
                <div class="url-display" id="__qr-url" title="클릭하면 복사됩니다">${networkUrl || hostnameUrl}</div>
                <div class="hint">QR 코드를 스캔하면 자동으로 접속됩니다</div>
                <button class="close-btn" id="__qr-close">닫기</button>
            </div>
        \`;
        document.body.appendChild(modal);

        var qrImg = generateQR('${networkUrl || hostnameUrl}', 200);
        qrImg.style.cssText = 'width:200px;height:200px;';
        qrImg.onload = function() {
            document.getElementById('__qr-container').appendChild(qrImg);
        };
        qrImg.onerror = function() {
            document.getElementById('__qr-container').innerHTML =
                '<div style="font-size:24px;font-weight:bold;color:#0369a1;padding:40px 20px;">${networkUrl || hostnameUrl}</div>';
        };

        document.getElementById('__qr-close').onclick = function() { modal.classList.remove('show'); };
        modal.onclick = function(e) { if(e.target === modal) modal.classList.remove('show'); };
        document.getElementById('__qr-url').onclick = function() {
            navigator.clipboard.writeText('${networkUrl || hostnameUrl}').then(function() {
                var el = document.getElementById('__qr-url');
                el.textContent = 'URL \\uBCF5\\uC0AC \\uC644\\uB8CC!';
                el.style.color = '#16a34a';
                setTimeout(function() { el.textContent = '${networkUrl || hostnameUrl}'; el.style.color = '#0369a1'; }, 1500);
            });
        };

        var bar = document.createElement('div');
        bar.id = '__server-info-bar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#1e293b,#334155);color:#e2e8f0;padding:6px 16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -2px 10px rgba(0,0,0,0.3);border-top:1px solid #475569;';

        var left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';

        var dot = document.createElement('span');
        dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 2s infinite;';

        var label = document.createElement('span');
        label.textContent = '서버 실행 중';
        label.style.cssText = 'font-weight:600;color:#94a3b8;font-size:12px;';

        var sep1 = document.createElement('span');
        sep1.textContent = '|';
        sep1.style.cssText = 'color:#475569;';

        var urlBox = document.createElement('span');
        urlBox.textContent = '${hostnameUrl}';
        urlBox.style.cssText = 'background:#0f172a;color:#38bdf8;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:12px;cursor:pointer;border:1px solid #1e40af;';
        urlBox.title = '\\uD074\\uB9AD\\uD558\\uBA74 \\uBCF5\\uC0AC';
        urlBox.onclick = function() {
            navigator.clipboard.writeText('${hostnameUrl}').then(function() {
                urlBox.textContent = 'Copied!';
                urlBox.style.color = '#22c55e';
                setTimeout(function() { urlBox.textContent = '${hostnameUrl}'; urlBox.style.color = '#38bdf8'; }, 1200);
            });
        };

        var sep2 = document.createElement('span');
        sep2.textContent = '|';
        sep2.style.cssText = 'color:#475569;';

        var qrThumb = document.createElement('div');
        qrThumb.style.cssText = 'width:28px;height:28px;background:#fff;border-radius:4px;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid #475569;transition:transform 0.2s;';
        qrThumb.title = '클릭하면 QR 코드 확대';
        qrThumb.onmouseenter = function(){ qrThumb.style.transform='scale(1.15)'; };
        qrThumb.onmouseleave = function(){ qrThumb.style.transform='scale(1)'; };
        qrThumb.onclick = function() { document.getElementById('__qr-modal').classList.add('show'); };

        var thumbImg = generateQR('${networkUrl || hostnameUrl}', 56);
        thumbImg.style.cssText = 'width:24px;height:24px;';
        thumbImg.onload = function() { qrThumb.appendChild(thumbImg); };
        thumbImg.onerror = function() {
            qrThumb.innerHTML = '<span style="font-size:16px;">&#9783;</span>';
        };

        var qrLabel = document.createElement('span');
        qrLabel.textContent = 'QR';
        qrLabel.style.cssText = 'color:#94a3b8;font-size:10px;font-weight:600;cursor:pointer;';
        qrLabel.onclick = function() { document.getElementById('__qr-modal').classList.add('show'); };

        left.appendChild(dot);
        left.appendChild(label);
        left.appendChild(sep1);
        left.appendChild(urlBox);
        left.appendChild(sep2);
        left.appendChild(qrThumb);
        left.appendChild(qrLabel);

        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
                e.preventDefault();
                document.getElementById('__qr-modal').classList.toggle('show');
            }
            if (e.key === 'Escape') {
                document.getElementById('__qr-modal').classList.remove('show');
            }
        });

        var right = document.createElement('div');
        right.style.cssText = 'display:flex;align-items:center;gap:8px;';

        var ipRef = document.createElement('span');
        ipRef.textContent = 'IP: ${networkUrl ? networkUrl.replace("http://","") : "N/A"}';
        ipRef.style.cssText = 'color:#475569;font-size:10px;font-family:monospace;';
        ipRef.title = '관리자용 IP 참고';

        var closeBtn = document.createElement('button');
        closeBtn.textContent = String.fromCharCode(215);
        closeBtn.style.cssText = 'background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;padding:0 4px;line-height:1;';
        closeBtn.onclick = function() { bar.style.display = 'none'; document.body.style.paddingBottom = '0'; };

        right.appendChild(ipRef);
        right.appendChild(closeBtn);

        bar.appendChild(left);
        bar.appendChild(right);
        document.body.appendChild(bar);
        document.body.style.paddingBottom = '36px';
    })();
    `;
  win.webContents.executeJavaScript(js).catch(() => {});
}

// IPC handlers
ipcMain.handle('get-server-info', () => {
  return getServerInfo();
});
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'HR SYSTEM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      injectServerInfoUI(mainWindow);
    }
  });

  // Right-click context menu with QR option
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const info = getServerInfo();
    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: '\uD83D\uDCF1 모바일 접속 QR',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.executeJavaScript(
              "document.getElementById('__qr-modal')?.classList.add('show');"
            ).catch(() => {});
          }
        }
      },
      {
        label: '\uD83D\uDD17 서버 URL 복사',
        click: () => {
          clipboard.writeText(`http://${info.hostname}:${PORT}`);
        }
      },
      { type: 'separator' },
      { label: '뒤로', role: 'undo', visible: params.isEditable },
      { label: '앞으로', role: 'redo', visible: params.isEditable },
      { type: 'separator', visible: params.isEditable },
      { label: '잘라내기', role: 'cut', visible: params.isEditable },
      { label: '복사', role: 'copy', visible: params.selectionText.length > 0 },
      { label: '붙여넣기', role: 'paste', visible: params.isEditable },
      { label: '전체 선택', role: 'selectAll' },
    ];
    const menu = Menu.buildFromTemplate(menuItems.filter(m => m.visible !== false));
    menu.popup();
  });

  mainWindow.on('close', (event) => {
    if (mainWindow && !(app as typeof app & { isQuitting?: boolean }).isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('before-quit', () => {
  (app as typeof app & { isQuitting?: boolean }).isQuitting = true;
});

app.whenReady().then(async () => {
  try {
    const userDataPath = getUserDataPath();
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    await startServer();
    serverReady = true;

    // Prevent system sleep while server is running
    powerSaveId = powerSaveBlocker.start('prevent-app-suspension');

    createWindow();
    const info = getServerInfo();
    createTray(mainWindow!, app, info);
  } catch (err) {
    dialog.showErrorBox(
      'HR SYSTEM 시작 오류',
      `서버를 시작할 수 없습니다.\n\n${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
    powerSaveId = null;
  }
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    const proc = serverProcess;
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
    }, 3000);
    serverProcess = null;
  }
});
