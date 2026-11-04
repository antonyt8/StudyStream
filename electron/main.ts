import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from './database/connection';
import { registerLibraryIpc } from './ipc/library.ipc';
import { registerCoursesIpc } from './ipc/courses.ipc';
import { registerPlaybackIpc } from './ipc/playback.ipc';
import { registerNotesAndBookmarksIpc } from './ipc/notes.ipc';
import { registerGoalsIpc } from './ipc/goals.ipc';
import { registerTasksAndListsIpc } from './ipc/tasks.ipc';
import { registerDownloadsIpc } from './ipc/downloads.ipc';
import { registerRcloneIpc } from './ipc/rclone.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerExplorerIpc } from './ipc/explorer.ipc';
import { PlaybackService } from './services/playback.service';
import { AppLogger } from './services/app-logger';

// ESM dirname resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = AppLogger.getInstance();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logger.error('Uncaught exception', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  logger.error('Unhandled promise rejection', reason);
});

// Hardware-accelerated video decoding & GPU rasterization switches
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const preloadCjs = path.join(__dirname, 'preload.cjs');
  const preloadMjs = path.join(__dirname, 'preload.mjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCjs)
    ? preloadCjs
    : (fs.existsSync(preloadMjs) ? preloadMjs : preloadJs);

  console.log('Preload path resolved:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    title: 'StudyStream Desktop',
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0a0d14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Fallback to guarantee window visibility
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1000);

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Register all IPC modules
  registerLibraryIpc(mainWindow);
  registerCoursesIpc();
  registerPlaybackIpc();
  registerNotesAndBookmarksIpc();
  registerGoalsIpc();
  registerTasksAndListsIpc();
  registerDownloadsIpc(mainWindow);
  registerRcloneIpc();
  registerSettingsIpc(mainWindow);
  registerExplorerIpc();

  // Load URL or File
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await DatabaseService.getInstance().initialize();
    } catch (err) {
      console.error('Falha ao inicializar o banco de dados SQLite:', err);
    }

    try {
      PlaybackService.getInstance();
    } catch (err) {
      console.error('Falha ao inicializar serviço de playback:', err);
    }

    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    try {
      PlaybackService.getInstance().stop();
      DatabaseService.getInstance().close();
    } catch {
      // ignore
    }
    app.quit();
  }
});
