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

  private constructor() {}

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
   * Natural sort comparison for filenames and numbers
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
      const courseId = this.makeStableId('course', sourceId, courseTitle);

      progress.currentFolder = courseTitle;
      if (onProgress) onProgress(progress);

      const courseData = this.scanLocalCourseFolder(rootPath, courseId, scanState, progress, onProgress);

      if (courseData.modules.length > 0 || courseData.materials.length > 0) {
        this.db.transaction(() => {
          this.coursesRepo.upsert({
            id: courseId,
            source_id: sourceId,
            title: courseTitle,
            root_folder: rootPath
          });

          for (const mod of courseData.modules) {
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
            }
          }

          for (const mat of courseData.materials) {
            this.materialsRepo.upsert(mat);
          }
        });
      }
      return;
    }

    // Otherwise, treat rootPath as a parent library folder containing multiple course subdirectories
    for (const entry of entries) {
      if (scanState.cancelled) break;

      const fullCoursePath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        const courseTitle = entry.name;
        const courseId = this.makeStableId('course', sourceId, courseTitle);

        progress.currentFolder = courseTitle;
        if (onProgress) onProgress(progress);

        // Scan this course folder
        const courseData = this.scanLocalCourseFolder(fullCoursePath, courseId, scanState, progress, onProgress);

        if (courseData.modules.length > 0 || courseData.materials.length > 0) {
          this.db.transaction(() => {
            this.coursesRepo.upsert({
              id: courseId,
              source_id: sourceId,
              title: courseTitle,
              root_folder: fullCoursePath
            });

            for (const mod of courseData.modules) {
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
              }
            }

            for (const mat of courseData.materials) {
              this.materialsRepo.upsert(mat);
            }
          });
        }
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
    const modules: Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }> = [];
    const materials: Array<{ id: string; course_id: string; module_id?: string; title: string; file_path: string; file_type: string; file_size: number }> = [];

    // Map of relative directory -> lessons and materials in that directory
    const dirMap = new Map<string, {
      lessons: Array<{ name: string; fullPath: string; size: number; media_type: string }>;
      materials: Array<{ title: string; filePath: string; fileType: string; size: number }>;
    }>();

    const getDirBucket = (relDir: string) => {
      const normalized = relDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || '.';
      if (!dirMap.has(normalized)) {
        dirMap.set(normalized, { lessons: [], materials: [] });
      }
      return dirMap.get(normalized)!;
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
          const bucket = getDirBucket(relDir);

          if (VIDEO_EXTENSIONS.has(ext)) {
            progress.videosFound++;
            const stat = fs.statSync(fullPath);
            bucket.lessons.push({
              name: path.parse(entry.name).name,
              fullPath,
              size: stat.size,
              media_type: 'video/mp4'
            });
          } else if (ext === '.pdf') {
            const stat = fs.statSync(fullPath);
            bucket.materials.push({
              title: entry.name,
              filePath: fullPath,
              fileType: 'pdf',
              size: stat.size
            });
            // Also add as a lesson of this module!
            bucket.lessons.push({
              name: path.parse(entry.name).name,
              fullPath,
              size: stat.size,
              media_type: 'application/pdf'
            });
          } else if (MATERIAL_EXTENSIONS[ext]) {
            const stat = fs.statSync(fullPath);
            bucket.materials.push({
              title: entry.name,
              filePath: fullPath,
              fileType: MATERIAL_EXTENSIONS[ext],
              size: stat.size
            });
          }
        }
      }
    };

    walk(coursePath, '.');

    if (onProgress) onProgress(progress);

    // Sort relative directories naturally (root '.' comes first)
    const sortedDirs = Array.from(dirMap.keys()).sort((a, b) => {
      if (a === '.') return -1;
      if (b === '.') return 1;
      return this.naturalCompare(a, b);
    });

    let modulePos = 1;
    for (const relDir of sortedDirs) {
      const bucket = dirMap.get(relDir)!;
      if (bucket.lessons.length === 0 && bucket.materials.length === 0) continue;

      const modTitle = relDir === '.' ? 'Aulas Gerais' : relDir.replace(/\\/g, ' / ');
      const modId = this.makeStableId('mod', courseId, relDir);

      bucket.lessons.sort((a, b) => this.naturalCompare(a.name, b.name));

      modules.push({
        id: modId,
        title: modTitle,
        position: modulePos++,
        relative_path: relDir,
        lessons: bucket.lessons.map((v, idx) => ({
          id: this.makeStableId('les', modId, v.name),
          title: v.name,
          original_path: v.fullPath,
          position: idx + 1,
          file_size: v.size,
          media_type: v.media_type
        }))
      });

      for (const mat of bucket.materials) {
        materials.push({
          id: this.makeStableId('mat', courseId, relDir, mat.title),
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
    const items = await this.rcloneService.listJson(rclonePath, remoteRoot, { recursive: true });

    // Group items into Course -> Module -> Lessons and Materials
    const courseMap = new Map<string, Map<string, Array<{ title: string; remotePath: string; size: number; mediaType: string }>>>();
    const remoteMaterials: Array<{ id: string; course_id: string; title: string; file_path: string; file_type: string; file_size: number }> = [];

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
      const parts = item.Path.split(/[\/\\]/);
      let courseName = '';
      let moduleName = 'Aulas Gerais';
      let itemTitle = path.parse(item.Name).name;

      if (isSingleCourse) {
        courseName = folderBaseName || source?.name || 'Curso';
        if (parts.length === 1) {
          moduleName = 'Aulas Gerais';
        } else {
          // All parent directories become the module title, preserving origin structure!
          moduleName = parts.slice(0, -1).join(' / ');
        }
      } else {
        if (parts.length === 1) {
          courseName = folderBaseName || source?.name || 'Aulas Principais';
          moduleName = 'Módulo Único';
        } else if (parts.length === 2) {
          courseName = parts[0];
          moduleName = 'Aulas Gerais';
        } else {
          courseName = parts[0];
          moduleName = parts.slice(1, -1).join(' / ');
          itemTitle = path.parse(parts[parts.length - 1]).name;
        }
      }

      const fullRemotePath = `${remoteRoot}/${item.Path}`.replace(/\/+/g, '/');
      const courseId = this.makeStableId('course', sourceId, courseName);

      if (isVideo || isPdf) {
        if (isVideo) progress.videosFound++;

        if (!courseMap.has(courseName)) {
          courseMap.set(courseName, new Map());
        }
        const modulesMap = courseMap.get(courseName)!;
        if (!modulesMap.has(moduleName)) {
          modulesMap.set(moduleName, []);
        }

        modulesMap.get(moduleName)!.push({
          title: itemTitle,
          remotePath: fullRemotePath,
          size: item.Size || 0,
          mediaType: isPdf ? 'application/pdf' : 'video/mp4'
        });
      }

      if (isMaterial || isPdf) {
        remoteMaterials.push({
          id: this.makeStableId('mat', courseId, item.Name),
          course_id: courseId,
          title: item.Name,
          file_path: fullRemotePath,
          file_type: isPdf ? 'pdf' : (MATERIAL_EXTENSIONS[ext] || 'other'),
          file_size: item.Size || 0
        });
      }
    }

    if (onProgress) onProgress(progress);

    // Save to database
    this.db.transaction(() => {
      for (const [courseTitle, modulesMap] of courseMap.entries()) {
        const courseId = this.makeStableId('course', sourceId, courseTitle);

        this.coursesRepo.upsert({
          id: courseId,
          source_id: sourceId,
          title: courseTitle,
          root_folder: isSingleCourse ? remoteRoot : `${remoteRoot}/${courseTitle}`
        });

        let modPos = 1;
        for (const [moduleTitle, lessons] of modulesMap.entries()) {
          const modId = this.makeStableId('mod', courseId, moduleTitle);

          this.modulesRepo.upsert({
            id: modId,
            course_id: courseId,
            title: moduleTitle,
            position: modPos++,
            relative_path: moduleTitle
          });

          // Sort lessons naturally
          lessons.sort((a, b) => this.naturalCompare(a.title, b.title));

          let lesPos = 1;
          for (const les of lessons) {
            const lesId = this.makeStableId('les', modId, les.title);
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
      }

      for (const mat of remoteMaterials) {
        this.materialsRepo.upsert(mat);
      }
    });
  }
}
