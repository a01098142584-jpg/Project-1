import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  SkipForward,
  Brain,
  Send,
  X,
  RefreshCw,
  AlertTriangle,
  BookCheck,
} from 'lucide-react';
import {
  ConditionLevel,
  ConditionPeriod,
  ConditionRecord,
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  DayRoutineConfig,
  EVENT_TYPE_LABELS,
  ExamMeta,
  PlanAdjustmentRule,
  StudyTask,
  SubjectConfig,
  TASK_TYPE_LABELS,
  TimeBlock,
} from '../types';
import {
  calculateSubjectInvestments,
  computeFeasibility,
  formatDurationKo,
  timeToMinutes,
} from '../utils/scheduler';

interface TodayPlannerViewProps {
  examMeta: ExamMeta;
  todayDay: DayOfWeek;
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  subjects: SubjectConfig[];
  tasks: StudyTask[];
  timeBlocks: TimeBlock[];
  conditionRecords: ConditionRecord[];
  adjustmentRules: PlanAdjustmentRule[];
  onOpenConditionModal: (period: ConditionPeriod) => void;
  onOpenQuizModal: (block: TimeBlock) => void;
  onMarkBlockMissed: (blockId: string) => void;
  onAddAdjustmentRules: (rules: PlanAdjustmentRule[], summary: string) => void;
  onRemoveAdjustmentRule: (ruleId: string) => void;
  onRegeneratePlan: () => void;
}

