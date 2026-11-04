import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type LogLevel = 'info' | 'warn' | 'error';

export class AppLogger {
  private static instance: AppLogger | null = null;
  private readonly logDir: string;
  private readonly logPath: string;
  private maxBytes = 5 * 1024 * 1024;
  private maxFiles = 3;

  private constructor() {
    const userData = app?.getPath ? app.getPath('userData') : path.join(process.env.APPDATA || process.cwd(), 'StudyStream');
    this.logDir = path.join(userData, 'logs');
    this.logPath = path.join(this.logDir, 'studystream.log');
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const details = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    this.write('error', message, { ...context, ...details });
  }

  public getLogDirectory(): string {
    return this.logDir;
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {})
    }) + '\n';

    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      this.rotateIfNeeded(Buffer.byteLength(entry));
      fs.appendFileSync(this.logPath, entry, 'utf8');
    } catch (writeError) {
      console.error('Unable to write application log:', writeError);
    }
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (!fs.existsSync(this.logPath)) return;
    const size = fs.statSync(this.logPath).size;
    if (size + incomingBytes <= this.maxBytes) return;

    for (let index = this.maxFiles - 1; index >= 1; index--) {
      const source = `${this.logPath}.${index}`;
      const target = `${this.logPath}.${index + 1}`;
      if (fs.existsSync(source)) {
        if (index === this.maxFiles - 1) fs.rmSync(source, { force: true });
        else fs.renameSync(source, target);
      }
    }
    fs.renameSync(this.logPath, `${this.logPath}.1`);
  }
}
