import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock,
  BookOpen,
  AlertCircle,
  LayoutGrid,
  RotateCcw,
  Menu,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ConditionPeriod,
  ConditionRecord,
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  DayRoutineConfig,
  ExamMeta,
  PlanAdjustmentRule,
  StudyTask,
  SubjectConfig,
  TimeBlock,
  WeaknessRecord,
} from './types';
import {
  DEFAULT_SUBJECTS,
  DEFAULT_TASKS,
  DEFAULT_WEEKLY_ROUTINE,
  getDefaultExamMeta,
} from './data/defaultData';
import { generateWeeklySchedule, getTodayDayOfWeek } from './utils/scheduler';
import { TodayPlannerView } from './components/TodayPlannerView';
import { WeeklyOverviewView } from './components/WeeklyOverviewView';
import { RoutineEditorView } from './components/RoutineEditorView';
import { SubjectsAndScoresView } from './components/SubjectsAndScoresView';
import { WeaknessAndMemoryView } from './components/WeaknessAndMemoryView';
import { ConditionCheckModal } from './components/ConditionCheckModal';
import { QuizVerificationModal } from './components/QuizVerificationModal';
import { SetupOnboardingFlow } from './components/SetupOnboardingFlow';

type TabKey = 'today' | 'weekly' | 'routine' | 'subjects' | 'weakness';

const STORAGE_KEY = 'pacemaker_high_state_v2';

interface PersistedState {
  hasCompletedSetup: boolean;
  examMeta: ExamMeta;
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  subjects: SubjectConfig[];
  tasks: StudyTask[];
  timeBlocks: TimeBlock[];
  conditionRecords: ConditionRecord[];
  weaknesses: WeaknessRecord[];
  adjustmentRules: PlanAdjustmentRule[];
}

