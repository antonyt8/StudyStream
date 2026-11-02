import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { RcloneRemote, RcloneStatus, RcloneItem } from '../types';

export class RcloneService {
  private static instance: RcloneService | null = null;
  private serverProcess: ChildProcess | null = null;
  private currentServerUrl: string | null = null;
  private currentServerRemote: string | null = null;
  private activePort: number = 0;

  private constructor() {
    // Ensure clean exit
    process.on('exit', () => this.stopHttpServer());
  }

  public static getInstance(): RcloneService {
    if (!RcloneService.instance) {
      RcloneService.instance = new RcloneService();
    }
    return RcloneService.instance;
  }

  /**
   * Helper to check an available TCP port on loopback
   */
  private async getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => resolve(18590));
        }
      });
    });
  }

  /**
   * Checks if Rclone is installed, gets its version and configured remotes
   */
  public async checkStatus(executablePath: string = 'rclone'): Promise<RcloneStatus> {
    return new Promise((resolve) => {
      try {
        const child = spawn(executablePath, ['version'], {
          windowsHide: true,
          shell: false
        });

        let output = '';
        let errOutput = '';

        child.stdout.on('data', (d) => { output += d.toString(); });
        child.stderr.on('data', (d) => { errOutput += d.toString(); });

        child.on('error', (err) => {
          resolve({
            installed: false,
            path: executablePath,
            remotes: [],
            error: err.message
          });
        });

        child.on('close', async (code) => {
          if (code === 0) {
            const firstLine = output.split('\n')[0] || '';
            const versionMatch = firstLine.match(/rclone\s+v?([^\s]+)/i);
            const version = versionMatch ? versionMatch[1] : firstLine;
            const remotes = await this.listRemotes(executablePath);
            resolve({
              installed: true,
              version,
              path: executablePath,
              remotes
            });
          } else {
            resolve({
              installed: false,
              path: executablePath,
              remotes: [],
              error: errOutput || `Processo encerrou com código ${code}`
            });
          }
        });
      } catch (err: any) {
        resolve({
          installed: false,
          path: executablePath,
          remotes: [],
          error: err.message
        });
      }
    });
  }

  /**
   * Lists configured remotes safely
   */
  public async listRemotes(executablePath: string = 'rclone'): Promise<RcloneRemote[]> {
    return new Promise((resolve) => {
      try {
        const child = spawn(executablePath, ['listremotes'], {
          windowsHide: true,
          shell: false
        });

        let output = '';
        child.stdout.on('data', (d) => { output += d.toString(); });

        child.on('error', () => resolve([]));
        child.on('close', (code) => {
          if (code === 0) {
            const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const remotes: RcloneRemote[] = lines.map(name => ({
              name,
              type: name.toLowerCase().includes('drive') ? 'drive' : 'cloud'
            }));
            resolve(remotes);
          } else {
            resolve([]);
          }
        });
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Tests access to a remote directory (low timeout)
   */
  public async testRemoteAccess(executablePath: string = 'rclone', remotePath: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      try {
        const child = spawn(executablePath, ['lsd', remotePath, '--max-depth', '1', '--timeout', '8s'], {
          windowsHide: true,
          shell: false
        });

        let err = '';
        child.stderr.on('data', (d) => { err += d.toString(); });

        child.on('error', (e) => resolve({ success: false, message: e.message }));
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, message: 'Conexão estabelecida com sucesso' });
          } else {
            // Mask any sensitive token strings if present
            const cleanErr = err.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
            resolve({ success: false, message: cleanErr || 'Falha ao acessar remote' });
          }
        });
      } catch (e: any) {
        resolve({ success: false, message: e.message });
      }
    });
  }

  /**
   * Structured JSON file listing of remote files
   */
  public async listJson(
    executablePath: string = 'rclone',
    remotePath: string,
    options: { recursive?: boolean; maxDepth?: number; dirsOnly?: boolean } = {}
  ): Promise<RcloneItem[]> {
    return new Promise((resolve, reject) => {
      try {
        const args = ['lsjson', remotePath];
        if (options.recursive) {
          args.push('-R');
        }
        if (options.maxDepth !== undefined) {
          args.push('--max-depth', String(options.maxDepth));
        }
        if (options.dirsOnly) {
          args.push('--dirs-only');
        }

        const child = spawn(executablePath, args, {
          windowsHide: true,
          shell: false
        });

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (chunk) => {
          stdoutData += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
        });

        child.on('error', (err) => reject(err));

        child.on('close', (code) => {
          if (code === 0) {
            try {
              const parsed: RcloneItem[] = JSON.parse(stdoutData || '[]');
              resolve(parsed);
            } catch (jsonErr: any) {
              reject(new Error(`Falha ao decodificar JSON do Rclone: ${jsonErr.message}`));
            }
          } else {
            const cleanErr = stderrData.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
            reject(new Error(`Rclone lsjson falhou com código ${code}: ${cleanErr}`));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Starts an internal loopback HTTP server with HTTP 206 Range seeking for Google Drive streaming
   */
  public async startHttpServer(
    executablePath: string = 'rclone',
    remotePath: string
  ): Promise<{ url: string; port: number }> {
    // If server is already running for the exact same remote root, reuse it
    if (this.serverProcess && this.currentServerRemote === remotePath && this.currentServerUrl) {
      return { url: this.currentServerUrl, port: this.activePort };
    }

    // Otherwise stop existing process
    this.stopHttpServer();

    const port = await this.getFreePort();
    this.activePort = port;
    this.currentServerRemote = remotePath;

    const args = [
      'serve', 'http', remotePath,
      '--addr', `127.0.0.1:${port}`,
      '--read-only',
      '--vfs-cache-mode', 'minimal',
      '--dir-cache-time', '5m',
      '--no-modtime'
    ];

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(executablePath, args, {
          windowsHide: true,
          shell: false
        });

        this.serverProcess = child;
        this.currentServerUrl = `http://127.0.0.1:${port}`;

        let started = false;

        child.stderr.on('data', (data) => {
          const msg = data.toString();
          // rclone logs server startup info or notices to stderr
          if (!started && (msg.includes('Serving') || msg.includes('server') || msg.includes('127.0.0.1'))) {
            started = true;
            resolve({ url: this.currentServerUrl!, port: this.activePort });
          }
        });

        child.on('error', (err) => {
          this.serverProcess = null;
          if (!started) reject(err);
        });

        child.on('close', () => {
          this.serverProcess = null;
          this.currentServerUrl = null;
          this.currentServerRemote = null;
        });

        // Resolve after 1000ms if no error occurred
        setTimeout(() => {
          if (!started && this.serverProcess) {
            started = true;
            resolve({ url: this.currentServerUrl!, port: this.activePort });
          }
        }, 1200);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stops the Rclone HTTP streaming server
   */
  public stopHttpServer(): void {
    if (this.serverProcess) {
      try {
        this.serverProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.serverProcess = null;
      this.currentServerUrl = null;
      this.currentServerRemote = null;
    }
  }

  /**
   * Downloads a single remote file to local disk with progress callback
   */
  public async downloadFile(
    executablePath: string = 'rclone',
    remoteFilePath: string,
    localDestPath: string,
    onProgress: (percent: number, speedBytesPerSec: number, downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const destDir = path.dirname(localDestPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const args = [
          'copyto',
          remoteFilePath,
          localDestPath,
          '--stats', '1s',
          '--stats-log-level', 'NOTICE',
          '--use-json-log'
        ];

        const child = spawn(executablePath, args, {
          windowsHide: true,
          shell: false
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              if (entry.stats) {
                const total = entry.stats.totalBytes || 0;
                const transferred = entry.stats.bytes || 0;
                const speed = entry.stats.speed || 0;
                const pct = total > 0 ? Math.round((transferred / total) * 100) : 0;
                onProgress(pct, speed, transferred, total);
              }
            } catch {
              // Non-json output
            }
          }
        });

        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Download falhou com código ${code}`));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
