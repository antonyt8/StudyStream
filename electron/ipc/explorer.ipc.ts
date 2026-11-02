import { ipcMain, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { RcloneService } from '../services/rclone.service';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { PathSecurity } from '../security/path-validation';

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.mpeg', '.mpg', '.wmv']);

export function registerExplorerIpc(): void {
  const rcloneService = RcloneService.getInstance();
  const settingsRepo = new SettingsRepository();

  /**
   * List folders and files in a remote Google Drive / Rclone folder (1 level deep)
   */
  ipcMain.handle('explorer:list-remote', async (_, data: { remoteName: string; subfolder?: string }) => {
    const settings = settingsRepo.getAll();
    const execPath = settings.rclonePath || 'rclone';
    const remote = data.remoteName.endsWith(':') ? data.remoteName : `${data.remoteName}:`;
    const cleanSub = (data.subfolder || '').replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    const targetPath = cleanSub ? `${remote}${cleanSub}` : remote;

    try {
      const items = await rcloneService.listJson(execPath, targetPath, { maxDepth: 1 });

      const folders: Array<{ name: string; path: string }> = [];
      const files: Array<{ name: string; path: string; size: number; isVideo: boolean; isPdf: boolean; ext: string }> = [];

      for (const item of items) {
        const itemRelative = cleanSub ? `${cleanSub}/${item.Name}` : item.Name;
        if (item.IsDir) {
          folders.push({
            name: item.Name,
            path: itemRelative
          });
        } else {
          const ext = path.extname(item.Name).toLowerCase();
          const isVideo = VIDEO_EXTS.has(ext);
          const isPdf = ext === '.pdf';
          files.push({
            name: item.Name,
            path: itemRelative,
            size: item.Size || 0,
            isVideo,
            isPdf,
            ext
          });
        }
      }

      // Natural sort folders and files
      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // Build breadcrumbs
      const breadcrumbs: Array<{ name: string; path: string }> = [
        { name: remote, path: '' }
      ];
      if (cleanSub) {
        const parts = cleanSub.split(/[/\\]/);
        let accum = '';
        for (const part of parts) {
          accum = accum ? `${accum}/${part}` : part;
          breadcrumbs.push({ name: part, path: accum });
        }
      }

      let parentPath: string | undefined = undefined;
      if (cleanSub) {
        const parts = cleanSub.split(/[/\\]/);
        parts.pop();
        parentPath = parts.join('/');
      }

      return {
        success: true,
        currentPath: cleanSub,
        fullRemotePath: targetPath,
        parentPath,
        breadcrumbs,
        folders,
        files,
        videoCount: files.filter(f => f.isVideo).length,
        pdfCount: files.filter(f => f.isPdf).length
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        currentPath: cleanSub,
        breadcrumbs: [{ name: remote, path: '' }],
        folders: [],
        files: [],
        videoCount: 0,
        pdfCount: 0
      };
    }
  });

  /**
   * List folders and files in local computer directory
   */
  ipcMain.handle('explorer:list-local', async (_, folderPath?: string) => {
    try {
      // If no folder path provided, return root drives and common user paths on Windows
      if (!folderPath) {
        const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\'].filter(d => {
          try { return fs.existsSync(d); } catch { return false; }
        });

        const commonFolders: Array<{ name: string; path: string }> = [];
        try {
          const home = app.getPath('home');
          const downloads = app.getPath('downloads');
          const documents = app.getPath('documents');
          if (fs.existsSync(downloads)) commonFolders.push({ name: 'Downloads', path: downloads });
          if (fs.existsSync(documents)) commonFolders.push({ name: 'Documentos', path: documents });
          if (fs.existsSync(home)) commonFolders.push({ name: 'Pasta do Usuário', path: home });
        } catch {}

        return {
          success: true,
          isRoot: true,
          currentPath: '',
          breadcrumbs: [{ name: 'Meu Computador', path: '' }],
          folders: [
            ...drives.map(d => ({ name: `Disco Local (${d})`, path: d })),
            ...commonFolders
          ],
          files: [],
          videoCount: 0,
          pdfCount: 0
        };
      }

      if (!PathSecurity.isSafePath(folderPath) || !fs.existsSync(folderPath)) {
        throw new Error(`Caminho local inválido ou não encontrado: ${folderPath}`);
      }

      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const folders: Array<{ name: string; path: string }> = [];
      const files: Array<{ name: string; path: string; size: number; isVideo: boolean; isPdf: boolean; ext: string }> = [];

      for (const entry of entries) {
        try {
          const fullPath = path.join(folderPath, entry.name);
          if (entry.isDirectory()) {
            folders.push({
              name: entry.name,
              path: fullPath
            });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const isVideo = VIDEO_EXTS.has(ext);
            const isPdf = ext === '.pdf';
            const stat = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              size: stat.size,
              isVideo,
              isPdf,
              ext
            });
          }
        } catch {}
      }

      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // Normalized breadcrumbs
      const normalized = path.resolve(folderPath);
      const root = path.parse(normalized).root;
      const relative = path.relative(root, normalized);
      const parts = relative ? relative.split(path.sep) : [];

      const breadcrumbs: Array<{ name: string; path: string }> = [
        { name: root, path: root }
      ];
      let currentAcc = root;
      for (const part of parts) {
        currentAcc = path.join(currentAcc, part);
        breadcrumbs.push({ name: part, path: currentAcc });
      }

      const parentDir = path.dirname(normalized);
      const parentPath = parentDir !== normalized ? parentDir : undefined;

      return {
        success: true,
        currentPath: normalized,
        parentPath,
        breadcrumbs,
        folders,
        files,
        videoCount: files.filter(f => f.isVideo).length,
        pdfCount: files.filter(f => f.isPdf).length
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        currentPath: folderPath || '',
        breadcrumbs: [{ name: 'Meu Computador', path: '' }],
        folders: [],
        files: [],
        videoCount: 0,
        pdfCount: 0
      };
    }
  });
}
