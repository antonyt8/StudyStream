import React, { useState, useEffect } from 'react';
import { Sidebar, ActivePage } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { CourseDetails } from './pages/CourseDetails';
import { Player } from './pages/Player';
import { NotesPage } from './pages/Notes';
import { StudyHistoryPage } from './pages/StudyHistory';
import { GoalsPage } from './pages/Goals';
import { DownloadsPage } from './pages/Downloads';
import { SettingsPage } from './pages/Settings';
import { AddSourceModal } from './components/library/AddSourceModal';
import { ScanProgressModal } from './components/library/ScanProgressModal';
import { ScanProgress, DashboardStats } from './types';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<{ courseId: string; lessonId: string } | null>(null);

  // Global search & stats
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Modals
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  const refreshStats = async () => {
    try {
      if (window.api) {
        const res = await window.api.getDashboardStats();
        setStats(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshStats();

    // Listen to live scan progress IPC
    if (window.api) {
      const unsub = window.api.onScanProgress((prog: ScanProgress) => {
        setScanProgress(prog);
        if (prog.status === 'completed') {
          refreshStats();
        }
      });
      return () => {
        unsub();
      };
    }
  }, []);

  const handleSourceAdded = async (sourceId: string) => {
    try {
      if (window.api) {
        // Start scanning automatically
        setScanProgress({
          sourceId,
          status: 'scanning',
          filesExamined: 0,
          videosFound: 0
        });
        await window.api.scanSource(sourceId);
        refreshStats();
      }
    } catch (err) {
      console.error('Scan error:', err);
    }
  };

  const handleReScanSource = async (sourceId: string) => {
    try {
      if (window.api) {
        setScanProgress({
          sourceId,
          status: 'scanning',
          filesExamined: 0,
          videosFound: 0
        });
        await window.api.scanSource(sourceId);
        refreshStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenPlayer = (courseId: string, lessonId: string) => {
    setActiveLesson({ courseId, lessonId });
  };

  const handleClosePlayer = () => {
    setActiveLesson(null);
    refreshStats();
  };

  // If Player is active, render player full-screen
  if (activeLesson) {
    return (
      <Player
        courseId={activeLesson.courseId}
        lessonId={activeLesson.lessonId}
        onBack={handleClosePlayer}
        onSelectLesson={(cId, lId) => setActiveLesson({ courseId: cId, lessonId: lId })}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-slate-100 select-none">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setSelectedCourseId(null);
          setActivePage(page);
        }}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenAddSource={() => setIsAddSourceOpen(true)}
          streakDays={stats?.studyStreakDays || 0}
          todayMinutes={stats ? Math.round(stats.todayStudySeconds / 60) : 0}
        />

        {/* Dynamic Pages */}
        {selectedCourseId ? (
          <CourseDetails
            courseId={selectedCourseId}
            onBack={() => setSelectedCourseId(null)}
            onOpenPlayer={handleOpenPlayer}
          />
        ) : (
          <>
            {activePage === 'dashboard' && (
              <Dashboard
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenPlayer={handleOpenPlayer}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
                onNavigateToCourses={() => setActivePage('all-courses')}
              />
            )}

            {activePage === 'library' && (
              <Library
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
              />
            )}

            {activePage === 'all-courses' && (
              <Library
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
              />
            )}

            {activePage === 'continue' && (
              <Library
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
              />
            )}

            {activePage === 'favorites' && (
              <Library
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
                initialFavoritesOnly={true}
              />
            )}

            {activePage === 'completed' && (
              <Library
                onSelectCourse={(id) => setSelectedCourseId(id)}
                onOpenAddSource={() => setIsAddSourceOpen(true)}
                initialCompletedOnly={true}
              />
            )}

            {activePage === 'notes' && (
              <NotesPage onOpenPlayer={handleOpenPlayer} />
            )}

            {activePage === 'history' && (
              <StudyHistoryPage />
            )}

            {activePage === 'goals' && (
              <GoalsPage />
            )}

            {activePage === 'downloads' && (
              <DownloadsPage onOpenPlayer={handleOpenPlayer} />
            )}

            {activePage === 'settings' && (
              <SettingsPage onReScanSource={handleReScanSource} />
            )}
          </>
        )}
      </div>

      {/* Add Source Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onSourceAdded={handleSourceAdded}
      />

      {/* Live Scan Progress Modal */}
      <ScanProgressModal
        progress={scanProgress}
        onCancel={() => {
          if (scanProgress && window.api) {
            window.api.cancelScan(scanProgress.sourceId);
          }
        }}
        onDismiss={() => setScanProgress(null)}
      />
    </div>
  );
}
