import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseService } from '../electron/database/connection';
import { SourcesRepository } from '../electron/database/repositories/sources.repo';
import { CoursesRepository } from '../electron/database/repositories/courses.repo';
import { LibraryService } from '../electron/services/library.service';

describe('Library Service Indexing Tests', () => {
  const tempDir = path.join(os.tmpdir(), `studystream_lib_test_${Date.now()}`);
  const dbPath = path.join(tempDir, 'test_lib.db');
  const coursesFolder = path.join(tempDir, 'Cursos');

  beforeAll(async () => {
    // 1. Create temporary folders structure:
    // Cursos/
    //   Curso Python/
    //     01 - Introducao/
    //       Aula 01.mp4
    //       Aula 02.mkv
    //     02 - Estruturas/
    //       Aula 01.webm
    const course1 = path.join(coursesFolder, 'Curso Python');
    const mod1 = path.join(course1, '01 - Introducao');
    const mod2 = path.join(course1, '02 - Estruturas');

    fs.mkdirSync(mod1, { recursive: true });
    fs.mkdirSync(mod2, { recursive: true });

    // Dummy video files
    fs.writeFileSync(path.join(mod1, 'Aula 01.mp4'), 'dummy video data');
    fs.writeFileSync(path.join(mod1, 'Aula 02.mkv'), 'dummy video data');
    fs.writeFileSync(path.join(mod2, 'Aula 01.webm'), 'dummy video data');

    // Also a direct video file in Course 2
    const course2 = path.join(coursesFolder, 'Curso Git');
    fs.mkdirSync(course2, { recursive: true });
    fs.writeFileSync(path.join(course2, '01 - Boas vindas.mp4'), 'dummy video data');

    const db = DatabaseService.getInstance();
    await db.initialize(dbPath);
  });

  afterAll(() => {
    DatabaseService.getInstance().close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should scan local folder, group into courses and modules naturally', async () => {
    const sourcesRepo = new SourcesRepository();
    const coursesRepo = new CoursesRepository();
    const libraryService = LibraryService.getInstance();

    const sourceId = 'src_lib_test';
    sourcesRepo.create({
      id: sourceId,
      name: 'Origem de Teste Local',
      source_type: 'local',
      root_path: coursesFolder,
      scan_mode: 'multi_course',
      enabled: 1
    });

    const progress = await libraryService.scanSource(sourceId);
    expect(progress.status).toBe('completed');
    expect(progress.videosFound).toBe(4);
    expect(progress.filesExamined).toBeGreaterThanOrEqual(4);

    // Verify courses in DB
    const courses = coursesRepo.list({ sourceId });
    expect(courses.length).toBe(2);

    const pythonCourse = courses.find(c => c.title === 'Curso Python');
    expect(pythonCourse).toBeDefined();

    const details = coursesRepo.getFullCourse(pythonCourse!.id);
    expect(details?.modules.length).toBe(2);
    expect(details?.modules[0].title).toBe('01 - Introducao');
    expect(details?.modules[0].lessons?.length).toBe(2);
    expect(details?.modules[1].title).toBe('02 - Estruturas');
    expect(details?.modules[1].lessons?.length).toBe(1);
  });

  it('should preserve the exact folder name as the course name when indexing a single course folder', async () => {
    const sourcesRepo = new SourcesRepository();
    const coursesRepo = new CoursesRepository();
    const libraryService = LibraryService.getInstance();

    const singleCoursePath = path.join(coursesFolder, 'Curso Python');
    const sourceId = 'src_single_course_test';

    // Source name is different from folder name, single_course mode
    sourcesRepo.create({
      id: sourceId,
      name: 'Nome de Origem Genérico',
      source_type: 'local',
      root_path: singleCoursePath,
      scan_mode: 'single_course',
      enabled: 1
    });

    const progress = await libraryService.scanSource(sourceId);
    expect(progress.status).toBe('completed');

    // The course title MUST be the folder name 'Curso Python', NOT 'Nome de Origem Genérico'
    // and its subfolders must be modules inside this course
    const courses = coursesRepo.list({ sourceId });
    expect(courses.length).toBe(1);
    expect(courses[0].title).toBe('Curso Python');

    const details = coursesRepo.getFullCourse(courses[0].id);
    expect(details?.modules.length).toBe(2);
    expect(details?.modules.some(m => m.title === '01 - Introducao')).toBe(true);
    expect(details?.modules.some(m => m.title === '02 - Estruturas')).toBe(true);
  });

  it('should format lesson titles cleanly when files are in subfolders', () => {
    const libraryService = LibraryService.getInstance();

    // 1. "1. Aula" -> "(Parte 1)"
    expect(
      libraryService.formatLessonTitle(
        ['7. Aula 07 - Direitos Fundamentais - Direito à Vida'],
        '1. Aula'
      )
    ).toBe('7. Aula 07 - Direitos Fundamentais - Direito à Vida (Parte 1)');

    // 2. "2. Aula" -> "(Parte 2)"
    expect(
      libraryService.formatLessonTitle(
        ['7. Aula 07 - Direitos Fundamentais - Direito à Vida'],
        '2. Aula'
      )
    ).toBe('7. Aula 07 - Direitos Fundamentais - Direito à Vida (Parte 2)');

    // 3. Just "Aula" -> does not duplicate "Aula"
    expect(
      libraryService.formatLessonTitle(
        ['7. Aula 07 - Direitos Fundamentais - Direito à Vida'],
        'Aula'
      )
    ).toBe('7. Aula 07 - Direitos Fundamentais - Direito à Vida');

    // 4. Detailed file title with aula prefix preserved
    expect(
      libraryService.formatLessonTitle(
        ['7. Aula 07 - Direitos Fundamentais - Direito à Vida'],
        '1. Aula 07 - Direito.08.25'
      )
    ).toBe('1. Aula 07 - Direito.08.25');

    // 5. Empty subfolders (standard 2-level course) -> unchanged
    expect(
      libraryService.formatLessonTitle([], '01 - Introducao')
    ).toBe('01 - Introducao');
  });

  it('should properly group 3-level folder structure into subjects as modules and preserve lesson parts', async () => {
    const sourcesRepo = new SourcesRepository();
    const coursesRepo = new CoursesRepository();
    const libraryService = LibraryService.getInstance();

    // Create 3-level directory matching user's exact course:
    // Combo PM AL - Soldado/
    //   22. ▹ Teoria _ Direito Constitucional (Prof. Juliano Yamakaw)/
    //     1. Aula 01 - Teoria dos Direitos Fundamentais/
    //       1. Aula.mp4
    //       2. Aula.mp4
    //     7. Aula 07 - Direitos Fundamentais - Direito à Vida/
    //       1. Aula.mp4
    //       2. Aula.mp4
    //       1. Aula 07 - Direito.08.25.pdf
    //   23. ▹ Teoria _ Direito Administrativo/
    //     1. Aula 01 - Introducao/
    //       1. Aula.mp4
    const pmalDir = path.join(tempDir, 'Combo PM AL - Soldado');
    const constDir = path.join(pmalDir, '22. ▹ Teoria _ Direito Constitucional (Prof. Juliano Yamakaw)');
    const aula01Dir = path.join(constDir, '1. Aula 01 - Teoria dos Direitos Fundamentais');
    const aula07Dir = path.join(constDir, '7. Aula 07 - Direitos Fundamentais - Direito à Vida');

    const adminDir = path.join(pmalDir, '23. ▹ Teoria _ Direito Administrativo');
    const adminAula01Dir = path.join(adminDir, '1. Aula 01 - Introducao');

    fs.mkdirSync(aula01Dir, { recursive: true });
    fs.mkdirSync(aula07Dir, { recursive: true });
    fs.mkdirSync(adminAula01Dir, { recursive: true });

    fs.writeFileSync(path.join(aula01Dir, '1. Aula.mp4'), 'video part 1');
    fs.writeFileSync(path.join(aula01Dir, '2. Aula.mp4'), 'video part 2');
    fs.writeFileSync(path.join(aula07Dir, '1. Aula.mp4'), 'video part 1');
    fs.writeFileSync(path.join(aula07Dir, '2. Aula.mp4'), 'video part 2');
    fs.writeFileSync(path.join(aula07Dir, '1. Aula 07 - Direito.08.25.pdf'), 'pdf content');
    fs.writeFileSync(path.join(aula07Dir, 'descricao.md'), '# Resumo da aula');

    fs.writeFileSync(path.join(adminAula01Dir, '1. Aula.mp4'), 'admin video');

    const sourceId = 'src_pmal_hierarchy_test';
    sourcesRepo.create({
      id: sourceId,
      name: 'Combo PM AL',
      source_type: 'local',
      root_path: pmalDir,
      scan_mode: 'single_course',
      enabled: 1
    });

    const progress = await libraryService.scanSource(sourceId);
    expect(progress.status).toBe('completed');
    expect(progress.videosFound).toBe(5);

    const courses = coursesRepo.list({ sourceId });
    expect(courses.length).toBe(1);
    expect(courses[0].title).toBe('Combo PM AL - Soldado');

    const details = coursesRepo.getFullCourse(courses[0].id);
    expect(details).toBeDefined();

    // MUST only be 2 modules (the subjects), NOT 3 or 4 fragmented modules!
    expect(details?.modules.length).toBe(2);
    expect(details?.modules[0].title).toBe('22. ▹ Teoria _ Direito Constitucional (Prof. Juliano Yamakaw)');
    expect(details?.modules[1].title).toBe('23. ▹ Teoria _ Direito Administrativo');

    // In Direito Constitucional module: 4 video parts + 1 PDF lesson = 5 lessons
    const constModule = details?.modules[0];
    expect(constModule?.lessons?.length).toBe(5);

    // Lessons must have formatted titles with part numbers
    const lessonTitles = constModule?.lessons?.map(l => l.title) || [];
    expect(lessonTitles).toContain('1. Aula 01 - Teoria dos Direitos Fundamentais (Parte 1)');
    expect(lessonTitles).toContain('1. Aula 01 - Teoria dos Direitos Fundamentais (Parte 2)');
    expect(lessonTitles).toContain('7. Aula 07 - Direitos Fundamentais - Direito à Vida (Parte 1)');
    expect(lessonTitles).toContain('7. Aula 07 - Direitos Fundamentais - Direito à Vida (Parte 2)');

    // In materials:
    expect(details?.materials.some(m => m.title === '1. Aula 07 - Direito.08.25.pdf')).toBe(true);
    expect(details?.materials.some(m => m.title === 'descricao.md')).toBe(true);
  });
});

