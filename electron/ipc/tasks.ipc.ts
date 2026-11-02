import { ipcMain } from 'electron';
import { TasksRepository } from '../database/repositories/tasks.repo';
import { CustomListsRepository } from '../database/repositories/lists.repo';
import { TaskStatus } from '../types';

export function registerTasksAndListsIpc(): void {
  const tasksRepo = new TasksRepository();
  const listsRepo = new CustomListsRepository();

  // Tasks
  ipcMain.handle('tasks:list', async () => {
    return tasksRepo.list();
  });

  ipcMain.handle('tasks:create', async (_, data: {
    courseId?: string;
    lessonId?: string;
    title: string;
    description?: string;
    dueDate?: string;
  }) => {
    return tasksRepo.create(data);
  });

  ipcMain.handle('tasks:update-status', async (_, id: string, status: TaskStatus) => {
    tasksRepo.updateStatus(id, status);
    return { success: true };
  });

  ipcMain.handle('tasks:delete', async (_, id: string) => {
    tasksRepo.delete(id);
    return { success: true };
  });

  // Custom Lists
  ipcMain.handle('lists:list', async () => {
    return listsRepo.list();
  });

  ipcMain.handle('lists:create', async (_, name: string, description?: string, icon?: string) => {
    return listsRepo.create(name, description, icon);
  });

  ipcMain.handle('lists:add-course', async (_, listId: string, courseId: string) => {
    listsRepo.addCourse(listId, courseId);
    return { success: true };
  });

  ipcMain.handle('lists:remove-course', async (_, listId: string, courseId: string) => {
    listsRepo.removeCourse(listId, courseId);
    return { success: true };
  });

  ipcMain.handle('lists:get-courses', async (_, listId: string) => {
    return listsRepo.getCoursesInList(listId);
  });

  ipcMain.handle('lists:delete', async (_, id: string) => {
    listsRepo.delete(id);
    return { success: true };
  });
}
