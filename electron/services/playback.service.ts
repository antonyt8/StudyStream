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

        const ext = path.extname(decodedPath).toLowerCase();

        // Subtitles support (.vtt and .srt on-the-fly conversion)
        if (ext === '.vtt') {
          res.writeHead(200, {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(decodedPath).pipe(res);
          return;
        }

        if (ext === '.srt') {
          try {
            const srtContent = fs.readFileSync(decodedPath, 'utf-8');
            const vttContent = 'WEBVTT\n\n' + srtContent
              .replace(/\r\n|\r/g, '\n')
              .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
            res.writeHead(200, {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(vttContent);
            return;
          } catch (e: any) {
            res.writeHead(500);
            res.end(`Error parsing subtitle: ${e.message}`);
            return;
          }
        }

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
  }): Promise<{ url: string; subtitles?: Array<{ label: string; src: string; srclang: string }>; error?: string }> {
    try {
      let subtitles: Array<{ label: string; src: string; srclang: string }> = [];

      // 1. If local path exists, prioritize local playback
      if (params.localPath && fs.existsSync(params.localPath)) {
        const encoded = encodeURIComponent(params.localPath);

        // Discover matching subtitle files (.srt, .vtt)
        try {
          const dir = path.dirname(params.localPath);
          const baseName = path.basename(params.localPath, path.extname(params.localPath)).toLowerCase();
          const candidateDirs = [dir, path.join(dir, 'subs'), path.join(dir, 'subtitles')];

          for (const cDir of candidateDirs) {
            if (fs.existsSync(cDir)) {
              const files = fs.readdirSync(cDir);
              for (const f of files) {
                const fLower = f.toLowerCase();
                if (fLower.endsWith('.srt') || fLower.endsWith('.vtt')) {
                  const fBase = f.slice(0, f.lastIndexOf('.')).toLowerCase();
                  if (fBase.includes(baseName) || baseName.includes(fBase) || files.filter(x => x.toLowerCase().endsWith('.mp4')).length <= 1) {
                    const subPath = path.join(cDir, f);
                    const encodedSub = encodeURIComponent(subPath);
                    const isEn = fLower.includes('en') || fLower.includes('eng');
                    const isEs = fLower.includes('es') || fLower.includes('esp');
                    const langLabel = isEn ? 'Inglês' : isEs ? 'Espanhol' : 'Português';
                    subtitles.push({
                      label: `${langLabel} (${f})`,
                      src: `http://127.0.0.1:${this.localServerPort}/sub?file=${encodedSub}&token=${this.sessionToken}`,
                      srclang: isEn ? 'en' : isEs ? 'es' : 'pt'
                    });
                  }
                }
              }
            }
          }
        } catch (subErr) {
          console.warn('Subtitle scan notice:', subErr);
        }

        return {
          url: `http://127.0.0.1:${this.localServerPort}/video?file=${encoded}&token=${this.sessionToken}`,
          subtitles
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

        return { url: fullUrl, subtitles };
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
