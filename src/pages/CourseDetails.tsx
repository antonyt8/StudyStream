import React, { useEffect, useState } from 'react';
import { Course, CourseModule, Lesson } from '../types';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Heart,
  ChevronDown,
  ChevronRight,
  Download,
  HardDrive,
  Cloud,
  Check
} from 'lucide-react';

interface CourseDetailsProps {
  courseId: string;
  onBack: () => void;
  onOpenPlayer: (courseId: string, lessonId: string) => void;
}

export const CourseDetails: React.FC<CourseDetailsProps> = ({
  courseId,
  onBack,
  onOpenPlayer
}) => {
  const [data, setData] = useState<{ course: Course; modules: CourseModule[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const loadCourse = async () => {
    try {
      if (window.api) {
        const res = await window.api.getCourseDetails(courseId);
        setData(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const toggleModule = (modId: string) => {
    setCollapsedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleToggleFavorite = async () => {
    try {
      await window.api.toggleFavorite(courseId);
      loadCourse();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadLesson = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.api.startDownload(lessonId);
      alert('Download iniciado! Acompanhe na aba Downloads Offline.');
    } catch (err: any) {
      alert(`Erro ao iniciar download: ${err.message}`);
    }
  };

  const handleToggleComplete = async (lesson: Lesson, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCompleted = lesson.progress?.completed === 1;
    try {
      await window.api.markCompleted({
        lessonId: lesson.id,
        courseId,
        completed: !isCompleted
      });
      loadCourse();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { course, modules } = data;
  const isGoogleDrive = course.source_type === 'gdrive';

  // Find next unfinished lesson
  let nextLesson: Lesson | null = null;
  for (const mod of modules) {
    for (const les of mod.lessons || []) {
      if (les.progress?.completed !== 1) {
        nextLesson = les;
        break;
      }
    }
    if (nextLesson) break;
  }
  // Fallback to first lesson
  if (!nextLesson && modules.length > 0 && (modules[0].lessons?.length || 0) > 0) {
    nextLesson = modules[0].lessons![0];
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à biblioteca</span>
      </button>

      {/* Course Hero Header */}
      <div className="glass-card rounded-2xl p-6 md:p-8 border border-border flex flex-col md:flex-row gap-6 justify-between items-start">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-950/80 text-primary-300 border border-primary-700/50">
              {isGoogleDrive ? <Cloud className="w-3.5 h-3.5 text-accent-cyan" /> : <HardDrive className="w-3.5 h-3.5" />}
              <span>{course.source_name || (isGoogleDrive ? 'Google Drive' : 'Local')}</span>
            </span>

            {course.category_name && (
              <span className="text-xs font-medium text-slate-300 bg-background-elevated px-2.5 py-0.5 rounded-full border border-border">
                {course.category_name}
              </span>
            )}
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
            {course.title}
          </h2>

          {course.instructor && (
            <p className="text-sm font-medium text-slate-300">
              Instrutor: <span className="text-white">{course.instructor}</span>
            </p>
          )}

          {course.description && (
            <p className="text-sm text-slate-400 leading-relaxed">
              {course.description}
            </p>
          )}

          {/* Progress Bar & Stats */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>{course.completed_lessons || 0} de {course.total_lessons || 0} aulas concluídas</span>
              <span className="font-bold text-primary-400">{course.progress_percent || 0}%</span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 shadow-glow transition-all"
                style={{ width: `${course.progress_percent || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
          {nextLesson && (
            <button
              onClick={() => onOpenPlayer(course.id, nextLesson!.id)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm shadow-glow transition-all active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{course.progress_percent ? 'Continuar Curso' : 'Começar a Assistir'}</span>
            </button>
          )}

          <button
            onClick={handleToggleFavorite}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              course.is_favorite
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-background border-border text-slate-300 hover:bg-background-elevated'
            }`}
          >
            <Heart className={`w-4 h-4 ${course.is_favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{course.is_favorite ? 'Favoritado' : 'Adicionar aos Favoritos'}</span>
          </button>
        </div>
      </div>

      {/* Modules and Lessons Accordion */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-400" />
          <span>Conteúdo do Curso ({modules.length} módulos)</span>
        </h3>

        {modules.map((mod, modIdx) => {
          const isCollapsed = collapsedModules[mod.id] || false;
          const lessons = mod.lessons || [];
          const modCompleted = lessons.filter(l => l.progress?.completed === 1).length;

          return (
            <div
              key={mod.id}
              className="bg-background-surface/80 border border-border rounded-xl overflow-hidden transition-all"
            >
              {/* Module Header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-elevated/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-primary-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Módulo {modIdx + 1}: {mod.title}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {modCompleted} de {lessons.length} aulas concluídas
                    </span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-400">
                  {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
                </div>
              </button>

              {/* Lessons List */}
              {!isCollapsed && (
                <div className="border-t border-border/60 divide-y divide-border/40">
                  {lessons.map((lesson, lesIdx) => {
                    const isCompleted = lesson.progress?.completed === 1;
                    const isLocalAvailable = !!lesson.local_path;

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => onOpenPlayer(course.id, lesson.id)}
                        className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-background-elevated/60 cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Completion Toggle */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleComplete(lesson, e)}
                            className="text-slate-500 hover:text-emerald-400 transition-colors shrink-0"
                            title={isCompleted ? 'Desmarcar como concluída' : 'Marcar como concluída'}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>

                          {/* Lesson Info */}
                          <div className="min-w-0">
                            <h5 className={`text-sm font-medium truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-100 group-hover:text-primary-300'}`}>
                              {lesIdx + 1}. {lesson.title}
                            </h5>

                            {lesson.progress && (lesson.progress.position_seconds > 0) && !isCompleted && (
                              <div className="text-[11px] text-primary-400 mt-0.5">
                                Em andamento ({lesson.progress.progress_percent}%)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Offline Download button for remote Google Drive lessons */}
                          {isGoogleDrive && (
                            <button
                              type="button"
                              onClick={(e) => handleDownloadLesson(lesson.id, e)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isLocalAvailable
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'text-slate-400 hover:text-white border-transparent hover:bg-background-elevated'
                              }`}
                              title={isLocalAvailable ? 'Disponível offline' : 'Baixar para assistir offline'}
                            >
                              {isLocalAvailable ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                            </button>
                          )}

                          <div className="w-8 h-8 rounded-full bg-primary-600/0 group-hover:bg-primary-600 text-transparent group-hover:text-white flex items-center justify-center transition-all">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
