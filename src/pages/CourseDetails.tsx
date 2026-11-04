import React, { useEffect, useState } from 'react';
import { Course, CourseModule, Lesson, CourseMaterial, CustomList, Note } from '../types';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Heart,
  ChevronDown,
  ChevronUp,
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
  Trash2,
  RotateCcw,
  Loader2,
  Search,
  LayoutGrid,
  List,
  ChevronsUpDown,
  ChevronLeft,
  Pin,
  Maximize2
} from 'lucide-react';

interface CourseDetailsProps {
  courseId: string;
  onBack: () => void;
  onOpenPlayer: (courseId: string, lessonId: string, initialTime?: number) => void;
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

  // Active Tab: 'lessons' | 'materials' | 'notes'
  const [activeTab, setActiveTab] = useState<'lessons' | 'materials' | 'notes'>('lessons');

  // Lessons Search & Filter
  const [lessonSearch, setLessonSearch] = useState('');

  // Materials state (Search, Filter, ViewMode, Pagination)
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState<'all' | 'pdf' | 'zip' | 'other'>('all');
  const [materialViewMode, setMaterialViewMode] = useState<'list' | 'grid'>('list');
  const [materialPage, setMaterialPage] = useState(1);
  const materialsPerPage = 24;

  // Course Notes
  const [courseNotes, setCourseNotes] = useState<Note[]>([]);
  const [zoomSnapshot, setZoomSnapshot] = useState<string | null>(null);

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

        // Intelligently collapse modules if course has more than 2 modules:
        // Keep ONLY the active/next unfinished lesson's module open, collapse the rest!
        if (res?.modules && res.modules.length > 2) {
          let activeModId: string | null = null;
          for (const mod of res.modules) {
            for (const les of mod.lessons || []) {
              if (les.progress?.completed !== 1) {
                activeModId = mod.id;
                break;
              }
            }
            if (activeModId) break;
          }
          if (!activeModId && res.modules[0]) {
            activeModId = res.modules[0].id;
          }
          const initialCollapsed: Record<string, boolean> = {};
          for (const mod of res.modules) {
            initialCollapsed[mod.id] = mod.id !== activeModId;
          }
          setCollapsedModules(initialCollapsed);
        }

        // Load course notes
        const nList = await window.api.listNotes({ courseId });
        setCourseNotes(nList || []);
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

  // Reset material pagination when search or filter changes
  useEffect(() => {
    setMaterialPage(1);
  }, [materialSearch, materialTypeFilter]);

  const toggleModule = (modId: string) => {
    setCollapsedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const allModulesCollapsed = (data?.modules || []).every(m => collapsedModules[m.id]);
  const handleToggleExpandAll = () => {
    if (!data?.modules) return;
    const newState: Record<string, boolean> = {};
    const shouldCollapse = !allModulesCollapsed;
    for (const m of data.modules) {
      newState[m.id] = shouldCollapse;
    }
    setCollapsedModules(newState);
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

  const handleDownloadCourse = async () => {
    if (!data?.modules || !window.api) return;
    const allRemoteLessons: string[] = [];
    for (const mod of data.modules) {
      for (const les of mod.lessons || []) {
        if (les.remote_path && !les.local_path) {
          allRemoteLessons.push(les.id);
        }
      }
    }

    if (allRemoteLessons.length === 0) {
      alert('Todas as aulas deste curso já estão disponíveis offline!');
      return;
    }

    try {
      const res = await window.api.startBatchDownload(allRemoteLessons);
      alert(`Download de ${res.queuedCount} aula(s) iniciado! Você pode acompanhar o progresso na aba Downloads.`);
    } catch (err: any) {
      alert(`Erro ao iniciar download do curso: ${err.message}`);
    }
  };

  const handleDownloadModule = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data?.modules || !window.api) return;
    const targetMod = data.modules.find(m => m.id === moduleId);
    if (!targetMod) return;

    const moduleRemoteLessons: string[] = [];
    for (const les of targetMod.lessons || []) {
      if (les.remote_path && !les.local_path) {
        moduleRemoteLessons.push(les.id);
      }
    }

    if (moduleRemoteLessons.length === 0) {
      alert('Todas as aulas deste módulo já estão disponíveis offline!');
      return;
    }

    try {
      const res = await window.api.startBatchDownload(moduleRemoteLessons);
      alert(`Download de ${res.queuedCount} aula(s) do módulo "${targetMod.title}" iniciado!`);
    } catch (err: any) {
      alert(`Erro ao iniciar download do módulo: ${err.message}`);
    }
  };