export const TodayPlannerView: React.FC<TodayPlannerViewProps> = ({
  examMeta,
  todayDay,
  selectedDay,
  onSelectDay,
  weeklyRoutine,
  subjects,
  tasks,
  timeBlocks,
  conditionRecords,
  adjustmentRules,
  onOpenConditionModal,
  onOpenQuizModal,
  onMarkBlockMissed,
  onAddAdjustmentRules,
  onRemoveAdjustmentRule,
  onRegeneratePlan,
}) => {
  const [activeTimerBlockId, setActiveTimerBlockId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  const [adjustInput, setAdjustInput] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustFeedback, setAdjustFeedback] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTimerBlockId) return;
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimerBlockId]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleTimer = (blockId: string) => {
    if (activeTimerBlockId === blockId) {
      setActiveTimerBlockId(null);
    } else {
      setActiveTimerBlockId(blockId);
      setTimerSeconds(0);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const morningCond = conditionRecords.find(
    (c) => c.dateStr === todayStr && c.period === 'morning'
  );
  const eveningCond = conditionRecords.find(
    (c) => c.dateStr === todayStr && c.period === 'evening'
  );
  const latestCond = eveningCond || morningCond;

  const feasibility = computeFeasibility(weeklyRoutine, tasks, examMeta.examDate);
  const investments = calculateSubjectInvestments(subjects, tasks);

  const dayRoutine = weeklyRoutine[selectedDay];
  const dayStudyBlocks = timeBlocks.filter((b) => b.dayOfWeek === selectedDay);
  const dayPlannedMinutes = dayStudyBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const dayCompletedMinutes = dayStudyBlocks
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  type TimelineItem =
    | { kind: 'fixed'; startMin: number; startTime: string; endTime: string; title: string; subtitle: string; id: string }
    | { kind: 'study'; startMin: number; block: TimeBlock };

  const timelineItems: TimelineItem[] = [
    ...dayRoutine.blocks.map((fb) => ({
      kind: 'fixed' as const,
      startMin: timeToMinutes(fb.startTime),
      startTime: fb.startTime,
      endTime: fb.endTime,
      title: fb.title,
      subtitle: fb.allowLightStudy
        ? `${EVENT_TYPE_LABELS[fb.type]} · 이동 중 암기 허용`
        : EVENT_TYPE_LABELS[fb.type],
      id: fb.id,
    })),
    ...dayStudyBlocks.map((sb) => ({
      kind: 'study' as const,
      startMin: timeToMinutes(sb.startTime),
      block: sb,
    })),
  ].sort((a, b) => a.startMin - b.startMin);

  const handleAdjustSubmit = async (promptText?: string) => {
    const reqText = (promptText ?? adjustInput).trim();
    if (!reqText) return;
    setIsAdjusting(true);
    setAdjustError(null);
    setAdjustFeedback(null);

    try {
      const res = await fetch('/api/plan/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: reqText,
          subjects: subjects.map((s) => ({ name: s.name })),
          todayDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '요청을 반영하지 못했습니다.');

      const newRules: PlanAdjustmentRule[] = (data.rules ?? []).map(
        (r: Omit<PlanAdjustmentRule, 'id' | 'createdAt'>) => ({
          ...r,
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        })
      );

      onAddAdjustmentRules(newRules, data.summary || '요청사항이 계획표에 반영되었습니다.');
      setAdjustFeedback(data.summary || '계획표에 즉시 반영했습니다.');
      if (!promptText) setAdjustInput('');
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : '계획 수정 중 오류가 발생했습니다.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const conditionLabel = (level: ConditionLevel) => {
    if (level === 'optimal') return '최상';
    if (level === 'normal') return '보통';
    return '저하(경량 조정됨)';
  };

  return (
    <div className="space-y-6">
      {/* 상단 핵심 요약 스트립 (4열 그리드, 테두리 과다 중첩 금지) */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{examMeta.title}</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            D-{feasibility.daysUntilExam}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{examMeta.examDate} 시작</p>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-4">
          <p className="text-xs font-medium text-slate-500">
            {DAY_LABELS[selectedDay]}요일 공부 배정
          </p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            {formatDurationKo(dayPlannedMinutes)}
          </p>
          <p className="mt-0.5 font-mono-num text-xs text-slate-500">
            완료 {formatDurationKo(dayCompletedMinutes)} / 일일 상한 {formatDurationKo(dayRoutine.maxStudyMinutes)}
          </p>
        </div>

        <div className="lg:border-l lg:border-slate-200 lg:pl-4">
          <p className="text-xs font-medium text-slate-500">시험까지 실현 가능성</p>
          <p
            className={`mt-1 font-mono-num text-2xl font-bold ${
              feasibility.isFeasible ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {feasibility.isFeasible ? '달성 가능' : '시간 부족'}
          </p>
          <p className="mt-0.5 font-mono-num text-xs text-slate-500">
            필요 {formatDurationKo(feasibility.totalRequiredMinutes)} / 가용 {formatDurationKo(feasibility.totalAvailableUntilExam)}
          </p>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-4">
          <p className="text-xs font-medium text-slate-500">오늘 판정된 컨디션</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {latestCond ? conditionLabel(latestCond.judgedCondition) : '체크 전'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {latestCond
              ? `${latestCond.period === 'morning' ? '아침' : '저녁'} 회상 ${latestCond.recallScore}점`
              : '아침·저녁 20초 암기로 자동 판정'}
          </p>
        </div>
      </div>

      {/* 아침·저녁 컨디션 체크 & 요일 선택 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          {DAY_ORDER.map((d) => {
            const active = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => onSelectDay(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {DAY_LABELS[d]}
                {d === todayDay ? ' (오늘)' : ''}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenConditionModal('morning')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              morningCond
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            {morningCond
              ? `아침 컨디션: ${conditionLabel(morningCond.judgedCondition)}`
              : '아침 컨디션 체크 (20초 암기)'}
          </button>

          <button
            onClick={() => onOpenConditionModal('evening')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              eveningCond
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            {eveningCond
              ? `저녁 컨디션: ${conditionLabel(eveningCond.judgedCondition)}`
              : '저녁 컨디션 체크 (20초 암기)'}
          </button>

          <button
            onClick={onRegeneratePlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            일정 재계산
          </button>
        </div>
      </div>

      {/* 메인 2컬럼 레이아웃 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 왼쪽: 일과 + 학습 통합 타임라인 */}
        <div className="space-y-4 lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                {DAY_LABELS[selectedDay]}요일 일과 및 공부 타임라인
              </h2>
              <span className="font-mono-num text-xs text-slate-500">
                기상 {dayRoutine.wakeTime} · 취침 {dayRoutine.sleepTime}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {timelineItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  이 요일에 배정된 일정이 없습니다. 일과 또는 과목 과제를 확인해 주세요.
                </div>
              ) : (
                timelineItems.map((item) => {
                  if (item.kind === 'fixed') {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 bg-slate-50/60 px-5 py-3 text-xs text-slate-500"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="w-28 shrink-0 font-mono-num text-slate-500">
                            {item.startTime}–{item.endTime}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-700">{item.title}</span>
                            <span className="mx-1.5">·</span>
                            <span>{item.subtitle}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-slate-400">고정 일과</span>
                      </div>
                    );
                  }

                  const b = item.block;
                  const subj = subjects.find((s) => s.id === b.subjectId);
                  const isRunning = activeTimerBlockId === b.id;
                  const isDone = b.status === 'completed';
                  const isMissed = b.status === 'missed';

                  return (
                    <div
                      key={b.id}
                      className={`flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isDone ? 'bg-emerald-50/40' : isMissed ? 'bg-slate-50 opacity-60' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-28 shrink-0">
                          <p className="font-mono-num text-sm font-bold text-slate-900">
                            {b.startTime}–{b.endTime}
                          </p>
                          <p className="font-mono-num text-xs text-slate-500">
                            {b.durationMinutes}분 · {b.slotContext === 'commute' ? '이동 암기' : '책상 집중'}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span
                              className="inline-block h-2 w-2 rounded-xs shrink-0"
                              style={{ backgroundColor: subj?.color || '#2563EB' }}
                            />
                            <span className="font-bold text-slate-800">{subj?.name}</span>
                            <span>·</span>
                            <span>{TASK_TYPE_LABELS[b.taskType]}</span>
                            <span>·</span>
                            <span>목표 {subj?.targetGrade}등급</span>
                            {b.isRemedial && (
                              <>
                                <span>·</span>
                                <span className="font-semibold text-amber-700">오답 보충</span>
                              </>
                            )}
                            {b.adjustmentNote && (
                              <>
                                <span>·</span>
                                <span className="font-medium text-blue-700">{b.adjustmentNote}</span>
                              </>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-sm font-semibold ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {b.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            학습 및 문제 통과
                          </span>
                        ) : isMissed ? (
                          <span className="text-xs font-medium text-slate-500">다음 일정으로 이월됨</span>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleTimer(b.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono-num text-xs font-semibold transition-colors whitespace-nowrap ${
                                isRunning
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {isRunning ? (
                                <>
                                  <Pause className="h-3.5 w-3.5" />
                                  {formatTimer(timerSeconds)}
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  타이머
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                if (isRunning) setActiveTimerBlockId(null);
                                onOpenQuizModal(b);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                            >
                              <BookCheck className="h-3.5 w-3.5" />
                              완료 & 확인문제
                            </button>

                            <button
                              onClick={() => onMarkBlockMissed(b.id)}
                              title="못 끝내서 다음 날로 미루기"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              미루기
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 자연어 추가 요구 반영 + 과목 투자 요약 */}
        <div className="space-y-6 lg:col-span-4">
          {/* 학생 추가 요구사항 입력 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">계획 수정·추가 요구하기</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              갑작스러운 수행평가나 집중하고 싶은 과목이 생기면 말로 요청하세요. 일과 예산을 지키며 계획표를 재조정합니다.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdjustSubmit();
              }}
              className="mt-3 space-y-2.5"
            >
              <textarea
                rows={3}
                value={adjustInput}
                onChange={(e) => setAdjustInput(e.target.value)}
                placeholder="예: 목요일은 수행평가 때문에 영어 빼고 공통수학1 시간 1시간 더 늘려줘"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="submit"
                disabled={isAdjusting || !adjustInput.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isAdjusting ? '요청 분석 및 재조정 중...' : '요청 반영해 계획 조정'}
              </button>
            </form>

            {/* 빠른 예시 버튼 */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                '오늘 너무 피곤해서 전체 공부 1시간 줄여줘',
                '목요일은 영어 빼고 수학 집중해줘',
                '토요일에 통합과학1 시간 1시간 늘려줘',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setAdjustInput(sample)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
                >
                  {sample}
                </button>
              ))}
            </div>

            {adjustFeedback && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                {adjustFeedback}
              </div>
            )}

            {adjustError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustmentRules.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-700">현재 적용 중인 요청 규칙</p>
                <div className="mt-2 space-y-1.5">
                  {adjustmentRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <span className="truncate">
                        {DAY_LABELS[rule.dayOfWeek]}요일 · {rule.note}
                      </span>
                      <button
                        onClick={() => onRemoveAdjustmentRule(rule.id)}
                        aria-label="규칙 해제"
                        className="text-slate-400 hover:text-red-600 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 직전 시험 데이터 기반 투자 비중 요약 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">직전 시험 기반 과목 투자 비중</h2>
            <p className="mt-1 text-xs text-slate-500">
              직전 등급과 목표 등급의 격차가 클수록 더 많은 시간이 배정됩니다.
            </p>
            <div className="mt-4 space-y-3">
              {investments.map((inv) => (
                <div key={inv.subject.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {inv.subject.name} ({inv.subject.prevGrade}등급 → 목표 {inv.subject.targetGrade}등급)
                    </span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {inv.sharePercent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${inv.sharePercent}%`,
                        backgroundColor: inv.subject.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
