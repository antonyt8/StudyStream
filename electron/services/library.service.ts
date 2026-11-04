import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SourcesRepository } from '../database/repositories/sources.repo';
import { CoursesRepository } from '../database/repositories/courses.repo';
import { ModulesRepository } from '../database/repositories/modules.repo';
import { LessonsRepository } from '../database/repositories/lessons.repo';
import { MaterialsRepository } from '../database/repositories/materials.repo';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { RcloneService } from './rclone.service';
import { DatabaseService } from '../database/connection';
import { ScanProgress } from '../types';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.mpeg', '.mpg', '.wmv']);
const MATERIAL_EXTENSIONS: Record<string, 'pdf' | 'txt' | 'markdown' | 'docx' | 'zip' | 'other'> = {
  '.pdf': 'pdf',
  '.txt': 'txt',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.docx': 'docx',
  '.doc': 'docx',
  '.zip': 'zip',
  '.epub': 'other'
};

export class LibraryService {
  private static instance: LibraryService | null = null;
  private sourcesRepo = new SourcesRepository();
  private coursesRepo = new CoursesRepository();
  private modulesRepo = new ModulesRepository();
  private lessonsRepo = new LessonsRepository();
  private materialsRepo = new MaterialsRepository();
  private settingsRepo = new SettingsRepository();
  private rcloneService = RcloneService.getInstance();
  private db = DatabaseService.getInstance();

  private activeScans = new Map<string, { cancelled: boolean }>();
  private remoteCacheDir: string;

  private constructor() {
    const userData = this.settingsRepo.getAll().dbPath;
    this.remoteCacheDir = path.join(userData ? path.dirname(userData) : process.cwd(), 'metadata-cache');
    fs.mkdirSync(this.remoteCacheDir, { recursive: true });
  }

  public static getInstance(): LibraryService {
    if (!LibraryService.instance) {
      LibraryService.instance = new LibraryService();
    }
    return LibraryService.instance;
  }

  public cancelScan(sourceId: string): void {
    const scan = this.activeScans.get(sourceId);
    if (scan) {
      scan.cancelled = true;
    }
  }

  /**
   * Natural sort comparison for filenames, folders and numbers
   */
  private naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Generates a stable deterministic ID from strings
   */
  private makeStableId(prefix: string, ...parts: string[]): string {
    const hash = crypto.createHash('md5').update(parts.join('::')).digest('hex').substring(0, 16);
    return `${prefix}_${hash}`;
  }

  /**
   * Formats a clean, descriptive lesson title when files are inside subfolders.
   * Handles patterns like "1. Aula.mp4", "2. Aula.mp4", "Parte 1", "01", etc.
   */
  public formatLessonTitle(subfolders: string[], fileName: string): string {
    const cleanFileName = fileName.trim();
    if (!subfolders || subfolders.length === 0) {
      return cleanFileName;
    }

    const folderTitle = subfolders.join(' - ').trim();

    // 1. "1. Aula", "01 - Aula", "2_aula", "1. Video", "1. Bloco", "1. Parte", "1 - Parte"
    const prefixNumMatch = cleanFileName.match(/^(\d+)[\s._-]+(?:aula|bloco|parte|video|part)$/i);
    if (prefixNumMatch) {
      const partNum = parseInt(prefixNumMatch[1], 10);
      return `${folderTitle} (Parte ${partNum})`;
    }

    // 2. "Aula 1", "Aula 02", "Parte 1", "Bloco 03", "Video 2", "Part 1"
    const suffixNumMatch = cleanFileName.match(/^(?:aula|bloco|parte|video|part)[\s._-]*(\d+)$/i);
    if (suffixNumMatch) {
      const partNum = parseInt(suffixNumMatch[1], 10);
      return `${folderTitle} (Parte ${partNum})`;
    }

    // 3. Just a number: "1", "02", "3"
    const justNumMatch = cleanFileName.match(/^0*(\d+)$/);
    if (justNumMatch) {
      const partNum = parseInt(justNumMatch[1], 10);
      return `${folderTitle} (Parte ${partNum})`;
    }

    // 4. "Parte A", "Bloco B"
    const letterMatch = cleanFileName.match(/^(?:parte|bloco|part)[\s._-]*([a-zA-Z])$/i);
    if (letterMatch) {
      return `${folderTitle} (Parte ${letterMatch[1].toUpperCase()})`;
    }

    // 5. Just "Aula", "Video", "Parte", "Bloco" (single video in folder)
    if (/^(?:aula|video|parte|bloco|part)$/i.test(cleanFileName)) {
      return folderTitle;
    }

    // If fileName already includes the folder title or vice versa
    const lowerFolder = folderTitle.toLowerCase();
    const lowerFile = cleanFileName.toLowerCase();
    if (lowerFile.includes(lowerFolder)) {
      return cleanFileName;
    }
    if (lowerFolder.includes(lowerFile)) {
      return folderTitle;
    }

    // If fileName already has an aula prefix like "Aula 07" or "1. Aula 07"
    if (/^(?:\d+[\s._-]+)?aula\s*\d+/i.test(cleanFileName)) {
      return cleanFileName;
    }

    // Otherwise, combine them naturally
    return `${folderTitle} - ${cleanFileName}`;
  }

