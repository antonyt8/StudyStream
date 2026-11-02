import React, { useState } from 'react';
import { X, BookOpen, AlertCircle } from 'lucide-react';
import { FolderExplorer } from './FolderExplorer';
import { SourceType } from '../../types';

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
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddCourse = async (data: {
    name: string;
    sourceType: SourceType;
    rootPath: string;
    remoteName?: string;
    scanMode?: 'single_course' | 'multi_course';
  }) => {
    setError(null);
    try {
      if (!window.api) return;
      const created = await window.api.addSource({
        name: data.name,
        sourceType: data.sourceType,
        rootPath: data.rootPath,
        remoteName: data.remoteName,
        scanMode: data.scanMode || 'single_course'
      });

      if (created) {
        onSourceAdded(created.id);
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-background-surface border border-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background-subtle">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-400" />
              <span>Navegador de Cursos & Origens</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Navegue pelas pastas e subpastas no Google Drive ou no computador e adicione o curso desejado à sua biblioteca
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-background-elevated flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Interactive Folder Explorer */}
        <div className="p-4 flex-1 overflow-hidden">
          <FolderExplorer
            onAddCourse={handleAddCourse}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};
