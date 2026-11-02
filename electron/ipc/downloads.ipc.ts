import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { DownloadsRepository } from '../database/repositories/downloads.repo';
import { LessonsRepository } from '../database/repositories/lessons.repo';
import { CoursesRepository } from '../database/repositories/courses.repo';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { RcloneService } from '../services/rclone.service';

export function registerDownloadsIpc(mainWindow: BrowserWindow): void {
  const downloadsRepo = new DownloadsRepository();
  const lessonsRepo = new LessonsRepository();
  const coursesRepo = new CoursesRepository();
  const settingsRepo = new SettingsRepository();
  const rcloneService = RcloneService.getInstance();

  ipcMain.handle('downloads:list', async () => {
    return downloadsRepo.list();
  });

  ipcMain.handle('downloads:start', async (_, lessonId: string) => {
    const lesson = lessonsRepo.getById(lessonId);
    if (!lesson || !lesson.remote_path) {
      throw new Error('Aula remota não encontrada para download');
    }

    const course = coursesRepo.getById(lesson.course_id);
    const settings = settingsRepo.getAll();
    const defaultDir = settings.defaultDownloadPath || path.join(process.env.USERPROFILE || process.cwd(), 'Downloads', 'StudyStream');

    const ext = path.extname(lesson.remote_path) || '.mp4';
    const safeTitle = lesson.title.replace(/[<>:"/\\|?*]/g, '_');
    const safeCourse = (course?.title || 'Curso').replace(/[<>:"/\\|?*]/g, '_');
    const localDest = path.join(defaultDir, safeCourse, `${safeTitle}${ext}`);

    const dlItem = downloadsRepo.create({
      lessonId,
      courseId: lesson.course_id,
      remotePath: lesson.remote_path,
      destinationPath: localDest,
      totalBytes: lesson.file_size
    });

    // Start download asynchronously in background
    (async () => {
      try {
        await rcloneService.downloadFile(
          settings.rclonePath || 'rclone',
          lesson.remote_path!,
          localDest,
          (pct, speed, downloaded, total) => {
            downloadsRepo.updateProgress(dlItem.id, downloaded, total, speed);
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('downloads:progress', {
                id: dlItem.id,
                percent: pct,
                speed,
                downloaded,
                total
              });
            }
          }
        );

        // Success: update status and bind local path
        downloadsRepo.updateStatus(dlItem.id, 'completed');
        lessonsRepo.updateLocalPath(lessonId, localDest);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('downloads:completed', { id: dlItem.id, localPath: localDest });
        }
      } catch (err: any) {
        downloadsRepo.updateStatus(dlItem.id, 'error', err.message);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('downloads:error', { id: dlItem.id, error: err.message });
        }
      }
    })();

    return dlItem;
  });

  ipcMain.handle('downloads:delete', async (_, id: string) => {
    downloadsRepo.delete(id);
    return { success: true };
  });
}
