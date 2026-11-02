import { DatabaseService } from '../connection';
import { CustomList, Course } from '../../types';

export class CustomListsRepository {
  private db = DatabaseService.getInstance();

  public list(): CustomList[] {
    return this.db.all<CustomList>(`
      SELECT 
        cl.id, cl.name, cl.description, cl.icon, cl.created_at,
        COUNT(clc.course_id) AS course_count
      FROM custom_lists cl
      LEFT JOIN custom_list_courses clc ON clc.list_id = cl.id
      GROUP BY cl.id
      ORDER BY cl.created_at ASC
    `);
  }

  public create(name: string, description?: string, icon?: string): CustomList {
    const id = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO custom_lists (id, name, description, icon, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, name, description || null, icon || 'bookmark', now]);

    return {
      id,
      name,
      description,
      icon: icon || 'bookmark',
      created_at: now,
      course_count: 0
    };
  }

  public addCourse(listId: string, courseId: string): void {
    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR IGNORE INTO custom_list_courses (list_id, course_id, added_at)
      VALUES (?, ?, ?)
    `, [listId, courseId, now]);
  }

  public removeCourse(listId: string, courseId: string): void {
    this.db.run(`
      DELETE FROM custom_list_courses
      WHERE list_id = ? AND course_id = ?
    `, [listId, courseId]);
  }

  public getCoursesInList(listId: string): Course[] {
    return this.db.all<Course>(`
      SELECT c.*, s.name AS source_name, s.source_type
      FROM courses c
      JOIN custom_list_courses clc ON clc.course_id = c.id
      JOIN sources s ON s.id = c.source_id
      WHERE clc.list_id = ?
      ORDER BY clc.added_at DESC
    `, [listId]);
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM custom_lists WHERE id = ?`, [id]);
  }
}
