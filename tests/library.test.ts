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
});
