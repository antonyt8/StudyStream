import React from 'react';
import { Search, Plus, Flame, Clock } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAddSource: () => void;
  streakDays?: number;
  todayMinutes?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenAddSource,
  streakDays = 0,
  todayMinutes = 0
}) => {
  return (
    <header className="h-16 border-b border-border bg-background-subtle/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 select-none shrink-0 z-10">
      {/* Global Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Pesquisar cursos, aulas, professores, anotações..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-background-surface/80 border border-border text-sm text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-slate-500"
        />
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
