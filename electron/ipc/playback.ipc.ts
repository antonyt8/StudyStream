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

  ipcMain.handle('playback:get-url', async (_, lessonId: string) => {
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
    return progressRepo.saveProgress(data);
  });

  ipcMain.handle('playback:mark-completed', async (_, data: {
    lessonId: string;
    courseId: string;
    completed: boolean;
  }) => {
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
    return progressRepo.getByLesson(lessonId);
  });
}
