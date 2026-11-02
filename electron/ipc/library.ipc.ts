import { ipcMain, dialog, BrowserWindow } from 'electron';
import { SourcesRepository } from '../database/repositories/sources.repo';
import { LibraryService } from '../services/library.service';
import { SourceType } from '../types';

export function registerLibraryIpc(mainWindow: BrowserWindow): void {
  const sourcesRepo = new SourcesRepository();
  const libraryService = LibraryService.getInstance();

  ipcMain.handle('library:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Pasta de Cursos',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('library:add-source', async (_, data: {
    name: string;
    sourceType: SourceType;
    rootPath: string;
    remoteName?: string;
    scanMode?: 'single_course' | 'multi_course';
  }) => {
    if (!data.name || !data.rootPath) {
      throw new Error('Nome e caminho da origem são obrigatórios');
    }

    const id = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sourcesRepo.create({
      id,
      name: data.name,
      source_type: data.sourceType,
      root_path: data.rootPath,
      remote_name: data.remoteName,
      scan_mode: data.scanMode || 'single_course',
      enabled: 1
    });

    return sourcesRepo.getById(id);
  });

  ipcMain.handle('library:list-sources', async () => {
    return sourcesRepo.list();
  });

  ipcMain.handle('library:delete-source', async (_, id: string) => {
    sourcesRepo.delete(id);
    return { success: true };
  });

  ipcMain.handle('library:scan-source', async (_, sourceId: string) => {
    return libraryService.scanSource(sourceId, (progress) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library:scan-progress', progress);
      }
    });
  });

  ipcMain.handle('library:cancel-scan', async (_, sourceId: string) => {
    libraryService.cancelScan(sourceId);
    return { success: true };
  });
}
