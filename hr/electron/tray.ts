import { Tray, Menu, nativeImage, BrowserWindow, App, NativeImage, Notification } from 'electron';
import path from 'path';

let tray: Tray | null = null;

interface ServerInfo {
  port: number;
  localURL: string;
  networkURL: string | null;
  allIPs: { name: string; address: string }[];
  hostname: string;
}

export function createTray(mainWindow: BrowserWindow, app: App & { isQuitting?: boolean }, serverInfo?: ServerInfo) {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, '.next', 'standalone', 'public', 'favicon.ico')
    : path.join(__dirname, '..', 'public', 'favicon.ico');
  let icon: NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);

  const networkUrl = serverInfo && serverInfo.networkURL ? serverInfo.networkURL : 'N/A';
  const tooltipText = serverInfo && serverInfo.networkURL
    ? `HR SYSTEM - ${networkUrl}`
    : 'HR SYSTEM - localhost:3000';
  tray.setToolTip(tooltipText);

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'HR SYSTEM 열기',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '서버 상태: 실행 중',
      enabled: false,
    },
    {
      label: `이 PC: http://localhost:3000`,
      enabled: false,
    },
    {
      label: `다른 PC 접속: ${networkUrl}`,
      click: () => {
        const { clipboard } = require('electron');
        clipboard.writeText(networkUrl);
        const notification = new Notification({
          title: 'HR SYSTEM',
          body: `접속 주소가 복사되었습니다: ${networkUrl}`,
        });
        notification.show();
      },
    },
  ];

  // Add all IPs if multiple
  if (serverInfo && serverInfo.allIPs && serverInfo.allIPs.length > 1) {
    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: '전체 네트워크 주소',
      enabled: false,
    });
    for (const ip of serverInfo.allIPs) {
      menuItems.push({
        label: `  ${ip.name}: http://${ip.address}:3000`,
        click: () => {
          const url = `http://${ip.address}:3000`;
          const { clipboard } = require('electron');
          clipboard.writeText(url);
          const notification = new Notification({
            title: 'HR SYSTEM',
            body: `접속 주소가 복사되었습니다: ${url}`,
          });
          notification.show();
        },
      });
    }
  }

  menuItems.push(
    { type: 'separator' },
    {
      label: 'DB 백업',
      click: () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const dbPath = path.join(app.getPath('userData'), 'data.db');

        if (!fs.existsSync(dbPath)) {
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'DB 백업',
            message: '데이터베이스 파일이 존재하지 않습니다.',
          });
          return;
        }

        dialog.showSaveDialog(mainWindow, {
          title: 'DB 백업 저장',
          defaultPath: `hr-backup-${new Date().toISOString().slice(0, 10)}.db`,
          filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        }).then((result: { canceled: boolean; filePath?: string }) => {
          if (!result.canceled && result.filePath) {
            fs.copyFileSync(dbPath, result.filePath);
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'DB 백업 완료',
              message: `백업이 완료되었습니다.\n${result.filePath}`,
            });
          }
        });
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  );

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
