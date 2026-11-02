import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { DatabaseService } from '../database/connection';
import { AppSettings } from '../types';

export function registerSettingsIpc(mainWindow: BrowserWindow): void {
  const settingsRepo = new SettingsRepository();
  const db = DatabaseService.getInstance();

  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:save', async (_, updates: Partial<AppSettings>) => {
    settingsRepo.updateMany(updates);
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:select-download-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Diretório de Downloads',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selected = result.filePaths[0];
    settingsRepo.set('defaultDownloadPath', selected);
    return selected;
  });

  ipcMain.handle('settings:backup', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Backup do Banco de Dados',
      defaultPath: `studystream_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
      filters: [{ name: 'Banco SQLite', extensions: ['db', 'sqlite'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true };
    }

    return db.backup(result.filePath);
  });

  ipcMain.handle('settings:restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Arquivo de Backup para Restauração',
      filters: [{ name: 'Banco SQLite', extensions: ['db', 'sqlite'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    return db.restore(result.filePaths[0]);
  });

  ipcMain.handle('settings:check-integrity', async () => {
    return db.checkIntegrity();
  });

  ipcMain.handle('settings:open-path', async (_, targetPath: string) => {
    await shell.openPath(targetPath);
    return { success: true };
  });
}
