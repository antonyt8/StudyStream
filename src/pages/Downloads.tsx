import React, { useEffect, useState } from 'react';
import { DownloadItem } from '../types';
import { Download, CheckCircle2, AlertCircle, Loader2, Trash2, Play, RotateCcw, Pause } from 'lucide-react';

interface DownloadsPageProps {
  onOpenPlayer: (courseId: string, lessonId: string) => void;
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({ onOpenPlayer }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      if (window.api) {
        const list = await window.api.listDownloads();
        setDownloads(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (window.api) {
      const unsubProg = window.api.onDownloadProgress((data) => {
        setDownloads(prev => prev.map(d => {
          if (d.id === data.id) {
            return {
              ...d,
              downloaded_bytes: data.downloaded,
              total_bytes: data.total,
              speed: data.speed,
              status: 'downloading'
            };
          }
          return d;
        }));
      });

      const unsubComp = window.api.onDownloadCompleted(() => {
        loadData();
      });
      const unsubError = window.api.onDownloadError(() => {
        loadData();
      });

      return () => {
        unsubProg();
        unsubComp();
        unsubError();
      };
    }
  }, []);

  const handleDelete = async (id: string) => {
    await window.api.deleteDownload(id);
    loadData();
  };

  const handleRetry = async (lessonId: string) => {
    try {
      await window.api.startDownload(lessonId);
      loadData();
    } catch (err: any) {
      alert(`Erro ao reiniciar download: ${err.message}`);
    }
  };

  const handleCancel = async (id: string) => {
    await window.api.cancelDownload(id);
    loadData();
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (speedBytesSec: number) => {
    return `${formatBytes(speedBytesSec)}/s`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Download className="w-6 h-6 text-primary-400" />
          Downloads & Modo Offline
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Acompanhe o download de aulas remotas para estudar mesmo quando estiver sem internet
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : downloads.length > 0 ? (
        <div className="space-y-3">
          {downloads.map((item) => {
            const isCompleted = item.status === 'completed';
            const isDownloading = item.status === 'downloading';
            const isPaused = item.status === 'paused';
            const isError = item.status === 'error';

            const pct = item.total_bytes > 0
              ? Math.min(100, Math.round((item.downloaded_bytes / item.total_bytes) * 100))
              : 0;

            return (
              <div
                key={item.id}
                className="p-4 bg-background-surface/80 border border-border rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-primary-400 uppercase">
                      {item.course_title}
                    </span>
                    <h4 className="text-sm font-semibold text-white truncate mt-0.5">
                      {item.lesson_title}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {item.destination_path}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted && (
                      <button
                        onClick={() => onOpenPlayer(item.course_id, item.lesson_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold shadow-glow"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Assistir</span>
                      </button>
                    )}

                    {isError && (
                      <button
                        onClick={() => handleRetry(item.lesson_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-semibold border border-rose-500/30 transition-colors"
                        title="Tentar baixar novamente"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Tentar Novamente</span>
                      </button>
                    )}

                    {isDownloading && (
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-background-elevated rounded transition-colors"
                        title="Pausar download"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}

                    {isPaused && (
                      <button
                        onClick={() => handleRetry(item.lesson_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg text-xs font-semibold border border-amber-500/30 transition-colors"
                        title="Retomar download"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retomar</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-background-elevated rounded transition-colors"
                      title="Remover da lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5">
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {isDownloading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-400" />}
                      {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                      <span className={isCompleted ? 'text-emerald-400 font-semibold' : ''}>
                        {isCompleted
                          ? 'Download Concluído (Disponível offline)'
                          : isDownloading
                          ? `Baixando... (${formatSpeed(item.speed)})`
                          : isError
                          ? `Erro: ${item.error_message || 'Falha no download'}`
                          : isPaused
                          ? 'Download pausado'
                          : 'Aguardando na fila...'}
                      </span>
                    </span>

                    <span className="font-mono text-slate-300">
                      {formatBytes(item.downloaded_bytes)} / {formatBytes(item.total_bytes)} ({pct}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isError
                          ? 'bg-rose-500'
                          : 'bg-primary-500 shadow-glow'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto border border-border space-y-3">
          <Download className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum download na fila</h3>
          <p className="text-xs text-slate-400">
            Ao navegar pelas aulas de um curso no Google Drive, clique no ícone de download para salvar a aula e assisti-la offline.
          </p>
        </div>
      )}
    </div>
  );
};
