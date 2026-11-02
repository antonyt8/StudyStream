import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Course, CourseModule, Lesson, Note, Bookmark } from '../types';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  BookOpen,
  FileText,
  Bookmark as BookmarkIcon,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface PlayerProps {
  courseId: string;
  lessonId: string;
  onBack: () => void;
  onSelectLesson: (courseId: string, lessonId: string) => void;
}

export const Player: React.FC<PlayerProps> = ({
  courseId,
  lessonId,
  onBack,
  onSelectLesson
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Data state
  const [courseData, setCourseData] = useState<{ course: Course; modules: CourseModule[] } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);

  // Sidebar state
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes' | 'bookmarks'>('lessons');
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newBookmarkTitle, setNewBookmarkTitle] = useState<string>('');

  // Study session tracking
  const sessionStartRef = useRef<number>(Date.now());
  const activeWatchSecondsRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(Date.now());

  // Load course details, media URL, notes, and bookmarks
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      setIsLoadingMedia(true);
      setLoadError(null);
      setVideoUrl('');

      try {
        if (!window.api) return;

        // 1. Fetch course structure
        const details = await window.api.getCourseDetails(courseId);
        if (!isCancelled) setCourseData(details);

        // 2. Fetch media URL
        const mediaRes = await window.api.getPlaybackUrl(lessonId);
        if (isCancelled) return;

        if (mediaRes.error || !mediaRes.url) {
          setLoadError(mediaRes.error || 'Não foi possível carregar o vídeo');
        } else {
          setVideoUrl(mediaRes.url);
        }

        // 3. Load notes & bookmarks
        const [nList, bList, prog] = await Promise.all([
          window.api.listNotes({ courseId, lessonId }),
          window.api.listBookmarks(lessonId),
          window.api.getLessonProgress(lessonId)
        ]);

        if (isCancelled) return;
        setNotes(nList);
        setBookmarks(bList);

        // Saved progress resume
        if (prog && prog.position_seconds > 0 && !prog.completed) {
          setCurrentTime(prog.position_seconds);
          if (videoRef.current) {
            videoRef.current.currentTime = prog.position_seconds;
          }
        }
      } catch (err: any) {
        if (!isCancelled) setLoadError(err.message);
      } finally {
        if (!isCancelled) setIsLoadingMedia(false);
      }
    }

    init();

    return () => {
      isCancelled = true;
      recordStudySession();
    };
  }, [courseId, lessonId]);

  // Record session elapsed time
  const recordStudySession = () => {
    if (activeWatchSecondsRef.current > 3 && window.api) {
      window.api.recordSession({
        courseId,
        lessonId,
        startedAt: new Date(sessionStartRef.current).toISOString(),
        endedAt: new Date().toISOString(),
        elapsedSeconds: Math.round(activeWatchSecondsRef.current)
      }).catch(() => {});
      activeWatchSecondsRef.current = 0;
    }
  };

  // Periodic tick for study time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (isPlaying) {
        const delta = (now - lastTickTimeRef.current) / 1000;
        if (delta > 0 && delta < 2) {
          activeWatchSecondsRef.current += delta;
        }
      }
      lastTickTimeRef.current = now;
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  // Periodic save progress
  const saveCurrentProgress = useCallback((pos: number, dur: number) => {
    if (dur > 0 && window.api) {
      window.api.saveProgress({
        lessonId,
        courseId,
        positionSeconds: pos,
        durationSeconds: dur
      }).catch(() => {});
    }
  }, [courseId, lessonId]);

  // Auto save progress every 5 seconds while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        saveCurrentProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, saveCurrentProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyN':
          e.preventDefault();
          handleNextLesson();
          break;
        case 'KeyP':
          e.preventDefault();
          handlePrevLesson();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      saveCurrentProgress(videoRef.current.currentTime, videoRef.current.duration);
    }
  };

  const seekDelta = (seconds: number) => {
    if (!videoRef.current) return;
    const next = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const changeVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    videoRef.current.volume = newVol;
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Find next and prev lessons
  const allLessons: Lesson[] = [];
  courseData?.modules.forEach(m => {
    m.lessons?.forEach(l => allLessons.push(l));
  });
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const currentLesson = allLessons[currentIndex];
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const handleNextLesson = () => {
    if (nextLesson) {
      onSelectLesson(courseId, nextLesson.id);
    }
  };

  const handlePrevLesson = () => {
    if (prevLesson) {
      onSelectLesson(courseId, prevLesson.id);
    }
  };

  // Time format helper (HH:MM:SS or MM:SS)
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !window.api) return;

    try {
      const created = await window.api.createNote({
        courseId,
        lessonId,
        title: `Nota em ${formatTime(currentTime)}`,
        content: newNoteContent.trim(),
        timestampSeconds: currentTime
      });
      setNotes(prev => [created, ...prev]);
      setNewNoteContent('');
    } catch (err) {
      console.error(err);
    }
  };

  // Add Bookmark
  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkTitle.trim() || !window.api) return;

    try {
      const created = await window.api.createBookmark({
        courseId,
        lessonId,
        timestampSeconds: currentTime,
        title: newBookmarkTitle.trim()
      });
      setBookmarks(prev => [...prev, created].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNewBookmarkTitle('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-screen bg-black overflow-hidden select-none relative"
      onMouseMove={() => setControlsVisible(true)}
    >
      {/* Top Bar Overlay */}
      <div className={`h-14 px-6 flex items-center justify-between z-30 transition-opacity duration-300 bg-gradient-to-b from-black/80 to-transparent ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              recordStudySession();
              if (videoRef.current) {
                saveCurrentProgress(videoRef.current.currentTime, videoRef.current.duration);
              }
              onBack();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide truncate max-w-md">
              {courseData?.course.title}
            </h3>
            <h2 className="text-sm font-bold text-white truncate max-w-lg">
              {currentLesson?.title || 'Reproduzindo aula...'}
            </h2>
          </div>
        </div>

        {/* Speed & Tab Buttons */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
            {[1, 1.25, 1.5, 2].map((sp) => (
              <button
                key={sp}
                onClick={() => handleSpeedChange(sp)}
                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                  playbackSpeed === sp ? 'bg-primary-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Video + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden group">
          {isLoadingMedia && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              <p className="text-sm font-medium text-slate-300">Carregando vídeo e preparando streaming...</p>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 gap-3 p-6 text-center max-w-md mx-auto">
              <AlertTriangle className="w-12 h-12 text-rose-500" />
              <h3 className="text-base font-bold text-white">Não foi possível reproduzir este vídeo</h3>
              <p className="text-xs text-slate-400">{loadError}</p>
              <button
                onClick={() => onBack()}
                className="mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold rounded-lg"
              >
                Voltar ao Curso
              </button>
            </div>
          )}

          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  videoRef.current.playbackRate = playbackSpeed;
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (videoRef.current) {
                  saveCurrentProgress(videoRef.current.duration, videoRef.current.duration);
                }
                // Auto play next if available
                if (nextLesson) {
                  handleNextLesson();
                }
              }}
            />
          )}

          {/* Bottom Player Controls Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 transition-opacity duration-300 space-y-2 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Timeline Range Slider */}
            <div className="relative flex items-center group/slider">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) {
                    videoRef.current.currentTime = val;
                  }
                }}
                className="w-full h-1.5 bg-white/20 hover:h-2.5 rounded-full appearance-none cursor-pointer transition-all"
              />
            </div>

            {/* Bottom Button Row */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                {/* Previous Lesson */}
                <button
                  onClick={handlePrevLesson}
                  disabled={!prevLesson}
                  className="p-2 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  title="Aula Anterior (P)"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center shadow-glow transition-all active:scale-95"
                  title="Reproduzir / Pausar (Espaço)"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>

                {/* Next Lesson */}
                <button
                  onClick={handleNextLesson}
                  disabled={!nextLesson}
                  className="p-2 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                  title="Próxima Aula (N)"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="p-1.5 text-slate-300 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (videoRef.current) {
                        videoRef.current.volume = v;
                        videoRef.current.muted = v === 0;
                      }
                      setIsMuted(v === 0);
                    }}
                    className="w-16 h-1 bg-white/20 rounded appearance-none cursor-pointer"
                  />
                </div>

                {/* Time Display */}
                <div className="text-xs font-mono text-slate-300 ml-2">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Tela Cheia (F)"
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Study Sidebar (Lessons, Notes, Bookmarks) */}
        <aside className="w-80 bg-background-subtle border-l border-border flex flex-col h-full z-20 shrink-0">
          {/* Tabs Header */}
          <div className="grid grid-cols-3 border-b border-border bg-background p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'lessons' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Aulas</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'notes' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Anotações</span>
            </button>

            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'bookmarks' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              <span>Marcadores</span>
            </button>
          </div>

          {/* Tab 1: Lessons List */}
          {activeTab === 'lessons' && (
            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-3">
              {courseData?.modules.map((mod, modIdx) => (
                <div key={mod.id} className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Módulo {modIdx + 1}: {mod.title}
                  </div>
                  {mod.lessons?.map((les, idx) => {
                    const isCurrent = les.id === lessonId;
                    const isCompleted = les.progress?.completed === 1;

                    return (
                      <div
                        key={les.id}
                        onClick={() => onSelectLesson(courseId, les.id)}
                        className={`p-2.5 rounded-lg flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-all ${
                          isCurrent
                            ? 'bg-primary-600 text-white font-semibold shadow-glow'
                            : 'hover:bg-background-elevated text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                          )}
                          <span className="truncate">
                            {idx + 1}. {les.title}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Study Notes */}
          {activeTab === 'notes' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="mb-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary-400" />
                    Momento: <strong className="text-white">{formatTime(currentTime)}</strong>
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Escreva uma anotação desta aula..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={!newNoteContent.trim()}
                  className="w-full py-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-glow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Salvar Anotação</span>
                </button>
              </form>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {notes.length > 0 ? (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-lg bg-background border border-border hover:border-primary-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        {n.timestamp_seconds !== null && n.timestamp_seconds !== undefined && (
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = n.timestamp_seconds!;
                                setCurrentTime(n.timestamp_seconds!);
                              }
                            }}
                            className="font-mono text-primary-400 hover:underline font-semibold flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            {formatTime(n.timestamp_seconds)}
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            await window.api.deleteNote(n.id);
                            setNotes(prev => prev.filter(item => item.id !== n.id));
                          }}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-200 whitespace-pre-wrap">{n.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Nenhuma anotação nesta aula ainda.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Bookmarks */}
          {activeTab === 'bookmarks' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              {/* Add Bookmark Form */}
              <form onSubmit={handleAddBookmark} className="mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Nome do marcador (Ex: Exemplo Importante)"
                  value={newBookmarkTitle}
                  onChange={(e) => setNewBookmarkTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={!newBookmarkTitle.trim()}
                  className="w-full py-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-glow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Marcar em {formatTime(currentTime)}</span>
                </button>
              </form>

              {/* Bookmarks List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {bookmarks.length > 0 ? (
                  bookmarks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = b.timestamp_seconds;
                          setCurrentTime(b.timestamp_seconds);
                        }
                      }}
                      className="p-2.5 rounded-lg bg-background border border-border hover:border-accent-cyan/40 cursor-pointer flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-accent-cyan">
                          {b.title}
                        </div>
                        <div className="text-[11px] font-mono text-primary-400 mt-0.5">
                          {formatTime(b.timestamp_seconds)}
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await window.api.deleteBookmark(b.id);
                          setBookmarks(prev => prev.filter(item => item.id !== b.id));
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Nenhum marcador criado nesta aula.
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
