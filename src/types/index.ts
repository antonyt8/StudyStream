export type SourceType = 'local' | 'gdrive';

export interface Source {
  id: string;
  name: string;
  source_type: SourceType;
  root_path: string;
  remote_name?: string;
  enabled: number;
  last_scan_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export type CourseStatus = 'not_started' | 'in_progress' | 'completed';

export interface Course {
  id: string;
  source_id: string;
  title: string;
  description?: string;
  instructor?: string;
  category_id?: string;
  category_name?: string;
  cover_path?: string;
  total_duration_seconds: number;
  status: CourseStatus;
  is_favorite: number;
  root_folder: string;
  created_at: string;
  updated_at: string;
  // Computed / aggregated fields
  total_lessons?: number;
  completed_lessons?: number;
  progress_percent?: number;
  source_name?: string;
  source_type?: SourceType;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  position: number;
  relative_path: string;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  original_path: string;
  local_path?: string;
  remote_path?: string;
  duration_seconds: number;
  position: number;
  media_type: string;
  file_size: number;
  is_available: number;
  created_at: string;
  updated_at: string;
  // Progress joined fields
  progress?: LessonProgress;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  course_id: string;
  position_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  completed: number;
  last_watched_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  course_id: string;
  lesson_id: string;
  started_at: string;
  ended_at: string;
  elapsed_seconds: number;
  session_status: 'completed' | 'interrupted';
  course_title?: string;
  lesson_title?: string;
}

export interface Note {
  id: string;
  course_id: string;
  lesson_id?: string;
  title: string;
  content: string;
  timestamp_seconds?: number;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  course_title?: string;
  lesson_title?: string;
}

export interface Bookmark {
  id: string;
  course_id: string;
  lesson_id: string;
  timestamp_seconds: number;
  title: string;
  note?: string;
  created_at: string;
  course_title?: string;
  lesson_title?: string;
}

export type GoalType = 'daily_minutes' | 'weekly_minutes' | 'daily_lessons';

export interface StudyGoal {
  id: string;
  goal_type: GoalType;
  target_value: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface StudyTask {
  id: string;
  course_id?: string;
  lesson_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  course_title?: string;
}

export interface CustomList {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: string;
  course_count?: number;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadItem {
  id: string;
  lesson_id: string;
  course_id: string;
  remote_path: string;
  destination_path: string;
  status: DownloadStatus;
  total_bytes: number;
  downloaded_bytes: number;
  speed: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  lesson_title?: string;
  course_title?: string;
}

export interface RcloneRemote {
  name: string;
  type: string;
}

export interface RcloneStatus {
  installed: boolean;
  version?: string;
  path?: string;
  remotes: RcloneRemote[];
  error?: string;
}

export interface RcloneItem {
  Path: string;
  Name: string;
  Size: number;
  MimeType: string;
  ModTime: string;
  IsDir: boolean;
  ID?: string;
}

export interface ScanProgress {
  sourceId: string;
  status: 'scanning' | 'indexing' | 'completed' | 'error' | 'cancelled';
  filesExamined: number;
  videosFound: number;
  currentFolder?: string;
  error?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  language: string;
  defaultDownloadPath: string;
  defaultPlaybackSpeed: number;
  autoResume: boolean;
  autoCompleteThreshold: number; // e.g. 0.9 (90%)
  rclonePath: string;
  selectedRemote: string;
  remoteFolderPath: string;
  startWithWindows: boolean;
  dbPath?: string;
}

export interface DashboardStats {
  todayStudySeconds: number;
  weekStudySeconds: number;
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalLessons: number;
  completedLessons: number;
  recentCourses: Course[];
  continueWatching: {
    course: Course;
    lesson: Lesson;
    progress: LessonProgress;
  }[];
  studyStreakDays: number;
  dailyGoalMinutes: number;
  dailyGoalProgressMinutes: number;
}