  const handleExportCourseNotes = async () => {
    if (!data?.course || !window.api) return;
    try {
      const notes = await window.api.listNotes({ courseId });
      if (!notes || notes.length === 0) {
        alert('Este curso ainda não possui anotações para exportar.');
        return;
      }

      const dateStr = new Date().toLocaleDateString('pt-BR');
      let md = `# Caderno de Estudos: ${data.course.title}\n\n`;
      md += `*Exportado do StudyStream em: ${dateStr}*\n\n---\n\n`;

      for (const n of notes) {
        const timeBadge = n.timestamp_seconds !== null && n.timestamp_seconds !== undefined
          ? `[${Math.floor(n.timestamp_seconds / 60)}:${Math.floor(n.timestamp_seconds % 60).toString().padStart(2, '0')}]`
          : '[Nota Geral]';
        const les = n.lesson_title ? ` - *${n.lesson_title}*` : '';
        md += `### ⏱️ ${timeBadge}${les}\n`;
        md += `${n.content}\n\n`;
        if (n.snapshot_data) {
          md += `![Screenshot da Aula](${n.snapshot_data})\n\n`;
        }
        md += `---\n\n`;
      }

      const safeName = data.course.title.replace(/[<>:"/\\|?*]/g, '_');
      const res = await window.api.exportNotesToMarkdown({
        defaultFileName: `Anotacoes_${safeName}.md`,
        markdownContent: md
      });
      if (res.success) {
        alert(`Anotações exportadas com sucesso para:\n${res.filePath}`);
      }
    } catch (err: any) {
      alert(`Erro ao exportar anotações: ${err.message}`);
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

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir esta anotação?')) {
      if (window.api) {
        await window.api.deleteNote(id);
        const nList = await window.api.listNotes({ courseId });
        setCourseNotes(nList || []);
      }
    }
  };

  const handleTogglePinNote = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.api) {
      await window.api.updateNote(note.id, { isPinned: !note.is_pinned });
      const nList = await window.api.listNotes({ courseId });
      setCourseNotes(nList || []);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatNoteTime = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  // Filter modules and lessons
  const filteredModules = modules.map(mod => {
    if (!lessonSearch.trim()) return mod;
    const q = lessonSearch.toLowerCase().trim();
    const modMatches = mod.title.toLowerCase().includes(q);
    const matchingLessons = (mod.lessons || []).filter(l => l.title.toLowerCase().includes(q));
    if (modMatches) {
      return mod;
    }
    if (matchingLessons.length > 0) {
      return { ...mod, lessons: matchingLessons };
    }
    return null;
  }).filter((m): m is CourseModule => m !== null);

  const totalFilteredLessons = filteredModules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);

  // Materials filtering and counts
  const pdfMaterialsCount = materials.filter(m => m.file_type === 'pdf').length;
  const zipMaterialsCount = materials.filter(m => m.file_type === 'zip').length;
  const otherMaterialsCount = materials.filter(m => m.file_type !== 'pdf' && m.file_type !== 'zip').length;

  const filteredMaterials = materials.filter(mat => {
    const matchesSearch = !materialSearch.trim() || mat.title.toLowerCase().includes(materialSearch.toLowerCase().trim());
    const matchesType =
      materialTypeFilter === 'all'
        ? true
        : materialTypeFilter === 'pdf'
        ? mat.file_type === 'pdf'
        : materialTypeFilter === 'zip'
        ? mat.file_type === 'zip'
        : (mat.file_type !== 'pdf' && mat.file_type !== 'zip');
    return matchesSearch && matchesType;
  });

  const totalMaterialPages = Math.ceil(filteredMaterials.length / materialsPerPage) || 1;
  const safeMaterialPage = Math.min(Math.max(1, materialPage), totalMaterialPages);
  const displayedMaterials = filteredMaterials.slice(
    (safeMaterialPage - 1) * materialsPerPage,
    safeMaterialPage * materialsPerPage
  );

  // Sorted notes (pinned first, then chronological)
  const sortedNotes = [...courseNotes].sort((a, b) => {
    if (b.is_pinned !== a.is_pinned) return b.is_pinned - a.is_pinned;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const renderMaterialIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        );
      case 'zip':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <FolderArchive className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-primary-600/15 text-primary-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 select-none">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à biblioteca</span>
      </button>

      {/* Course Hero Header */}
      <div className="glass-card rounded-2xl p-6 md:p-8 border border-border flex flex-col md:flex-row gap-6 justify-between items-start relative overflow-hidden shadow-xl">
        {course.cover_path && (
          <div className="w-full md:w-56 h-36 md:h-44 rounded-xl overflow-hidden shrink-0 border border-border shadow-lg relative group">
            <img
              src={course.cover_path.startsWith('data:') || course.cover_path.startsWith('http') ? course.cover_path : `studystream-media://file?path=${encodeURIComponent(course.cover_path)}`}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="space-y-3 flex-1 min-w-0">
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

          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {course.title}
          </h2>

          {course.instructor && (
            <p className="text-sm font-medium text-slate-300">
              Instrutor: <span className="text-white">{course.instructor}</span>
            </p>
          )}

          {course.description && (
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
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
                className="h-full bg-primary-500 shadow-glow transition-all duration-500"
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

          {/* Download Course & Export Notes */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCourse}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-slate-300 hover:text-white hover:bg-background-elevated transition-colors"
              title="Baixar todas as aulas do curso para assistir offline"
            >
              <Download className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Baixar Curso</span>
            </button>

            <button
              onClick={handleExportCourseNotes}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-slate-300 hover:text-white hover:bg-background-elevated transition-colors"
              title="Exportar anotações do curso em arquivo Markdown (.md)"
            >
              <FileText className="w-3.5 h-3.5 text-primary-400" />
              <span>Anotações (.md)</span>
            </button>
          </div>

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

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3 pt-2">
        <div className="flex items-center gap-2">
          {/* Tab 1: Lessons & Modules */}
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'lessons'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'bg-background-surface/80 hover:bg-background-elevated text-slate-400 hover:text-white border border-border/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Aulas & Conteúdo</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              activeTab === 'lessons' ? 'bg-white/20 text-white' : 'bg-background text-slate-400'
            }`}>
              {course.total_lessons || 0}
            </span>
          </button>

          {/* Tab 2: Complementary Materials */}
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'materials'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'bg-background-surface/80 hover:bg-background-elevated text-slate-400 hover:text-white border border-border/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Materiais de Apoio</span>
            {materials.length > 0 && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'materials' ? 'bg-white/25 text-white' : 'bg-accent-cyan/15 text-accent-cyan'
              }`}>
                {materials.length}
              </span>
            )}
          </button>

          {/* Tab 3: Notes */}
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'notes'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'bg-background-surface/80 hover:bg-background-elevated text-slate-400 hover:text-white border border-border/60'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Anotações</span>
            {courseNotes.length > 0 && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'notes' ? 'bg-white/25 text-white' : 'bg-amber-400/15 text-amber-300'
              }`}>
                {courseNotes.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Context Info */}
        <div className="text-xs text-slate-400 hidden sm:block">
          {activeTab === 'lessons' && `${modules.length} módulos no total`}
          {activeTab === 'materials' && `${materials.length} arquivos disponíveis`}
          {activeTab === 'notes' && `${courseNotes.length} anotações registradas`}
        </div>
      </div>

      {/* TAB 1: Lessons & Modules */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {/* Lessons Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-background-surface/50 border border-border/60 p-3 rounded-xl">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar aulas ou módulos por título..."
                value={lessonSearch}
                onChange={(e) => setLessonSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500"
              />
              {lessonSearch && (
                <button
                  onClick={() => setLessonSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleToggleExpandAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background border border-border text-xs font-semibold text-slate-300 hover:text-white hover:bg-background-elevated transition-colors"
                title={allModulesCollapsed ? 'Expandir todos os módulos' : 'Recolher todos os módulos'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-primary-400" />
                <span>{allModulesCollapsed ? 'Expandir Todos' : 'Recolher Todos'}</span>
              </button>
            </div>
          </div>

          {/* Search Result Feedback */}
          {lessonSearch && (
            <div className="text-xs text-slate-400 px-1">
              Mostrando {totalFilteredLessons} aula(s) em {filteredModules.length} módulo(s) para a busca "<span className="text-white font-medium">{lessonSearch}</span>":
            </div>
          )}

          {/* Modules List Accordion */}
          {filteredModules.length === 0 ? (
            <div className="p-12 text-center bg-background-surface/40 border border-border/50 rounded-2xl space-y-3">
              <Search className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Nenhuma aula encontrada para "{lessonSearch}"
              </p>
              <button
                onClick={() => setLessonSearch('')}
                className="text-xs text-primary-400 hover:underline"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredModules.map((mod, modIdx) => {
                const isCollapsed = collapsedModules[mod.id] || false;
                const lessons = mod.lessons || [];
                const modCompleted = lessons.filter(l => l.progress?.completed === 1).length;

                return (
                  <div
                    key={mod.id}
                    className="bg-background-surface/80 border border-border rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    {/* Module Header */}
                    <div className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-background-elevated/40 transition-colors text-left">
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className="flex items-center gap-3 min-w-0 pr-2 text-left"
                        title={isCollapsed ? 'Expandir módulo' : 'Recolher módulo'}
                        aria-label={`${isCollapsed ? 'Expandir' : 'Recolher'} módulo ${mod.title}`}
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-primary-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            Módulo {modIdx + 1}: {mod.title}
                          </h4>
                          <span className="text-xs text-slate-400">
                            {modCompleted} de {lessons.length} aulas concluídas
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        {lessons.some(l => l.remote_path && !l.local_path) && (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadModule(mod.id, e)}
                            className="px-2.5 py-1 rounded-lg bg-background-elevated hover:bg-primary-600 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold border border-border"
                            title="Baixar todas as aulas deste módulo para assistir offline"
                          >
                            <Download className="w-3.5 h-3.5 text-accent-cyan" />
                            <span className="hidden sm:inline">Baixar Módulo</span>
                          </button>
                        )}

                        <div className="text-xs font-semibold text-slate-400 bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
                          {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleModule(mod.id)}
                          className="rounded-lg border border-border bg-background-elevated p-1.5 text-slate-400 transition-colors hover:bg-primary-600 hover:text-white"
                          title={isCollapsed ? 'Expandir módulo' : 'Recolher módulo'}
                          aria-label={`${isCollapsed ? 'Expandir' : 'Recolher'} módulo ${mod.title}`}
                          aria-expanded={!isCollapsed}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Lessons List */}
                    {!isCollapsed && (
                      <div className="border-t border-border/60 divide-y divide-border/40 bg-background/20">
                        {lessons.map((lesson, lesIdx) => {
                          const isCompleted = lesson.progress?.completed === 1;
                          const isLocalAvailable = !!lesson.local_path;
                          const isPdf = lesson.media_type === 'application/pdf' || lesson.original_path.toLowerCase().endsWith('.pdf');
                          const partBadge = detectPart(lesson.title);

                          return (
                            <div
                              key={lesson.id}
                              onClick={() => handleOpenLesson(lesson)}
                              className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-background-elevated/60 cursor-pointer group transition-colors"
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
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className={`text-xs sm:text-sm font-medium truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-100 group-hover:text-primary-300'}`}>
                                      {lesIdx + 1}. {lesson.title}
                                    </h5>

                                    {partBadge && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary-900/60 text-primary-300 border border-primary-700/50">
                                        {partBadge}
                                      </span>
                                    )}

                                    {isPdf && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-700/50">
                                        Apostila PDF
                                      </span>
                                    )}
                                  </div>

