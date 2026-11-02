import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Flame, Clock, BookOpen, Play, FileText, X, ArrowRight, Loader2 } from 'lucide-react';
import { GlobalSearchResult } from '../../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAddSource: () => void;
  onSelectCourse?: (courseId: string) => void;
  onOpenPlayer?: (courseId: string, lessonId: string, initialTime?: number) => void;
  streakDays?: number;
  todayMinutes?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenAddSource,
  onSelectCourse,
  onOpenPlayer,
  streakDays = 0,
  todayMinutes = 0
}) => {
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounced live global search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults(null);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        if (window.api) {
          const res = await window.api.globalSearch(searchQuery.trim());
          setResults(res);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalHits = results
    ? results.courses.length + results.lessons.length + results.notes.length
    : 0;

  const handleClear = () => {
    onSearchChange('');
    setResults(null);
    setIsDropdownOpen(false);
  };

  return (
    <header className="h-16 border-b border-border bg-background-subtle/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 select-none shrink-0 z-30 relative">
      {/* Global Search Bar with Autocomplete Dropdown */}
      <div ref={dropdownRef} className="relative flex-1 max-w-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar cursos, aulas, professores, anotações..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => {
              if (results && totalHits > 0) setIsDropdownOpen(true);
            }}
            className="w-full bg-background-surface/90 border border-border text-sm text-slate-100 rounded-lg pl-10 pr-9 py-2 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-slate-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
              title="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Floating Search Results Dropdown */}
        {isDropdownOpen && results && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-background-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[75vh] flex flex-col backdrop-blur-xl animate-fadeIn">
            {/* Header info */}
            <div className="px-4 py-2.5 bg-background-elevated/60 border-b border-border/60 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                {totalHits} {totalHits === 1 ? 'resultado encontrado' : 'resultados encontrados'} para "{searchQuery}"
              </span>
              {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-400" />}
            </div>

            <div className="overflow-y-auto divide-y divide-border/40 p-2 space-y-3">
              {/* Courses Category */}
              {results.courses.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-primary-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Cursos ({results.courses.length})</span>
                  </div>
                  {results.courses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onSelectCourse?.(c.id);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-background-elevated transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-white group-hover:text-primary-300 truncate">
                          {c.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {c.instructor && <span>{c.instructor}</span>}
                          {c.category_name && <span>• {c.category_name}</span>}
                          <span>• {c.total_lessons} aulas</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-primary-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Lessons Category */}
              {results.lessons.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" />
                    <span>Aulas em Vídeo ({results.lessons.length})</span>
                  </div>
                  {results.lessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenPlayer?.(l.course_id, l.id);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-background-elevated transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-primary-300 truncate">
                          {l.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {l.course_title} • {l.module_title}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary-600/20 text-primary-300 group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
                        Assistir
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Notes Category */}
              {results.notes.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Anotações de Estudo ({results.notes.length})</span>
                  </div>
                  {results.notes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (n.lesson_id) {
                          onOpenPlayer?.(n.course_id, n.lesson_id, n.timestamp_seconds);
                        } else {
                          onSelectCourse?.(n.course_id);
                        }
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-background-elevated transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 truncate">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {n.course_title} {n.lesson_title ? `• ${n.lesson_title}` : ''}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 italic">
                          "{n.content}"
                        </p>
                      </div>
                      {n.timestamp_seconds !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">
                          {Math.floor(n.timestamp_seconds / 60)}:{(n.timestamp_seconds % 60 < 10 ? '0' : '')}{Math.floor(n.timestamp_seconds % 60)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {totalHits === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum resultado correspondente a "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Streak Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-surface border border-border text-xs font-medium text-slate-300">
          <Flame className="w-4 h-4 text-amber-500" />
          <span>{streakDays} {streakDays === 1 ? 'dia' : 'dias'} seguidos</span>
        </div>

        {/* Today Study Time Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-surface border border-border text-xs font-medium text-slate-300">
          <Clock className="w-4 h-4 text-primary-400" />
          <span>Hoje: <strong className="text-white">{todayMinutes} min</strong></span>
        </div>

        {/* Add Course Source Button */}
        <button
          onClick={onOpenAddSource}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold shadow-glow transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Origem</span>
        </button>
      </div>
    </header>
  );
};
