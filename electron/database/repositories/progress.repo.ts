import { DatabaseService } from '../connection';
import { LessonProgress } from '../../types';

export class ProgressRepository {
  private db = DatabaseService.getInstance();

  public getByLesson(lessonId: string): LessonProgress | null {
    return this.db.get<LessonProgress>(`
      SELECT id, lesson_id, course_id, position_seconds, duration_seconds, progress_percent, completed, last_watched_at, updated_at
      FROM lesson_progress
      WHERE lesson_id = ?
    `, [lessonId]);
  }

  public saveProgress(data: {
    lessonId: string;
    courseId: string;
    positionSeconds: number;
    durationSeconds: number;
    completed?: boolean;
    autoCompleteThreshold?: number; // e.g. 0.9
  }): LessonProgress {
    const threshold = data.autoCompleteThreshold || 0.9;
    const progressPercent = data.durationSeconds > 0 
      ? Math.min(100, Math.round((data.positionSeconds / data.durationSeconds) * 100))
      : 0;

    let isCompleted = data.completed ?? false;
    if (!isCompleted && data.durationSeconds > 0 && (data.positionSeconds / data.durationSeconds) >= threshold) {
      isCompleted = true;
    }

    const now = new Date().toISOString();
    const existing = this.getByLesson(data.lessonId);

    if (existing) {
      const finalCompleted = isCompleted || existing.completed === 1 ? 1 : 0;
      this.db.run(`
        UPDATE lesson_progress
        SET position_seconds = ?, duration_seconds = ?, progress_percent = ?,
            completed = ?, last_watched_at = ?, updated_at = ?
        WHERE lesson_id = ?
      `, [
        data.positionSeconds,
        data.durationSeconds,
        progressPercent,
        finalCompleted,
        now,
        now,
        data.lessonId
      ]);
    } else {
      const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO lesson_progress (id, lesson_id, course_id, position_seconds, duration_seconds, progress_percent, completed, last_watched_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        data.lessonId,
        data.courseId,
        data.positionSeconds,
        data.durationSeconds,
        progressPercent,
        isCompleted ? 1 : 0,
        now,
        now
      ]);
    }

    // Update parent course status
    this.updateCourseStatus(data.courseId);

    return this.getByLesson(data.lessonId)!;
  }

  public markLessonCompleted(lessonId: string, courseId: string, completed: boolean): void {
    const now = new Date().toISOString();
    const existing = this.getByLesson(lessonId);

    if (existing) {
      this.db.run(`
        UPDATE lesson_progress
        SET completed = ?, updated_at = ?
        WHERE lesson_id = ?
      `, [completed ? 1 : 0, now, lessonId]);
    } else {
      const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.db.run(`
        INSERT INTO lesson_progress (id, lesson_id, course_id, position_seconds, duration_seconds, progress_percent, completed, last_watched_at, updated_at)
        VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
      `, [
        id,
        lessonId,
        courseId,
        completed ? 100 : 0,
        completed ? 1 : 0,
        now,
        now
      ]);
    }

    this.updateCourseStatus(courseId);
  }

  private updateCourseStatus(courseId: string): void {
    const stats = this.db.get<{ total: number; completed: number }>(`
      SELECT 
        COUNT(l.id) AS total,
        COUNT(CASE WHEN lp.completed = 1 THEN 1 END) AS completed
      FROM lessons l
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      WHERE l.course_id = ?
    `, [courseId]);

    if (!stats || stats.total === 0) return;

    let newStatus = 'not_started';
    if (stats.completed >= stats.total) {
      newStatus = 'completed';
    } else if (stats.completed > 0) {
      newStatus = 'in_progress';
    } else {
      // Check if any position > 0
      const anyWatched = this.db.get<{ count: number }>(`
        SELECT COUNT(*) AS count FROM lesson_progress WHERE course_id = ? AND position_seconds > 0
      `, [courseId]);
      if (anyWatched && anyWatched.count > 0) {
        newStatus = 'in_progress';
      }
    }

    this.db.run(`
      UPDATE courses
      SET status = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, new Date().toISOString(), courseId]);
  }
}
