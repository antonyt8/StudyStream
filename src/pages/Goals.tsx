import React, { useEffect, useState } from 'react';
import { StudyGoal, StudyTask, Course } from '../types';
import { Target, CheckCircle2, Circle, Plus, Trash2, Clock, Calendar, Flame } from 'lucide-react';

export const GoalsPage: React.FC = () => {
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<any>(null);

  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskCourseId, setTaskCourseId] = useState('');

  // Daily goal input
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(300);

  const loadData = async () => {
    try {
      if (window.api) {
        const [gList, tList, cList, dStats] = await Promise.all([
          window.api.listGoals(),
          window.api.listTasks(),
          window.api.listCourses(),
          window.api.getDashboardStats()
        ]);
        setGoals(gList);
        setTasks(tList);
        setCourses(cList);
        setStats(dStats);

        const daily = gList.find((g: StudyGoal) => g.goal_type === 'daily_minutes');
        if (daily) setDailyGoalMinutes(daily.target_value);

        const weekly = gList.find((g: StudyGoal) => g.goal_type === 'weekly_minutes');
        if (weekly) setWeeklyGoalMinutes(weekly.target_value);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateGoal = async (type: string, val: number) => {
    await window.api.updateGoal(type, val);
    loadData();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    await window.api.createTask({
      title: taskTitle.trim(),
      dueDate: taskDueDate || undefined,
      courseId: taskCourseId || undefined
    });

    setTaskTitle('');
    setTaskDueDate('');
    setTaskCourseId('');
    loadData();
  };

  const handleToggleTask = async (task: StudyTask) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    await window.api.updateTaskStatus(task.id, next);
    loadData();
  };

  const handleDeleteTask = async (id: string) => {
    await window.api.deleteTask(id);
    loadData();
  };

  const todayMinutes = stats ? Math.round(stats.todayStudySeconds / 60) : 0;
  const weekMinutes = stats ? Math.round(stats.weekStudySeconds / 60) : 0;

  const dailyPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoalMinutes)) * 100));
  const weeklyPct = Math.min(100, Math.round((weekMinutes / Math.max(1, weeklyGoalMinutes)) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Target className="w-6 h-6 text-primary-400" />
          Metas e Produtividade
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Defina seus objetivos de dedicação diária e gerencie suas tarefas de estudo
        </p>
      </div>

      {/* Goals Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Goal Card */}
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Meta Diária</span>
              <h3 className="text-lg font-bold text-white mt-0.5">{dailyGoalMinutes} minutos por dia</h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">{todayMinutes}</span>
              <span className="text-xs text-slate-400"> / {dailyGoalMinutes} min</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                dailyPct >= 100 ? 'bg-emerald-500 shadow-glow' : 'bg-primary-500 shadow-glow'
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>{dailyPct}% atingido hoje</span>
            <div className="flex items-center gap-1.5">
              <span>Alterar meta:</span>
              <select
                value={dailyGoalMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDailyGoalMinutes(val);
                  handleUpdateGoal('daily_minutes', val);
                }}
                className="bg-background border border-border rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-primary-500 font-semibold"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>
        </div>

        {/* Weekly Goal Card */}
        <div className="glass-card p-6 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-accent-cyan uppercase tracking-wider">Meta Semanal</span>
              <h3 className="text-lg font-bold text-white mt-0.5">{weeklyGoalMinutes} minutos na semana</h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">{weekMinutes}</span>
              <span className="text-xs text-slate-400"> / {weeklyGoalMinutes} min</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-background rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                weeklyPct >= 100 ? 'bg-emerald-500 shadow-glow' : 'bg-accent-cyan shadow-glow-cyan'
              }`}
              style={{ width: `${weeklyPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>{weeklyPct}% da meta semanal</span>
            <div className="flex items-center gap-1.5">
              <span>Alterar meta:</span>
              <select
                value={weeklyGoalMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setWeeklyGoalMinutes(val);
                  handleUpdateGoal('weekly_minutes', val);
                }}
                className="bg-background border border-border rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-accent-cyan font-semibold"
              >
                <option value={180}>3 horas (180m)</option>
                <option value={300}>5 horas (300m)</option>
                <option value={420}>7 horas (420m)</option>
                <option value={600}>10 horas (600m)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Study Tasks Checklist Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>Tarefas de Estudo</span>
        </h3>

        {/* Create Task Form */}
        <form onSubmit={handleCreateTask} className="p-4 bg-background-surface/80 border border-border rounded-xl flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Nova tarefa de estudo (ex: Terminar módulo 3 de CSS)..."
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="flex-1 min-w-[240px] bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-500"
          />

          {courses.length > 0 && (
            <select
              value={taskCourseId}
              onChange={(e) => setTaskCourseId(e.target.value)}
              className="bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-500 max-w-[200px] truncate"
            >
              <option value="">Curso Opcional</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}

          <input
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
            className="bg-background border border-border text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
          />

          <button
            type="submit"
            disabled={!taskTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </form>

        {/* Tasks List */}
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.map((task) => {
              const isCompleted = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
                    isCompleted
                      ? 'bg-background/40 border-border/40 opacity-70'
                      : 'bg-background-surface/80 border-border hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className="text-slate-500 hover:text-emerald-400 transition-colors shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className={`text-xs font-medium truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        {task.course_title && (
                          <span className="text-primary-400">{task.course_title}</span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-background-elevated rounded transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 bg-background-surface/40 rounded-xl border border-border">
              Nenhuma tarefa cadastrada. Adicione tarefas acima para organizar seu cronograma de estudos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
