import { ipcMain } from 'electron';
import { PlaybackService } from '../services/playback.service';
import { ProgressRepository } from '../database/repositories/progress.repo';
import { SessionsRepository } from '../database/repositories/sessions.repo';
import { LessonsRepository } from '../database/repositories/lessons.repo';
import { SourcesRepository } from '../database/repositories/sources.repo';
import { CoursesRepository } from '../database/repositories/courses.repo';

export function registerPlaybackIpc(): void {
  const playbackService = PlaybackService.getInstance();
  const progressRepo = new ProgressRepository();
  const sessionsRepo = new SessionsRepository();
  const lessonsRepo = new LessonsRepository();
  const sourcesRepo = new SourcesRepository();
  const coursesRepo = new CoursesRepository();
  const isValidId = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[\w-]+$/.test(value);

  ipcMain.handle('playback:get-url', async (_, lessonId: string) => {
    if (!isValidId(lessonId)) return { url: '', error: 'Identificador de aula inválido' };
    const lesson = lessonsRepo.getById(lessonId);
    if (!lesson) {
      return { url: '', error: 'Aula não encontrada' };
    }

    const course = coursesRepo.getById(lesson.course_id);
    if (!course) {
      return { url: '', error: 'Curso não encontrado' };
    }

    const source = sourcesRepo.getById(course.source_id);
    if (!source) {
      return { url: '', error: 'Origem do curso não encontrada' };
    }

    return playbackService.getPlaybackUrl({
      sourceType: source.source_type,
      localPath: lesson.local_path,
      remotePath: lesson.remote_path,
      sourceRoot: source.root_path,
      remoteName: source.remote_name
    });
  });

  ipcMain.handle('playback:save-progress', async (_, data: {
    lessonId: string;
    courseId: string;
    positionSeconds: number;
    durationSeconds: number;
    completed?: boolean;
    autoCompleteThreshold?: number;
  }) => {
    if (!isValidId(data?.lessonId) || !isValidId(data?.courseId)) {
      throw new Error('Identificador de progresso inválido');
    }
    if (![data.positionSeconds, data.durationSeconds].every(Number.isFinite) ||
        data.positionSeconds < 0 || data.durationSeconds < 0 ||
        data.positionSeconds > data.durationSeconds + 1) {
      throw new Error('Valores de progresso inválidos');
    }
    return progressRepo.saveProgress(data);
  });

  ipcMain.handle('playback:mark-completed', async (_, data: {
    lessonId: string;
    courseId: string;
    completed: boolean;
  }) => {
    if (!isValidId(data?.lessonId) || !isValidId(data?.courseId) || typeof data.completed !== 'boolean') {
      throw new Error('Dados de conclusão inválidos');
    }
    progressRepo.markLessonCompleted(data.lessonId, data.courseId, data.completed);
    return progressRepo.getByLesson(data.lessonId);
  });

  ipcMain.handle('playback:record-session', async (_, data: {
    courseId: string;
    lessonId: string;
    startedAt: string;
    endedAt: string;
    elapsedSeconds: number;
  }) => {
    sessionsRepo.recordSession(data);
    return { success: true };
  });

  ipcMain.handle('playback:get-lesson-progress', async (_, lessonId: string) => {
    if (!isValidId(lessonId)) throw new Error('Identificador de aula inválido');
    return progressRepo.getByLesson(lessonId);
  });

  ipcMain.handle('playback:prefetch', async (_, lessonId: string) => {
    try {
      const lesson = lessonsRepo.getById(lessonId);
      if (!lesson) return { success: false, error: 'Aula não encontrada' };
      const course = coursesRepo.getById(lesson.course_id);
      if (!course) return { success: false, error: 'Curso não encontrado' };
      const source = sourcesRepo.getById(course.source_id);
      if (!source) return { success: false, error: 'Origem não encontrada' };

      const mediaRes = await playbackService.getPlaybackUrl({
        sourceType: source.source_type,
        localPath: lesson.local_path,
        remotePath: lesson.remote_path,
        sourceRoot: source.root_path,
        remoteName: source.remote_name
      });

      if (mediaRes.url && mediaRes.url.startsWith('http') && source.source_type === 'gdrive') {
        playbackService.prefetchChunk(mediaRes.url, 32 * 1024 * 1024);
        return { success: true };
      }
      return { success: false };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('playback:open-external', async (_, lessonId: string) => {
    try {
      const lesson = lessonsRepo.getById(lessonId);
      if (!lesson) return { success: false, error: 'Aula não encontrada' };
      const course = coursesRepo.getById(lesson.course_id);
      if (!course) return { success: false, error: 'Curso não encontrado' };
      const source = sourcesRepo.getById(course.source_id);
      if (!source) return { success: false, error: 'Origem não encontrada' };

      const mediaRes = await playbackService.getPlaybackUrl({
        sourceType: source.source_type,
        localPath: lesson.local_path,
        remotePath: lesson.remote_path,
        sourceRoot: source.root_path,
        remoteName: source.remote_name
      });

      if (!mediaRes.url && !lesson.local_path) {
        return { success: false, error: 'URL ou arquivo de mídia indisponível' };
      }

      return playbackService.openInExternalPlayer(mediaRes.url, lesson.local_path, lesson.title);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
