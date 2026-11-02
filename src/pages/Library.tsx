import React, { useEffect, useState } from 'react';
import { CourseCard } from '../components/courses/CourseCard';
import { Course, Source } from '../types';
import {
  Filter,
  ArrowUpDown,
  BookOpen,
  Plus,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface LibraryProps {
  onSelectCourse: (courseId: string) => void;
  onOpenAddSource: () => void;
  initialFavoritesOnly?: boolean;
  initialCompletedOnly?: boolean;
}

export const Library: React.FC<LibraryProps> = ({
  onSelectCourse,
  onOpenAddSource,
  initialFavoritesOnly = false,
  initialCompletedOnly = false
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(initialCompletedOnly ? 'completed' : 'all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(initialFavoritesOnly);
  const [sourceId, setSourceId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'title' | 'last_watched' | 'created_at' | 'progress'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const [cList, sList] = await Promise.all([
          window.api.listCourses({
            search,
            status: status !== 'all' ? status : undefined,
            favoritesOnly,
            sourceId: sourceId || undefined,
            sortBy,
            sortOrder
          }),
          window.api.listSources()
        ]);
        setCourses(cList);
        setSources(sList);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, status, favoritesOnly, sourceId, sortBy, sortOrder]);

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    try {
      await window.api.toggleFavorite(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {favoritesOnly
              ? 'Cursos Favoritos'
              : status === 'completed'
              ? 'Cursos Concluídos'
              : 'Biblioteca de Cursos'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {courses.length} {courses.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
          </p>
        </div>

        <button
          onClick={onOpenAddSource}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-glow transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Pasta ou Drive</span>
        </button>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="p-4 rounded-xl bg-background-surface/80 border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-background border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-500"
            >
              <option value="all">Todos</option>
              <option value="in_progress">Em Andamento</option>
              <option value="not_started">Não Iniciados</option>
              <option value="completed">Concluídos</option>
            </select>
          </div>

          {/* Source Select */}
          {sources.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Origem:</span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="bg-background border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-500 max-w-[180px] truncate"
              >
                <option value="">Todas as Origens</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.source_type === 'gdrive' ? 'Drive' : 'Local'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Favorites Checkbox */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              favoritesOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-background text-slate-400 border-border hover:text-white'
            }`}
          >
            Apenas Favoritos
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-500"
          >
            <option value="title">Nome</option>
            <option value="last_watched">Último Acesso</option>
            <option value="progress">Progresso</option>
            <option value="created_at">Adicionados Recentemente</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-background-elevated text-xs text-slate-300 font-medium"
            title="Inverter ordem"
          >
            {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
          </button>
        </div>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelect={onSelectCourse}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto border border-border space-y-4">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum curso encontrado</h3>
          <p className="text-xs text-slate-400">
            Tente ajustar os filtros ou adicione uma nova pasta para indexar seus vídeos.
          </p>
          <button
            onClick={onOpenAddSource}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Origem</span>
          </button>
        </div>
      )}
    </div>
  );
};
