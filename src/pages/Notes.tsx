import React, { useEffect, useState } from 'react';
import { Note, Course } from '../types';
import { FileText, Search, Clock, Trash2, Pin, Play, BookOpen } from 'lucide-react';

interface NotesPageProps {
  onOpenPlayer: (courseId: string, lessonId: string) => void;
}

export const NotesPage: React.FC<NotesPageProps> = ({ onOpenPlayer }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

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

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary-400" />
          Minhas Anotações de Estudo
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Todas as anotações vinculadas aos seus cursos e momentos específicos das aulas
        </p>
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
                    onClick={() => onOpenPlayer(note.course_id, note.lesson_id!)}
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
            Você pode adicionar anotações com marcação de tempo enquanto assiste a qualquer aula no reprodutor de vídeo.
          </p>
        </div>
      )}
    </div>
  );
};
