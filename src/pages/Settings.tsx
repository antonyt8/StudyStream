import React, { useEffect, useState } from 'react';
import { AppSettings, RcloneStatus, Source } from '../types';
import {
  Settings as SettingsIcon,
  HardDrive,
  Cloud,
  Database,
  RefreshCw,
  Folder,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  DownloadCloud,
  Loader2
} from 'lucide-react';

interface SettingsPageProps {
  onReScanSource: (sourceId: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onReScanSource }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [rcloneStatus, setRcloneStatus] = useState<RcloneStatus | null>(null);
  const [testingRemote, setTestingRemote] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [integrityResult, setIntegrityResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const loadData = async () => {
    try {
      if (window.api) {
        const [s, srcList, rStatus] = await Promise.all([
          window.api.getSettings(),
          window.api.listSources(),
          window.api.checkRcloneStatus()
        ]);
        setSettings(s);
        setSources(srcList);
        setRcloneStatus(rStatus);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !window.api) return;

    try {
      const updated = await window.api.saveSettings(settings);
      setSettings(updated);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectDownloadDir = async () => {
    try {
      const dir = await window.api.selectDownloadDir();
      if (dir && settings) {
        setSettings({ ...settings, defaultDownloadPath: dir });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestRemote = async () => {
    if (!settings?.selectedRemote) return;
    setTestingRemote(true);
    setTestResult(null);
    try {
      const res = await window.api.testRcloneRemote(settings.selectedRemote);
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Conexão funcionando com sucesso!' : 'Erro na conexão')
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingRemote(false);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (confirm(`Deseja desvincular a origem "${name}"? Os arquivos originais NÃO serão apagados do seu computador ou Google Drive.`)) {
      await window.api.deleteSource(id);
      loadData();
    }
  };

  const handleBackup = async () => {
    const res = await window.api.backupDatabase();
    if (res.success) {
      alert('Backup do banco de dados salvo com sucesso!');
    } else if (!res.cancelled) {
      alert(`Erro ao criar backup: ${res.error}`);
    }
  };

  const handleRestore = async () => {
    if (confirm('Atenção: A restauração substituirá todos os dados atuais pelo arquivo selecionado. Deseja prosseguir?')) {
      const res = await window.api.restoreDatabase();
      if (res.success) {
        alert('Banco de dados restaurado com sucesso! A página será recarregada.');
        window.location.reload();
      } else if (!res.cancelled) {
        alert(`Erro ao restaurar backup: ${res.error}`);
      }
    }
  };

  const handleCheckIntegrity = async () => {
    const res = await window.api.checkDbIntegrity();
    setIntegrityResult(res);
  };

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary-400" />
          Configurações do Sistema
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Gerenciamento de origens, Rclone, preferências de reprodução e banco de dados SQLite
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
        {/* Section 1: Preferências Gerais e Player */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary-400" />
            <span>Preferências do Player e Geral</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Velocidade Padrão de Reprodução
              </label>
              <select
                value={settings.defaultPlaybackSpeed}
                onChange={(e) => setSettings({ ...settings, defaultPlaybackSpeed: parseFloat(e.target.value) })}
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={1.75}>1.75x</option>
                <option value={2}>2.0x</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Conclusão Automática da Aula
              </label>
              <select
                value={settings.autoCompleteThreshold}
                onChange={(e) => setSettings({ ...settings, autoCompleteThreshold: parseFloat(e.target.value) })}
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              >
                <option value={0.8}>Ao assistir 80% do vídeo</option>
                <option value={0.9}>Ao assistir 90% do vídeo (Padrão)</option>
                <option value={0.95}>Ao assistir 95% do vídeo</option>
                <option value={1}>Somente com 100%</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Pasta Padrão para Downloads Offline
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="Selecione um diretório de download..."
                  value={settings.defaultDownloadPath}
                  className="flex-1 bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSelectDownloadDir}
                  className="px-3.5 py-2 bg-background-elevated hover:bg-primary-600 text-white rounded-lg text-xs font-medium border border-border transition-colors flex items-center gap-1.5"
                >
                  <Folder className="w-4 h-4" />
                  <span>Escolher</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Integração Google Drive & Rclone */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-accent-cyan" />
              <span>Integração Rclone & Google Drive</span>
            </h3>

            {rcloneStatus?.installed ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Rclone detectado ({rcloneStatus.version || 'Instalado'})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Rclone não detectado no PATH
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Caminho do Executável Rclone
              </label>
              <input
                type="text"
                value={settings.rclonePath}
                onChange={(e) => setSettings({ ...settings, rclonePath: e.target.value })}
                placeholder="rclone (ou caminho absoluto no Windows)"
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Remote Padrão do Google Drive
              </label>
              <input
                type="text"
                value={settings.selectedRemote}
                onChange={(e) => setSettings({ ...settings, selectedRemote: e.target.value })}
                placeholder="Ex: gdrive:"
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTestRemote}
              disabled={testingRemote}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-primary-300 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {testingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Testar Acesso ao Google Drive</span>
            </button>

            {testResult && (
              <span className={`text-xs flex items-center gap-1 ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Section 3: Origens Cadastradas */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-amber-400" />
            <span>Origens da Biblioteca ({sources.length})</span>
          </h3>

          {sources.length > 0 ? (
            <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-background">
              {sources.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{s.name}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-background-elevated text-slate-300">
                        {s.source_type === 'gdrive' ? 'Google Drive' : 'Pasta Local'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      {s.root_path}
                    </p>
                    {s.last_scan_at && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Última varredura: {new Date(s.last_scan_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onReScanSource(s.id)}
                      className="px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600 text-primary-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Reindexar esta pasta"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reindexar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSource(s.id, s.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-background-elevated rounded transition-colors"
                      title="Desvincular origem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Nenhuma pasta ou remote cadastrado ainda. Use o botão "Adicionar Origem" no topo.
            </p>
          )}
        </div>

        {/* Section 4: Banco de Dados SQLite e Manutenção */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <span>Banco de Dados SQLite & Backup</span>
          </h3>

          <div className="p-3 bg-background border border-border rounded-xl">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Local do Arquivo SQLite</div>
            <div className="text-xs text-slate-200 font-mono mt-1 select-all break-all">
              {settings.dbPath || 'studystream.db'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleBackup}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-slate-200 rounded-lg flex items-center gap-2 transition-colors"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Criar Backup do Banco (.db)</span>
            </button>

            <button
              type="button"
              onClick={handleRestore}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-slate-200 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Restaurar Backup</span>
            </button>

            <button
              type="button"
              onClick={handleCheckIntegrity}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-slate-200 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verificar Integridade SQLite</span>
            </button>
          </div>

          {integrityResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${integrityResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
              {integrityResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>Integridade do banco: {integrityResult.message}</span>
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedFeedback ? (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Configurações salvas com sucesso!
            </span>
          ) : <div />}

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm shadow-glow transition-all active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
