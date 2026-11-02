import { ipcMain } from 'electron';
import { CoursesRepository, CourseFilter } from '../database/repositories/courses.repo';

export function registerCoursesIpc(): void {
  const coursesRepo = new CoursesRepository();

  ipcMain.handle('courses:list', async (_, filter?: CourseFilter) => {
    return coursesRepo.list(filter || {});
  });

  ipcMain.handle('courses:get-details', async (_, id: string) => {
    return coursesRepo.getFullCourse(id);
  });

  ipcMain.handle('courses:toggle-favorite', async (_, id: string) => {
    return coursesRepo.toggleFavorite(id);
  });

  ipcMain.handle('courses:update', async (_, id: string, updates: any) => {
    coursesRepo.updateCourse(id, updates);
    return coursesRepo.getById(id);
  });

  ipcMain.handle('courses:delete', async (_, id: string) => {
    coursesRepo.delete(id);
    return { success: true };
  });
}
