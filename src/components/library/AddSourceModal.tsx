import React, { useEffect, useState } from 'react';
import { X, Folder, Cloud, HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { RcloneRemote, SourceType } from '../../types';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded: (sourceId: string) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onSourceAdded
}) => {
  const [activeTab, setActiveTab] = useState<SourceType>('local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local tab state
  const [localPath, setLocalPath] = useState('');
  const [localName, setLocalName] = useState('');

  // Rclone tab state
  const [remotes, setRemotes] = useState<RcloneRemote[]>([]);
  const [selectedRemote, setSelectedRemote] = useState('');
  const [remoteSubfolder, setRemoteSubfolder] = useState('');
  const [remoteName, setRemoteName] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (isOpen && window.api) {
      window.api.listRcloneRemotes().then((list) => {
        setRemotes(list);
        if (list.length > 0 && !selectedRemote) {
          setSelectedRemote(list[0].name);
          setRemoteName(`Google Drive (${list[0].name})`);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectLocalFolder = async () => {
    try {
      const selected = await window.api.selectFolder();
      if (selected) {
        setLocalPath(selected);
        const parts = selected.replace(/\\/g, '/').split('/');
        const folderName = parts[parts.length - 1] || 'Cursos Locais';
        if (!localName) {
          setLocalName(folderName);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestRemote = async () => {
    if (!selectedRemote) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const fullPath = remoteSubfolder.trim() 
        ? `${selectedRemote}/${remoteSubfolder.trim()}`.replace(/\/+/g, '/')
        : selectedRemote;

      const res = await window.api.testRcloneRemote(fullPath);
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Conexão confirmada com sucesso!' : 'Falha ao acessar remote')
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'local') {
        if (!localPath.trim()) {
          throw new Error('Por favor, selecione uma pasta no computador');
        }
        const created = await window.api.addSource({
          name: localName.trim() || 'Cursos Locais',
          sourceType: 'local',
          rootPath: localPath.trim()
        });
        if (created) {
          onSourceAdded(created.id);
          onClose();
        }
      } else {
        if (!selectedRemote) {
          throw new Error('Nenhum remote do Rclone selecionado');
        }
        const fullRemotePath = remoteSubfolder.trim()
          ? `${selectedRemote}${remoteSubfolder.trim()}`.replace(/\/+/g, '/')
          : selectedRemote;

        const created = await window.api.addSource({
          name: remoteName.trim() || `Google Drive (${selectedRemote})`,
          sourceType: 'gdrive',
          rootPath: fullRemotePath,
          remoteName: selectedRemote
        });
        if (created) {
          onSourceAdded(created.id);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Adicionar Origem de Cursos</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha uma pasta no seu computador ou um remote do Google Drive
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-background-elevated flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Type Tabs */}
        <div className="grid grid-cols-2 p-2 bg-background-subtle border-b border-border gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'local'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-background-surface'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Pasta Local (PC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gdrive')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'gdrive'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-background-surface'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Google Drive (Rclone)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'local' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pasta dos Cursos no Computador
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="Selecione o diretório no computador..."
                    value={localPath}
                    className="flex-1 bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSelectLocalFolder}
                    className="flex items-center gap-1.5 px-3 py-2 bg-background-elevated hover:bg-primary-600 border border-border hover:border-primary-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Procurar</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome de Exibição da Origem
                </label>
                <input
                  type="text"
                  placeholder="Ex: Meus Cursos de Programação"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="w-full bg-background border border-border text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Remote Configurado no Rclone
                </label>
                {remotes.length > 0 ? (
                  <select
                    value={selectedRemote}
                    onChange={(e) => {
                      setSelectedRemote(e.target.value);
                      setRemoteName(`Google Drive (${e.target.value})`);
                    }}
                    className="w-full bg-background border border-border text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                  >
                    {remotes.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} ({r.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs">
                    Nenhum remote detectado. Certifique-se de que o Rclone está instalado e configurado via <code>rclone config</code> no terminal.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subpasta no Google Drive (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cursos ou Faculdade/2026 (deixe vazio para a raiz)"
                  value={remoteSubfolder}
                  onChange={(e) => setRemoteSubfolder(e.target.value)}
                  className="w-full bg-background border border-border text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome da Origem
                </label>
                <input
                  type="text"
                  placeholder="Ex: Google Drive - Cursos"
                  value={remoteName}
                  onChange={(e) => setRemoteName(e.target.value)}
                  className="w-full bg-background border border-border text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestRemote}
                  disabled={testingConnection || !selectedRemote}
                  className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 font-medium disabled:opacity-50"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testando conexão com o Google Drive...</span>
                    </>
                  ) : (
                    <span>Testar Acesso ao Remote</span>
                  )}
                </button>

                {testResult && (
                  <span className={`text-xs flex items-center gap-1 ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {testResult.message}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-background-elevated text-slate-300 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold shadow-glow disabled:opacity-50 transition-all"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Adicionar e Indexar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
