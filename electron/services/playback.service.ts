import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PathSecurity } from '../security/path-validation';
import { SourcesRepository } from '../database/repositories/sources.repo';
import { RcloneService } from './rclone.service';
import { SettingsRepository } from '../database/repositories/settings.repo';

export class PlaybackService {
  private static instance: PlaybackService | null = null;
  private localServer: http.Server | null = null;
  private localServerPort: number = 0;
  private sessionToken: string = crypto.randomBytes(16).toString('hex');
  private sourcesRepo = new SourcesRepository();
  private settingsRepo = new SettingsRepository();
  private rcloneService = RcloneService.getInstance();

  private constructor() {
    this.startLocalServer();
    process.on('exit', () => this.stop());
  }

  public static getInstance(): PlaybackService {
    if (!PlaybackService.instance) {
      PlaybackService.instance = new PlaybackService();
    }
    return PlaybackService.instance;
  }

  /**
   * Starts a secure loopback HTTP server with HTTP 206 Partial Content Range support for local files
   */
  private startLocalServer(): void {
    this.localServer = http.createServer((req, res) => {
      // Security headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
      }

      try {
        const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${this.localServerPort}`);
        const token = parsedUrl.searchParams.get('token');
        const rawPath = parsedUrl.searchParams.get('file');

        if (token !== this.sessionToken || !rawPath) {
          res.writeHead(403);
          res.end('Forbidden: Invalid session token');
          return;
        }

        const decodedPath = decodeURIComponent(rawPath);

        // Security check: Verify file exists and belongs to configured library sources
        const sources = this.sourcesRepo.list();
        const allowedRoots = sources.filter(s => s.source_type === 'local').map(s => s.root_path);
        
        // Also allow default download folder if configured
        const settings = this.settingsRepo.getAll();
        if (settings.defaultDownloadPath) {
          allowedRoots.push(settings.defaultDownloadPath);
        }

        if (!PathSecurity.isPathWithinRoots(decodedPath, allowedRoots)) {
          res.writeHead(403);
          res.end('Access Denied: File path outside authorized library sources');
          return;
        }

        if (!fs.existsSync(decodedPath)) {
          res.writeHead(404);
          res.end('File Not Found');
          return;
        }

        const stat = fs.statSync(decodedPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Content-Type by extension
        const ext = path.extname(decodedPath).toLowerCase();
        let mime = 'video/mp4';
        if (ext === '.webm') mime = 'video/webm';
        else if (ext === '.mkv') mime = 'video/x-matroska';
        else if (ext === '.mov') mime = 'video/quicktime';
        else if (ext === '.avi') mime = 'video/x-msvideo';

        if (range) {
          // Parse Range: bytes=start-end
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          if (start >= fileSize || end >= fileSize) {
            res.writeHead(416, {
              'Content-Range': `bytes */${fileSize}`,
            });
            res.end();
            return;
          }

          const chunksize = end - start + 1;
          const stream = fs.createReadStream(decodedPath, { start, end });

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': mime,
          });

          if (req.method === 'HEAD') {
            res.end();
          } else {
            stream.pipe(res);
          }
        } else {
          // Full file stream
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
          });

          if (req.method === 'HEAD') {
            res.end();
          } else {
            fs.createReadStream(decodedPath).pipe(res);
          }
        }
      } catch (err: any) {
        res.writeHead(500);
        res.end(`Internal Server Error: ${err.message}`);
      }
    });

    this.localServer.listen(0, '127.0.0.1', () => {
      const addr = this.localServer?.address();
      if (addr && typeof addr !== 'string') {
        this.localServerPort = addr.port;
      }
    });
  }

  /**
   * Generates a streaming URL for a given lesson
   */
  public async getPlaybackUrl(params: {
    sourceType: 'local' | 'gdrive';
    localPath?: string;
    remotePath?: string;
    sourceRoot: string;
    remoteName?: string;
  }): Promise<{ url: string; error?: string }> {
    try {
      // 1. If local path exists, prioritize local playback
      if (params.localPath && fs.existsSync(params.localPath)) {
        const encoded = encodeURIComponent(params.localPath);
        return {
          url: `http://127.0.0.1:${this.localServerPort}/video?file=${encoded}&token=${this.sessionToken}`
        };
      }

      // 2. If it's a remote Google Drive source
      if (params.sourceType === 'gdrive' && params.remotePath) {
        const settings = this.settingsRepo.getAll();
        const rclonePath = settings.rclonePath || 'rclone';

        // Start rclone serve http on the remote root with configured VFS cache options
        const remoteRoot = params.sourceRoot; // e.g. "gdrive:Cursos"
        const serverInfo = await this.rcloneService.startHttpServer(rclonePath, remoteRoot, {
          vfsCacheMode: settings.rcloneVfsCacheMode,
          vfsCacheMaxSize: settings.rcloneVfsCacheMaxSize,
          vfsCacheMaxAge: settings.rcloneVfsCacheMaxAge,
          vfsReadChunkSize: settings.rcloneVfsReadChunkSize,
          dirCacheTime: settings.rcloneDirCacheTime,
          bandwidthLimit: settings.rcloneBandwidthLimit
        });

        // Compute relative path from remoteRoot
        let relative = params.remotePath;
        if (relative.startsWith(remoteRoot)) {
          relative = relative.substring(remoteRoot.length);
        }
        if (relative.startsWith('/') || relative.startsWith('\\')) {
          relative = relative.substring(1);
        }

        // Encode URI path components safely
        const encodedPath = relative.split(/[/\\]/).map(segment => encodeURIComponent(segment)).join('/');
        const fullUrl = `${serverInfo.url}/${encodedPath}`;

        return { url: fullUrl };
      }

      return { url: '', error: 'Arquivo não encontrado nem localmente nem remotamente' };
    } catch (err: any) {
      return { url: '', error: err.message };
    }
  }

  public stop(): void {
    if (this.localServer) {
      this.localServer.close();
      this.localServer = null;
    }
    this.rcloneService.stopHttpServer();
  }
}
