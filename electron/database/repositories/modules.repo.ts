import { DatabaseService } from '../connection';
import { CourseModule } from '../../types';

export class ModulesRepository {
  private db = DatabaseService.getInstance();

  public listByCourse(courseId: string): CourseModule[] {
    return this.db.all<CourseModule>(`
      SELECT id, course_id, title, position, relative_path, created_at, updated_at
      FROM modules
      WHERE course_id = ?
      ORDER BY position ASC, title ASC
    `, [courseId]);
  }

  public upsert(mod: {
    id: string;
    course_id: string;
    title: string;
    position: number;
    relative_path: string;
  }): void {
    const existing = this.db.get<any>(`SELECT id FROM modules WHERE id = ?`, [mod.id]);
    const now = new Date().toISOString();
    if (existing) {
      this.db.run(`
        UPDATE modules
        SET course_id = ?, title = ?, position = ?, relative_path = ?, updated_at = ?
        WHERE id = ?
      `, [mod.course_id, mod.title, mod.position, mod.relative_path, now, mod.id]);
    } else {
      this.db.run(`
        INSERT INTO modules (id, course_id, title, position, relative_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [mod.id, mod.course_id, mod.title, mod.position, mod.relative_path, now, now]);
    }
  }
}