  /**
   * Scans a source (local folder or Google Drive remote)
   */
  public async scanSource(
    sourceId: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanProgress> {
    const source = this.sourcesRepo.getById(sourceId);
    if (!source) {
      throw new Error(`Origem não encontrada: ${sourceId}`);
    }

    const scanState = { cancelled: false };
    this.activeScans.set(sourceId, scanState);

    const progress: ScanProgress = {
      sourceId,
      status: 'scanning',
      filesExamined: 0,
      videosFound: 0
    };

    try {
      if (source.source_type === 'local') {
        await this.scanLocalSource(source.root_path, source.id, scanState, progress, onProgress);
        this.reconcileLocalAvailability(source.id, source.root_path);
      } else {
        await this.scanRemoteSource(source.root_path, source.id, scanState, progress, onProgress);
      }

      if (scanState.cancelled) {
        progress.status = 'cancelled';
      } else {
        progress.status = 'completed';
        this.sourcesRepo.updateLastScan(sourceId);
      }
    } catch (err: any) {
      progress.status = 'error';
      progress.error = err.message;
    } finally {
      this.activeScans.delete(sourceId);
      if (onProgress) onProgress(progress);
    }

    return progress;
  }

  private reconcileLocalAvailability(sourceId: string, rootPath: string): void {
    if (!fs.existsSync(rootPath)) return;
    const files = new Map<string, string[]>();
    try {
      for (const entry of fs.readdirSync(rootPath, { recursive: true, withFileTypes: true }) as unknown as fs.Dirent[]) {
        if (!entry.isFile() || !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        const fullPath = path.join(entry.parentPath || rootPath, entry.name);
        const key = `${entry.name.toLowerCase()}:${fs.statSync(fullPath).size}`;
        const matches = files.get(key) || [];
        matches.push(fullPath);
        files.set(key, matches);
      }
    } catch {
      return;
    }

    const lessons = this.db.all<{ id: string; original_path: string; file_size: number }>(`
      SELECT l.id, l.original_path, l.file_size
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE c.source_id = ?
    `, [sourceId]);
    for (const lesson of lessons) {
      if (fs.existsSync(lesson.original_path)) {
        this.lessonsRepo.updateAvailability(lesson.id, true);
        continue;
      }
      const key = `${path.basename(lesson.original_path).toLowerCase()}:${lesson.file_size}`;
      const matches = files.get(key) || [];
      if (matches.length === 1) {
        this.lessonsRepo.updateLocalPath(lesson.id, matches[0]);
        this.lessonsRepo.updateAvailability(lesson.id, true);
      } else {
        this.lessonsRepo.updateAvailability(lesson.id, false);
      }
    }
  }

  /**
   * Persists course structure into the database and prunes obsolete modules/materials
   */
  private saveCourseData(
    courseId: string,
    sourceId: string,
    courseTitle: string,
    rootFolder: string,
    courseData: {
      modules: Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }>;
      materials: Array<{ id: string; course_id: string; module_id?: string; title: string; file_path: string; file_type: string; file_size: number }>;
    }
  ): void {
    if (courseData.modules.length === 0 && courseData.materials.length === 0) return;

    this.db.transaction(() => {
      this.coursesRepo.upsert({
        id: courseId,
        source_id: sourceId,
        title: courseTitle,
        root_folder: rootFolder
      });

      const currentModuleIds: string[] = [];
      const currentMaterialIds: string[] = [];

      for (const mod of courseData.modules) {
        currentModuleIds.push(mod.id);
        this.modulesRepo.upsert({
          id: mod.id,
          course_id: courseId,
          title: mod.title,
          position: mod.position,
          relative_path: mod.relative_path
        });

        for (const les of mod.lessons) {
          this.lessonsRepo.upsert({
            id: les.id,
            module_id: mod.id,
            course_id: courseId,
            title: les.title,
            original_path: les.original_path,
            local_path: les.original_path,
            position: les.position,
            file_size: les.file_size,
            media_type: les.media_type || 'video/mp4'
          });
          this.lessonsRepo.updateAvailability(les.id, fs.existsSync(les.original_path));
        }
      }

      const validModuleIds = new Set(currentModuleIds);
      for (const mat of courseData.materials) {
        currentMaterialIds.push(mat.id);
        const safeModuleId = mat.module_id && validModuleIds.has(mat.module_id) ? mat.module_id : undefined;
        this.materialsRepo.upsert({
          ...mat,
          module_id: safeModuleId
        });
      }

      this.pruneObsoleteRecords('modules', courseId, currentModuleIds);
      this.pruneObsoleteRecords('materials', courseId, currentMaterialIds);
    });
  }

  /**
   * Safely prunes IDs not in active list in chunks without hitting SQLite variable limits
   */
  private pruneObsoleteRecords(table: string, courseId: string, activeIds: string[]): void {
    const existing = this.db.all<{ id: string }>(`SELECT id FROM ${table} WHERE course_id = ?`, [courseId]);
    const activeSet = new Set(activeIds);
    const toDelete = existing.filter(r => !activeSet.has(r.id)).map(r => r.id);

    const CHUNK_SIZE = 400;
    for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
      const chunk = toDelete.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      this.db.run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, chunk);
    }
  }

  /**
   * Local folder recursive scanner
   */
  private async scanLocalSource(
    rootPath: string,
    sourceId: string,
    scanState: { cancelled: boolean },
    progress: ScanProgress,
    onProgress?: (p: ScanProgress) => void
  ): Promise<void> {
    if (!fs.existsSync(rootPath)) {
      throw new Error(`O diretório "${rootPath}" não existe ou está inacessível`);
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });

    const source = this.sourcesRepo.getById(sourceId);
    let isSingleCourse = source?.scan_mode === 'single_course';
    if (!source?.scan_mode) {
      const isDriveRoot = /^[a-zA-Z]:[/\\]?$/.test(rootPath) || rootPath === '/' || rootPath === '\\';
      isSingleCourse = !isDriveRoot;
    }

    if (isSingleCourse) {
      // Index rootPath itself as a single course
      const folderName = path.basename(rootPath);
      const courseTitle = folderName || source?.name || 'Curso';
      const courseId = this.makeStableId('course', rootPath);

      progress.currentFolder = courseTitle;
      if (onProgress) onProgress(progress);

      const courseData = this.scanLocalCourseFolder(rootPath, courseId, scanState, progress, onProgress);
      this.saveCourseData(courseId, sourceId, courseTitle, rootPath, courseData);
      return;
    }

    // Otherwise, treat rootPath as a parent library folder containing multiple course subdirectories
    for (const entry of entries) {
      if (scanState.cancelled) break;

      const fullCoursePath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        const courseTitle = entry.name;
        const courseId = this.makeStableId('course', fullCoursePath);

        progress.currentFolder = courseTitle;
        if (onProgress) onProgress(progress);

        // Scan this course folder
        const courseData = this.scanLocalCourseFolder(fullCoursePath, courseId, scanState, progress, onProgress);
        this.saveCourseData(courseId, sourceId, courseTitle, fullCoursePath, courseData);
      }
    }
  }

  /**
   * Scans a single course directory structure
   */
  private scanLocalCourseFolder(
    coursePath: string,
    courseId: string,
    scanState: { cancelled: boolean },
    progress: ScanProgress,
    onProgress?: (p: ScanProgress) => void
  ): {
    modules: Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }>;
    materials: Array<{ id: string; course_id: string; module_id?: string; title: string; file_path: string; file_type: string; file_size: number }>;
  } {
    const moduleMap = new Map<string, {
      title: string;
      relativePath: string;
      lessons: Array<{
        title: string;
        rawName: string;
        relDir: string;
        fullPath: string;
        size: number;
        media_type: string;
      }>;
      materials: Array<{
        title: string;
        filePath: string;
        fileType: string;
        size: number;
      }>;
    }>();

    const getModuleBucket = (moduleTitle: string, relativePath: string) => {
      if (!moduleMap.has(moduleTitle)) {
        moduleMap.set(moduleTitle, {
          title: moduleTitle,
          relativePath,
          lessons: [],
          materials: []
        });
      }
      return moduleMap.get(moduleTitle)!;
    };

    // Recursive directory walker
    const walk = (currentDir: string, relDir: string) => {
      if (scanState.cancelled) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      entries.sort((a, b) => this.naturalCompare(a.name, b.name));

      for (const entry of entries) {
        if (scanState.cancelled) break;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          const nextRel = relDir === '.' ? entry.name : path.join(relDir, entry.name);
          walk(fullPath, nextRel);
        } else if (entry.isFile()) {
          progress.filesExamined++;
          const ext = path.extname(entry.name).toLowerCase();
          const isVideo = VIDEO_EXTENSIONS.has(ext);
          const isPdf = ext === '.pdf';
          const isMaterial = !!MATERIAL_EXTENSIONS[ext];

          if (!isVideo && !isPdf && !isMaterial) continue;

          // Determine module and subfolders
          const normRelDir = relDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
          const dirSegments = normRelDir && normRelDir !== '.' ? normRelDir.split('/').filter(Boolean) : [];

          let moduleTitle = 'Aulas Gerais';
          let moduleRelPath = '.';
          let subFolders: string[] = [];

          if (dirSegments.length === 0) {
            moduleTitle = 'Aulas Gerais';
            moduleRelPath = '.';
            subFolders = [];
          } else if (dirSegments.length === 1) {
            moduleTitle = dirSegments[0];
            moduleRelPath = dirSegments[0];
            subFolders = [];
          } else {
            // 2 or more segments: top-level folder is the Module/Matéria, inner folders are Aula topics
            moduleTitle = dirSegments[0];
            moduleRelPath = dirSegments[0];
            subFolders = dirSegments.slice(1);
          }

          const bucket = getModuleBucket(moduleTitle, moduleRelPath);
          const rawName = path.parse(entry.name).name;
          const formattedTitle = this.formatLessonTitle(subFolders, rawName);

          let stat: fs.Stats;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            stat = { size: 0 } as fs.Stats;
          }

          if (isVideo) {
            progress.videosFound++;
            bucket.lessons.push({
              title: formattedTitle,
              rawName,
              relDir: normRelDir,
              fullPath,
              size: stat.size,
              media_type: 'video/mp4'
            });
          } else if (isPdf) {
            bucket.materials.push({
              title: entry.name,
              filePath: fullPath,
              fileType: 'pdf',
              size: stat.size
            });
            bucket.lessons.push({
              title: formattedTitle,
              rawName,
              relDir: normRelDir,
              fullPath,
              size: stat.size,
              media_type: 'application/pdf'
            });
          } else if (isMaterial) {
            bucket.materials.push({
              title: entry.name,
              filePath: fullPath,
              fileType: MATERIAL_EXTENSIONS[ext] || 'other',
              size: stat.size
            });
          }
        }
      }
    };

    walk(coursePath, '.');

    if (onProgress) onProgress(progress);

    // Sort modules naturally by relativePath
    const sortedBuckets = Array.from(moduleMap.values()).sort((a, b) => {
      if (a.relativePath === '.') return -1;
      if (b.relativePath === '.') return 1;
      return this.naturalCompare(a.relativePath, b.relativePath);
    });

    const modules: Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }> = [];
    const materials: Array<{ id: string; course_id: string; module_id?: string; title: string; file_path: string; file_type: string; file_size: number }> = [];

    let modulePos = 1;
    for (const bucket of sortedBuckets) {
      if (bucket.lessons.length === 0 && bucket.materials.length === 0) continue;

      const modId = this.makeStableId('mod', courseId, bucket.title);

      // Sort lessons naturally: by folder path first, then by filename
      bucket.lessons.sort((a, b) => {
        const dirDiff = this.naturalCompare(a.relDir, b.relDir);
        if (dirDiff !== 0) return dirDiff;
        return this.naturalCompare(a.rawName, b.rawName);
      });

      modules.push({
        id: modId,
        title: bucket.title,
        position: modulePos++,
        relative_path: bucket.relativePath,
        lessons: bucket.lessons.map((v, idx) => {
          const existing = this.lessonsRepo.getByCourseAndPath(courseId, v.fullPath);
          const lesId = existing ? existing.id : this.makeStableId('les', courseId, v.fullPath);
          return {
            id: lesId,
            title: v.title,
            original_path: v.fullPath,
            position: idx + 1,
            file_size: v.size,
            media_type: v.media_type
          };
        })
      });

      for (const mat of bucket.materials) {
        materials.push({
          id: this.makeStableId('mat', courseId, mat.filePath),
          course_id: courseId,
          module_id: modId,
          title: mat.title,
          file_path: mat.filePath,
          file_type: mat.fileType,
          file_size: mat.size
        });
      }
    }

    return { modules, materials };
  }

  /**
   * Remote Google Drive scanner using Rclone structured JSON output
   */
  private async scanRemoteSource(
    remoteRoot: string,
    sourceId: string,
    scanState: { cancelled: boolean },
    progress: ScanProgress,
    onProgress?: (p: ScanProgress) => void
  ): Promise<void> {
    const settings = this.settingsRepo.getAll();
    const rclonePath = settings.rclonePath || 'rclone';

    // List all files recursively in structured JSON
    const cachePath = path.join(this.remoteCacheDir, `${crypto.createHash('sha1').update(remoteRoot).digest('hex')}.json`);
    let items: any[];
    try {
      items = await this.rcloneService.listJson(rclonePath, remoteRoot, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({ cachedAt: new Date().toISOString(), items }), 'utf8');
    } catch (error) {
      if (!fs.existsSync(cachePath)) throw error;
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      items = Array.isArray(cached.items) ? cached.items : [];
      progress.error = 'Rclone indisponível; usando metadados armazenados localmente.';
    }

    // Group items into Course -> Module -> Lessons and Materials
    const courseMap = new Map<string, {
      rootFolder: string;
      modules: Map<string, {
        title: string;
        relativePath: string;
        lessons: Array<{
          title: string;
          rawName: string;
          relDir: string;
          remotePath: string;
          size: number;
          mediaType: string;
        }>;
      }>;
      materials: Array<{
        title: string;
        filePath: string;
        fileType: string;
        size: number;
        moduleTitle: string;
      }>;
    }>();

    // Check if remoteRoot represents a single course or collection
    const source = this.sourcesRepo.getById(sourceId);
    const cleanSub = remoteRoot.replace(/^[a-zA-Z0-9_\-]+:/, '').replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '');
    const folderBaseName = cleanSub ? cleanSub.split(/[\/\\]/).filter(Boolean).pop() || '' : '';
    
    // Check scan_mode: default to single_course if folderBaseName exists, or if scan_mode === 'single_course'
    let isSingleCourse = source?.scan_mode === 'single_course';
    if (!source?.scan_mode) {
      isSingleCourse = !!folderBaseName;
    }

    for (const item of items) {
      if (scanState.cancelled) break;
      progress.filesExamined++;

      if (item.IsDir) continue;

      const ext = path.extname(item.Name).toLowerCase();
      const isVideo = VIDEO_EXTENSIONS.has(ext);
      const isPdf = ext === '.pdf';
      const isMaterial = !!MATERIAL_EXTENSIONS[ext];

      if (!isVideo && !isMaterial && !isPdf) continue;

      // Split normalized path
      const parts = item.Path.split(/[\/\\]/).filter(Boolean);
      let courseName = '';
      let courseRelParts: string[] = [];
      let courseRootFolder = '';

      if (isSingleCourse) {
        courseName = folderBaseName || source?.name || 'Curso';
        courseRelParts = parts;
        courseRootFolder = remoteRoot;
      } else {
        if (parts.length <= 1) {
          courseName = folderBaseName || source?.name || 'Aulas Principais';
          courseRelParts = parts;
          courseRootFolder = remoteRoot;
        } else {
          courseName = parts[0];
          courseRelParts = parts.slice(1);
          courseRootFolder = `${remoteRoot}/${courseName}`;
        }
      }

      const dirSegments = courseRelParts.slice(0, -1);
      let moduleTitle = 'Aulas Gerais';
      let moduleRelPath = '.';
      let subFolders: string[] = [];

      if (dirSegments.length === 0) {
        moduleTitle = 'Aulas Gerais';
        moduleRelPath = '.';
        subFolders = [];
      } else if (dirSegments.length === 1) {
        moduleTitle = dirSegments[0];
        moduleRelPath = dirSegments[0];
        subFolders = [];
      } else {
        // 2 or more segments: top-level is the Module/Matéria, inner folders are Aula topics
        moduleTitle = dirSegments[0];
        moduleRelPath = dirSegments[0];
        subFolders = dirSegments.slice(1);
      }

      const rawName = path.parse(item.Name).name;
      const formattedTitle = this.formatLessonTitle(subFolders, rawName);
      const normRelDir = dirSegments.join('/');
      const fullRemotePath = `${remoteRoot}/${item.Path}`.replace(/\/+/g, '/');

      if (!courseMap.has(courseName)) {
        courseMap.set(courseName, {
          rootFolder: courseRootFolder,
          modules: new Map(),
          materials: []
        });
      }
      const courseEntry = courseMap.get(courseName)!;

      if (!courseEntry.modules.has(moduleTitle)) {
        courseEntry.modules.set(moduleTitle, {
          title: moduleTitle,
          relativePath: moduleRelPath,
          lessons: []
        });
      }
      const modBucket = courseEntry.modules.get(moduleTitle)!;

      if (isVideo || isPdf) {
        if (isVideo) progress.videosFound++;

        modBucket.lessons.push({
          title: formattedTitle,
          rawName,
          relDir: normRelDir,
          remotePath: fullRemotePath,
          size: item.Size || 0,
          mediaType: isPdf ? 'application/pdf' : 'video/mp4'
        });
      }

      if (isMaterial || isPdf) {
        courseEntry.materials.push({
          title: item.Name,
          filePath: fullRemotePath,
          fileType: isPdf ? 'pdf' : (MATERIAL_EXTENSIONS[ext] || 'other'),
          size: item.Size || 0,
          moduleTitle
        });
      }
    }

    if (onProgress) onProgress(progress);

    // Save to database
    this.db.transaction(() => {
      for (const [courseTitle, courseEntry] of courseMap.entries()) {
        const courseId = this.makeStableId('course', courseEntry.rootFolder);

        this.coursesRepo.upsert({
          id: courseId,
          source_id: sourceId,
          title: courseTitle,
          root_folder: courseEntry.rootFolder
        });

        const currentModuleIds: string[] = [];
        const currentMaterialIds: string[] = [];

        // Sort modules naturally
        const sortedModules = Array.from(courseEntry.modules.values()).sort((a, b) => {
          if (a.relativePath === '.') return -1;
          if (b.relativePath === '.') return 1;
          return this.naturalCompare(a.relativePath, b.relativePath);
        });

        let modPos = 1;
        for (const mod of sortedModules) {
          const modMaterials = courseEntry.materials.filter(m => m.moduleTitle === mod.title);
          if (mod.lessons.length === 0 && modMaterials.length === 0) continue;

          const modId = this.makeStableId('mod', courseId, mod.title);
          currentModuleIds.push(modId);

          this.modulesRepo.upsert({
            id: modId,
            course_id: courseId,
            title: mod.title,
            position: modPos++,
            relative_path: mod.relativePath
          });

          // Sort lessons naturally: by folder first, then by filename
          mod.lessons.sort((a, b) => {
            const dirDiff = this.naturalCompare(a.relDir, b.relDir);
            if (dirDiff !== 0) return dirDiff;
            return this.naturalCompare(a.rawName, b.rawName);
          });

          let lesPos = 1;
          for (const les of mod.lessons) {
            const existing = this.lessonsRepo.getByCourseAndPath(courseId, les.remotePath);
            const lesId = existing ? existing.id : this.makeStableId('les', courseId, les.remotePath);

            this.lessonsRepo.upsert({
              id: lesId,
              module_id: modId,
              course_id: courseId,
              title: les.title,
              original_path: les.remotePath,
              remote_path: les.remotePath,
              position: lesPos++,
              file_size: les.size,
              media_type: les.mediaType || 'video/mp4'
            });
          }
        }

        const validModuleIds = new Set(currentModuleIds);
        for (const mat of courseEntry.materials) {
          const matId = this.makeStableId('mat', courseId, mat.filePath);
          currentMaterialIds.push(matId);
          const targetModId = mat.moduleTitle ? this.makeStableId('mod', courseId, mat.moduleTitle) : undefined;
          const safeModId = targetModId && validModuleIds.has(targetModId) ? targetModId : undefined;

          this.materialsRepo.upsert({
            id: matId,
            course_id: courseId,
            module_id: safeModId,
            title: mat.title,
            file_path: mat.filePath,
            file_type: mat.fileType,
            file_size: mat.size
          });
        }

        this.pruneObsoleteRecords('modules', courseId, currentModuleIds);
        this.pruneObsoleteRecords('materials', courseId, currentMaterialIds);
      }
    });
  }
}
