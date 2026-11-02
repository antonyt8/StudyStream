import React, { useEffect, useState } from 'react';
import { AppSettings, RcloneStatus, Source, RcloneDiagnostics } from '../types';
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
  Loader2,
  Activity,
  Cpu,
  FileCode,
  FileDown,
  Sparkles,
  ShieldAlert,
  Moon,
  Sun
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
  const [diagnostics, setDiagnostics] = useState<RcloneDiagnostics | null>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
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

  const handleRunDiagnostics = async () => {
    if (!settings || !window.api) return;
    setRunningDiagnostics(true);
    setDiagnostics(null);
    try {
      const res = await window.api.getRcloneDiagnostics(settings.rclonePath, settings.selectedRemote);
      setDiagnostics(res);
    } catch (err: any) {
      setDiagnostics({
        installed: false,
        version: '',
        configPath: '',
        remotesCount: 0,
        canConnectDrive: false,
        message: err.message
      });
    } finally {
      setRunningDiagnostics(false);
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

  const handleExportJson = async () => {
    const res = await window.api.exportUserDataJson();
    if (res.success && res.filePath) {
      alert(`Dados exportados com sucesso para:\n${res.filePath}`);
    } else if (!res.cancelled && res.error) {
      alert(`Erro ao exportar dados: ${res.error}`);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Deseja limpar os arquivos temporários e cache de reprodução?')) {
      const res = await window.api.clearCache();
      if (res.success) {
        alert('Cache temporário limpo com sucesso!');
      } else {
        alert(`Erro ao limpar cache: ${res.error}`);
      }
    }
  };

  const handleResetLocalData = async () => {
    const confirm1 = confirm('ATENÇÃO: Deseja realmente resetar todos os dados locais do aplicativo (cursos indexados, anotações, histórico e metas)?\n\nNENHUM ARQUIVO de curso será apagado do seu computador ou Google Drive.');
    if (!confirm1) return;
    const confirm2 = confirm('Confirmação final: Esta ação é irreversível a menos que você tenha um backup prévio. Deseja prosseguir com a exclusão dos dados locais?');
    if (!confirm2) return;

    const res = await window.api.resetLocalData();
    if (res.success) {
      alert('Dados locais resetados com sucesso! O aplicativo será recarregado.');
      window.location.reload();
    } else {
      alert(`Erro ao resetar: ${res.error}`);
    }
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                {settings.theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-primary-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                <span>Tema Visual da Interface</span>
              </label>
              <select
                value={settings.theme}
                onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'dark' | 'light' })}
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              >
                <option value="dark">Tema Escuro (Padrão Streaming)</option>
                <option value="light">Tema Claro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Idioma da Aplicação
              </label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              >
                <option value="pt-BR">Português (Brasil)</option>
              </select>
            </div>

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

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-background/50 hover:bg-background cursor-pointer transition-colors text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.autoResume}
                  onChange={(e) => setSettings({ ...settings, autoResume: e.target.checked })}
                  className="rounded border-border text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>Retomar vídeo automaticamente de onde parou</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-background/50 hover:bg-background cursor-pointer transition-colors text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.startWithWindows}
                  onChange={(e) => setSettings({ ...settings, startWithWindows: e.target.checked })}
                  className="rounded border-border text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>Iniciar StudyStream com o Windows</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Integração Google Drive & Rclone */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-accent-cyan" />
              <span>Integração Rclone & Google Drive</span>
            </h3>

            {rcloneStatus?.installed ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Rclone detectado ({rcloneStatus.version || 'Instalado'})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.selectedRemote}
                  onChange={(e) => setSettings({ ...settings, selectedRemote: e.target.value })}
                  placeholder="Ex: gdrive:"
                  className="flex-1 bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
                />
                {rcloneStatus && rcloneStatus.remotes.length > 0 && (
                  <select
                    value={settings.selectedRemote}
                    onChange={(e) => setSettings({ ...settings, selectedRemote: e.target.value })}
                    className="bg-background-elevated border border-border text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none"
                    title="Remotes detectados no seu computador"
                  >
                    <option value="" disabled>Detectados</option>
                    {rcloneStatus.remotes.map((r) => (
                      <option key={r.name} value={r.name.endsWith(':') ? r.name : `${r.name}:`}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Subpasta Remota Padrão (Opcional)
              </label>
              <input
                type="text"
                value={settings.remoteFolderPath || ''}
                onChange={(e) => setSettings({ ...settings, remoteFolderPath: e.target.value })}
                placeholder="Ex: Cursos ou MeusCursos/TI (deixe em branco para raiz do remote)"
                className="w-full bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Advanced VFS Cache & Streaming Performance */}
          <div className="p-4 bg-background border border-border rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Cpu className="w-4 h-4 text-primary-400" />
              <span>Ajustes Avançados de Cache VFS & Streaming HTTP</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Modo de Cache VFS
                </label>
                <select
                  value={settings.rcloneVfsCacheMode || 'minimal'}
                  onChange={(e) => setSettings({ ...settings, rcloneVfsCacheMode: e.target.value as any })}
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="minimal">minimal (Recomendado)</option>
                  <option value="writes">writes</option>
                  <option value="full">full</option>
                  <option value="off">off (sem cache)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tamanho Máximo do Cache VFS
                </label>
                <input
                  type="text"
                  value={settings.rcloneVfsCacheMaxSize || '10G'}
                  onChange={(e) => setSettings({ ...settings, rcloneVfsCacheMaxSize: e.target.value })}
                  placeholder="Ex: 10G ou 20G"
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Idade Máxima do Cache (Max Age)
                </label>
                <input
                  type="text"
                  value={settings.rcloneVfsCacheMaxAge || '24h'}
                  onChange={(e) => setSettings({ ...settings, rcloneVfsCacheMaxAge: e.target.value })}
                  placeholder="Ex: 24h ou 48h"
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Chunk Size de Leitura VFS
                </label>
                <input
                  type="text"
                  value={settings.rcloneVfsReadChunkSize || '128M'}
                  onChange={(e) => setSettings({ ...settings, rcloneVfsReadChunkSize: e.target.value })}
                  placeholder="Ex: 128M ou 64M"
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tempo de Cache de Diretórios
                </label>
                <input
                  type="text"
                  value={settings.rcloneDirCacheTime || '5m'}
                  onChange={(e) => setSettings({ ...settings, rcloneDirCacheTime: e.target.value })}
                  placeholder="Ex: 5m ou 10m"
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Limite de Banda (Bandwidth)
                </label>
                <input
                  type="text"
                  value={settings.rcloneBandwidthLimit || 'off'}
                  onChange={(e) => setSettings({ ...settings, rcloneBandwidthLimit: e.target.value })}
                  placeholder="Ex: off ou 10M"
                  className="w-full bg-background-surface border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Test Remote & Diagnostic Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestRemote}
              disabled={testingRemote}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-primary-300 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {testingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Testar Acesso ao Google Drive</span>
            </button>

            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="px-4 py-2 bg-background-elevated hover:bg-background-elevated/80 border border-border text-xs font-semibold text-accent-cyan rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {runningDiagnostics ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              <span>Diagnóstico Completo Rclone</span>
            </button>

            {testResult && (
              <span className={`text-xs flex items-center gap-1 ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.message}
              </span>
            )}
          </div>

          {/* Diagnostics Results Panel */}
          {diagnostics && (
            <div className="p-4 bg-background border border-border rounded-xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-accent-cyan" />
                  Resultado do Diagnóstico do Rclone
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  diagnostics.canConnectDrive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {diagnostics.canConnectDrive ? 'Operacional' : 'Com Erro'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-background-surface rounded-lg border border-border/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Versão do Rclone</span>
                  <div className="text-slate-200 font-mono mt-0.5">{diagnostics.version || 'Não detectada'}</div>
                </div>

                <div className="p-2.5 bg-background-surface rounded-lg border border-border/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Latência de Resposta</span>
                  <div className="text-slate-200 font-mono mt-0.5">
                    {diagnostics.latencyMs !== undefined ? `${diagnostics.latencyMs} ms` : 'Inacessível'}
                  </div>
                </div>

                <div className="sm:col-span-2 p-2.5 bg-background-surface rounded-lg border border-border/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Arquivo de Configuração</span>
                  <div className="text-slate-200 font-mono text-[11px] mt-0.5 break-all select-all">
                    {diagnostics.configPath}
                  </div>
                </div>

                <div className="sm:col-span-2 p-2.5 bg-background-surface rounded-lg border border-border/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Status de Conectividade</span>
                  <div className={`mt-0.5 font-medium ${diagnostics.canConnectDrive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {diagnostics.message} ({diagnostics.remotesCount} remotes configurados)
                  </div>
                </div>
              </div>
            </div>
          )}
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

        {/* Section 5: Privacidade, Dados Pessoais & Limpeza */}
        <div className="p-6 bg-background-surface/80 border border-border rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-accent-rose" />
            <span>Privacidade, Dados Pessoais & Manutenção</span>
          </h3>

          <p className="text-xs text-slate-400">
            Exportação de dados no formato aberto JSON, higienização de arquivos temporários e redefinição segura do banco de dados local.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-4 rounded-xl border border-border bg-background/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1">
                  <FileDown className="w-4 h-4 text-primary-400" />
                  <span>Exportar Dados (JSON)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Exporta todas as suas anotações, marcadores, metas, histórico e listas personalizadas em arquivo JSON estruturado.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full px-3 py-2 bg-background-elevated hover:bg-primary-600/30 border border-border text-xs font-semibold text-primary-300 hover:text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Limpar Cache & Temporários</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Apaga miniaturas e fragmentos de streaming temporários do disco para liberar espaço.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearCache}
                className="w-full px-3 py-2 bg-background-elevated hover:bg-amber-600/30 border border-border text-xs font-semibold text-amber-300 hover:text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Limpar Cache</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Redefinir Dados Locais</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Limpa o catálogo e tabelas locais. Não apaga nenhum arquivo original de vídeo do seu computador ou Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetLocalData}
                className="w-full px-3 py-2 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Resetar Dados</span>
              </button>
            </div>
          </div>
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
