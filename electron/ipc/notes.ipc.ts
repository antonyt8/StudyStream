import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import { NotesRepository } from '../database/repositories/notes.repo';
import { BookmarksRepository } from '../database/repositories/bookmarks.repo';

export function registerNotesAndBookmarksIpc(): void {
  const notesRepo = new NotesRepository();
  const bookmarksRepo = new BookmarksRepository();

  // Notes
  ipcMain.handle('notes:list', async (_, filter?: { courseId?: string; lessonId?: string; search?: string }) => {
    return notesRepo.list(filter || {});
  });

  ipcMain.handle('notes:create', async (_, data: {
    courseId: string;
    lessonId?: string;
    title: string;
    content: string;
    timestampSeconds?: number;
    snapshotData?: string;
  }) => {
    return notesRepo.create(data);
  });

  ipcMain.handle('notes:export-markdown', async (_, params: { defaultFileName: string; markdownContent: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Caderno de Anotações',
      defaultPath: params.defaultFileName || 'Anotacoes-StudyStream.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    await fs.promises.writeFile(filePath, params.markdownContent, 'utf-8');
    return { success: true, filePath };
  });

  ipcMain.handle('notes:update', async (_, id: string, data: { title?: string; content?: string; isPinned?: boolean }) => {
    notesRepo.update(id, data);
    return { success: true };
  });

  ipcMain.handle('notes:delete', async (_, id: string) => {
    notesRepo.delete(id);
    return { success: true };
  });

  // Bookmarks
  ipcMain.handle('bookmarks:list', async (_, lessonId: string) => {
    return bookmarksRepo.listByLesson(lessonId);
  });

  ipcMain.handle('bookmarks:create', async (_, data: {
    courseId: string;
    lessonId: string;
    timestampSeconds: number;
    title: string;
    note?: string;
  }) => {
    return bookmarksRepo.create(data);
  });

  ipcMain.handle('bookmarks:delete', async (_, id: string) => {
    bookmarksRepo.delete(id);
    return { success: true };
  });
}
