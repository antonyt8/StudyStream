import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SourcesRepository } from '../database/repositories/sources.repo';
import { CoursesRepository } from '../database/repositories/courses.repo';
import { ModulesRepository } from '../database/repositories/modules.repo';
import { LessonsRepository } from '../database/repositories/lessons.repo';
import { SettingsRepository } from '../database/repositories/settings.repo';
import { RcloneService } from './rclone.service';
import { DatabaseService } from '../database/connection';
import { ScanProgress } from '../types';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.mpeg', '.mpg', '.wmv']);

export class LibraryService {
  private static instance: LibraryService | null = null;
  private sourcesRepo = new SourcesRepository();
  private coursesRepo = new CoursesRepository();
  private modulesRepo = new ModulesRepository();
  private lessonsRepo = new LessonsRepository();
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

    // Inspect entries in rootPath
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });

    // Separate course folders or root files
    for (const entry of entries) {
      if (scanState.cancelled) break;

      const fullCoursePath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        const courseTitle = entry.name;
        const courseId = this.makeStableId('course', sourceId, courseTitle);

        progress.currentFolder = courseTitle;
        if (onProgress) onProgress(progress);

        // Scan this course folder
        const courseModules = this.scanLocalCourseFolder(fullCoursePath, courseId, scanState, progress, onProgress);

        if (courseModules.length > 0) {
          // Commit course and modules to DB in a single transaction
          this.db.transaction(() => {
            this.coursesRepo.upsert({
              id: courseId,
              source_id: sourceId,
              title: courseTitle,
              root_folder: fullCoursePath
            });

            for (const mod of courseModules) {
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
                  file_size: les.file_size
                });
              }
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
  ): Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }> {
    const modules: Array<{ id: string; title: string; position: number; relative_path: string; lessons: any[] }> = [];

    const rootEntries = fs.readdirSync(coursePath, { withFileTypes: true });
    
    // Sort entries naturally
    rootEntries.sort((a, b) => this.naturalCompare(a.name, b.name));

    const directVideos: any[] = [];
    const subfolderEntries: fs.Dirent[] = [];

    for (const entry of rootEntries) {
      progress.filesExamined++;
      const fullPath = path.join(coursePath, entry.name);

      if (entry.isDirectory()) {
        subfolderEntries.push(entry);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          progress.videosFound++;
          const stat = fs.statSync(fullPath);
          directVideos.push({
            name: path.parse(entry.name).name,
            fullPath,
            size: stat.size
          });
        }
      }
    }

    if (onProgress) onProgress(progress);

    let modulePos = 1;

    // If there are direct video files in the course folder
    if (directVideos.length > 0) {
      const defaultModId = this.makeStableId('mod', courseId, 'Aulas Gerais');
      directVideos.sort((a, b) => this.naturalCompare(a.name, b.name));

      modules.push({
        id: defaultModId,
        title: 'Aulas Gerais',
        position: modulePos++,
        relative_path: '.',
        lessons: directVideos.map((v, idx) => ({
          id: this.makeStableId('les', defaultModId, v.name),
          title: v.name,
          original_path: v.fullPath,
          position: idx + 1,
          file_size: v.size
        }))
      });
    }

    // Process subfolders as modules
    for (const sub of subfolderEntries) {
      if (scanState.cancelled) break;

      const subPath = path.join(coursePath, sub.name);
      const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
      subEntries.sort((a, b) => this.naturalCompare(a.name, b.name));

      const moduleVideos: any[] = [];

      for (const file of subEntries) {
        progress.filesExamined++;
        const filePath = path.join(subPath, file.name);

        if (file.isFile()) {
          const ext = path.extname(file.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            progress.videosFound++;
            const stat = fs.statSync(filePath);
            moduleVideos.push({
              name: path.parse(file.name).name,
              fullPath: filePath,
              size: stat.size
            });
          }
        }
      }

      if (moduleVideos.length > 0) {
        const modId = this.makeStableId('mod', courseId, sub.name);
        moduleVideos.sort((a, b) => this.naturalCompare(a.name, b.name));

        modules.push({
          id: modId,
          title: sub.name,
          position: modulePos++,
          relative_path: sub.name,
          lessons: moduleVideos.map((v, idx) => ({
            id: this.makeStableId('les', modId, v.name),
            title: v.name,
            original_path: v.fullPath,
            position: idx + 1,
            file_size: v.size
          }))
        });
      }
    }

    return modules;
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

    // Group items into Course -> Module -> Lessons
    // Item Path is relative to remoteRoot e.g. "JavaScript Master/01 - Introducao/01 - Boas vindas.mp4"
    const courseMap = new Map<string, Map<string, Array<{ title: string; remotePath: string; size: number }>>>();

    for (const item of items) {
      if (scanState.cancelled) break;
      progress.filesExamined++;

      if (item.IsDir) continue;

      const ext = path.extname(item.Name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) continue;

      progress.videosFound++;

      // Split normalized path
      const parts = item.Path.split(/[/\\]/);
      let courseName = '';
      let moduleName = 'Aulas Gerais';
      const lessonTitle = path.parse(item.Name).name;

      if (parts.length === 1) {
        // Video directly in root
        courseName = 'Aulas Principais';
        moduleName = 'Módulo Único';
      } else if (parts.length === 2) {
        // Course/Lesson.mp4
        courseName = parts[0];
        moduleName = 'Aulas Gerais';
      } else {
        // Course/Module/.../Lesson.mp4
        courseName = parts[0];
        moduleName = parts[1];
      }

      if (!courseMap.has(courseName)) {
        courseMap.set(courseName, new Map());
      }
      const modulesMap = courseMap.get(courseName)!;
      if (!modulesMap.has(moduleName)) {
        modulesMap.set(moduleName, []);
      }

      const fullRemotePath = `${remoteRoot}/${item.Path}`.replace(/\/+/g, '/');
      modulesMap.get(moduleName)!.push({
        title: lessonTitle,
        remotePath: fullRemotePath,
        size: item.Size
      });
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
          root_folder: `${remoteRoot}/${courseTitle}`
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
              file_size: les.size
            });
          }
        }
      }
    });
  }
}
