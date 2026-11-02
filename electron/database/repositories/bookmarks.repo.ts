import { DatabaseService } from '../connection';
import { Bookmark } from '../../types';

export class BookmarksRepository {
  private db = DatabaseService.getInstance();

  public listByLesson(lessonId: string): Bookmark[] {
    return this.db.all<Bookmark>(`
      SELECT id, course_id, lesson_id, timestamp_seconds, title, note, created_at
      FROM bookmarks
      WHERE lesson_id = ?
      ORDER BY timestamp_seconds ASC
    `, [lessonId]);
  }

  public create(data: {
    courseId: string;
    lessonId: string;
    timestampSeconds: number;
    title: string;
    note?: string;
  }): Bookmark {
    const id = `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO bookmarks (id, course_id, lesson_id, timestamp_seconds, title, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.courseId,
      data.lessonId,
      data.timestampSeconds,
      data.title,
      data.note || null,
      now
    ]);

    return {
      id,
      course_id: data.courseId,
      lesson_id: data.lessonId,
      timestamp_seconds: data.timestampSeconds,
      title: data.title,
      note: data.note,
      created_at: now
    };
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM bookmarks WHERE id = ?`, [id]);
  }
}
