import React, { useEffect, useState } from 'react';
import { Note, Course } from '../types';
import { FileText, Search, Clock, Trash2, Pin, Play, Download, ExternalLink, X } from 'lucide-react';

interface NotesPageProps {
  onOpenPlayer: (courseId: string, lessonId: string, initialTime?: number) => void;
}

export const NotesPage: React.FC<NotesPageProps> = ({ onOpenPlayer }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [zoomSnapshot, setZoomSnapshot] = useState<string | null>(null);

  const loadData = async () => {
    try {
      if (window.api) {
        const [nList, cList] = await Promise.all([
          window.api.listNotes({ courseId: selectedCourseId || undefined, search }),
          window.api.listCourses()
        ]);
        setNotes(nList);
        setCourses(cList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourseId, search]);

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir esta anotação?')) {
      await window.api.deleteNote(id);
      loadData();
    }
  };

  const handleTogglePin = async (note: Note) => {
    await window.api.updateNote(note.id, { isPinned: !note.is_pinned });
    loadData();
  };

  const formatTime = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Export notes to Markdown
  const handleExportMarkdown = async () => {
    if (notes.length === 0 || !window.api) return;

    const courseObj = courses.find(c => c.id === selectedCourseId);
    const titleHeader = courseObj ? `Caderno de Estudos - ${courseObj.title}` : 'Caderno de Estudos - StudyStream';
    const dateStr = new Date().toLocaleDateString('pt-BR');

    let md = `# ${titleHeader}\n\n`;
    md += `*Exportado do StudyStream em: ${dateStr}*\n\n---\n\n`;

    // Group notes by course and lesson
    const courseGroups: { [cName: string]: Note[] } = {};
    for (const n of notes) {
      const cName = n.course_title || 'Geral';
      if (!courseGroups[cName]) courseGroups[cName] = [];
      courseGroups[cName].push(n);
    }

    for (const [cName, cNotes] of Object.entries(courseGroups)) {
      md += `## 📚 ${cName}\n\n`;
      for (const n of cNotes) {
        const timeBadge = n.timestamp_seconds !== null && n.timestamp_seconds !== undefined
          ? `[${formatTime(n.timestamp_seconds)}]`
          : '[Nota Geral]';
        const les = n.lesson_title ? ` - *${n.lesson_title}*` : '';
        md += `### ⏱️ ${timeBadge}${les}\n`;
        md += `${n.content}\n\n`;
        if (n.snapshot_data) {
          md += `![Screenshot da Aula](${n.snapshot_data})\n\n`;
        }
        md += `---\n\n`;
      }
    }

    const defaultFileName = courseObj
      ? `Anotacoes_${courseObj.title.replace(/[<>:"/\\|?*]/g, '_')}.md`
      : 'Caderno_Estudos_StudyStream.md';

    try {
      const res = await window.api.exportNotesToMarkdown({
        defaultFileName,
        markdownContent: md
      });
      if (res.success) {
        alert(`Anotações exportadas com sucesso para:\n${res.filePath}`);
      }
    } catch (err: any) {
      alert(`Erro ao exportar anotações: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-400" />
            Minhas Anotações de Estudo
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Todas as anotações vinculadas aos seus cursos e momentos específicos das aulas
          </p>
        </div>

        {/* Export Button */}
        {notes.length > 0 && (
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold shadow-glow transition-all active:scale-95"
            title="Exportar todas as anotações visíveis para um arquivo Markdown (.md)"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Caderno (.md)</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-background-surface/80 border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar nas anotações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {courses.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar por Curso:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos os Cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : notes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                note.is_pinned
                  ? 'bg-primary-950/20 border-primary-500/40 shadow-glow'
                  : 'bg-background-surface/80 border-border hover:border-slate-600'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400 truncate">
                    {note.course_title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-1 rounded hover:bg-background-elevated ${
                        note.is_pinned ? 'text-primary-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={note.is_pinned ? 'Desafixar nota' : 'Fixar nota'}
                    >
                      <Pin className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-background-elevated"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {note.lesson_title && (
                  <h4 className="text-xs font-semibold text-white mb-2 line-clamp-1">
                    Aula: {note.lesson_title}
                  </h4>
                )}

                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>

                {/* Attached Snapshot */}
                {note.snapshot_data && (
                  <div
                    className="mt-3 rounded-lg overflow-hidden border border-border/80 cursor-pointer group/snap relative bg-black"
                    onClick={() => setZoomSnapshot(note.snapshot_data || null)}
                    title="Clique para ampliar o print da aula"
                  >
                    <img
                      src={note.snapshot_data}
                      alt="Print da aula"
                      className="w-full h-32 object-cover group-hover/snap:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover/snap:bg-transparent transition-colors flex items-center justify-center opacity-0 group-hover/snap:opacity-100">
                      <span className="px-2 py-1 rounded bg-black/75 text-[11px] text-white flex items-center gap-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Ampliar Print
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with Timestamp and Action */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                {note.timestamp_seconds !== null && note.timestamp_seconds !== undefined ? (
                  <span className="inline-flex items-center gap-1 font-mono text-primary-400 font-semibold bg-primary-950/60 px-2 py-0.5 rounded border border-primary-800/40">
                    <Clock className="w-3 h-3" />
                    {formatTime(note.timestamp_seconds)}
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px]">Nota geral</span>
                )}

                {note.lesson_id && (
                  <button
                    onClick={() => onOpenPlayer(note.course_id, note.lesson_id!, note.timestamp_seconds !== null && note.timestamp_seconds !== undefined ? Number(note.timestamp_seconds) : undefined)}
                    className="flex items-center gap-1 text-primary-400 hover:text-primary-300 font-semibold text-xs"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Abrir na aula</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto border border-border space-y-3">
          <FileText className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma anotação encontrada</h3>
          <p className="text-xs text-slate-400">
            Você pode adicionar anotações com marcação de tempo e prints da tela enquanto assiste a qualquer aula no reprodutor de vídeo.
          </p>
        </div>
      )}

      {/* Zoom Snapshot Modal */}
      {zoomSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn"
          onClick={() => setZoomSnapshot(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-background-surface rounded-xl border border-border p-2 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={zoomSnapshot} alt="Screenshot ampliado" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setZoomSnapshot(null)}
              className="absolute top-4 right-4 p-2 bg-black/80 hover:bg-rose-600 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
