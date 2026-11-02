import { DatabaseService } from '../connection';
import { Lesson } from '../../types';

export class LessonsRepository {
  private db = DatabaseService.getInstance();

  public getById(id: string): Lesson | null {
    return this.db.get<Lesson>(`
      SELECT id, module_id, course_id, title, original_path, local_path, remote_path,
             duration_seconds, position, media_type, file_size, is_available, created_at, updated_at
      FROM lessons
      WHERE id = ?
    `, [id]);
  }

  public getByPath(originalPath: string): Lesson | null {
    return this.db.get<Lesson>(`
      SELECT id, module_id, course_id, title, original_path, local_path, remote_path,
             duration_seconds, position, media_type, file_size, is_available, created_at, updated_at
      FROM lessons
      WHERE original_path = ?
    `, [originalPath]);
  }

  public upsert(lesson: {
    id: string;
    module_id: string;
    course_id: string;
    title: string;
    original_path: string;
    local_path?: string;
    remote_path?: string;
    duration_seconds?: number;
    position: number;
    media_type?: string;
    file_size?: number;
  }): void {
    const existing = this.db.get<any>(`SELECT id FROM lessons WHERE id = ?`, [lesson.id]);
    const now = new Date().toISOString();
    if (existing) {
      this.db.run(`
        UPDATE lessons
        SET title = ?, position = ?, duration_seconds = COALESCE(?, duration_seconds),
            local_path = COALESCE(?, local_path), remote_path = COALESCE(?, remote_path),
            file_size = COALESCE(?, file_size), updated_at = ?
        WHERE id = ?
      `, [
        lesson.title,
        lesson.position,
        lesson.duration_seconds || null,
        lesson.local_path || null,
        lesson.remote_path || null,
        lesson.file_size || null,
        now,
        lesson.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO lessons (id, module_id, course_id, title, original_path, local_path, remote_path, duration_seconds, position, media_type, file_size, is_available, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        lesson.id,
        lesson.module_id,
        lesson.course_id,
        lesson.title,
        lesson.original_path,
        lesson.local_path || null,
        lesson.remote_path || null,
        lesson.duration_seconds || 0,
        lesson.position,
        lesson.media_type || 'video/mp4',
        lesson.file_size || 0,
        now,
        now
      ]);
    }
  }

  public updateLocalPath(lessonId: string, localPath: string): void {
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE lessons
      SET local_path = ?, updated_at = ?
      WHERE id = ?
    `, [localPath, now, lessonId]);
  }
}
