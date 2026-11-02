import React, { useEffect, useState } from 'react';
import { StudySession, Course } from '../types';
import { History, Clock, Calendar, BookOpen, Flame } from 'lucide-react';

export const StudyHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      if (window.api) {
        const [sList, cList] = await Promise.all([
          window.api.getStudyHistory(selectedCourseId || undefined),
          window.api.listCourses()
        ]);
        setSessions(sList);
        setCourses(cList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourseId]);

  const totalSeconds = sessions.reduce((acc, s) => acc + s.elapsed_seconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary-400" />
            Histórico de Estudos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro detalhado de todas as suas sessões de reprodução e foco
          </p>
        </div>

        {/* Total Stat Card */}
        <div className="px-4 py-2.5 rounded-xl bg-background-surface border border-border flex items-center gap-3">
          <Clock className="w-5 h-5 text-accent-cyan" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Registrado</div>
            <div className="text-sm font-bold text-white">{totalHours} horas de estudo</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      {courses.length > 0 && (
        <div className="p-3 bg-background-surface/80 border border-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar por Curso:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos os Cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {sessions.length} sessões registradas
          </span>
        </div>
      )}

      {/* Sessions Table */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : sessions.length > 0 ? (
        <div className="bg-background-surface/80 border border-border rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-background border-b border-border text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Data & Hora</th>
                <th className="px-5 py-3.5">Curso</th>
                <th className="px-5 py-3.5">Aula</th>
                <th className="px-5 py-3.5 text-right">Tempo Efetivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sessions.map((sess) => {
                const date = new Date(sess.started_at);
                const dateStr = date.toLocaleDateString('pt-BR');
                const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={sess.id} className="hover:bg-background-elevated/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                      <div className="font-semibold text-white">{dateStr}</div>
                      <div className="text-[11px] text-slate-500">{timeStr}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium max-w-xs truncate">
                      {sess.course_title}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">
                      {sess.lesson_title}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-primary-400">
                      {formatElapsed(sess.elapsed_seconds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto border border-border space-y-3">
          <History className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum histórico registrado</h3>
          <p className="text-xs text-slate-400">
            Assista a algumas aulas no player para que suas sessões de estudo sejam cronometradas e salvas aqui.
          </p>
        </div>
      )}
    </div>
  );
};
