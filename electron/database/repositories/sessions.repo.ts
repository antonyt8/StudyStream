import { DatabaseService } from '../connection';
import { StudySession } from '../../types';

export class SessionsRepository {
  private db = DatabaseService.getInstance();

  public recordSession(data: {
    courseId: string;
    lessonId: string;
    startedAt: string;
    endedAt: string;
    elapsedSeconds: number;
    status?: 'completed' | 'interrupted';
  }): void {
    if (data.elapsedSeconds <= 0) return; // Don't record empty sessions

    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.db.run(`
      INSERT INTO study_sessions (id, course_id, lesson_id, started_at, ended_at, elapsed_seconds, session_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.courseId,
      data.lessonId,
      data.startedAt,
      data.endedAt,
      data.elapsedSeconds,
      data.status || 'completed'
    ]);
  }

  public listRecent(limit: number = 50, courseId?: string): StudySession[] {
    let sql = `
      SELECT 
        s.id, s.course_id, s.lesson_id, s.started_at, s.ended_at, 
        s.elapsed_seconds, s.session_status,
        c.title AS course_title,
        l.title AS lesson_title
      FROM study_sessions s
      JOIN courses c ON c.id = s.course_id
      JOIN lessons l ON l.id = s.lesson_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (courseId) {
      sql += ` AND s.course_id = ?`;
      params.push(courseId);
    }
    sql += ` ORDER BY s.started_at DESC LIMIT ?`;
    params.push(limit);

    return this.db.all<StudySession>(sql, params);
  }

  public getStats(): {
    todaySeconds: number;
    weekSeconds: number;
    monthSeconds: number;
    streakDays: number;
  } {
    // Today
    const today = this.db.get<{ total: number }>(`
      SELECT COALESCE(SUM(elapsed_seconds), 0) AS total
      FROM study_sessions
      WHERE date(started_at, 'localtime') = date('now', 'localtime')
    `);

    // Week (last 7 days)
    const week = this.db.get<{ total: number }>(`
      SELECT COALESCE(SUM(elapsed_seconds), 0) AS total
      FROM study_sessions
      WHERE started_at >= datetime('now', '-7 days')
    `);

    // Month (last 30 days)
    const month = this.db.get<{ total: number }>(`
      SELECT COALESCE(SUM(elapsed_seconds), 0) AS total
      FROM study_sessions
      WHERE started_at >= datetime('now', '-30 days')
    `);

    // Streak calculation: distinct days with sessions ordered descending
    const days = this.db.all<{ study_date: string }>(`
      SELECT DISTINCT date(started_at) AS study_date
      FROM study_sessions
      ORDER BY study_date DESC
    `);

    let streak = 0;
    if (days.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      let expectedDateStr = days[0].study_date === todayStr ? todayStr : (days[0].study_date === yesterday ? yesterday : null);

      if (expectedDateStr) {
        let curr = new Date(expectedDateStr);
        for (const d of days) {
          const expected = curr.toISOString().split('T')[0];
          if (d.study_date === expected) {
            streak++;
            curr = new Date(curr.getTime() - 86400000);
          } else {
            break;
          }
        }
      }
    }

    return {
      todaySeconds: today?.total || 0,
      weekSeconds: week?.total || 0,
      monthSeconds: month?.total || 0,
      streakDays: streak
    };
  }
}
