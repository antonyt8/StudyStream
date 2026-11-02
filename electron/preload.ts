import { contextBridge, ipcRenderer } from 'electron';
import { CourseFilter } from './database/repositories/courses.repo';
import { SourceType, AppSettings, TaskStatus } from '../src/types';

const api = {
  // Library
  selectFolder: () => ipcRenderer.invoke('library:select-folder'),
  addSource: (data: { name: string; sourceType: SourceType; rootPath: string; remoteName?: string }) => 
    ipcRenderer.invoke('library:add-source', data),
  listSources: () => ipcRenderer.invoke('library:list-sources'),
  deleteSource: (id: string) => ipcRenderer.invoke('library:delete-source', id),
  scanSource: (sourceId: string) => ipcRenderer.invoke('library:scan-source', sourceId),
  cancelScan: (sourceId: string) => ipcRenderer.invoke('library:cancel-scan', sourceId),
  onScanProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('library:scan-progress', handler);
    return () => ipcRenderer.removeListener('library:scan-progress', handler);
  },

  // Courses
  listCourses: (filter?: CourseFilter) => ipcRenderer.invoke('courses:list', filter),
  getCourseDetails: (id: string) => ipcRenderer.invoke('courses:get-details', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('courses:toggle-favorite', id),
  updateCourse: (id: string, updates: any) => ipcRenderer.invoke('courses:update', id, updates),
  deleteCourse: (id: string) => ipcRenderer.invoke('courses:delete', id),

  // Playback
  getPlaybackUrl: (lessonId: string) => ipcRenderer.invoke('playback:get-url', lessonId),
  saveProgress: (data: {
    lessonId: string;
    courseId: string;
    positionSeconds: number;
    durationSeconds: number;
    completed?: boolean;
    autoCompleteThreshold?: number;
  }) => ipcRenderer.invoke('playback:save-progress', data),
  markCompleted: (data: { lessonId: string; courseId: string; completed: boolean }) =>
    ipcRenderer.invoke('playback:mark-completed', data),
  recordSession: (data: {
    courseId: string;
    lessonId: string;
    startedAt: string;
    endedAt: string;
    elapsedSeconds: number;
  }) => ipcRenderer.invoke('playback:record-session', data),
  getLessonProgress: (lessonId: string) => ipcRenderer.invoke('playback:get-lesson-progress', lessonId),

  // Notes & Bookmarks
  listNotes: (filter?: { courseId?: string; lessonId?: string; search?: string }) =>
    ipcRenderer.invoke('notes:list', filter),
  createNote: (data: { courseId: string; lessonId?: string; title: string; content: string; timestampSeconds?: number }) =>
    ipcRenderer.invoke('notes:create', data),
  updateNote: (id: string, data: { title?: string; content?: string; isPinned?: boolean }) =>
    ipcRenderer.invoke('notes:update', id, data),
  deleteNote: (id: string) => ipcRenderer.invoke('notes:delete', id),
  listBookmarks: (lessonId: string) => ipcRenderer.invoke('bookmarks:list', lessonId),
  createBookmark: (data: { courseId: string; lessonId: string; timestampSeconds: number; title: string; note?: string }) =>
    ipcRenderer.invoke('bookmarks:create', data),
  deleteBookmark: (id: string) => ipcRenderer.invoke('bookmarks:delete', id),

  // Goals & Dashboard
  listGoals: () => ipcRenderer.invoke('goals:list'),
  updateGoal: (type: string, targetValue: number) => ipcRenderer.invoke('goals:update', type, targetValue),
  getDashboardStats: () => ipcRenderer.invoke('goals:get-dashboard-stats'),
  getStudyHistory: (courseId?: string) => ipcRenderer.invoke('goals:get-history', courseId),

  // Tasks
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  createTask: (data: { courseId?: string; lessonId?: string; title: string; description?: string; dueDate?: string }) =>
    ipcRenderer.invoke('tasks:create', data),
  updateTaskStatus: (id: string, status: TaskStatus) => ipcRenderer.invoke('tasks:update-status', id, status),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),

  // Custom Lists
  listCustomLists: () => ipcRenderer.invoke('lists:list'),
  createCustomList: (name: string, description?: string, icon?: string) =>
    ipcRenderer.invoke('lists:create', name, description, icon),
  addCourseToList: (listId: string, courseId: string) => ipcRenderer.invoke('lists:add-course', listId, courseId),
  removeCourseFromList: (listId: string, courseId: string) => ipcRenderer.invoke('lists:remove-course', listId, courseId),
  getCoursesInList: (listId: string) => ipcRenderer.invoke('lists:get-courses', listId),
  deleteCustomList: (id: string) => ipcRenderer.invoke('lists:delete', id),

  // Downloads
  listDownloads: () => ipcRenderer.invoke('downloads:list'),
  startDownload: (lessonId: string) => ipcRenderer.invoke('downloads:start', lessonId),
  deleteDownload: (id: string) => ipcRenderer.invoke('downloads:delete', id),
  onDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('downloads:progress', handler);
    return () => ipcRenderer.removeListener('downloads:progress', handler);
  },
  onDownloadCompleted: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('downloads:completed', handler);
    return () => ipcRenderer.removeListener('downloads:completed', handler);
  },

  // Rclone
  checkRcloneStatus: (customPath?: string) => ipcRenderer.invoke('rclone:check-status', customPath),
  listRcloneRemotes: (customPath?: string) => ipcRenderer.invoke('rclone:list-remotes', customPath),
  testRcloneRemote: (remotePath: string) => ipcRenderer.invoke('rclone:test-remote', remotePath),
  listRcloneFolders: (remotePath: string) => ipcRenderer.invoke('rclone:list-folders', remotePath),

  // Settings & DB
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings),
  selectDownloadDir: () => ipcRenderer.invoke('settings:select-download-dir'),
  backupDatabase: () => ipcRenderer.invoke('settings:backup'),
  restoreDatabase: () => ipcRenderer.invoke('settings:restore'),
  checkDbIntegrity: () => ipcRenderer.invoke('settings:check-integrity'),
  openPath: (targetPath: string) => ipcRenderer.invoke('settings:open-path', targetPath),
};

export type WindowApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
