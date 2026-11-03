import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { RcloneRemote, RcloneStatus, RcloneItem, RcloneDiagnostics } from '../types';

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
   * Resolves the actual binary path of rclone, checking settings, PATH, WinGet, Scoop, etc.
   */
  public resolveExecutable(configuredPath: string = 'rclone'): string {
    if (path.isAbsolute(configuredPath) && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    const candidates: string[] = [];

    if (configuredPath && configuredPath !== 'rclone') {
      candidates.push(configuredPath);
      if (process.platform === 'win32' && !configuredPath.endsWith('.exe')) {
        candidates.push(`${configuredPath}.exe`);
      }
    }

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const userProfile = process.env.USERPROFILE || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

      // WinGet packages directory
      const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(wingetDir)) {
        try {
          const entries = fs.readdirSync(wingetDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.toLowerCase().includes('rclone')) {
              const fullDir = path.join(wingetDir, entry.name);
              const subEntries = fs.readdirSync(fullDir, { withFileTypes: true });
              for (const sub of subEntries) {
                if (sub.isDirectory() && sub.name.toLowerCase().includes('rclone')) {
                  const exe = path.join(fullDir, sub.name, 'rclone.exe');
                  if (fs.existsSync(exe)) candidates.push(exe);
                } else if (sub.isFile() && sub.name.toLowerCase() === 'rclone.exe') {
                  candidates.push(path.join(fullDir, sub.name));
                }
              }
            }
          }
        } catch {}
      }

      candidates.push(
        path.join(programFiles, 'rclone', 'rclone.exe'),
        'C:\\rclone\\rclone.exe',
        path.join(userProfile, 'scoop', 'shims', 'rclone.exe'),
        path.join(process.env.ProgramData || 'C:\\ProgramData', 'chocolatey', 'bin', 'rclone.exe'),
        'rclone.exe'
      );
    }

    candidates.push('rclone');

    for (const c of candidates) {
      if (path.isAbsolute(c) && fs.existsSync(c)) {
        return c;
      }
    }

    return configuredPath || (process.platform === 'win32' ? 'rclone.exe' : 'rclone');
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
    const exec = this.resolveExecutable(executablePath);
    return new Promise((resolve) => {
      try {
        const child = spawn(exec, ['version'], {
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
    const exec = this.resolveExecutable(executablePath);
    return new Promise((resolve) => {
      try {
        const child = spawn(exec, ['listremotes'], {
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
    const exec = this.resolveExecutable(executablePath);
    return new Promise((resolve) => {
      try {
        const child = spawn(exec, ['lsd', remotePath, '--max-depth', '1', '--timeout', '8s'], {
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
    const exec = this.resolveExecutable(executablePath);
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

        const child = spawn(exec, args, {
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
   * Diagnostic inspection of Rclone installation and remote connection
   */
  public async getDiagnostics(
    executablePath: string = 'rclone',
    remotePath: string = 'gdrive:'
  ): Promise<RcloneDiagnostics> {
    const status = await this.checkStatus(executablePath);
    let configPath = '';
    
    try {
      configPath = await new Promise<string>((resolve) => {
        const exec = this.resolveExecutable(executablePath);
        const child = spawn(exec, ['config', 'file'], {
          windowsHide: true,
          shell: false
        });
        let out = '';
        child.stdout.on('data', d => { out += d.toString(); });
        child.on('error', () => resolve(''));
        child.on('close', () => {
          const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const found = lines.find(l => l.endsWith('.conf') || l.includes('rclone.conf'));
          resolve(found || lines[lines.length - 1] || '');
        });
      });
    } catch {
      configPath = '';
    }

    if (!status.installed) {
      return {
        installed: false,
        version: '',
        configPath: '',
        remotesCount: 0,
        canConnectDrive: false,
        message: status.error || 'Rclone não encontrado'
      };
    }

    // Measure latency to remotePath
    const start = Date.now();
    const access = await this.testRemoteAccess(executablePath, remotePath);
    const latencyMs = Date.now() - start;

    return {
      installed: true,
      version: status.version || 'Detectado',
      configPath: configPath || 'Padrão do Sistema (%APPDATA%/rclone/rclone.conf)',
      remotesCount: status.remotes.length,
      latencyMs: access.success ? latencyMs : undefined,
      canConnectDrive: access.success,
      message: access.message || (access.success ? 'Conexão estável com Google Drive' : 'Falha ao conectar')
    };
  }

  /**
   * Starts an internal loopback HTTP server with HTTP 206 Range seeking for Google Drive streaming
   */
  public async startHttpServer(
    executablePath: string = 'rclone',
    remotePath: string,
    options: {
      vfsCacheMode?: string;
      vfsCacheMaxSize?: string;
      vfsCacheMaxAge?: string;
      vfsReadChunkSize?: string;
      dirCacheTime?: string;
      bandwidthLimit?: string;
    } = {}
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

    const cacheMode = options.vfsCacheMode && options.vfsCacheMode !== 'minimal' ? options.vfsCacheMode : 'full';
    const dirCacheTime = options.dirCacheTime || '15m';

    const args = [
      'serve', 'http', remotePath,
      '--addr', `127.0.0.1:${port}`,
      '--read-only',
      '--vfs-cache-mode', cacheMode,
      '--vfs-read-ahead', '64M',
      '--vfs-read-chunk-size', options.vfsReadChunkSize || '8M',
      '--vfs-read-chunk-size-limit', '128M',
      '--vfs-read-chunk-streams', '4',
      '--buffer-size', '32M',
      '--drive-chunk-size', '32M',
      '--vfs-read-wait', '10ms',
      '--vfs-handle-caching', '30m',
      '--vfs-fast-fingerprint',
      '--no-checksum',
      '--no-modtime',
      '--dir-cache-time', dirCacheTime
    ];

    if (options.vfsCacheMaxSize && options.vfsCacheMaxSize !== '0') {
      args.push('--vfs-cache-max-size', options.vfsCacheMaxSize);
    }
    if (options.vfsCacheMaxAge) {
      args.push('--vfs-cache-max-age', options.vfsCacheMaxAge);
    }
    if (options.bandwidthLimit && options.bandwidthLimit !== 'off') {
      args.push('--bwlimit', options.bandwidthLimit);
    }

    return new Promise((resolve, reject) => {
      try {
        const exec = this.resolveExecutable(executablePath);
        const child = spawn(exec, args, {
          windowsHide: true,
          shell: false
        });

        this.serverProcess = child;
        this.currentServerUrl = `http://127.0.0.1:${port}`;

        let started = false;
        let pollTimer: NodeJS.Timeout | null = null;

        const cleanupAndResolve = () => {
          if (!started) {
            started = true;
            if (pollTimer) clearInterval(pollTimer);
            resolve({ url: this.currentServerUrl!, port: this.activePort });
          }
        };

        // Actively probe loopback port to detect when rclone starts accepting connections
        const checkPortReady = () => {
          if (started || !this.serverProcess) {
            if (pollTimer) clearInterval(pollTimer);
            return;
          }
          const sock = net.createConnection({ port, host: '127.0.0.1' });
          sock.once('connect', () => {
            sock.destroy();
            cleanupAndResolve();
          });
          sock.once('error', () => {
            sock.destroy();
          });
        };

        pollTimer = setInterval(checkPortReady, 35);
        setTimeout(checkPortReady, 10);

        child.stderr.on('data', (data) => {
          const msg = data.toString();
          // rclone logs server startup info or notices to stderr
          if (!started && (msg.includes('Serving') || msg.includes('server') || msg.includes('127.0.0.1'))) {
            cleanupAndResolve();
          }
        });

        child.on('error', (err) => {
          if (pollTimer) clearInterval(pollTimer);
          this.serverProcess = null;
          if (!started) reject(err);
        });

        child.on('close', () => {
          if (pollTimer) clearInterval(pollTimer);
          this.serverProcess = null;
          this.currentServerUrl = null;
          this.currentServerRemote = null;
        });

        // Maximum fallback timeout
        setTimeout(() => {
          if (!started && this.serverProcess) {
            cleanupAndResolve();
          }
        }, 1500);
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

        const exec = this.resolveExecutable(executablePath);
        const child = spawn(exec, args, {
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

  public async copyFileTo(
    executablePath: string = 'rclone',
    remoteFilePath: string,
    localDestPath: string
  ): Promise<void> {
    return this.downloadFile(executablePath, remoteFilePath, localDestPath, () => {});
  }
}
