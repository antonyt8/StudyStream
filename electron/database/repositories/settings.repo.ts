import { DatabaseService } from '../connection';
import { AppSettings } from '../../types';

export class SettingsRepository {
  private db = DatabaseService.getInstance();

  public getAll(): AppSettings {
    const rows = this.db.all<{ key: string; value: string }>(`SELECT key, value FROM settings`);
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }

    return {
      theme: (map['theme'] as any) || 'dark',
      language: map['language'] || 'pt-BR',
      defaultDownloadPath: map['defaultDownloadPath'] || '',
      defaultPlaybackSpeed: parseFloat(map['defaultPlaybackSpeed'] || '1') || 1,
      autoResume: map['autoResume'] !== 'false',
      autoCompleteThreshold: parseFloat(map['autoCompleteThreshold'] || '0.9') || 0.9,
      rclonePath: map['rclonePath'] || 'rclone',
      selectedRemote: map['selectedRemote'] || 'gdrive:',
      remoteFolderPath: map['remoteFolderPath'] || '',
      startWithWindows: map['startWithWindows'] === 'true',
      dbPath: this.db.getDbPath(),
      rcloneVfsCacheMode: (map['rcloneVfsCacheMode'] as any) || 'full',
      rcloneVfsCacheMaxSize: map['rcloneVfsCacheMaxSize'] || '50G',
      rcloneVfsCacheMaxAge: map['rcloneVfsCacheMaxAge'] || '72h',
      rcloneVfsReadChunkSize: map['rcloneVfsReadChunkSize'] || '64M',
      rcloneDirCacheTime: map['rcloneDirCacheTime'] || '15m',
      rcloneBandwidthLimit: map['rcloneBandwidthLimit'] || 'off',
      rcloneBufferChunkStreams: parseInt(map['rcloneBufferChunkStreams'] || '4', 10) || 4
    };
  }

  public set(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `, [key, value, now]);
  }

  public updateMany(settings: Partial<AppSettings>): void {
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && key !== 'dbPath') {
        this.set(key, String(val));
      }
    }
  }
}
