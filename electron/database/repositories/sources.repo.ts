import { DatabaseService } from '../connection';
import { Source } from '../../types';

export class SourcesRepository {
  private db = DatabaseService.getInstance();

  public list(): Source[] {
    return this.db.all<Source>(`
      SELECT id, name, source_type, root_path, remote_name, enabled, scan_mode, last_scan_at, created_at, updated_at
      FROM sources
      ORDER BY created_at DESC
    `);
  }

  public getById(id: string): Source | null {
    return this.db.get<Source>(`
      SELECT id, name, source_type, root_path, remote_name, enabled, scan_mode, last_scan_at, created_at, updated_at
      FROM sources
      WHERE id = ?
    `, [id]);
  }

  public create(source: Omit<Source, 'created_at' | 'updated_at'>): void {
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO sources (id, name, source_type, root_path, remote_name, enabled, scan_mode, last_scan_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      source.id,
      source.name,
      source.source_type,
      source.root_path,
      source.remote_name || null,
      source.enabled ? 1 : 0,
      source.scan_mode || 'single_course',
      source.last_scan_at || null,
      now,
      now
    ]);
  }

  public updateLastScan(id: string): void {
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE sources
      SET last_scan_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);
  }

  public delete(id: string): void {
    const courses = this.db.all<{ id: string }>(`SELECT id FROM courses WHERE source_id = ?`, [id]);
    this.db.transaction(() => {
      for (const c of courses) {
        this.db.run(`DELETE FROM lesson_progress WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM study_sessions WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM notes WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM bookmarks WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM custom_list_courses WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM downloads WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM materials WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM lessons WHERE course_id = ?`, [c.id]);
        this.db.run(`DELETE FROM modules WHERE course_id = ?`, [c.id]);
      }
      this.db.run(`DELETE FROM courses WHERE source_id = ?`, [id]);
      this.db.run(`DELETE FROM sources WHERE id = ?`, [id]);
    });
    this.db.saveImmediate();
  }
}
