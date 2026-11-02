import React, { useEffect, useState } from 'react';
import { Course, CourseModule, Lesson, CourseMaterial, CustomList } from '../types';
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
  Check,
  Edit3,
  Bookmark,
  FileText,
  ExternalLink,
  X,
  Plus,
  FolderArchive,
  Save,
  CheckCheck,
  Trash2,
  RotateCcw,
  Loader2
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
  const [data, setData] = useState<{ course: Course; modules: CourseModule[]; materials?: CourseMaterial[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // Metadata editor modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editInstructor, setEditInstructor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<string>('not_started');

  // Custom list modal state
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [allLists, setAllLists] = useState<CustomList[]>([]);
  const [activeListIds, setActiveListIds] = useState<Set<string>>(new Set());
  const [newListName, setNewListName] = useState('');

  const loadCourse = async () => {
    try {
      if (window.api) {
        const res = await window.api.getCourseDetails(courseId);
        setData(res);
        if (res && res.course) {
          setEditTitle(res.course.title);
          setEditInstructor(res.course.instructor || '');
          setEditDescription(res.course.description || '');
          setEditStatus(res.course.status || 'not_started');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomLists = async () => {
    try {
      if (window.api) {
        const lists = await window.api.listCustomLists();
        setAllLists(lists);

        // Check which lists contain this course
        const containing = new Set<string>();
        for (const l of lists) {
          const courses = await window.api.getCoursesInList(l.id);
          if (courses.some((c: Course) => c.id === courseId)) {
            containing.add(l.id);
          }
        }
        setActiveListIds(containing);
      }
    } catch (err) {
      console.error(err);
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

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.api.updateCourse(courseId, {
        title: editTitle.trim(),
        instructor: editInstructor.trim() || undefined,
        description: editDescription.trim() || undefined,
        status: editStatus as any
      });
      setIsEditModalOpen(false);
      loadCourse();
    } catch (err: any) {
      alert(`Erro ao salvar metadados: ${err.message}`);
    }
  };

  const handleOpenListModal = () => {
    loadCustomLists();
    setIsListModalOpen(true);
  };

  const handleToggleListMembership = async (listId: string) => {
    try {
      if (activeListIds.has(listId)) {
        await window.api.removeCourseFromList(listId, courseId);
        setActiveListIds(prev => {
          const next = new Set(prev);
          next.delete(listId);
          return next;
        });
      } else {
        await window.api.addCourseToList(listId, courseId);
        setActiveListIds(prev => {
          const next = new Set(prev);
          next.add(listId);
          return next;
        });
      }
    } catch (err: any) {
      alert(`Erro ao atualizar lista: ${err.message}`);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const created = await window.api.createCustomList(newListName.trim());
      await window.api.addCourseToList(created.id, courseId);
      setNewListName('');
      loadCustomLists();
    } catch (err: any) {
      alert(`Erro ao criar lista: ${err.message}`);
    }
  };

  const handleOpenMaterial = async (filePath: string) => {
    try {
      setOpeningPath(filePath);
      await window.api.openPath(filePath);
    } catch (err: any) {
      alert(`Não foi possível abrir o arquivo: ${err.message}`);
    } finally {
      setOpeningPath(null);
    }
  };

  const detectPart = (filename: string) => {
    const match = filename.match(/(?:parte|part|pt)\s*(\d+)/i);
    return match ? `Parte ${match[1]}` : null;
  };

  const handleOpenLesson = async (lesson: Lesson) => {
    const isPdf = lesson.media_type === 'application/pdf' || lesson.original_path.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      if (window.api) {
        const targetPath = lesson.local_path || lesson.original_path;
        try {
          setOpeningPath(targetPath);
          await window.api.openPath(targetPath);
          if (lesson.progress?.completed !== 1) {
            await window.api.markCompleted({
              lessonId: lesson.id,
              courseId: course.id,
              completed: true
            });
            loadCourse();
          }
        } catch (err: any) {
          alert(`Erro ao abrir documento PDF: ${err.message}`);
        } finally {
          setOpeningPath(null);
        }
      }
    } else {
      onOpenPlayer(course.id, lesson.id);
    }
  };

  const handleDeleteCourse = async () => {
    if (!data?.course || !window.api) return;
    const confirmDelete = confirm(
      `Deseja realmente remover o curso "${data.course.title}" da sua biblioteca?\n\nOs arquivos originais de vídeo e apostilas NÃO serão excluídos do seu computador ou Google Drive.`
    );
    if (!confirmDelete) return;

    try {
      await window.api.deleteCourse(data.course.id);
      onBack();
    } catch (err: any) {
      alert(`Erro ao excluir curso: ${err.message}`);
    }
  };

  const handleResetProgress = async () => {
    if (!data?.course || !window.api) return;
    const confirmReset = confirm(
      `Deseja zerar todo o progresso do curso "${data.course.title}"?\n\nTodas as aulas voltarão a ficar como não assistidas.`
    );
    if (!confirmReset) return;

    try {
      await window.api.resetCourseProgress(data.course.id);
      loadCourse();
    } catch (err: any) {
      alert(`Erro ao zerar progresso: ${err.message}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { course, modules, materials = [] } = data;
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

            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              course.status === 'completed'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : course.status === 'in_progress'
                ? 'bg-primary-500/15 text-primary-300 border border-primary-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {course.status === 'completed' ? 'Concluído' : course.status === 'in_progress' ? 'Em Andamento' : 'Não Iniciado'}
            </span>
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
        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
          {nextLesson && (
            <button
              onClick={() => onOpenPlayer(course.id, nextLesson!.id)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm shadow-glow transition-all active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{course.progress_percent ? 'Continuar Curso' : 'Começar a Assistir'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                course.is_favorite
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-background border-border text-slate-300 hover:bg-background-elevated'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${course.is_favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{course.is_favorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>

            <button
              onClick={handleOpenListModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold text-slate-300 hover:bg-background-elevated transition-colors"
              title="Organizar em listas personalizadas"
            >
              <Bookmark className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Listas</span>
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-2.5 rounded-xl bg-background border border-border text-slate-300 hover:bg-background-elevated transition-colors"
              title="Editar metadados do curso"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetProgress}
              className="p-2.5 rounded-xl bg-background border border-border text-slate-300 hover:text-amber-400 hover:bg-background-elevated transition-colors"
              title="Zerar progresso do curso (recomeçar aulas)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeleteCourse}
              className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white transition-colors"
              title="Excluir curso da biblioteca"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Complementary Materials Section */}
      {materials.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-cyan" />
              <span>Materiais Complementares ({materials.length})</span>
            </h3>
            <span className="text-xs text-slate-400">Apostilas, PDFs e documentos de apoio</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {materials.map((mat) => (
              <div
                key={mat.id}
                onClick={() => handleOpenMaterial(mat.file_path)}
                className="p-4 bg-background-surface/80 hover:bg-background-elevated/70 border border-border hover:border-slate-600 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-lg bg-primary-600/15 text-primary-400 flex items-center justify-center shrink-0">
                    {mat.file_type === 'zip' ? (
                      <FolderArchive className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white group-hover:text-primary-300 truncate">
                      {mat.title}
                    </h5>
                    <div className="text-[11px] text-slate-400 mt-0.5 uppercase flex items-center gap-2">
                      <span className="font-semibold text-primary-400">{mat.file_type}</span>
                      <span>• {formatFileSize(mat.file_size)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-white group-hover:bg-primary-600 transition-colors shrink-0">
                  {openingPath === mat.file_path ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    const isPdf = lesson.media_type === 'application/pdf' || lesson.original_path.toLowerCase().endsWith('.pdf');
                    const partBadge = detectPart(lesson.title);

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => handleOpenLesson(lesson)}
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
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className={`text-sm font-medium truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-100 group-hover:text-primary-300'}`}>
                                {lesIdx + 1}. {lesson.title}
                              </h5>

                              {partBadge && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-900/60 text-primary-300 border border-primary-700/50">
                                  {partBadge}
                                </span>
                              )}

                              {isPdf && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-700/50">
                                  Apostila PDF
                                </span>
                              )}
                            </div>

                            {lesson.progress && (lesson.progress.position_seconds > 0) && !isCompleted && !isPdf && (
                              <div className="text-[11px] text-primary-400">
                                Em andamento ({lesson.progress.progress_percent}%)
                              </div>
                            )}

                            {isPdf && lesson.file_size > 0 && (
                              <div className="text-[11px] text-slate-400">
                                Documento PDF ({formatFileSize(lesson.file_size)})
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

                          {isPdf ? (
                            <div className="w-8 h-8 rounded-full bg-rose-600/10 group-hover:bg-rose-600 text-rose-400 group-hover:text-white flex items-center justify-center transition-all" title="Abrir Apostila PDF">
                              {openingPath === (lesson.local_path || lesson.original_path) ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-400 group-hover:text-white" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-600/0 group-hover:bg-primary-600 text-transparent group-hover:text-white flex items-center justify-center transition-all">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                          )}
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

      {/* Edit Metadata Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background-surface border border-border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary-400" />
                <span>Editar Informações do Curso</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMetadata} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Título de Exibição
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-background border border-border text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Professor / Instrutor
                </label>
                <input
                  type="text"
                  value={editInstructor}
                  onChange={(e) => setEditInstructor(e.target.value)}
                  placeholder="Ex: John Doe"
                  className="w-full bg-background border border-border text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Status de Conclusão
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-background border border-border text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                >
                  <option value="not_started">Não Iniciado</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descrição ou Observações
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Anotações e detalhes gerais sobre este curso..."
                  className="w-full bg-background border border-border text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-background-elevated hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-xs font-semibold text-white shadow-glow transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Lists Modal */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background-surface border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-accent-cyan" />
                <span>Listas de Estudo Personalizadas</span>
              </h3>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Marque as listas às quais este curso pertence:
            </p>

            {/* List entries */}
            <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-border/40 border border-border rounded-xl p-2 bg-background">
              {allLists.length > 0 ? (
                allLists.map((list) => {
                  const inList = activeListIds.has(list.id);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => handleToggleListMembership(list.id)}
                      className="w-full p-2.5 flex items-center justify-between text-left hover:bg-background-elevated rounded-lg transition-colors group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-semibold text-white group-hover:text-primary-300 block truncate">
                          {list.name}
                        </span>
                        {list.description && (
                          <span className="text-[11px] text-slate-400 block truncate">
                            {list.description}
                          </span>
                        )}
                      </div>

                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        inList
                          ? 'bg-primary-600 border-primary-500 text-white'
                          : 'border-slate-600 bg-background-surface text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Nenhuma lista criada ainda. Crie sua primeira lista abaixo!
                </div>
              )}
            </div>

            {/* Create new list form */}
            <form onSubmit={handleCreateList} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Nova lista (Ex: Prioridade Semana)..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="flex-1 bg-background border border-border text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                disabled={!newListName.trim()}
                className="px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1 shadow-glow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar</span>
              </button>
            </form>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-background-elevated hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
