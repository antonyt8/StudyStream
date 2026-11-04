import { DatabaseService } from '../connection';
import { DownloadItem, DownloadStatus } from '../../types';

export class DownloadsRepository {
  private db = DatabaseService.getInstance();

  public list(): DownloadItem[] {
    return this.db.all<DownloadItem>(`
      SELECT 
        d.id, d.lesson_id, d.course_id, d.remote_path, d.destination_path,
        d.status, d.total_bytes, d.downloaded_bytes, d.speed, d.error_message,
        d.created_at, d.updated_at,
        l.title AS lesson_title,
        c.title AS course_title
      FROM downloads d
      JOIN lessons l ON l.id = d.lesson_id
      JOIN courses c ON c.id = d.course_id
      ORDER BY d.created_at DESC
    `);
  }

  public getById(id: string): DownloadItem | null {
    const list = this.list();
    return list.find(d => d.id === id) || null;
  }

  public getActiveByLesson(lessonId: string): DownloadItem | null {
    return this.db.get<DownloadItem>(`
      SELECT d.*, l.title AS lesson_title, c.title AS course_title
      FROM downloads d
      JOIN lessons l ON l.id = d.lesson_id
      JOIN courses c ON c.id = d.course_id
      WHERE d.lesson_id = ? AND d.status IN ('pending', 'downloading', 'paused', 'error')
      ORDER BY d.updated_at DESC
      LIMIT 1
    `, [lessonId]);
  }

  public create(data: {
    lessonId: string;
    courseId: string;
    remotePath: string;
    destinationPath: string;
    totalBytes?: number;
  }): DownloadItem {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO downloads (id, lesson_id, course_id, remote_path, destination_path, status, total_bytes, downloaded_bytes, speed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, 0, ?, ?)
    `, [
      id,
      data.lessonId,
      data.courseId,
      data.remotePath,
      data.destinationPath,
      data.totalBytes || 0,
      now,
      now
    ]);

    return this.getById(id)!;
  }

  public updateProgress(id: string, downloadedBytes: number, totalBytes: number, speed: number): void {
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE downloads
      SET downloaded_bytes = ?, total_bytes = ?, speed = ?, status = 'downloading', updated_at = ?
      WHERE id = ?
    `, [downloadedBytes, totalBytes, speed, now, id]);
  }

  public updateStatus(id: string, status: DownloadStatus, errorMessage?: string): void {
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE downloads
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `, [status, errorMessage || null, now, id]);
  }

  public delete(id: string): void {
    this.db.run(`DELETE FROM downloads WHERE id = ?`, [id]);
  }
}
