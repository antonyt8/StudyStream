import { DatabaseService } from '../connection';
import { Course, CourseModule, Lesson } from '../../types';

export interface CourseFilter {
  search?: string;
  categoryId?: string;
  status?: string;
  favoritesOnly?: boolean;
  sourceId?: string;
  sortBy?: 'title' | 'last_watched' | 'created_at' | 'progress';
  sortOrder?: 'asc' | 'desc';
}

export class CoursesRepository {
  private db = DatabaseService.getInstance();

  public list(filter: CourseFilter = {}): Course[] {
    let sql = `
      SELECT 
        c.id, c.source_id, c.title, c.description, c.instructor, 
        c.category_id, c.cover_path, c.total_duration_seconds, 
        c.status, c.is_favorite, c.root_folder, c.created_at, c.updated_at,
        s.name AS source_name, s.source_type,
        cat.name AS category_name,
        COUNT(DISTINCT l.id) AS total_lessons,
        COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN l.id END) AS completed_lessons,
        MAX(lp.last_watched_at) AS last_watched_at
      FROM courses c
      JOIN sources s ON s.id = c.source_id
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filter.search && filter.search.trim()) {
      sql += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.instructor LIKE ?)`;
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term);
    }

    if (filter.categoryId) {
      sql += ` AND c.category_id = ?`;
      params.push(filter.categoryId);
    }

    if (filter.status && filter.status !== 'all') {
      sql += ` AND c.status = ?`;
      params.push(filter.status);
    }

    if (filter.favoritesOnly) {
      sql += ` AND c.is_favorite = 1`;
    }

    if (filter.sourceId) {
      sql += ` AND c.source_id = ?`;
      params.push(filter.sourceId);
    }

    sql += ` GROUP BY c.id`;

    // Order by
    const order = filter.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (filter.sortBy === 'last_watched') {
      sql += ` ORDER BY last_watched_at ${order} NULLS LAST`;
    } else if (filter.sortBy === 'created_at') {
      sql += ` ORDER BY c.created_at ${order}`;
    } else if (filter.sortBy === 'progress') {
      sql += ` ORDER BY (CAST(COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN l.id END) AS FLOAT) / MAX(1, COUNT(DISTINCT l.id))) ${order}`;
    } else {
      sql += ` ORDER BY c.title ${order}`;
    }

    const rows = this.db.all<any>(sql, params);
    return rows.map(row => {
      const total = Number(row.total_lessons || 0);
      const completed = Number(row.completed_lessons || 0);
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...row,
        total_lessons: total,
        completed_lessons: completed,
        progress_percent: progressPercent
      };
    });
  }

  public getById(id: string): Course | null {
    const list = this.list();
    return list.find(c => c.id === id) || null;
  }

  public getFullCourse(id: string): { course: Course; modules: CourseModule[] } | null {
    const course = this.getById(id);
    if (!course) return null;

    const modules = this.db.all<CourseModule>(`
      SELECT id, course_id, title, position, relative_path, created_at, updated_at
      FROM modules
      WHERE course_id = ?
      ORDER BY position ASC, title ASC
    `, [id]);

    const lessons = this.db.all<any>(`
      SELECT 
        l.id, l.module_id, l.course_id, l.title, l.original_path, 
        l.local_path, l.remote_path, l.duration_seconds, l.position, 
        l.media_type, l.file_size, l.is_available, l.created_at, l.updated_at,
        lp.id AS progress_id, lp.position_seconds, lp.duration_seconds AS progress_duration,
        lp.progress_percent, lp.completed, lp.last_watched_at
      FROM lessons l
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      WHERE l.course_id = ?
      ORDER BY l.position ASC, l.title ASC
    `, [id]);

    // Group lessons into modules
    const modulesWithLessons = modules.map(m => {
      const moduleLessons: Lesson[] = lessons
        .filter(l => l.module_id === m.id)
        .map(l => ({
          id: l.id,
          module_id: l.module_id,
          course_id: l.course_id,
          title: l.title,
          original_path: l.original_path,
          local_path: l.local_path,
          remote_path: l.remote_path,
          duration_seconds: l.duration_seconds,
          position: l.position,
          media_type: l.media_type,
          file_size: l.file_size,
          is_available: l.is_available,
          created_at: l.created_at,
          updated_at: l.updated_at,
          progress: l.progress_id ? {
            id: l.progress_id,
            lesson_id: l.id,
            course_id: l.course_id,
            position_seconds: l.position_seconds || 0,
            duration_seconds: l.progress_duration || 0,
            progress_percent: l.progress_percent || 0,
            completed: l.completed || 0,
            last_watched_at: l.last_watched_at,
            updated_at: l.last_watched_at
          } : undefined
        }));

      return {
        ...m,
        lessons: moduleLessons
      };
    });

    return { course, modules: modulesWithLessons };
  }

  public upsert(course: {
    id: string;
    source_id: string;
    title: string;
    description?: string;
    instructor?: string;
    category_id?: string;
    cover_path?: string;
    root_folder: string;
  }): void {
    const existing = this.db.get<any>(`SELECT id FROM courses WHERE id = ?`, [course.id]);
    const now = new Date().toISOString();
    if (existing) {
      this.db.run(`
        UPDATE courses
        SET title = ?, description = COALESCE(?, description), instructor = COALESCE(?, instructor),
            category_id = COALESCE(?, category_id), cover_path = COALESCE(?, cover_path), updated_at = ?
        WHERE id = ?
      `, [course.title, course.description || null, course.instructor || null, course.category_id || null, course.cover_path || null, now, course.id]);
    } else {
      this.db.run(`
        INSERT INTO courses (id, source_id, title, description, instructor, category_id, cover_path, total_duration_seconds, status, is_favorite, root_folder, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'not_started', 0, ?, ?, ?)
      `, [course.id, course.source_id, course.title, course.description || null, course.instructor || null, course.category_id || null, course.cover_path || null, course.root_folder, now, now]);
    }
  }

  public toggleFavorite(id: string): number {
    const current = this.db.get<{ is_favorite: number }>(`SELECT is_favorite FROM courses WHERE id = ?`, [id]);
    const newStatus = current && current.is_favorite === 1 ? 0 : 1;
    this.db.run(`UPDATE courses SET is_favorite = ?, updated_at = ? WHERE id = ?`, [newStatus, new Date().toISOString(), id]);
    return newStatus;
  }

  public updateCourse(id: string, updates: Partial<Course>): void {
    const fields: string[] = [];
    const params: any[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description); }
    if (updates.instructor !== undefined) { fields.push('instructor = ?'); params.push(updates.instructor); }
    if (updates.category_id !== undefined) { fields.push('category_id = ?'); params.push(updates.category_id); }
    if (updates.cover_path !== undefined) { fields.push('cover_path = ?'); params.push(updates.cover_path); }
    if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      this.db.run(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, params);
    }
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM courses WHERE id = ?`, [id]);
  }
}
