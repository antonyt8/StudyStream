import React from 'react';
import { Loader2, Film, FileCheck2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ScanProgress } from '../../types';

interface ScanProgressModalProps {
  progress: ScanProgress | null;
  onCancel: () => void;
  onDismiss: () => void;
}

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({
  progress,
  onCancel,
  onDismiss
}) => {
  if (!progress) return null;

  const isFinished = progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background-surface border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 select-none animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
            {isFinished ? (
              progress.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-400" />
              )
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {progress.status === 'completed'
                ? 'Varredura Concluída!'
                : progress.status === 'error'
                ? 'Erro na Varredura'
                : progress.status === 'cancelled'
                ? 'Varredura Cancelada'
                : 'Indexando Conteúdo...'}
            </h3>
            <p className="text-xs text-slate-400">
              {progress.status === 'completed'
                ? 'Sua biblioteca foi atualizada com sucesso.'
                : 'Examinando pastas e organizando módulos e aulas'}
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Arquivos Examinados</span>
            </div>
            <div className="text-lg font-bold text-white">
              {progress.filesExamined}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Film className="w-3.5 h-3.5 text-primary-400" />
              <span>Vídeos Catalogados</span>
            </div>
            <div className="text-lg font-bold text-primary-400">
              {progress.videosFound}
            </div>
          </div>
        </div>

        {/* Current Folder */}
        {progress.currentFolder && (
          <div className="text-xs text-slate-400 mb-4 truncate bg-background/50 px-3 py-2 rounded-lg border border-border/60">
            Pasta atual: <span className="text-slate-200 font-mono">{progress.currentFolder}</span>
          </div>
        )}

        {/* Error message */}
        {progress.error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-4">
            {progress.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          {!isFinished ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-border hover:bg-background-elevated text-slate-300 text-sm font-medium transition-colors"
            >
              Cancelar Varredura
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold shadow-glow transition-all"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