function createInitialState(): PersistedState {
  const examMeta = getDefaultExamMeta();
  const todayDay = getTodayDayOfWeek();
  const timeBlocks = generateWeeklySchedule({
    weeklyRoutine: DEFAULT_WEEKLY_ROUTINE,
    subjects: DEFAULT_SUBJECTS,
    tasks: DEFAULT_TASKS,
    todayDay,
    adjustmentRules: [],
  });
  return {
    hasCompletedSetup: false,
    examMeta,
    weeklyRoutine: DEFAULT_WEEKLY_ROUTINE,
    subjects: DEFAULT_SUBJECTS,
    tasks: DEFAULT_TASKS,
    timeBlocks,
    conditionRecords: [],
    weaknesses: [],
    adjustmentRules: [],
  };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.weeklyRoutine || !parsed.subjects || !parsed.tasks) {
      return createInitialState();
    }
    parsed.hasCompletedSetup = Boolean(parsed.hasCompletedSetup);
    parsed.subjects = parsed.subjects.map((s) => {
      const def = DEFAULT_SUBJECTS.find((d) => d.id === s.id);
      return {
        ...s,
        textbookPublisher: s.textbookPublisher ?? def?.textbookPublisher ?? '',
        supplementaryMaterial: s.supplementaryMaterial ?? def?.supplementaryMaterial ?? '',
      };
    });
    return parsed;
  } catch {
    return createInitialState();
  }
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const todayDay = getTodayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [conditionModal, setConditionModal] = useState<{
    open: boolean;
    period: ConditionPeriod;
  }>({ open: false, period: 'morning' });

  const [quizModalBlock, setQuizModalBlock] = useState<TimeBlock | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  const getLatestTodayCondition = (records: ConditionRecord[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todays = records.filter((r) => r.dateStr === todayStr);
    return todays[0]?.judgedCondition;
  };

  const regenerateSchedule = (
    nextState: PersistedState,
    preserveCompleted = true
  ): PersistedState => {
    const todayCondition = getLatestTodayCondition(nextState.conditionRecords);
    const nextBlocks = generateWeeklySchedule({
      weeklyRoutine: nextState.weeklyRoutine,
      subjects: nextState.subjects,
      tasks: nextState.tasks,
      todayDay,
      todayCondition,
      adjustmentRules: nextState.adjustmentRules,
      existingBlocks: preserveCompleted ? nextState.timeBlocks : [],
    });
    return {
      ...nextState,
      timeBlocks: nextBlocks,
    };
  };

  const handleRegenerateClick = () => {
    setState((prev) => regenerateSchedule(prev, true));
    setBannerNotice('요일별 일과, 직전 시험 투자 비중, 컨디션을 반영해 주간 계획표를 다시 계산했습니다.');
  };

  const handleConditionComplete = (record: ConditionRecord) => {
    setState((prev) => {
      const filtered = prev.conditionRecords.filter(
        (r) => !(r.dateStr === record.dateStr && r.period === record.period)
      );
      const updatedRecords = [record, ...filtered];
      const next = regenerateSchedule({ ...prev, conditionRecords: updatedRecords }, true);
      return next;
    });
  };

  const handlePassQuiz = (blockId: string) => {
    setState((prev) => {
      const target = prev.timeBlocks.find((b) => b.id === blockId);
      const updatedBlocks = prev.timeBlocks.map((b) =>
        b.id === blockId ? { ...b, status: 'completed' as const } : b
      );
      const updatedTasks = prev.tasks.map((t) => {
        if (!target || t.id !== target.taskId) return t;
        const unitGain = Math.max(1, Math.round(target.durationMinutes / Math.max(1, t.minutesPerUnit)));
        return {
          ...t,
          completedUnits: Math.min(t.totalUnits, t.completedUnits + unitGain),
        };
      });
      return { ...prev, timeBlocks: updatedBlocks, tasks: updatedTasks };
    });
  };

  const handleWeaknessDetected = (block: TimeBlock, newWeaknesses: WeaknessRecord[]) => {
    setState((prev) => {
      const updatedBlocks = prev.timeBlocks.map((b) =>
        b.id === block.id ? { ...b, status: 'completed' as const } : b
      );

      // 틀린 단원에 대해 다음 계획에 자동 들어갈 오답 보충 태스크 추가
      const remedialTasks: StudyTask[] = newWeaknesses.map((w) => ({
        id: `task-rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        subjectId: w.subjectId,
        title: `오답 보충: ${w.unitTag} 재풀이 및 핵심 정리`,
        unitTag: w.unitTag,
        taskType: 'remedial',
        totalUnits: 1,
        completedUnits: 0,
        unitLabel: '세트',
        minutesPerUnit: 35,
        difficulty: 'medium',
        isRemedial: true,
        createdReason: `${w.subjectName} 확인 문제 오답(${w.score}점) 반영`,
      }));

      const nextState: PersistedState = {
        ...prev,
        timeBlocks: updatedBlocks,
        tasks: [...remedialTasks, ...prev.tasks],
        weaknesses: [...newWeaknesses, ...prev.weaknesses],
      };

      return regenerateSchedule(nextState, true);
    });
    setBannerNotice('틀린 개념을 다음 날 공부 계획표에 오답 보충 블록으로 자동 반영했습니다.');
  };

  const handleMarkBlockMissed = (blockId: string) => {
    setState((prev) => {
      const updatedBlocks = prev.timeBlocks.map((b) =>
        b.id === blockId ? { ...b, status: 'missed' as const } : b
      );
      return regenerateSchedule({ ...prev, timeBlocks: updatedBlocks }, true);
    });
    setBannerNotice('미룬 학습 분량을 이후 가용 시간과 버퍼 슬롯에 재배치했습니다.');
  };

  const handleAddAdjustmentRules = (rules: PlanAdjustmentRule[], summary: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        adjustmentRules: [...prev.adjustmentRules, ...rules],
      };
      return regenerateSchedule(next, true);
    });
    setBannerNotice(summary);
  };

  const handleRemoveAdjustmentRule = (ruleId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        adjustmentRules: prev.adjustmentRules.filter((r) => r.id !== ruleId),
      };
      return regenerateSchedule(next, true);
    });
  };

  const handleCopyDayToWeekdays = (sourceDay: DayOfWeek) => {
    setState((prev) => {
      const source = prev.weeklyRoutine[sourceDay];
      const nextRoutine = { ...prev.weeklyRoutine };
      (['mon', 'tue', 'wed', 'thu', 'fri'] as DayOfWeek[]).forEach((d) => {
        nextRoutine[d] = {
          ...source,
          dayOfWeek: d,
          blocks: source.blocks.map((b, idx) => ({ ...b, id: `${d}-copy-${idx}-${Date.now()}` })),
        };
      });
      return { ...prev, weeklyRoutine: nextRoutine };
    });
    setBannerNotice(`${DAY_LABELS[sourceDay]}요일 일과를 월~금 전체에 복사했습니다.`);
  };

  const handleClearAllRoutines = () => {
    setState((prev) => {
      const cleared = { ...prev.weeklyRoutine };
      DAY_ORDER.forEach((d) => {
        cleared[d] = {
          ...cleared[d],
          blocks: [],
        };
      });
      return { ...prev, weeklyRoutine: cleared };
    });
  };

  const handleAddSubject = (subject: SubjectConfig) => {
    setState((prev) => {
      const defaultTaskForNewSubject: StudyTask = {
        id: `task-auto-${Date.now()}`,
        subjectId: subject.id,
        title: `${subject.name} 핵심 개념 및 기출 문제 풀이`,
        unitTag: subject.examScope || '핵심 단원',
        taskType: subject.targetGrade === 1 ? 'essay' : 'problems',
        totalUnits: 20,
        completedUnits: 0,
        unitLabel: '문항',
        minutesPerUnit: 5,
        difficulty: subject.targetGrade === 1 ? 'high' : 'medium',
      };
      return {
        ...prev,
        subjects: [...prev.subjects, subject],
        tasks: [defaultTaskForNewSubject, ...prev.tasks],
      };
    });
  };

  const handleDeleteSubject = (subjectId: string) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== subjectId),
      tasks: prev.tasks.filter((t) => t.subjectId !== subjectId),
    }));
  };

  const handleFinishSetupAndEnterLobby = () => {
    setState((prev) => {
      const next = regenerateSchedule(prev, false);
      return {
        ...next,
        hasCompletedSetup: true,
      };
    });
    setActiveTab('today');
    setBannerNotice('입력한 하루 일과와 시험범위·교과서 정보를 바탕으로 나만의 계획표를 생성했습니다.');
  };

  const handleResetDemo = () => {
    const fresh = createInitialState();
    setState(fresh);
    setBannerNotice('고1 기본 예시 데이터로 초기화했습니다.');
  };

  if (!state.hasCompletedSetup) {
    return (
      <SetupOnboardingFlow
        examMeta={state.examMeta}
        weeklyRoutine={state.weeklyRoutine}
        subjects={state.subjects}
        tasks={state.tasks}
        onUpdateExamMeta={(examMeta) => setState((prev) => ({ ...prev, examMeta }))}
        onUpdateDayRoutine={(day, updated) =>
          setState((prev) => ({
            ...prev,
            weeklyRoutine: { ...prev.weeklyRoutine, [day]: updated },
          }))
        }
        onReplaceWeeklyRoutine={(nextRoutine) =>
          setState((prev) => ({ ...prev, weeklyRoutine: nextRoutine }))
        }
        onCopyDayToAllWeekdays={handleCopyDayToWeekdays}
        onClearAllRoutines={handleClearAllRoutines}
        onResetToSampleData={() => setState(createInitialState())}
        onUpdateSubject={(updated) =>
          setState((prev) => ({
            ...prev,
            subjects: prev.subjects.map((s) => (s.id === updated.id ? updated : s)),
          }))
        }
        onAddSubject={handleAddSubject}
        onDeleteSubject={handleDeleteSubject}
        onFinishSetupAndEnterLobby={handleFinishSetupAndEnterLobby}
      />
    );
  }

  const navItems: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'today', label: '오늘의 시간표', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'weekly', label: '주간 계획표', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'routine', label: '요일별 일과 설정', icon: <Clock className="h-4 w-4" /> },
    { key: 'subjects', label: '과목·성적·시험범위', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'weakness', label: '오답 & 암기 보관함', icon: <AlertCircle className="h-4 w-4" /> },
  ];

  const tabTitles: Record<TabKey, string> = {
    today: '오늘의 시간표 및 학습 실행',
    weekly: '주간 계획표 전체 보기',
    routine: '요일별 일과 직접 설정',
    subjects: '과목·직전 시험·소요시간 관리',
    weakness: '오답 보충 및 핵심 암기 보관함',
  };

  const quizSubject = quizModalBlock
    ? state.subjects.find((s) => s.id === quizModalBlock.subjectId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* 데스크톱 좌측 사이드바 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <span className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
            페이스메이커 High
          </span>
          <p className="mt-0.5 text-xs text-slate-500">고1 내신 맞춤형 AI 플래너</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <button
            onClick={() => setState((prev) => ({ ...prev, hasCompletedSetup: false }))}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            일과·시험범위 초기 설정
          </button>
          <button
            onClick={handleResetDemo}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            기본 예시 데이터 초기화
          </button>
        </div>
      </aside>

      {/* 모바일 드로어 */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 flex w-64 flex-col bg-white border-r border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="text-base font-extrabold text-slate-900">페이스메이커 High</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="메뉴 닫기"
                className="p-1 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="메뉴 열기"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">{state.examMeta.title}</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{tabTitles[activeTab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setConditionModal({ open: true, period: 'morning' })}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              20초 컨디션 체크
            </button>
          </div>
        </header>

        {bannerNotice && (
          <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-2.5 text-xs font-medium text-blue-900 lg:px-8">
            <span>{bannerNotice}</span>
            <button
              onClick={() => setBannerNotice(null)}
              aria-label="알림 닫기"
              className="text-blue-700 hover:text-blue-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1280px] flex-1 p-5 lg:p-8">
          {activeTab === 'today' && (
            <TodayPlannerView
              examMeta={state.examMeta}
              todayDay={todayDay}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              weeklyRoutine={state.weeklyRoutine}
              subjects={state.subjects}
              tasks={state.tasks}
              timeBlocks={state.timeBlocks}
              conditionRecords={state.conditionRecords}
              adjustmentRules={state.adjustmentRules}
              onOpenConditionModal={(period) => setConditionModal({ open: true, period })}
              onOpenQuizModal={(block) => setQuizModalBlock(block)}
              onMarkBlockMissed={handleMarkBlockMissed}
              onAddAdjustmentRules={handleAddAdjustmentRules}
              onRemoveAdjustmentRule={handleRemoveAdjustmentRule}
              onRegeneratePlan={handleRegenerateClick}
            />
          )}

          {activeTab === 'weekly' && (
            <WeeklyOverviewView
              todayDay={todayDay}
              weeklyRoutine={state.weeklyRoutine}
              subjects={state.subjects}
              timeBlocks={state.timeBlocks}
              onJumpToDay={(d) => {
                setSelectedDay(d);
                setActiveTab('today');
              }}
            />
          )}

          {activeTab === 'routine' && (
            <RoutineEditorView
              weeklyRoutine={state.weeklyRoutine}
              onUpdateDayRoutine={(day, updated) =>
                setState((prev) => ({
                  ...prev,
                  weeklyRoutine: { ...prev.weeklyRoutine, [day]: updated },
                }))
              }
              onReplaceWeeklyRoutine={(nextRoutine) =>
                setState((prev) => ({ ...prev, weeklyRoutine: nextRoutine }))
              }
              onCopyDayToAllWeekdays={handleCopyDayToWeekdays}
              onClearAllRoutines={handleClearAllRoutines}
              onRegeneratePlan={() => {
                handleRegenerateClick();
                setActiveTab('today');
              }}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsAndScoresView
              examMeta={state.examMeta}
              onUpdateExamMeta={(examMeta) => setState((prev) => ({ ...prev, examMeta }))}
              subjects={state.subjects}
              tasks={state.tasks}
              onUpdateSubject={(updated) =>
                setState((prev) => ({
                  ...prev,
                  subjects: prev.subjects.map((s) => (s.id === updated.id ? updated : s)),
                }))
              }
              onAddTask={(task) =>
                setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }))
              }
              onUpdateTask={(updated) =>
                setState((prev) => ({
                  ...prev,
                  tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)),
                }))
              }
              onDeleteTask={(taskId) =>
                setState((prev) => ({
                  ...prev,
                  tasks: prev.tasks.filter((t) => t.id !== taskId),
                }))
              }
              onRegeneratePlan={() => {
                handleRegenerateClick();
                setActiveTab('today');
              }}
            />
          )}

          {activeTab === 'weakness' && (
            <WeaknessAndMemoryView
              weaknesses={state.weaknesses}
              conditionRecords={state.conditionRecords}
              onToggleResolveWeakness={(id) =>
                setState((prev) => ({
                  ...prev,
                  weaknesses: prev.weaknesses.map((w) =>
                    w.id === id ? { ...w, resolved: !w.resolved } : w
                  ),
                }))
              }
            />
          )}
        </main>
      </div>

      {/* 아침/저녁 20초 시험범위 컨디션 체크 모달 */}
      <ConditionCheckModal
        isOpen={conditionModal.open}
        period={conditionModal.period}
        dayOfWeek={todayDay}
        subjects={state.subjects}
        onClose={() => setConditionModal((prev) => ({ ...prev, open: false }))}
        onComplete={handleConditionComplete}
      />

      {/* 목표 등급별 확인 문제 & 1등급 서술형 채점 모달 */}
      <QuizVerificationModal
        isOpen={Boolean(quizModalBlock)}
        block={quizModalBlock}
        subject={quizSubject}
        onClose={() => setQuizModalBlock(null)}
        onPassComplete={handlePassQuiz}
        onWeaknessDetected={handleWeaknessDetected}
      />
    </div>
  );
}
