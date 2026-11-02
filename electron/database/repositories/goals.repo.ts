import { DatabaseService } from '../connection';
import { StudyGoal } from '../../types';

export class GoalsRepository {
  private db = DatabaseService.getInstance();

  public list(): StudyGoal[] {
    return this.db.all<StudyGoal>(`
      SELECT id, goal_type, target_value, active, created_at, updated_at
      FROM study_goals
      ORDER BY created_at ASC
    `);
  }

  public getByType(type: string): StudyGoal | null {
    return this.db.get<StudyGoal>(`
      SELECT id, goal_type, target_value, active, created_at, updated_at
      FROM study_goals
      WHERE goal_type = ?
    `, [type]);
  }

  public update(type: string, targetValue: number): void {
    const now = new Date().toISOString();
    const existing = this.getByType(type);
    if (existing) {
      this.db.run(`
        UPDATE study_goals
        SET target_value = ?, updated_at = ?
        WHERE goal_type = ?
      `, [targetValue, now, type]);
    } else {
      this.db.run(`
        INSERT INTO study_goals (id, goal_type, target_value, active, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `, [`goal_${type}`, type, targetValue, now, now]);
    }
  }
}
