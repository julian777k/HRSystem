interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  platform: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
