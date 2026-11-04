import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
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
  const activeDownloads = new Map<string, AbortController>();

  ipcMain.handle('downloads:list', async () => {
    return downloadsRepo.list();
  });

  const startDownloadInternal = async (lessonId: string) => {
    const lesson = lessonsRepo.getById(lessonId);
    if (!lesson || !lesson.remote_path) {
      return null;
    }

    // Check if already completed or local file exists
    if (lesson.local_path && fs.existsSync(lesson.local_path)) {
      return null;
    }

    const course = coursesRepo.getById(lesson.course_id);
    const settings = settingsRepo.getAll();
    const defaultDir = settings.defaultDownloadPath || path.join(process.env.USERPROFILE || process.cwd(), 'Downloads', 'StudyStream');

    const ext = path.extname(lesson.remote_path) || '.mp4';
    const safeTitle = lesson.title.replace(/[<>:"/\\|?*]/g, '_');
    const safeCourse = (course?.title || 'Curso').replace(/[<>:"/\\|?*]/g, '_');
    const localDest = path.join(defaultDir, safeCourse, `${safeTitle}${ext}`);

    const existing = downloadsRepo.getActiveByLesson(lessonId);
    const dlItem = existing && existing.destination_path === localDest
      ? existing
      : downloadsRepo.create({
          lessonId,
          courseId: lesson.course_id,
          remotePath: lesson.remote_path,
          destinationPath: localDest,
          totalBytes: lesson.file_size
        });

    fs.mkdirSync(path.dirname(localDest), { recursive: true });
    if (lesson.file_size > 0) {
      const disk = fs.statfsSync(path.dirname(localDest));
      const availableBytes = Number(disk.bavail) * Number(disk.bsize);
      if (availableBytes < lesson.file_size) {
        throw new Error('Espaço disponível insuficiente para o download.');
      }
    }
    const controller = new AbortController();
    activeDownloads.set(dlItem.id, controller);

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
          },
          controller.signal
        );

        // Success: update status and bind local path
        downloadsRepo.updateStatus(dlItem.id, 'completed');
        lessonsRepo.updateLocalPath(lessonId, localDest);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('downloads:completed', { id: dlItem.id, localPath: localDest });
        }
      } catch (err: any) {
        downloadsRepo.updateStatus(dlItem.id, controller.signal.aborted ? 'paused' : 'error', err.message);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('downloads:error', { id: dlItem.id, error: err.message });
        }
      }
      finally {
        activeDownloads.delete(dlItem.id);
      }
    })();

    return dlItem;
  };

  ipcMain.handle('downloads:start', async (_, lessonId: string) => {
    const item = await startDownloadInternal(lessonId);
    if (!item) {
      throw new Error('Aula não pôde ser baixada ou já se encontra disponível localmente.');
    }
    return item;
  });

  ipcMain.handle('downloads:start-batch', async (_, lessonIds: string[]) => {
    let count = 0;
    for (const lid of lessonIds) {
      const res = await startDownloadInternal(lid);
      if (res) count++;
    }
    return { queuedCount: count };
  });

  ipcMain.handle('downloads:delete', async (_, id: string) => {
    activeDownloads.get(id)?.abort();
    activeDownloads.delete(id);
    const item = downloadsRepo.getById(id);
    if (item?.destination_path && fs.existsSync(item.destination_path)) {
      fs.rmSync(item.destination_path, { force: true });
    }
    downloadsRepo.delete(id);
    return { success: true };
  });

  ipcMain.handle('downloads:cancel', async (_, id: string) => {
    const controller = activeDownloads.get(id);
    if (!controller) return { success: false, error: 'Download não está ativo' };
    controller.abort();
    downloadsRepo.updateStatus(id, 'paused', 'Download pausado pelo usuário');
    return { success: true };
  });
}
