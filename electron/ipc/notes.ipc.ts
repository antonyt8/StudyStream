import { ipcMain } from 'electron';
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
  }) => {
    return notesRepo.create(data);
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
