import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseService } from '../electron/database/connection';
import { SourcesRepository } from '../electron/database/repositories/sources.repo';
import { CoursesRepository } from '../electron/database/repositories/courses.repo';
import { ModulesRepository } from '../electron/database/repositories/modules.repo';
import { LessonsRepository } from '../electron/database/repositories/lessons.repo';
import { ProgressRepository } from '../electron/database/repositories/progress.repo';
import { SessionsRepository } from '../electron/database/repositories/sessions.repo';
import { NotesRepository } from '../electron/database/repositories/notes.repo';
import { BookmarksRepository } from '../electron/database/repositories/bookmarks.repo';
import { GoalsRepository } from '../electron/database/repositories/goals.repo';
import { TasksRepository } from '../electron/database/repositories/tasks.repo';
import { MaterialsRepository } from '../electron/database/repositories/materials.repo';
import { CustomListsRepository } from '../electron/database/repositories/lists.repo';
import { SettingsRepository } from '../electron/database/repositories/settings.repo';

describe('Database and Repositories Integration Tests', () => {
  const testDbDir = path.join(os.tmpdir(), `studystream_test_${Date.now()}`);
  const testDbPath = path.join(testDbDir, 'test_studystream.db');
  let dbService: DatabaseService;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    dbService = DatabaseService.getInstance();
    await dbService.initialize(testDbPath);
  });

  afterAll(() => {
    dbService.close();
    if (fs.existsSync(testDbDir)) {
      try {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should initialize database and verify SQLite integrity', () => {
    const integrity = dbService.checkIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.message).toBe('ok');
  });

  it('should manage sources correctly', () => {
    const sourcesRepo = new SourcesRepository();
    sourcesRepo.create({
      id: 'src_test_1',
      name: 'Pasta Local de Teste',
      source_type: 'local',
      root_path: 'C:\\TestCourses',
      enabled: 1
    });

    const list = sourcesRepo.list();
    expect(list.some(s => s.id === 'src_test_1')).toBe(true);

    const found = sourcesRepo.getById('src_test_1');
    expect(found?.name).toBe('Pasta Local de Teste');
  });

  it('should manage courses, modules and lessons hierarchy', () => {
    const coursesRepo = new CoursesRepository();
    const modulesRepo = new ModulesRepository();
    const lessonsRepo = new LessonsRepository();

    // 1. Course
    coursesRepo.upsert({
      id: 'course_test_1',
      source_id: 'src_test_1',
      title: 'Dominando TypeScript 2026',
      instructor: 'Engenheiro Sênior',
      root_folder: 'C:\\TestCourses\\TypeScript'
    });

    // 2. Module
    modulesRepo.upsert({
      id: 'mod_test_1',
      course_id: 'course_test_1',
      title: 'Módulo 01 - Fundamentos',
      position: 1,
      relative_path: '01-Fundamentos'
    });

    // 3. Lessons
    lessonsRepo.upsert({
      id: 'les_test_1',
      module_id: 'mod_test_1',
      course_id: 'course_test_1',
      title: 'Aula 01 - Setup e Configuração',
      original_path: 'C:\\TestCourses\\TypeScript\\01-Fundamentos\\aula01.mp4',
      position: 1,
      duration_seconds: 600
    });

    lessonsRepo.upsert({
      id: 'les_test_2',
      module_id: 'mod_test_1',
      course_id: 'course_test_1',
      title: 'Aula 02 - Tipos Avançados',
      original_path: 'C:\\TestCourses\\TypeScript\\01-Fundamentos\\aula02.mp4',
      position: 2,
      duration_seconds: 900
    });

    // Verify full structure
    const full = coursesRepo.getFullCourse('course_test_1');
    expect(full).not.toBeNull();
    expect(full?.course.title).toBe('Dominando TypeScript 2026');
    expect(full?.modules.length).toBe(1);
    expect(full?.modules[0].lessons?.length).toBe(2);
  });

  it('should save progress and auto-complete when >= 90%', () => {
    const progressRepo = new ProgressRepository();
    const coursesRepo = new CoursesRepository();

    // Lesson duration is 600s. Watching 550s (91.6%) should auto-complete
    const saved = progressRepo.saveProgress({
      lessonId: 'les_test_1',
      courseId: 'course_test_1',
      positionSeconds: 550,
      durationSeconds: 600
    });

    expect(saved.completed).toBe(1);
    expect(saved.progress_percent).toBeGreaterThanOrEqual(90);

    // Course status should now be 'in_progress'
    const course = coursesRepo.getById('course_test_1');
    expect(course?.status).toBe('in_progress');
  });

  it('should record study sessions and calculate stats accurately', () => {
    const sessionsRepo = new SessionsRepository();
    const started = new Date(Date.now() - 1800000).toISOString();
    const ended = new Date().toISOString();

    sessionsRepo.recordSession({
      courseId: 'course_test_1',
      lessonId: 'les_test_1',
      startedAt: started,
      endedAt: ended,
      elapsedSeconds: 1800 // 30 minutes
    });

    const stats = sessionsRepo.getStats();
    expect(stats.todaySeconds).toBeGreaterThanOrEqual(1800);
    expect(stats.weekSeconds).toBeGreaterThanOrEqual(1800);
    expect(stats.streakDays).toBeGreaterThanOrEqual(1);

    const recent = sessionsRepo.listRecent(5);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].elapsed_seconds).toBe(1800);
  });

  it('should support notes with timestamps and pin toggle', () => {
    const notesRepo = new NotesRepository();

    const created = notesRepo.create({
      courseId: 'course_test_1',
      lessonId: 'les_test_1',
      title: 'Nota de Tipos',
      content: 'Lembrar de usar utility types',
      timestampSeconds: 125.5
    });

    expect(created.id).toBeDefined();
    expect(created.timestamp_seconds).toBe(125.5);

    notesRepo.update(created.id, { isPinned: true });
    const notes = notesRepo.list({ courseId: 'course_test_1' });
    const updated = notes.find(n => n.id === created.id);
    expect(updated?.is_pinned).toBe(1);

    notesRepo.delete(created.id);
    const afterDelete = notesRepo.list({ courseId: 'course_test_1' });
    expect(afterDelete.some(n => n.id === created.id)).toBe(false);
  });

  it('should support bookmarks', () => {
    const bookmarksRepo = new BookmarksRepository();
    const bm = bookmarksRepo.create({
      courseId: 'course_test_1',
      lessonId: 'les_test_1',
      timestampSeconds: 45.0,
      title: 'Ponto chave da aula'
    });

    expect(bm.id).toBeDefined();
    const list = bookmarksRepo.listByLesson('les_test_1');
    expect(list.some(b => b.id === bm.id)).toBe(true);

    bookmarksRepo.delete(bm.id);
    const after = bookmarksRepo.listByLesson('les_test_1');
    expect(after.some(b => b.id === bm.id)).toBe(false);
  });

  it('should support study goals and tasks', () => {
    const goalsRepo = new GoalsRepository();
    goalsRepo.update('daily_minutes', 90);
    const daily = goalsRepo.getByType('daily_minutes');
    expect(daily?.target_value).toBe(90);

    const tasksRepo = new TasksRepository();
    const task = tasksRepo.create({
      title: 'Resolver exercícios práticos',
      courseId: 'course_test_1'
    });
    expect(task.status).toBe('pending');

    tasksRepo.updateStatus(task.id, 'completed');
    const tasks = tasksRepo.list();
    const found = tasks.find(t => t.id === task.id);
    expect(found?.status).toBe('completed');
  });

  it('should perform backup and safe restore with integrity validation', () => {
    const backupFile = path.join(testDbDir, 'backup_test.db');
    const backupRes = dbService.backup(backupFile);
    expect(backupRes.success).toBe(true);
    expect(fs.existsSync(backupFile)).toBe(true);

    const restoreRes = dbService.restore(backupFile);
    expect(restoreRes.success).toBe(true);

    const integrity = dbService.checkIntegrity();
    expect(integrity.ok).toBe(true);
  });

  it('should manage complementary course materials', () => {
    const materialsRepo = new MaterialsRepository();
    materialsRepo.upsert({
      id: 'mat_test_1',
      course_id: 'course_test_1',
      module_id: 'mod_test_1',
      title: 'Apostila TypeScript.pdf',
      file_path: 'C:\\TestCourses\\TypeScript\\apostila.pdf',
      file_type: 'pdf',
      file_size: 2048576
    });

    const list = materialsRepo.listByCourse('course_test_1');
    expect(list.some(m => m.id === 'mat_test_1')).toBe(true);
    const found = list.find(m => m.id === 'mat_test_1');
    expect(found?.file_type).toBe('pdf');
    expect(found?.file_size).toBe(2048576);

    // Verify materials are returned in getFullCourse
    const coursesRepo = new CoursesRepository();
    const full = coursesRepo.getFullCourse('course_test_1');
    expect(full?.materials.some(m => m.id === 'mat_test_1')).toBe(true);
  });

  it('should manage custom lists and course associations', () => {
    const listsRepo = new CustomListsRepository();
    const created = listsRepo.create('Estudar Esta Semana', 'Cursos prioritários');
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Estudar Esta Semana');

    // Add course to list
    listsRepo.addCourse(created.id, 'course_test_1');
    const inList = listsRepo.getCoursesInList(created.id);
    expect(inList.some(c => c.id === 'course_test_1')).toBe(true);

    // Remove course from list
    listsRepo.removeCourse(created.id, 'course_test_1');
    const afterRemove = listsRepo.getCoursesInList(created.id);
    expect(afterRemove.some(c => c.id === 'course_test_1')).toBe(false);

    // Delete list
    listsRepo.delete(created.id);
    const allLists = listsRepo.list();
    expect(allLists.some(l => l.id === created.id)).toBe(false);
  });

  it('should execute globalSearch across courses, lessons, and notes', () => {
    const coursesRepo = new CoursesRepository();
    const notesRepo = new NotesRepository();

    // Create a note with searchable term
    notesRepo.create({
      courseId: 'course_test_1',
      lessonId: 'les_test_1',
      title: 'Configuracao tsconfig',
      content: 'Configurar compilerOptions no tsconfig.json',
      timestampSeconds: 15.0
    });

    // 1. Search for 'TypeScript'
    const resCourse = coursesRepo.globalSearch('TypeScript');
    expect(resCourse.courses.some(c => c.title.includes('TypeScript'))).toBe(true);

    // 2. Search for lesson 'Setup'
    const resLesson = coursesRepo.globalSearch('Setup');
    expect(resLesson.lessons.some(l => l.title.includes('Setup'))).toBe(true);

    // 3. Search for note 'compilerOptions'
    const resNote = coursesRepo.globalSearch('compilerOptions');
    expect(resNote.notes.some(n => n.content.includes('compilerOptions'))).toBe(true);
  });

  it('should persist and load advanced Rclone VFS settings', () => {
    const settingsRepo = new SettingsRepository();
    settingsRepo.updateMany({
      rcloneVfsCacheMode: 'full',
      rcloneVfsCacheMaxSize: '25G',
      rcloneVfsCacheMaxAge: '48h',
      rcloneVfsReadChunkSize: '256M',
      rcloneDirCacheTime: '10m',
      rcloneBandwidthLimit: '20M'
    });

    const loaded = settingsRepo.getAll();
    expect(loaded.rcloneVfsCacheMode).toBe('full');
    expect(loaded.rcloneVfsCacheMaxSize).toBe('25G');
    expect(loaded.rcloneVfsCacheMaxAge).toBe('48h');
    expect(loaded.rcloneVfsReadChunkSize).toBe('256M');
    expect(loaded.rcloneDirCacheTime).toBe('10m');
    expect(loaded.rcloneBandwidthLimit).toBe('20M');
  });

  it('should reset course progress and delete course with cascading cleanup', () => {
    const coursesRepo = new CoursesRepository();
    const progressRepo = new ProgressRepository();

    // Verify course has progress before reset
    const full = coursesRepo.getFullCourse('course_test_1');
    expect(full).not.toBeNull();

    // Reset progress
    coursesRepo.resetProgress('course_test_1');
    const afterReset = coursesRepo.getFullCourse('course_test_1');
    expect(afterReset?.course.status).toBe('not_started');
    const progressAfter = progressRepo.getByLesson('les_test_1');
    expect(progressAfter).toBeNull();

    // Delete course
    coursesRepo.delete('course_test_1');
    const afterDelete = coursesRepo.getById('course_test_1');
    expect(afterDelete).toBeNull();

    // Verify cascaded modules and lessons are removed
    const lessonsRepo = new LessonsRepository();
    const modulesRepo = new ModulesRepository();
    expect(modulesRepo.listByCourse('course_test_1')).toHaveLength(0);
    expect(lessonsRepo.getById('les_test_1')).toBeNull();
  });
});
