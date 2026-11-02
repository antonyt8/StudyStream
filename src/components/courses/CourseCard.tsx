import React from 'react';
import { Course } from '../../types';
import { Play, Heart, CheckCircle2, BookOpen, HardDrive, Cloud } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  onSelect: (courseId: string) => void;
  onToggleFavorite?: (courseId: string, e: React.MouseEvent) => void;
}

// Generate pleasing consistent gradient from course title
function getGradient(title: string): string {
  const gradients = [
    'from-indigo-600 to-purple-800',
    'from-blue-600 to-cyan-800',
    'from-emerald-600 to-teal-800',
    'from-rose-600 to-amber-800',
    'from-violet-600 to-fuchsia-800',
    'from-cyan-600 to-blue-900',
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onSelect,
  onToggleFavorite
}) => {
  const total = course.total_lessons || 0;
  const completed = course.completed_lessons || 0;
  const percent = course.progress_percent || (total > 0 ? Math.round((completed / total) * 100) : 0);
  const isGoogleDrive = course.source_type === 'gdrive';

  return (
    <div
      onClick={() => onSelect(course.id)}
      className="glass-card rounded-xl overflow-hidden flex flex-col cursor-pointer group border border-border relative select-none"
    >
      {/* Thumbnail Banner */}
      <div className={`h-36 bg-gradient-to-tr ${getGradient(course.title)} p-4 flex flex-col justify-between relative overflow-hidden`}>
        {/* Glow overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10">
            {isGoogleDrive ? (
              <>
                <Cloud className="w-3 h-3 text-accent-cyan" />
                Google Drive
              </>
            ) : (
              <>
                <HardDrive className="w-3 h-3 text-slate-300" />
                Local
              </>
            )}
          </span>

          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(course.id, e);
              }}
              className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-rose-400 hover:scale-110 active:scale-95 transition-all border border-white/10"
              title={course.is_favorite ? 'Remover dos favoritos' : 'Favoritar curso'}
            >
              <Heart
                className={`w-3.5 h-3.5 ${course.is_favorite ? 'fill-rose-500 text-rose-500' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Play Icon on Hover */}
        <div className="relative z-10 flex items-end justify-between">
          {course.category_name ? (
            <span className="text-[10px] font-medium text-white/90 bg-white/15 px-2 py-0.5 rounded backdrop-blur-sm">
              {course.category_name}
            </span>
          ) : <div />}

          <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-glow">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Course Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
            {course.title}
          </h3>
          {course.instructor && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
              Prof. {course.instructor}
            </p>
          )}
        </div>

        {/* Progress & Lessons count */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {completed}/{total} aulas
            </span>
            <span className={`font-semibold ${percent === 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {percent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-background-elevated rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percent === 100 ? 'bg-emerald-500' : 'bg-primary-500 shadow-glow'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
