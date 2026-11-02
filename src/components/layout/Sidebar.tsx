import React, { useEffect, useState } from 'react';
import {
  Home,
  BookOpen,
  Compass,
  PlayCircle,
  Heart,
  CheckCircle2,
  FileText,
  History,
  Target,
  Download,
  Settings,
  HardDrive,
  Cloud,
  Check,
  AlertCircle
} from 'lucide-react';
import { RcloneStatus } from '../../types';

export type ActivePage = 
  | 'dashboard'
  | 'library'
  | 'all-courses'
  | 'continue'
  | 'favorites'
  | 'completed'
  | 'notes'
  | 'history'
  | 'goals'
  | 'downloads'
  | 'settings';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const [rcloneStatus, setRcloneStatus] = useState<RcloneStatus | null>(null);

  useEffect(() => {
    if (window.api) {
      window.api.checkRcloneStatus().then(setRcloneStatus).catch(() => {});
    }
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'library', label: 'Minha Biblioteca', icon: BookOpen },
    { id: 'all-courses', label: 'Todos os Cursos', icon: Compass },
    { id: 'continue', label: 'Continuar Assistindo', icon: PlayCircle },
    { id: 'favorites', label: 'Favoritos', icon: Heart },
    { id: 'completed', label: 'Cursos Concluídos', icon: CheckCircle2 },
    { id: 'notes', label: 'Minhas Anotações', icon: FileText },
    { id: 'history', label: 'Histórico de Estudos', icon: History },
    { id: 'goals', label: 'Metas de Estudo', icon: Target },
    { id: 'downloads', label: 'Downloads Offline', icon: Download },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-background-subtle border-r border-border flex flex-col h-screen select-none z-20 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 via-primary-500 to-accent-cyan flex items-center justify-center shadow-glow">
          <PlayCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            StudyStream
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary-900/60 text-primary-300 border border-primary-700/50">
              Desktop
            </span>
          </h1>
          <p className="text-xs text-slate-400">Streaming & Aprendizado</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ActivePage)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-background-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Google Drive & Rclone Status Footer */}
      <div className="p-3 border-t border-border bg-background-surface/50">
        <div className="p-2.5 rounded-lg border border-border/80 bg-background/60">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-accent-cyan" />
              Google Drive / Rclone
            </span>
            {rcloneStatus?.installed ? (
              <span className="inline-flex items-center text-[10px] text-emerald-400 gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <Check className="w-3 h-3" /> Conectado
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] text-amber-400 gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <AlertCircle className="w-3 h-3" /> Ausente
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {rcloneStatus?.installed
              ? `${rcloneStatus.remotes.length} remotes disponíveis (${rcloneStatus.version || 'v1.74'})`
              : 'Configure o Rclone nas opções'}
          </p>
        </div>
      </div>
    </aside>
  );
};
