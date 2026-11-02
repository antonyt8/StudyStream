import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  FileVideo,
  FileText,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { RcloneRemote, SourceType, ExplorerListing } from '../../types';

interface FolderExplorerProps {
  onAddCourse: (data: {
    name: string;
    sourceType: SourceType;
    rootPath: string;
    remoteName?: string;
    scanMode?: 'single_course' | 'multi_course';
  }) => void;
  onCancel: () => void;
}

export const FolderExplorer: React.FC<FolderExplorerProps> = ({ onAddCourse, onCancel }) => {
  const [activeTab, setActiveTab] = useState<SourceType>('gdrive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rclone Explorer State
  const [remotes, setRemotes] = useState<RcloneRemote[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<string>('');
  const [remoteSubfolder, setRemoteSubfolder] = useState<string>('');
  const [remoteListing, setRemoteListing] = useState<ExplorerListing | null>(null);

  // Local Explorer State
  const [localPath, setLocalPath] = useState<string>('');
  const [localListing, setLocalListing] = useState<ExplorerListing | null>(null);

  // Custom Course Title and Scan Mode for import
  const [customCourseTitle, setCustomCourseTitle] = useState<string>('');
  const [scanMode, setScanMode] = useState<'single_course' | 'multi_course'>('single_course');

  // 1. Initial Remotes Load
  useEffect(() => {
    if (window.api) {
      window.api.listRcloneRemotes().then((list) => {
        setRemotes(list);
        if (list.length > 0) {
          const first = list[0].name;
          setSelectedRemote(first);
          loadRemoteDirectory(first, '');
        } else {
          setActiveTab('local');
          loadLocalDirectory('');
        }
      }).catch(() => {
        setActiveTab('local');
        loadLocalDirectory('');
      });
    }
  }, []);

  // 2. Load Remote Directory
  const loadRemoteDirectory = async (remote: string, subfolder: string) => {
    if (!window.api || !remote) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.explorerListRemote(remote, subfolder);
      if (res.success) {
        setRemoteListing(res);
        setRemoteSubfolder(subfolder);
        // Default course title to the folder name
        const folderName = subfolder.split('/').filter(Boolean).pop() || remote.replace(/:$/, '');
        setCustomCourseTitle(folderName);
      } else {
        setError(res.error || 'Não foi possível listar esta pasta remota');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Load Local Directory
  const loadLocalDirectory = async (folderPath?: string) => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.explorerListLocal(folderPath);
      if (res.success) {
        setLocalListing(res);
        setLocalPath(res.currentPath);
        if (res.currentPath) {
          const parts = res.currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
          const folderName = parts[parts.length - 1] || 'Cursos Locais';
          setCustomCourseTitle(folderName);
        } else {
          setCustomCourseTitle('Meus Cursos');
        }
      } else {
        setError(res.error || 'Erro ao acessar pasta local');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRemote = (remote: string) => {
    setSelectedRemote(remote);
    setRemoteSubfolder('');
    loadRemoteDirectory(remote, '');
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const detectPart = (filename: string) => {
    const match = filename.match(/(?:parte|part|pt)\s*(\d+)/i);
    return match ? `Parte ${match[1]}` : null;
  };

  const currentListing = activeTab === 'gdrive' ? remoteListing : localListing;

  const handleImportCurrentFolderAsCourse = () => {
    if (activeTab === 'gdrive') {
      if (!selectedRemote) return;
      const fullPath = remoteSubfolder
        ? `${selectedRemote}${remoteSubfolder}`.replace(/\/+/g, '/')
        : selectedRemote;
      const title = customCourseTitle.trim() || remoteSubfolder.split('/').pop() || 'Curso Google Drive';
      onAddCourse({
        name: title,
        sourceType: 'gdrive',
        rootPath: fullPath,
        remoteName: selectedRemote,
        scanMode
      });
    } else {
      if (!localPath) return;
      const title = customCourseTitle.trim() || localPath.split(/[/\\]/).pop() || 'Curso Local';
      onAddCourse({
        name: title,
        sourceType: 'local',
        rootPath: localPath,
        scanMode
      });
    }
  };

  const handleQuickAddSubfolder = (folderPath: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab === 'gdrive') {
      const fullPath = `${selectedRemote}${folderPath}`.replace(/\/+/g, '/');
      onAddCourse({
        name: folderName,
        sourceType: 'gdrive',
        rootPath: fullPath,
        remoteName: selectedRemote,
        scanMode: 'single_course'
      });
    } else {
      onAddCourse({
        name: folderName,
        sourceType: 'local',
        rootPath: folderPath,
        scanMode: 'single_course'
      });
    }
  };

  return (
    <div className="flex flex-col h-[580px] bg-background-surface rounded-2xl overflow-hidden border border-border select-none">
      {/* Top Bar: Tabs & Drive/Remote Selector */}
      <div className="p-4 bg-background-subtle border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('gdrive');
                if (selectedRemote) loadRemoteDirectory(selectedRemote, remoteSubfolder);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'gdrive'
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-white hover:bg-background-elevated'
              }`}
            >
              <Cloud className="w-4 h-4 text-accent-cyan" />
              <span>Google Drive (Rclone)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('local');
                loadLocalDirectory(localPath);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'local'
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-white hover:bg-background-elevated'
              }`}
            >
              <HardDrive className="w-4 h-4 text-primary-400" />
              <span>Pasta Local (PC)</span>
            </button>
          </div>

          {activeTab === 'gdrive' && remotes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Remote:</span>
              <select
                value={selectedRemote}
                onChange={(e) => handleSelectRemote(e.target.value)}
                className="bg-background border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary-500 font-semibold"
              >
                {remotes.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'local' && (
            <button
              type="button"
              onClick={async () => {
                if (window.api) {
                  const picked = await window.api.selectFolder();
                  if (picked) loadLocalDirectory(picked);
                }
              }}
              className="px-2.5 py-1 bg-background-elevated hover:bg-primary-600 text-white rounded-lg text-xs font-semibold border border-border flex items-center gap-1.5 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Escolher Pasta no Windows</span>
            </button>
          )}
        </div>

        {/* Breadcrumb Navigation Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-background/80 rounded-xl border border-border overflow-x-auto text-xs font-medium text-slate-300">
          {currentListing?.parentPath !== undefined && (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'gdrive') {
                  loadRemoteDirectory(selectedRemote, currentListing.parentPath || '');
                } else {
                  loadLocalDirectory(currentListing.parentPath);
                }
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-background-elevated rounded transition-colors mr-1"
              title="Voltar para a pasta anterior"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1 flex-1 flex-wrap">
            {currentListing?.breadcrumbs.map((crumb, idx) => {
              const isLast = idx === (currentListing.breadcrumbs.length - 1);
              return (
                <React.Fragment key={crumb.path || idx}>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'gdrive') {
                        loadRemoteDirectory(selectedRemote, crumb.path);
                      } else {
                        loadLocalDirectory(crumb.path);
                      }
                    }}
                    className={`hover:text-primary-400 transition-colors ${
                      isLast ? 'text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                  {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'gdrive') loadRemoteDirectory(selectedRemote, remoteSubfolder);
              else loadLocalDirectory(localPath);
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-background-elevated transition-colors"
            title="Atualizar pasta"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Explorer Content (Folders & Files Grid/List) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-xs font-medium">Lendo arquivos e subpastas...</p>
          </div>
        ) : (
          <>
            {/* Subfolders Section */}
            {currentListing && currentListing.folders.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-primary-400" />
                  <span>Subpastas ({currentListing.folders.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {currentListing.folders.map((folder) => (
                    <div
                      key={folder.path}
                      onClick={() => {
                        if (activeTab === 'gdrive') loadRemoteDirectory(selectedRemote, folder.path);
                        else loadLocalDirectory(folder.path);
                      }}
                      className="group p-3 rounded-xl border border-border bg-background-elevated/40 hover:bg-background-elevated hover:border-primary-500/50 cursor-pointer flex items-center justify-between gap-2.5 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Folder className="w-4 h-4 text-primary-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                          {folder.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleQuickAddSubfolder(folder.path, folder.name, e)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 shadow-glow"
                        title="Adicionar esta subpasta diretamente como curso"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Section (Videos & PDFs) */}
            {currentListing && currentListing.files.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileVideo className="w-3.5 h-3.5 text-accent-cyan" />
                    <span>Conteúdo da Pasta ({currentListing.videoCount} vídeos, {currentListing.pdfCount} PDFs)</span>
                  </h4>
                </div>

                <div className="space-y-1.5 bg-background/50 rounded-xl border border-border p-2 divide-y divide-border/40">
                  {currentListing.files.map((file, idx) => {
                    const partBadge = detectPart(file.name);
                    return (
                      <div
                        key={file.path || idx}
                        className="py-1.5 px-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {file.isPdf ? (
                            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <FileVideo className="w-4 h-4 text-accent-cyan shrink-0" />
                          )}

                          <span className="text-slate-300 truncate font-medium">
                            {file.name}
                          </span>

                          {partBadge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-900/60 text-primary-300 border border-primary-700/50 shrink-0">
                              {partBadge}
                            </span>
                          )}

                          {file.isPdf && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-700/50 shrink-0">
                              PDF
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {formatSize(file.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentListing && currentListing.folders.length === 0 && currentListing.files.length === 0 && (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Folder className="w-10 h-10 opacity-30" />
                <p className="text-xs">Esta pasta está vazia ou não possui vídeos/documentos suportados.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Footer: Import Current Folder */}
      <div className="p-4 bg-background-subtle border-t border-border flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="block text-[11px] font-semibold text-slate-300">
            Nome do Curso na Biblioteca:
          </label>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
              <input
                type="radio"
                name="scanMode"
                checked={scanMode === 'single_course'}
                onChange={() => setScanMode('single_course')}
                className="text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
              />
              <span className={scanMode === 'single_course' ? 'text-primary-300 font-semibold' : ''}>
                Curso Único (subpastas viram módulos)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
              <input
                type="radio"
                name="scanMode"
                checked={scanMode === 'multi_course'}
                onChange={() => setScanMode('multi_course')}
                className="text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
              />
              <span className={scanMode === 'multi_course' ? 'text-primary-300 font-semibold' : ''}>
                Pasta com Vários Cursos
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            value={customCourseTitle}
            onChange={(e) => setCustomCourseTitle(e.target.value)}
            placeholder="Ex: Redação com Jamilk"
            className="flex-1 w-full bg-background border border-border text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-500 font-semibold"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-slate-300 hover:text-white hover:bg-background-elevated transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleImportCurrentFolderAsCourse}
              disabled={!customCourseTitle.trim()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs font-bold shadow-glow transition-all active:scale-[0.98]"
            >
              <BookOpen className="w-4 h-4" />
              <span>Adicionar à Biblioteca</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
