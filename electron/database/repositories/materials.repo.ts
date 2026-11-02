import { DatabaseService } from '../connection';
import { CourseMaterial } from '../../types';

export class MaterialsRepository {
  private db = DatabaseService.getInstance();

  public listByCourse(courseId: string): CourseMaterial[] {
    return this.db.all<CourseMaterial>(`
      SELECT id, course_id, module_id, title, file_path, file_type, file_size, created_at
      FROM materials
      WHERE course_id = ?
      ORDER BY title ASC
    `, [courseId]);
  }

  public upsert(material: {
    id: string;
    course_id: string;
    module_id?: string;
    title: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }): void {
    const existing = this.db.get<{ id: string }>(`SELECT id FROM materials WHERE id = ?`, [material.id]);
    if (existing) {
      this.db.run(`
        UPDATE materials
        SET title = ?, file_path = ?, file_type = ?, file_size = ?, module_id = ?
        WHERE id = ?
      `, [material.title, material.file_path, material.file_type, material.file_size, material.module_id || null, material.id]);
    } else {
      this.db.run(`
        INSERT INTO materials (id, course_id, module_id, title, file_path, file_type, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [material.id, material.course_id, material.module_id || null, material.title, material.file_path, material.file_type, material.file_size]);
    }
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM materials WHERE id = ?`, [id]);
  }
}
