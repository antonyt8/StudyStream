import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { DatabaseService } from '../database/connection';
import { AppSettings } from '../types';

import { RcloneService } from '../services/rclone.service';

export function registerSettingsIpc(mainWindow: BrowserWindow): void {
  const settingsRepo = new SettingsRepository();
  const db = DatabaseService.getInstance();
  const rcloneService = RcloneService.getInstance();

  ipcMain.handle('settings:get', async () => {
    return settingsRepo.getAll();
  });

  ipcMain.handle('settings:save', async (_, updates: Partial<AppSettings>) => {
    settingsRepo.updateMany(updates);
    if (updates.startWithWindows !== undefined) {
      try {
        app.setLoginItemSettings({
          openAtLogin: updates.startWithWindows
        });
      } catch (err) {
        console.warn('Could not set login item settings:', err);
      }
    }
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
    if (!targetPath) return { success: false, error: 'Caminho inválido' };

    // 1. If it's a web/http URL
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      await shell.openExternal(targetPath);
      return { success: true };
    }

    // 2. Check if it's a remote Google Drive / Rclone path (e.g. "gdrive:..." or "remote:path", not Windows "C:\")
    const isRemote = /^[a-zA-Z0-9_\-]+:/.test(targetPath) && !/^[a-zA-Z]:[/\\]/.test(targetPath);

    if (isRemote) {
      const settings = settingsRepo.getAll();
      const rclonePath = settings.rclonePath || 'rclone';

      const filename = path.basename(targetPath.replace(/\\/g, '/')) || 'documento.pdf';
      const tempDir = path.join(app.getPath('temp'), 'StudyStream_Docs');
      const localDest = path.join(tempDir, filename);

      if (!fs.existsSync(localDest) || fs.statSync(localDest).size === 0) {
        await rcloneService.copyFileTo(rclonePath, targetPath, localDest);
      }

      await shell.openPath(localDest);
      return { success: true, localPath: localDest };
    }

    // 3. Local disk file
    await shell.openPath(targetPath);
    return { success: true };
  });

  ipcMain.handle('settings:export-json', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Dados Pessoais do StudyStream',
      defaultPath: `studystream_user_data_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Arquivo JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true };
    }

    try {
      const notes = db.all(`SELECT * FROM notes`);
      const bookmarks = db.all(`SELECT * FROM bookmarks`);
      const goals = db.all(`SELECT * FROM study_goals`);
      const tasks = db.all(`SELECT * FROM tasks`);
      const progress = db.all(`SELECT * FROM lesson_progress`);
      const sessions = db.all(`SELECT * FROM study_sessions`);
      const customLists = db.all(`SELECT * FROM custom_lists`);
      const customListCourses = db.all(`SELECT * FROM custom_list_courses`);

      const exportPayload = {
        app: 'StudyStream Desktop',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          notes,
          bookmarks,
          goals,
          tasks,
          progress,
          sessions,
          customLists,
          customListCourses
        }
      };

      fs.writeFileSync(result.filePath, JSON.stringify(exportPayload, null, 2), 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:clear-cache', async () => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          try {
            fs.rmSync(path.join(tempDir, file), { recursive: true, force: true });
          } catch {}
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:reset-local-data', async () => {
    try {
      db.transaction(() => {
        db.run(`DELETE FROM notes;`);
        db.run(`DELETE FROM bookmarks;`);
        db.run(`DELETE FROM study_sessions;`);
        db.run(`DELETE FROM lesson_progress;`);
        db.run(`DELETE FROM tasks;`);
        db.run(`DELETE FROM study_goals;`);
        db.run(`DELETE FROM custom_list_courses;`);
        db.run(`DELETE FROM custom_lists;`);
        db.run(`DELETE FROM downloads;`);
        db.run(`DELETE FROM materials;`);
        db.run(`DELETE FROM lessons;`);
        db.run(`DELETE FROM modules;`);
        db.run(`DELETE FROM courses;`);
        db.run(`DELETE FROM sources;`);
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

