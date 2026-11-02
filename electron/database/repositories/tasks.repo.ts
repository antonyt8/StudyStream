import { DatabaseService } from '../connection';
import { StudyTask, TaskStatus } from '../../types';

export class TasksRepository {
  private db = DatabaseService.getInstance();

  public list(): StudyTask[] {
    return this.db.all<StudyTask>(`
      SELECT 
        t.id, t.course_id, t.lesson_id, t.title, t.description, 
        t.status, t.due_date, t.completed_at, t.created_at, t.updated_at,
        c.title AS course_title
      FROM tasks t
      LEFT JOIN courses c ON c.id = t.course_id
      ORDER BY 
        CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `);
  }

  public create(data: {
    courseId?: string;
    lessonId?: string;
    title: string;
    description?: string;
    dueDate?: string;
  }): StudyTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO tasks (id, course_id, lesson_id, title, description, status, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      id,
      data.courseId || null,
      data.lessonId || null,
      data.title,
      data.description || null,
      data.dueDate || null,
      now,
      now
    ]);

    return this.list().find(t => t.id === id)!;
  }

  public updateStatus(id: string, status: TaskStatus): void {
    const now = new Date().toISOString();
    const completedAt = status === 'completed' ? now : null;
    this.db.run(`
      UPDATE tasks
      SET status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `, [status, completedAt, now, id]);
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
  }
}
