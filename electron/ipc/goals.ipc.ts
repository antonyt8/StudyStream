import { ipcMain } from 'electron';
import { GoalsRepository } from '../database/repositories/goals.repo';
import { SessionsRepository } from '../database/repositories/sessions.repo';
import { CoursesRepository } from '../database/repositories/courses.repo';
import { DatabaseService } from '../database/connection';
import { DashboardStats } from '../types';

export function registerGoalsIpc(): void {
  const goalsRepo = new GoalsRepository();
  const sessionsRepo = new SessionsRepository();
  const coursesRepo = new CoursesRepository();
  const db = DatabaseService.getInstance();

  ipcMain.handle('goals:list', async () => {
    return goalsRepo.list();
  });

  ipcMain.handle('goals:update', async (_, type: string, targetValue: number) => {
    goalsRepo.update(type, targetValue);
    return goalsRepo.list();
  });

  ipcMain.handle('goals:get-dashboard-stats', async (): Promise<DashboardStats> => {
    const sessionStats = sessionsRepo.getStats();
    const allCourses = coursesRepo.list();

    const totalCourses = allCourses.length;
    const completedCourses = allCourses.filter(c => c.status === 'completed').length;
    const inProgressCourses = allCourses.filter(c => c.status === 'in_progress').length;

    const lessonCountRow = db.get<{ total: number; completed: number }>(`
      SELECT 
        COUNT(l.id) AS total,
        COUNT(CASE WHEN lp.completed = 1 THEN 1 END) AS completed
      FROM lessons l
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
    `);

    // Continue watching: lessons with progress > 0 and completed = 0, ordered by last_watched_at DESC
    const continueWatchingRows = db.all<any>(`
      SELECT 
        lp.id AS progress_id, lp.position_seconds, lp.duration_seconds AS progress_duration,
        lp.progress_percent, lp.completed, lp.last_watched_at,
        l.id AS lesson_id, l.title AS lesson_title, l.module_id, l.original_path, l.local_path, l.remote_path,
        c.id AS course_id, c.title AS course_title, c.cover_path, c.status AS course_status,
        s.name AS source_name, s.source_type
      FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      JOIN courses c ON c.id = lp.course_id
      JOIN sources s ON s.id = c.source_id
      WHERE lp.completed = 0 AND lp.position_seconds > 0
      ORDER BY lp.last_watched_at DESC
      LIMIT 8
    `);

    const continueWatching = continueWatchingRows.map(row => ({
      course: {
        id: row.course_id,
        source_id: '',
        title: row.course_title,
        cover_path: row.cover_path,
        status: row.course_status,
        total_duration_seconds: 0,
        is_favorite: 0,
        root_folder: '',
        created_at: '',
        updated_at: '',
        source_name: row.source_name,
        source_type: row.source_type
      },
      lesson: {
        id: row.lesson_id,
        module_id: row.module_id,
        course_id: row.course_id,
        title: row.lesson_title,
        original_path: row.original_path,
        local_path: row.local_path,
        remote_path: row.remote_path,
        duration_seconds: row.progress_duration || 0,
        position: 1,
        media_type: 'video/mp4',
        file_size: 0,
        is_available: 1,
        created_at: '',
        updated_at: ''
      },
      progress: {
        id: row.progress_id,
        lesson_id: row.lesson_id,
        course_id: row.course_id,
        position_seconds: row.position_seconds,
        duration_seconds: row.progress_duration,
        progress_percent: row.progress_percent,
        completed: row.completed,
        last_watched_at: row.last_watched_at,
        updated_at: row.last_watched_at
      }
    }));

    const dailyGoal = goalsRepo.getByType('daily_minutes');
    const dailyGoalMinutes = dailyGoal ? dailyGoal.target_value : 60;
    const todayStudyMinutes = Math.round(sessionStats.todaySeconds / 60);

    return {
      todayStudySeconds: sessionStats.todaySeconds,
      weekStudySeconds: sessionStats.weekSeconds,
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalLessons: lessonCountRow?.total || 0,
      completedLessons: lessonCountRow?.completed || 0,
      recentCourses: allCourses.slice(0, 6),
      continueWatching,
      studyStreakDays: sessionStats.streakDays,
      dailyGoalMinutes,
      dailyGoalProgressMinutes: todayStudyMinutes
    };
  });

  ipcMain.handle('goals:get-history', async (_, courseId?: string) => {
    return sessionsRepo.listRecent(100, courseId);
  });
}
