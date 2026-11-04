import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { initialMigration } from './migrations/001_initial';
import { AppLogger } from '../services/app-logger';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private dbPath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private logger = AppLogger.getInstance();

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(customPath?: string): Promise<void> {
    if (this.db) return;

    let wasmBinary: ArrayBuffer | undefined;
    const candidates = [
      path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
      path.join(process.resourcesPath || '', 'app.asar/node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        try {
          const buf = fs.readFileSync(c);
          wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
          break;
        } catch {
          // continue
        }
      }
    }

    this.SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});

    if (customPath) {
      this.dbPath = customPath;
    } else {
      const userDataDir = app ? app.getPath('userData') : path.join(process.env.APPDATA || process.cwd(), 'StudyStream');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      this.dbPath = path.join(userDataDir, 'studystream.db');
    }

    if (fs.existsSync(this.dbPath)) {
      this.createAutomaticBackup('startup');
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(fileBuffer);
    } else {
      this.db = new this.SQL.Database();
    }

    // Apply migrations
    this.runMigrations();

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON;');

    // Initial save
    this.saveImmediate();
    this.autoBackupTimer = setInterval(() => this.createAutomaticBackup('scheduled'), 30 * 60 * 1000);
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');
    try {
      this.db.exec(initialMigration);
    } catch (err) {
      console.error('Migration error:', err);
      throw err;
    }

    // Ensure scan_mode column exists for existing databases
    try {
      this.db.run(`ALTER TABLE sources ADD COLUMN scan_mode TEXT DEFAULT 'single_course';`);
    } catch {
      // Column already exists
    }

    // Ensure snapshot_data column exists for notes
    try {
      this.db.run(`ALTER TABLE notes ADD COLUMN snapshot_data TEXT;`);
    } catch {
      // Column already exists
    }

    // Clean up duplicate or orphaned sources
    try {
      this.db.run(`
        DELETE FROM sources
        WHERE id NOT IN (SELECT DISTINCT source_id FROM courses)
          AND root_path IN (SELECT root_path FROM sources GROUP BY root_path HAVING count(*) > 1);
      `);
    } catch {
      // ignore
    }
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public saveImmediate(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      this.logger.error('Error saving SQLite database to disk', err);
    }
  }

  public scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate();
      this.saveTimeout = null;
    }, 500);
  }

  public all<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  public get<T = any>(sql: string, params: any[] = []): T | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    let result: T | null = null;
    if (stmt.step()) {
      result = stmt.getAsObject() as T;
    }
    stmt.free();
    return result;
  }

  public run(sql: string, params: any[] = []): { changes: number } {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    const changes = this.db.getRowsModified();
    this.scheduleSave();
    return { changes };
  }

  public transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.run('COMMIT;');
      this.scheduleSave();
      return result;
    } catch (error) {
      this.db.run('ROLLBACK;');
      throw error;
    }
  }

  public backup(targetPath: string): { success: boolean; error?: string } {
    if (!this.db) return { success: false, error: 'Database not initialized' };
    try {
      this.saveImmediate();
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(this.dbPath, targetPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public restore(sourcePath: string): { success: boolean; error?: string } {
    if (!this.SQL) return { success: false, error: 'SQL not initialized' };
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'Backup file does not exist' };
      }

      // 1. Create a safety backup of current database first
      const safetyBackupPath = `${this.dbPath}.safety_${Date.now()}`;
      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, safetyBackupPath);
      }

      // 2. Read new database and test integrity
      const newBuffer = fs.readFileSync(sourcePath);
      const testDb = new this.SQL.Database(newBuffer);
      const testStmt = testDb.prepare('PRAGMA integrity_check;');
      testStmt.step();
      const integrity = testStmt.getAsObject();
      testStmt.free();
      testDb.close();

      if (integrity.integrity_check !== 'ok') {
        return { success: false, error: 'Arquivo de backup corrompido ou inválido' };
      }

      // 3. Replace atomically through a temporary file, then reopen it.
      const temporaryPath = `${this.dbPath}.restore_${Date.now()}.tmp`;
      fs.copyFileSync(sourcePath, temporaryPath);
      if (this.db) {
        this.db.close();
      }
      fs.renameSync(temporaryPath, this.dbPath);
      this.db = new this.SQL.Database(newBuffer);
      this.db.run('PRAGMA foreign_keys = ON;');
      this.logger.info('Database restored successfully', { sourcePath });
      return { success: true };
    } catch (err: any) {
      this.logger.error('Database restore failed', err, { sourcePath });
      return { success: false, error: err.message };
    }
  }

  public checkIntegrity(): { ok: boolean; message: string } {
    if (!this.db) return { ok: false, message: 'Banco de dados não inicializado' };
    try {
      const stmt = this.db.prepare('PRAGMA integrity_check;');
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      const isOk = result.integrity_check === 'ok';
      return { ok: isOk, message: String(result.integrity_check) };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  public close(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
    if (this.db) {
      this.saveImmediate();
      this.db.close();
      this.db = null;
    }
  }

  private createAutomaticBackup(reason: 'startup' | 'scheduled'): void {
    if (!this.dbPath || !fs.existsSync(this.dbPath)) return;
    try {
      const backupDir = path.join(path.dirname(this.dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const target = path.join(backupDir, `studystream_${reason}_${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      fs.copyFileSync(this.dbPath, target);
      const backups = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.db'))
        .map(file => ({ file, time: fs.statSync(path.join(backupDir, file)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
      for (const old of backups.slice(10)) {
        fs.rmSync(path.join(backupDir, old.file), { force: true });
      }
      this.logger.info('Automatic database backup created', { reason, target });
    } catch (error) {
      this.logger.error('Automatic database backup failed', error, { reason });
    }
  }
}
