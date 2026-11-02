import React, { useEffect, useState } from 'react';
import { CourseCard } from '../components/courses/CourseCard';
import { DashboardStats, Course } from '../types';
import {
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Flame,
  Plus,
  ArrowRight,
  FolderPlus
} from 'lucide-react';

interface DashboardProps {
  onSelectCourse: (courseId: string) => void;
  onOpenPlayer: (courseId: string, lessonId: string) => void;
  onOpenAddSource: () => void;
  onNavigateToCourses: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectCourse,
  onOpenPlayer,
  onOpenAddSource,
  onNavigateToCourses
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      if (window.api) {
        const data = await window.api.getDashboardStats();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleFavorite = async (courseId: string, e: React.MouseEvent) => {
    try {
      await window.api.toggleFavorite(courseId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const todayMinutes = stats ? Math.round(stats.todayStudySeconds / 60) : 0;
  const weekMinutes = stats ? Math.round(stats.weekStudySeconds / 60) : 0;
  const goalMinutes = stats?.dailyGoalMinutes || 60;
  const goalProgressPct = Math.min(100, Math.round((todayMinutes / Math.max(1, goalMinutes)) * 100));

  const hasCourses = (stats?.totalCourses || 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary-950/60 via-background-surface to-background-subtle p-6 rounded-2xl border border-primary-900/30 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-400">
            Painel de Estudos
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-1">
            Pronto para continuar aprendendo hoje?
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Acompanhe seu progresso, mantenha sua sequência de estudos e acesse seus cursos locais e do Google Drive.
          </p>
        </div>

        {/* Quick Action */}
        {stats?.continueWatching && stats.continueWatching.length > 0 ? (
          <button
            onClick={() => {
              const item = stats.continueWatching[0];
              onOpenPlayer(item.course.id, item.lesson.id);
            }}
            className="relative z-10 flex items-center gap-3 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-glow transition-all active:scale-[0.98] self-start md:self-auto shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </div>
            <div className="text-left">
              <div className="text-[11px] text-primary-200">Retomar Aula</div>
              <div className="text-sm font-bold truncate max-w-[180px]">
                {stats.continueWatching[0].lesson.title}
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenAddSource}
            className="relative z-10 flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-glow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Primeira Pasta</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today Studied */}
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Tempo Estudado Hoje</span>
            <div className="w-8 h-8 rounded-lg bg-primary-600/15 text-primary-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {todayMinutes} <span className="text-sm font-normal text-slate-400">min</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Meta: {goalMinutes} min</span>
            <span className="text-primary-400 font-semibold">{goalProgressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-background-elevated rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-primary-500 shadow-glow transition-all"
              style={{ width: `${goalProgressPct}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Week Studied */}
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Tempo na Semana</span>
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/15 text-accent-cyan flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {weekMinutes} <span className="text-sm font-normal text-slate-400">min</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {weekMinutes > 0 ? 'Bom ritmo semanal de estudos!' : 'Inicie uma sessão hoje.'}
          </p>
        </div>

        {/* Metric 3: Sequência de Dias */}
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Sequência de Estudos</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.studyStreakDays || 0} <span className="text-sm font-normal text-slate-400">dias</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Constância é o segredo do aprendizado
          </p>
        </div>

        {/* Metric 4: Total Cursos e Aulas */}
        <div className="glass-card p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Aulas Concluídas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.completedLessons || 0} <span className="text-sm font-normal text-slate-400">/ {stats?.totalLessons || 0}</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {stats?.totalCourses || 0} cursos cadastrados
          </p>
        </div>
      </div>

      {/* Continue Watching Section */}
      {stats?.continueWatching && stats.continueWatching.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-primary-400 fill-primary-400" />
              Continue de Onde Parou
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.continueWatching.map((item) => {
              const posMin = Math.floor(item.progress.position_seconds / 60);
              const posSec = Math.floor(item.progress.position_seconds % 60);
              const timeFormatted = `${posMin}:${posSec < 10 ? '0' : ''}${posSec}`;

              return (
                <div
                  key={item.lesson.id}
                  onClick={() => onOpenPlayer(item.course.id, item.lesson.id)}
                  className="glass-card rounded-xl p-4 border border-border hover:border-primary-500/50 cursor-pointer group flex flex-col justify-between select-none"
                >
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-primary-400">
                      {item.course.title}
                    </span>
                    <h4 className="text-sm font-semibold text-white mt-1 group-hover:text-primary-300 line-clamp-1">
                      {item.lesson.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Parou em {timeFormatted} ({item.progress.progress_percent}%)
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="w-full h-1.5 bg-background-elevated rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-primary-500 shadow-glow"
                        style={{ width: `${item.progress.progress_percent}%` }}
                      />
                    </div>
                    <button
                      className="w-full py-2 bg-primary-600/30 hover:bg-primary-600 text-primary-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Retomar Aula</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Courses Section */}
      {hasCourses ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent-cyan" />
              Cursos Recentes
            </h3>
            <button
              onClick={onNavigateToCourses}
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
            >
              <span>Ver todos os cursos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {stats?.recentCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onSelect={onSelectCourse}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </section>
      ) : (
        /* Empty State */
        <div className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto border border-border space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-600/20 text-primary-400 flex items-center justify-center mx-auto border border-primary-500/30 shadow-glow">
            <FolderPlus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Nenhum curso indexado ainda</h3>
          <p className="text-sm text-slate-400">
            Adicione uma pasta de cursos do seu computador ou conecte seu Google Drive para que o StudyStream organize seus vídeos em módulos e aulas automaticamente.
          </p>
          <button
            onClick={onOpenAddSource}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Origem de Cursos</span>
          </button>
        </div>
      )}
    </div>
  );
};