                                  {lesson.progress && (lesson.progress.position_seconds > 0) && !isCompleted && !isPdf && (
                                    <div className="text-[11px] text-primary-400 font-medium">
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
                                  <div className="w-7 h-7 rounded-full bg-rose-600/10 group-hover:bg-rose-600 text-rose-400 group-hover:text-white flex items-center justify-center transition-all" title="Abrir Apostila PDF">
                                    {openingPath === (lesson.local_path || lesson.original_path) ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400 group-hover:text-white" />
                                    ) : (
                                      <FileText className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-primary-600/0 group-hover:bg-primary-600 text-transparent group-hover:text-white flex items-center justify-center transition-all">
                                    <Play className="w-3 h-3 fill-current ml-0.5" />
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
          )}
        </div>
      )}

      {/* TAB 2: Complementary Materials */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {materials.length === 0 ? (
            <div className="p-12 text-center bg-background-surface/40 border border-border/50 rounded-2xl space-y-3">
              <FileText className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="text-base font-bold text-white">Nenhum material de apoio anexado</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Este curso não possui apostilas em PDF, slides ou arquivos de texto complementares na pasta de origem.
              </p>
            </div>
          ) : (
            <>
              {/* Materials Control Bar: Search + Type Filter + View Mode */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-background-surface/60 border border-border/60 p-3 rounded-xl shadow-sm">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar material por nome..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  />
                  {materialSearch && (
                    <button
                      onClick={() => setMaterialSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters & View Switcher */}
                <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border/60 text-xs">
                    <button
                      onClick={() => setMaterialTypeFilter('all')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        materialTypeFilter === 'all'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos ({materials.length})
                    </button>
                    {pdfMaterialsCount > 0 && (
                      <button
                        onClick={() => setMaterialTypeFilter('pdf')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          materialTypeFilter === 'pdf'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        PDFs ({pdfMaterialsCount})
                      </button>
                    )}
                    {zipMaterialsCount > 0 && (
                      <button
                        onClick={() => setMaterialTypeFilter('zip')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          materialTypeFilter === 'zip'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ZIP ({zipMaterialsCount})
                      </button>
                    )}
                    {otherMaterialsCount > 0 && (
                      <button
                        onClick={() => setMaterialTypeFilter('other')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          materialTypeFilter === 'other'
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Outros ({otherMaterialsCount})
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-background p-1 rounded-lg border border-border/60">
                    <button
                      onClick={() => setMaterialViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${
                        materialViewMode === 'list'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Exibição em Lista Compacta"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMaterialViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${
                        materialViewMode === 'grid'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Exibição em Grade"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Materials Results */}
              {filteredMaterials.length === 0 ? (
                <div className="p-12 text-center bg-background-surface/40 border border-border/50 rounded-2xl space-y-3">
                  <Search className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    Nenhum material encontrado com os filtros aplicados
                  </p>
                  <button
                    onClick={() => {
                      setMaterialSearch('');
                      setMaterialTypeFilter('all');
                    }}
                    className="text-xs text-primary-400 hover:underline"
                  >
                    Redefinir filtros
                  </button>
                </div>
              ) : materialViewMode === 'list' ? (
                /* Compact Table / List Mode */
                <div className="bg-background-surface/80 border border-border rounded-xl overflow-hidden divide-y divide-border/40 shadow-sm">
                  {displayedMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      onClick={() => handleOpenMaterial(mat.file_path)}
                      className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-background-elevated/60 cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderMaterialIcon(mat.file_type)}
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-white group-hover:text-primary-300 truncate" title={mat.title}>
                            {mat.title}
                          </h5>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-bold uppercase text-primary-400">{mat.file_type}</span>
                            <span>•</span>
                            <span>{formatFileSize(mat.file_size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMaterial(mat.file_path);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border group-hover:border-primary-500 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors"
                        >
                          {openingPath === mat.file_path ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5 text-primary-400 group-hover:text-white" />
                          )}
                          <span className="hidden sm:inline">Abrir</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Grid Mode (compact modern cards) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayedMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      onClick={() => handleOpenMaterial(mat.file_path)}
                      className="p-3.5 bg-background-surface/80 hover:bg-background-elevated/70 border border-border hover:border-slate-600 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {renderMaterialIcon(mat.file_type)}
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white group-hover:text-primary-300 truncate" title={mat.title}>
                            {mat.title}
                          </h5>
                          <div className="text-[11px] text-slate-400 mt-0.5 uppercase flex items-center gap-1.5">
                            <span className="font-semibold text-primary-400">{mat.file_type}</span>
                            <span>•</span>
                            <span>{formatFileSize(mat.file_size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-white group-hover:bg-primary-600 transition-colors shrink-0">
                        {openingPath === mat.file_path ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Bar */}
              {totalMaterialPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs text-slate-400">
                  <div>
                    Mostrando {(safeMaterialPage - 1) * materialsPerPage + 1} a {Math.min(safeMaterialPage * materialsPerPage, filteredMaterials.length)} de {filteredMaterials.length} materiais
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMaterialPage(p => Math.max(1, p - 1))}
                      disabled={safeMaterialPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background-surface border border-border hover:bg-background-elevated disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>

                    <span className="px-2 font-medium text-slate-300">
                      Página {safeMaterialPage} de {totalMaterialPages}
                    </span>

                    <button
                      onClick={() => setMaterialPage(p => Math.min(totalMaterialPages, p + 1))}
                      disabled={safeMaterialPage === totalMaterialPages}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background-surface border border-border hover:bg-background-elevated disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 transition-colors"
                    >
                      <span>Próxima</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: Course Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary-400" />
              <span>Anotações deste Curso ({courseNotes.length})</span>
            </h3>

            {courseNotes.length > 0 && (
              <button
                onClick={handleExportCourseNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-semibold text-slate-300 hover:text-white hover:bg-background-elevated transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Exportar Caderno (.md)</span>
              </button>
            )}
          </div>

          {sortedNotes.length === 0 ? (
            <div className="p-12 text-center bg-background-surface/40 border border-border/50 rounded-2xl space-y-3">
              <Edit3 className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="text-base font-bold text-white">Nenhuma anotação neste curso ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Durante a reprodução de qualquer aula no player, você pode criar anotações rápidas com atalhos de teclado, marcar momentos importantes e até tirar prints da tela com um clique!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`bg-background-surface/80 border rounded-xl p-4 space-y-3 transition-all relative ${
                    note.is_pinned ? 'border-primary-500/50 shadow-glow' : 'border-border'
                  }`}
                >
                  {/* Note Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {note.timestamp_seconds !== null && note.timestamp_seconds !== undefined && note.lesson_id ? (
                        <button
                          onClick={() => onOpenPlayer(courseId, note.lesson_id!, note.timestamp_seconds)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary-600/20 hover:bg-primary-600 text-primary-300 hover:text-white border border-primary-500/30 text-xs font-bold transition-colors"
                          title="Assistir aula neste exato segundo"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{formatNoteTime(note.timestamp_seconds)}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 bg-background px-2 py-0.5 rounded border border-border">
                          Geral
                        </span>
                      )}

                      {note.lesson_title && (
                        <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px]" title={note.lesson_title}>
                          {note.lesson_title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleTogglePinNote(note, e)}
                        className={`p-1.5 rounded hover:bg-background-elevated transition-colors ${
                          note.is_pinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={note.is_pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Excluir nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Note Content */}
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {/* Snapshot Thumbnail if present */}
                  {note.snapshot_data && (
                    <div
                      onClick={() => setZoomSnapshot(note.snapshot_data!)}
                      className="relative rounded-lg overflow-hidden border border-border cursor-pointer group max-w-xs"
                      title="Clique para ampliar o print"
                    >
                      <img
                        src={note.snapshot_data}
                        alt="Print da aula"
                        className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500">
                    {new Date(note.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Snapshot Zoom Modal */}
      {zoomSnapshot && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fadeIn"
          onClick={() => setZoomSnapshot(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomSnapshot(null)}
              className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomSnapshot}
              alt="Screenshot ampliado"
              className="max-h-[85vh] max-w-full rounded-xl border border-border shadow-2xl object-contain"
            />
          </div>
        </div>
      )}

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
