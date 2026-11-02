import { DatabaseService } from '../connection';
import { Note } from '../../types';

export class NotesRepository {
  private db = DatabaseService.getInstance();

  public list(filter: { courseId?: string; lessonId?: string; search?: string } = {}): Note[] {
    let sql = `
      SELECT 
        n.id, n.course_id, n.lesson_id, n.title, n.content, 
        n.timestamp_seconds, n.snapshot_data, n.is_pinned, n.created_at, n.updated_at,
        c.title AS course_title,
        l.title AS lesson_title
      FROM notes n
      JOIN courses c ON c.id = n.course_id
      LEFT JOIN lessons l ON l.id = n.lesson_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.courseId) {
      sql += ` AND n.course_id = ?`;
      params.push(filter.courseId);
    }
    if (filter.lessonId) {
      sql += ` AND n.lesson_id = ?`;
      params.push(filter.lessonId);
    }
    if (filter.search && filter.search.trim()) {
      sql += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
      const term = `%${filter.search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY n.is_pinned DESC, n.updated_at DESC`;
    return this.db.all<Note>(sql, params);
  }

  public create(data: {
    courseId: string;
    lessonId?: string;
    title: string;
    content: string;
    timestampSeconds?: number;
    snapshotData?: string;
  }): Note {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO notes (id, course_id, lesson_id, title, content, timestamp_seconds, snapshot_data, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      id,
      data.courseId,
      data.lessonId || null,
      data.title,
      data.content,
      data.timestampSeconds !== undefined ? data.timestampSeconds : null,
      data.snapshotData || null,
      now,
      now
    ]);

    return this.list({ courseId: data.courseId }).find(n => n.id === id)!;
  }

  public update(id: string, data: { title?: string; content?: string; isPinned?: boolean }): void {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content); }
    if (data.isPinned !== undefined) { fields.push('is_pinned = ?'); params.push(data.isPinned ? 1 : 0); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      this.db.run(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, params);
    }
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM notes WHERE id = ?`, [id]);
  }
}
