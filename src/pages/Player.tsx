import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Course, CourseModule, Lesson, Note, Bookmark } from '../types';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Settings,
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
  AlertTriangle,
  Camera,
  Subtitles,
  Tv,
  X,
  ExternalLink
} from 'lucide-react';

interface PlayerProps {
  courseId: string;
  lessonId: string;
  initialTime?: number;
  onBack: () => void;
  onSelectLesson: (courseId: string, lessonId: string) => void;
}

export const Player: React.FC<PlayerProps> = ({
  courseId,
  lessonId,
  initialTime,
  onBack,
  onSelectLesson
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Data state
  const [courseData, setCourseData] = useState<{ course: Course; modules: CourseModule[] } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Array<{ label: string; src: string; srclang: string }>>([]);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [bufferAheadSeconds, setBufferAheadSeconds] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isPlaybackSettingsOpen, setIsPlaybackSettingsOpen] = useState<boolean>(false);

  // Sidebar & Study state
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes' | 'bookmarks'>('lessons');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newBookmarkTitle, setNewBookmarkTitle] = useState<string>('');
  const [snapshotPreview, setSnapshotPreview] = useState<string | null>(null);
  const [zoomSnapshot, setZoomSnapshot] = useState<string | null>(null);
  const [isOpeningExternal, setIsOpeningExternal] = useState(false);

  // Study session tracking
  const sessionStartRef = useRef<number>(Date.now());
  const activeWatchSecondsRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(Date.now());
  const hasPrefetchedNextRef = useRef<boolean>(false);
  const lastVideoUiUpdateRef = useRef<number>(0);
  const bufferingStartedAtRef = useRef<number | null>(null);
  const bufferingSecondsRef = useRef<number>(0);

  // Load course details, media URL, notes, and bookmarks
  useEffect(() => {
    let isCancelled = false;
    hasPrefetchedNextRef.current = false;

    async function init() {
      setIsLoadingMedia(true);
      setLoadError(null);
      setVideoUrl('');
      setSubtitles([]);
      setSnapshotPreview(null);

      try {
        if (!window.api) return;

        // Start all async requests immediately in parallel!
        const playbackPromise = window.api.getPlaybackUrl(lessonId);
        const progressPromise = window.api.getLessonProgress(lessonId);
        const coursePromise = window.api.getCourseDetails(courseId);
        const notesPromise = window.api.listNotes({ courseId, lessonId });
        const bookmarksPromise = window.api.listBookmarks(lessonId);

        // 1. Prioritize video playback: resolve playback URL and progress first
        const [mediaRes, prog] = await Promise.all([playbackPromise, progressPromise]);
        if (isCancelled) return;

        if (mediaRes.error || !mediaRes.url) {
          setLoadError(mediaRes.error || 'Não foi possível carregar o vídeo');
          setIsLoadingMedia(false);
        } else {
          setVideoUrl(mediaRes.url);
          if (mediaRes.subtitles && mediaRes.subtitles.length > 0) {
            setSubtitles(mediaRes.subtitles);
          }
        }

        // Saved progress or initialTime resume
        if (initialTime !== undefined && initialTime >= 0) {
          setCurrentTime(initialTime);
          if (videoRef.current) {
            videoRef.current.currentTime = initialTime;
          }
        } else if (prog && prog.position_seconds > 0 && !prog.completed) {
          setCurrentTime(prog.position_seconds);
          if (videoRef.current) {
            videoRef.current.currentTime = prog.position_seconds;
          }
        }

        // 2. Hydrate course data, notes and bookmarks in the background without blocking video
        const [details, nList, bList] = await Promise.all([coursePromise, notesPromise, bookmarksPromise]);
        if (isCancelled) return;
        setCourseData(details);
        setNotes(nList);
        setBookmarks(bList);
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

  // Save progress periodically without competing with video decoding.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        saveCurrentProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    }, 15000);

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
  const currentModuleId = courseData?.modules.find((module) =>
    module.lessons?.some((lesson) => lesson.id === lessonId)
  )?.id;

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

  // Capture frame as screenshot
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSnapshotPreview(dataUrl);
      }
    } catch (err) {
      console.error('Erro ao capturar frame:', err);
    }
  };

  // Toggle Picture-in-Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP notice:', err);
    }
  };

  // Automatically generate course cover if none exists
  const handleAutoCover = () => {
    if (courseData?.course && !courseData.course.cover_path && videoRef.current) {
      try {
        const video = videoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 270;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const coverData = canvas.toDataURL('image/jpeg', 0.8);
            if (coverData && coverData.length > 500) {
              window.api.updateCourse(courseId, { cover_path: coverData });
              setCourseData(prev => prev ? { ...prev, course: { ...prev.course, cover_path: coverData } } : null);
            }
          }
        }
      } catch (err) {
        // Ignore CORS/canvas notice
      }
    }
  };

  // Open in external player (VLC, MPV or system default)
  const handleOpenExternal = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    if (window.api) {
      setIsOpeningExternal(true);
      try {
        const res = await window.api.openInExternalPlayer(lessonId);
        if (!res.success) {
          alert(`Não foi possível abrir no player externo: ${res.error || 'Erro desconhecido'}`);
        }
      } catch (err: any) {
        alert(`Erro ao abrir player externo: ${err.message}`);
      } finally {
        setIsOpeningExternal(false);
      }
    }
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
        timestampSeconds: currentTime,
        snapshotData: snapshotPreview || undefined
      });
      setNotes(prev => [created, ...prev]);
      setNewNoteContent('');
      setSnapshotPreview(null);
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

  // Track buffered ranges for visual buffer bar
  const updateBufferProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const buf = videoRef.current.buffered;
      const cur = videoRef.current.currentTime;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= cur && cur <= buf.end(i)) {
          setBufferedEnd(buf.end(i));
          setBufferAheadSeconds(Math.max(0, buf.end(i) - cur));
          return;
        }
      }
      setBufferedEnd(buf.end(buf.length - 1));
      setBufferAheadSeconds(0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const now = performance.now();
    const shouldUpdateUi = now - lastVideoUiUpdateRef.current >= 250;

    if (shouldUpdateUi) {
      lastVideoUiUpdateRef.current = now;
      setCurrentTime(video.currentTime);
      updateBufferProgress();
    }

    const dur = video.duration;
    if (nextLesson && !hasPrefetchedNextRef.current && dur > 0) {
      if (video.currentTime / dur > 0.5 || video.currentTime > 60) {
        hasPrefetchedNextRef.current = true;
        window.api?.prefetchLesson?.(nextLesson.id).catch(() => {});
      }
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

        {/* External Player Button */}
        <div className="flex items-center gap-2">
          {/* External Player (VLC / MPV / Default) Button */}
          <button
            onClick={handleOpenExternal}
            disabled={isOpeningExternal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 hover:text-white transition-colors border border-white/10 disabled:opacity-50"
            title="Abrir este vídeo no VLC, MPV ou reprodutor padrão do Windows"
          >
            {isOpeningExternal ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
            ) : (
              <Tv className="w-3.5 h-3.5 text-accent-cyan" />
            )}
            <span className="hidden sm:inline">Player Externo (VLC)</span>
          </button>

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
              autoPlay
              preload="auto"
              playsInline
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => {
                bufferingStartedAtRef.current = performance.now();
                setIsLoadingMedia(true);
              }}
              onStalled={() => {
                if (bufferingStartedAtRef.current === null) {
                  bufferingStartedAtRef.current = performance.now();
                }
                setIsLoadingMedia(true);
              }}
              onPlaying={() => {
                if (bufferingStartedAtRef.current !== null) {
                  bufferingSecondsRef.current += (performance.now() - bufferingStartedAtRef.current) / 1000;
                  bufferingStartedAtRef.current = null;
                }
                setIsLoadingMedia(false);
              }}
              onCanPlay={() => {
                setIsLoadingMedia(false);
                if (videoRef.current && isPlaying) {
                  videoRef.current.play().catch(() => {});
                }
              }}
              onLoadedData={handleAutoCover}
              onProgress={updateBufferProgress}
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  videoRef.current.playbackRate = playbackSpeed;
                  const seekTo = initialTime !== undefined && initialTime >= 0 ? initialTime : currentTime;
                  if (seekTo > 0) {
                    videoRef.current.currentTime = seekTo;
                  }
                  videoRef.current.play().catch(() => {});
                  updateBufferProgress();
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
            >
              {subtitlesEnabled && subtitles.map((sub, idx) => (
                <track
                  key={sub.src}
                  kind="subtitles"
                  label={sub.label}
                  src={sub.src}
                  srcLang={sub.srclang}
                  default={idx === 0}
                />
              ))}
            </video>
          )}

          {/* Bottom Player Controls Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 transition-opacity duration-300 space-y-2 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isPlaybackSettingsOpen && (
              <div className="absolute bottom-20 right-5 w-48 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-md">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Velocidade de reprodução
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[1, 1.25, 1.5, 2].map((sp) => (
                    <button
                      key={sp}
                      onClick={() => {
                        handleSpeedChange(sp);
                        setIsPlaybackSettingsOpen(false);
                      }}
                      className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                        playbackSpeed === sp
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Range Slider with Visual Interactive Markers & Buffer Bar */}
            <div className="relative flex items-center group/slider py-2">
              {/* Pre-buffered range bar (Netflix / YouTube style) */}
              {duration > 0 && (
                <div
                  className="absolute left-0 h-1.5 bg-white/20 rounded-full pointer-events-none transition-all duration-300 z-0"
                  style={{ width: `${Math.min(100, (bufferedEnd / duration) * 100)}%` }}
                />
              )}

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
                className="w-full h-1.5 bg-white/10 hover:h-2.5 rounded-full appearance-none cursor-pointer transition-all z-10"
              />

              {/* Render Notes & Bookmarks Markers on Timeline */}
              {duration > 0 && (
                <div className="absolute inset-x-0 h-1.5 pointer-events-none flex items-center z-20">
                  {/* Notes markers (Amber) */}
                  {notes
                    .filter(n => n.timestamp_seconds !== null && n.timestamp_seconds !== undefined && n.timestamp_seconds >= 0 && n.timestamp_seconds <= duration)
                    .map((n) => {
                      const posPct = ((n.timestamp_seconds || 0) / duration) * 100;
                      return (
                        <div
                          key={`note-marker-${n.id}`}
                          style={{ left: `${posPct}%` }}
                          className="absolute -translate-x-1/2 pointer-events-auto group/marker cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (videoRef.current && n.timestamp_seconds !== undefined) {
                              videoRef.current.currentTime = n.timestamp_seconds;
                              setCurrentTime(n.timestamp_seconds);
                            }
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-black shadow hover:scale-150 transition-transform" />
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden group-hover/marker:flex flex-col items-center z-50 pointer-events-none">
                            <div className="bg-black/95 text-white border border-amber-500/50 rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
                              <span className="font-mono text-amber-400 font-bold">{formatTime(n.timestamp_seconds || 0)}</span>: {n.title || n.content.slice(0, 30)}
                            </div>
                            <div className="w-1.5 h-1.5 bg-amber-500 rotate-45 -mt-0.5" />
                          </div>
                        </div>
                      );
                    })}

                  {/* Bookmark markers (Cyan) */}
                  {bookmarks
                    .filter(b => b.timestamp_seconds >= 0 && b.timestamp_seconds <= duration)
                    .map((b) => {
                      const posPct = (b.timestamp_seconds / duration) * 100;
                      return (
                        <div
                          key={`bm-marker-${b.id}`}
                          style={{ left: `${posPct}%` }}
                          className="absolute -translate-x-1/2 pointer-events-auto group/marker cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (videoRef.current) {
                              videoRef.current.currentTime = b.timestamp_seconds;
                              setCurrentTime(b.timestamp_seconds);
                            }
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-black shadow hover:scale-150 transition-transform" />
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden group-hover/marker:flex flex-col items-center z-50 pointer-events-none">
                            <div className="bg-black/95 text-white border border-cyan-500/50 rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
                              <span className="font-mono text-cyan-400 font-bold">{formatTime(b.timestamp_seconds)}</span>: {b.title}
                            </div>
                            <div className="w-1.5 h-1.5 bg-cyan-500 rotate-45 -mt-0.5" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <span className={bufferAheadSeconds < 5 && isPlaying ? 'text-amber-300' : 'text-emerald-300'}>
                Buffer: {Math.round(bufferAheadSeconds)}s
              </span>
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

                {/* Seek 10 seconds backward */}
                <button
                  onClick={() => seekDelta(-10)}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Voltar 10 segundos"
                  aria-label="Voltar 10 segundos"
                >
                  <span className="relative flex items-center justify-center">
                    <RotateCcw className="w-5 h-5" />
                    <span className="absolute text-[8px] font-bold">10</span>
                  </span>
                </button>

                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center shadow-glow transition-all active:scale-95"
                  title="Reproduzir / Pausar (Espaço)"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>

                {/* Seek 10 seconds forward */}
                <button
                  onClick={() => seekDelta(10)}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Avançar 10 segundos"
                  aria-label="Avançar 10 segundos"
                >
                  <span className="relative flex items-center justify-center">
                    <RotateCw className="w-5 h-5" />
                    <span className="absolute text-[8px] font-bold">10</span>
                  </span>
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
              <div className="flex items-center gap-2">
                {/* Subtitle Toggle */}
                {subtitles.length > 0 && (
                  <button
                    onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                    className={`p-2 transition-colors rounded ${
                      subtitlesEnabled ? 'text-primary-400 bg-white/10' : 'text-slate-400 hover:text-white'
                    }`}
                    title={subtitlesEnabled ? 'Ocultar Legendas' : 'Ativar Legendas'}
                  >
                    <Subtitles className="w-5 h-5" />
                  </button>
                )}

                {/* Picture in Picture */}
                <button
                  onClick={togglePiP}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                  title="Picture-in-Picture (Janela Flutuante)"
                >
                  <Tv className="w-5 h-5" />
                </button>

                {/* Playback Settings */}
                <button
                  onClick={() => setIsPlaybackSettingsOpen((open) => !open)}
                  className={`p-2 transition-colors rounded ${
                    isPlaybackSettingsOpen ? 'text-primary-400 bg-white/10' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Configurações de reprodução"
                  aria-label="Configurações de reprodução"
                  aria-expanded={isPlaybackSettingsOpen}
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Fullscreen */}
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

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-4 top-4 z-40 rounded-lg border border-white/10 bg-black/70 p-2 text-slate-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
            title="Mostrar painel lateral"
            aria-label="Mostrar painel lateral"
          >
            <PanelRightOpen className="h-5 w-5" />
          </button>
        )}

        {/* Study Sidebar (Lessons, Notes, Bookmarks) */}
        {isSidebarOpen && (
        <aside className="w-80 bg-background-subtle border-l border-border flex flex-col h-full z-20 shrink-0">
          {/* Tabs Header */}
          <div className="relative grid grid-cols-3 border-b border-border bg-background p-1.5 gap-1 pr-10">
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

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Minimizar painel lateral"
              aria-label="Minimizar painel lateral"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          {/* Tab 1: Lessons List */}
          {activeTab === 'lessons' && (
            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-3">
              {courseData?.modules.map((mod, modIdx) => (
                <div key={mod.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setExpandedModules((previous) => ({
                      ...previous,
                      [mod.id]: !(previous[mod.id] ?? mod.id === currentModuleId)
                    }))}
                    className="flex w-full items-center gap-1.5 border-b border-border/70 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-white"
                    aria-expanded={expandedModules[mod.id] ?? mod.id === currentModuleId}
                    title={`${(expandedModules[mod.id] ?? mod.id === currentModuleId) ? 'Minimizar' : 'Expandir'} módulo`}
                  >
                    {(expandedModules[mod.id] ?? mod.id === currentModuleId) ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primary-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                    <span className="min-w-0">{`Módulo ${modIdx + 1}: ${mod.title}`}</span>
                  </button>
                  {(expandedModules[mod.id] ?? mod.id === currentModuleId) && mod.lessons?.map((les, idx) => {
                    const isCurrent = les.id === lessonId;
                    const isCompleted = les.progress?.completed === 1;
                    const isPdf = les.media_type === 'application/pdf' || les.original_path.toLowerCase().endsWith('.pdf');
                    const partMatch = les.title.match(/(?:parte|part|pt)\s*(\d+)/i);
                    const partBadge = partMatch ? `Parte ${partMatch[1]}` : null;

                    return (
                      <div
                        key={les.id}
                        onClick={() => {
                          if (isPdf) {
                            if (window.api) window.api.openPath(les.local_path || les.original_path);
                          } else {
                            onSelectLesson(courseId, les.id);
                          }
                        }}
                        className={`p-2.5 rounded-lg flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-all ${
                          isCurrent
                            ? 'bg-primary-600 text-white font-semibold shadow-glow'
                            : 'hover:bg-background-elevated text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isPdf ? (
                            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                          )}
                          <span className="truncate">
                            {idx + 1}. {les.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {partBadge && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-900/80 text-primary-200 border border-primary-700/60">
                              {partBadge}
                            </span>
                          )}
                          {isPdf && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/60">
                              PDF
                            </span>
                          )}
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
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="flex items-center gap-1 text-[11px] text-primary-300 hover:text-white font-semibold px-2 py-0.5 rounded bg-primary-950/80 border border-primary-700/60 hover:bg-primary-900 transition-colors"
                    title="Capturar imagem atual do vídeo e anexar à nota"
                  >
                    <Camera className="w-3 h-3 text-primary-400" />
                    <span>Print da Tela</span>
                  </button>
                </div>

                {/* Snapshot Preview */}
                {snapshotPreview && (
                  <div className="relative rounded-lg overflow-hidden border border-primary-500/50 bg-black/60 group/preview">
                    <img src={snapshotPreview} alt="Captura do vídeo" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => setSnapshotPreview(null)}
                      className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-rose-600 text-white rounded-full transition-colors"
                      title="Remover print"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1.5 text-[9px] font-mono bg-black/80 text-primary-300 px-1.5 py-0.5 rounded border border-white/10">
                      Print anexado • {formatTime(currentTime)}
                    </span>
                  </div>
                )}

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

                      {/* Attached Snapshot Image */}
                      {n.snapshot_data && (
                        <div
                          className="mt-2 rounded-lg overflow-hidden border border-border/70 cursor-pointer group/snap relative bg-black"
                          onClick={() => setZoomSnapshot(n.snapshot_data || null)}
                          title="Clique para ampliar o print da aula"
                        >
                          <img
                            src={n.snapshot_data}
                            alt="Screenshot da aula"
                            className="w-full h-24 object-cover group-hover/snap:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover/snap:bg-transparent transition-colors flex items-center justify-center opacity-0 group-hover/snap:opacity-100">
                            <span className="px-2 py-1 rounded bg-black/70 text-[10px] text-white flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Ampliar
                            </span>
                          </div>
                        </div>
                      )}
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
        )}
      </div>

      {/* Zoom Snapshot Modal */}
      {zoomSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn"
          onClick={() => setZoomSnapshot(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-background-surface rounded-xl border border-border p-2 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={zoomSnapshot} alt="Screenshot ampliado" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setZoomSnapshot(null)}
              className="absolute top-4 right-4 p-2 bg-black/80 hover:bg-rose-600 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
