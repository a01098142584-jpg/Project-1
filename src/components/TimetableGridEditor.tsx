import React, { useState, useEffect } from 'react';
import {
  Copy,
  Eraser,
  Plus,
  Trash2,
  Wand2,
  LayoutList,
  Grid3X3,
  AlertTriangle,
} from 'lucide-react';
import {
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  DayRoutineConfig,
  EVENT_TYPE_LABELS,
  FixedEventType,
  RoutineBlock,
} from '../types';
import {
  extractAvailableSlots,
  formatDurationKo,
  minutesToTime,
  timeToMinutes,
} from '../utils/scheduler';
import {
  buildEmptyRoutine,
  buildYajaFocusedRoutine,
  getAcademyPresetRoutine,
} from '../data/routinePresets';

interface TimetableGridEditorProps {
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  onUpdateDayRoutine: (day: DayOfWeek, updated: DayRoutineConfig) => void;
  onReplaceWeeklyRoutine: (next: Record<DayOfWeek, DayRoutineConfig>) => void;
  onCopyDayToAllWeekdays: (sourceDay: DayOfWeek) => void;
  onClearAllRoutines?: () => void;
}

type BrushMode = FixedEventType | 'erase';

const START_HOUR = 6;
const END_HOUR = 24;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

const TYPE_CELL_STYLES: Record<FixedEventType, string> = {
  school: 'bg-slate-200 text-slate-800 border-slate-300',
  academy: 'bg-blue-100 text-blue-900 border-blue-200',
  commute: 'bg-teal-100 text-teal-900 border-teal-200',
  meal: 'bg-amber-100 text-amber-900 border-amber-200',
  activity: 'bg-purple-100 text-purple-900 border-purple-200',
  rest: 'bg-zinc-200 text-zinc-800 border-zinc-300',
};

const BRUSH_OPTIONS: Array<{ mode: BrushMode; label: string; dotColor: string }> = [
  { mode: 'school', label: '학교 수업', dotColor: 'bg-slate-500' },
  { mode: 'academy', label: '학원·과외', dotColor: 'bg-blue-600' },
  { mode: 'commute', label: '등하교·이동', dotColor: 'bg-teal-600' },
  { mode: 'meal', label: '식사', dotColor: 'bg-amber-500' },
  { mode: 'activity', label: '동아리·수행', dotColor: 'bg-purple-600' },
  { mode: 'rest', label: '휴식·기타', dotColor: 'bg-zinc-500' },
  { mode: 'erase', label: '지우개', dotColor: 'bg-white border border-slate-400' },
];

function applyCellPaint(
  existingBlocks: RoutineBlock[],
  day: DayOfWeek,
  cellStartMin: number,
  cellEndMin: number,
  mode: BrushMode,
  customLabel: string,
  allowLightOnCommute: boolean
): RoutineBlock[] {
  const nextBlocks: RoutineBlock[] = [];

  for (const b of existingBlocks) {
    const bs = timeToMinutes(b.startTime);
    const be = timeToMinutes(b.endTime);

    if (be <= cellStartMin || bs >= cellEndMin) {
      nextBlocks.push(b);
    } else {
      if (bs < cellStartMin) {
        nextBlocks.push({
          ...b,
          id: `${b.id}-L-${bs}`,
          endTime: minutesToTime(cellStartMin),
        });
      }
      if (be > cellEndMin) {
        nextBlocks.push({
          ...b,
          id: `${b.id}-R-${cellEndMin}`,
          startTime: minutesToTime(cellEndMin),
        });
      }
    }
  }

  if (mode !== 'erase') {
    const label = customLabel.trim() || EVENT_TYPE_LABELS[mode];
    nextBlocks.push({
      id: `${day}-grid-${cellStartMin}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      startTime: minutesToTime(cellStartMin),
      endTime: minutesToTime(cellEndMin),
      title: label,
      type: mode,
      allowLightStudy: mode === 'commute' ? allowLightOnCommute : false,
    });
  }

  const sorted = nextBlocks.sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const merged: RoutineBlock[] = [];
  for (const curr of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.endTime === curr.startTime &&
      prev.type === curr.type &&
      prev.title === curr.title &&
      Boolean(prev.allowLightStudy) === Boolean(curr.allowLightStudy)
    ) {
      prev.endTime = curr.endTime;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

export const TimetableGridEditor: React.FC<TimetableGridEditorProps> = ({
  weeklyRoutine,
  onUpdateDayRoutine,
  onReplaceWeeklyRoutine,
  onCopyDayToAllWeekdays,
  onClearAllRoutines,
}) => {
  const [viewMode, setViewMode] = useState<'easy' | 'grid'>('easy');

  // 1. 말로 한 번에 시간표 채우기 상태
  const [aiText, setAiText] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

  // 2. 여러 요일 한 번에 선택 추가 폼 상태
  const [targetDays, setTargetDays] = useState<DayOfWeek[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [quickStart, setQuickStart] = useState('08:20');
  const [quickEnd, setQuickEnd] = useState('16:10');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState<FixedEventType>('school');
  const [quickAllowLight, setQuickAllowLight] = useState(false);

  // 3. 그리드 모드 상태
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('mon');
  const [brushMode, setBrushMode] = useState<BrushMode>('academy');
  const [brushLabel, setBrushLabel] = useState('');
  const [brushLightStudy, setBrushLightStudy] = useState(true);
  const [isPainting, setIsPainting] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => setIsPainting(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleAiParseRoutine = async (presetText?: string) => {
    const text = (presetText ?? aiText).trim();
    if (!text) return;
    setIsParsingAi(true);
    setAiErrorMsg(null);
    setAiStatusMsg(null);

    try {
      const res = await fetch('/api/routine/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '시간표 변환에 실패했습니다.');

      const nextRoutine = buildEmptyRoutine();
      for (const dayItem of data.days ?? []) {
        const d = dayItem.dayOfWeek as DayOfWeek;
        if (!DAY_ORDER.includes(d)) continue;
        nextRoutine[d] = {
          dayOfWeek: d,
          wakeTime: dayItem.wakeTime || nextRoutine[d].wakeTime,
          sleepTime: dayItem.sleepTime || nextRoutine[d].sleepTime,
          maxStudyMinutes: d === 'sat' || d === 'sun' ? 360 : 240,
          blocks: (dayItem.blocks ?? []).map(
            (b: Omit<RoutineBlock, 'id'>, idx: number) => ({
              id: `${d}-ai-${idx}-${Date.now()}`,
              startTime: b.startTime,
              endTime: b.endTime,
              title: b.title,
              type: (['school', 'academy', 'commute', 'meal', 'activity', 'rest'].includes(b.type)
                ? b.type
                : 'rest') as FixedEventType,
              allowLightStudy: Boolean(b.allowLightStudy),
            })
          ),
        };
      }
      onReplaceWeeklyRoutine(nextRoutine);
      setAiStatusMsg(data.summary || '일주일 시간표를 자동으로 채웠습니다.');
      if (!presetText) setAiText('');
    } catch (err) {
      setAiErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsParsingAi(false);
    }
  };

  const toggleTargetDay = (day: DayOfWeek) => {
    setTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleBatchAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetDays.length === 0) return;
    if (timeToMinutes(quickEnd) <= timeToMinutes(quickStart)) return;
    const title = quickTitle.trim() || EVENT_TYPE_LABELS[quickType];

    const updated = { ...weeklyRoutine };
    for (const day of targetDays) {
      const curr = updated[day];
      updated[day] = {
        ...curr,
        blocks: [
          ...curr.blocks,
          {
            id: `${day}-batch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            startTime: quickStart,
            endTime: quickEnd,
            title,
            type: quickType,
            allowLightStudy: quickType === 'commute' ? quickAllowLight : false,
          },
        ],
      };
    }
    onReplaceWeeklyRoutine(updated);
    setQuickTitle('');
  };

  const handleDeleteBlock = (day: DayOfWeek, blockId: string) => {
    const curr = weeklyRoutine[day];
    onUpdateDayRoutine(day, {
      ...curr,
      blocks: curr.blocks.filter((b) => b.id !== blockId),
    });
  };

  const paintSlot = (day: DayOfWeek, slotIndex: number) => {
    const cellStartMin = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
    const cellEndMin = cellStartMin + SLOT_MINUTES;
    const current = weeklyRoutine[day];
    const updatedBlocks = applyCellPaint(
      current.blocks,
      day,
      cellStartMin,
      cellEndMin,
      brushMode,
      brushLabel,
      brushLightStudy
    );
    onUpdateDayRoutine(day, {
      ...current,
      blocks: updatedBlocks,
    });
  };

  const findBlockForSlot = (day: DayOfWeek, slotIndex: number): RoutineBlock | undefined => {
    const cellStart = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
    const cellEnd = cellStart + SLOT_MINUTES;
    const cellMid = cellStart + 15;
    return weeklyRoutine[day].blocks.find((b) => {
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);
      return cellMid >= s && cellMid < e && e > cellStart && s < cellEnd;
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. 제일 쉬운 방법: 말로 한 번에 입력 + 1초 프리셋 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              방법 1. 내 일과를 한 줄로 적으면 알아서 시간표를 채워줘요
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            일일이 칸을 누르지 않아도 학교·학원·식사·취침 시간만 대충 적으면 월~일 시간표가 3초 만에 완성됩니다.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiParseRoutine();
            }}
            className="mt-3 flex flex-col gap-2.5 sm:flex-row"
          >
            <input
              type="text"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="예: 월~금 8시20분~4시10분 학교, 월수금 6시~9시 수학학원, 5시 저녁먹고 12시에 자"
              className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              disabled={isParsingAi || !aiText.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Wand2 className="h-4 w-4" />
              {isParsingAi ? '시간표 채우는 중...' : '한 번에 채우기'}
            </button>
          </form>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              '평일 8:20~16:10 학교, 월수금 18:00~21:00 수학학원, 화목 21시까지 야자, 24시 취침',
              '평일 8시~16시 학교, 화목 19시~22시 영어학원, 주말엔 9시 기상해서 자유 공부',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setAiText(sample)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
              >
                예시 넣기: {sample}
              </button>
            ))}
          </div>

          {aiStatusMsg && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              {aiStatusMsg}
            </p>
          )}
          {aiErrorMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{aiErrorMsg}</span>
            </div>
          )}
        </div>

        {/* 1초 대표 시간표 프리셋 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
          <h2 className="text-sm font-bold text-slate-900">방법 2. 1초 대표 프리셋</h2>
          <p className="mt-1 text-xs text-slate-500">
            비슷한 생활 패턴을 먼저 불러온 뒤 필요한 부분만 빼거나 고치세요.
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => onReplaceWeeklyRoutine(getAcademyPresetRoutine())}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              고1 학교 + 월수금 학원형 불러오기
            </button>
            <button
              type="button"
              onClick={() => onReplaceWeeklyRoutine(buildYajaFocusedRoutine())}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              고1 학교 + 야자/독서실 집중형 불러오기
            </button>
            <button
              type="button"
              onClick={() => {
                if (onClearAllRoutines) onClearAllRoutines();
                else onReplaceWeeklyRoutine(buildEmptyRoutine());
              }}
              className="inline-flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Eraser className="h-3.5 w-3.5" />
              시간표 모두 비우고 직접 쓰기
            </button>
          </div>
        </div>
      </div>

      {/* 보기 전환 탭 + 여러 요일 묶어 추가 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('easy')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              viewMode === 'easy'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            간편 요일표로 보기 & 묶어 추가
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            30분 시간표 칸 직접 색칠하기
          </button>
        </div>
      </div>

      {viewMode === 'easy' ? (
        <div className="space-y-6">
          {/* 여러 요일 한 번에 일정 추가 */}
          <form
            onSubmit={handleBatchAddBlock}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                방법 3. 요일 여러 개를 한 번에 골라서 일정 추가하기
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTargetDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  평일 전체
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDays(['mon', 'wed', 'fri'])}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  월·수·금
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDays(['tue', 'thu'])}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  화·목
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDays(['sat', 'sun'])}
                  className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  주말
                </button>
              </div>
            </div>

            {/* 요일 체크 버튼 */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DAY_ORDER.map((d) => {
                const checked = targetDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleTargetDay(d)}
                    className={`rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      checked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {DAY_LABELS[d]}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500">시작 시간</label>
                <input
                  type="time"
                  value={quickStart}
                  onChange={(e) => setQuickStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-num text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500">종료 시간</label>
                <input
                  type="time"
                  value={quickEnd}
                  onChange={(e) => setQuickEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono-num text-sm"
                />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs text-slate-500">종류</label>
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as FixedEventType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="block text-xs text-slate-500">일정 이름</label>
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder={`비워두면 '${EVENT_TYPE_LABELS[quickType]}'`}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 flex items-end sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  선택 요일에 추가
                </button>
              </div>
            </div>

            {quickType === 'commute' && (
              <label className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={quickAllowLight}
                  onChange={(e) => setQuickAllowLight(e.target.checked)}
                />
                이동 중 영단어·핵심 문장 암기 배치 허용
              </label>
            )}
          </form>

          {/* 한눈에 보는 월~일 요약 표 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
            {DAY_ORDER.map((day) => {
              const routine = weeklyRoutine[day];
              const sorted = [...routine.blocks].sort(
                (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
              );
              const availSlots = extractAvailableSlots(routine);
              const totalAvail = availSlots.reduce((sum, s) => sum + s.duration, 0);

              return (
                <div
                  key={day}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3">
                    <span className="text-sm font-bold text-slate-900">
                      {DAY_LABELS[day]}요일
                    </span>
                    <span className="font-mono-num text-xs font-bold text-blue-700">
                      공부 {formatDurationKo(Math.min(totalAvail, routine.maxStudyMinutes))}
                    </span>
                  </div>

                  {/* 기상/취침 간략 조절 */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 font-mono-num text-[11px] text-slate-600">
                    <label className="flex items-center gap-1">
                      <span>기상</span>
                      <input
                        type="time"
                        value={routine.wakeTime}
                        onChange={(e) =>
                          onUpdateDayRoutine(day, { ...routine, wakeTime: e.target.value })
                        }
                        className="w-[74px] bg-transparent font-semibold text-slate-800"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span>취침</span>
                      <input
                        type="time"
                        value={routine.sleepTime}
                        onChange={(e) =>
                          onUpdateDayRoutine(day, { ...routine, sleepTime: e.target.value })
                        }
                        className="w-[74px] bg-transparent font-semibold text-slate-800"
                      />
                    </label>
                  </div>

                  {/* 등록된 고정 일정 목록 */}
                  <div className="flex-1 divide-y divide-slate-100 p-2">
                    {sorted.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        고정 일정 없음
                      </p>
                    ) : (
                      sorted.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-start justify-between gap-1.5 px-1.5 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-mono-num text-[11px] text-slate-500">
                              {b.startTime}–{b.endTime}
                            </p>
                            <p className="truncate font-semibold text-slate-900">{b.title}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(day, b.id)}
                            aria-label="일정 삭제"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {['mon', 'tue', 'wed', 'thu', 'fri'].includes(day) && (
                    <button
                      type="button"
                      onClick={() => onCopyDayToAllWeekdays(day)}
                      className="flex items-center justify-center gap-1 border-t border-slate-100 py-2 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Copy className="h-3 w-3" />
                      이 요일을 평일에 복사
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 30분 시간표 칸 직접 색칠하기 모드 */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              {BRUSH_OPTIONS.map((opt) => {
                const active = brushMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setBrushMode(opt.mode)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`inline-block h-2.5 w-2.5 rounded-xs ${opt.dotColor}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {brushMode !== 'erase' && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                <input
                  type="text"
                  value={brushLabel}
                  onChange={(e) => setBrushLabel(e.target.value)}
                  placeholder={`일정명 입력 (비워두면 '${EVENT_TYPE_LABELS[brushMode]}')`}
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
                {brushMode === 'commute' && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={brushLightStudy}
                      onChange={(e) => setBrushLightStudy(e.target.checked)}
                    />
                    이동 중 암기 허용
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white select-none">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="w-16 border-r border-slate-200 px-2 py-2.5 text-center font-mono-num font-semibold">
                      시간
                    </th>
                    {DAY_ORDER.map((day) => (
                      <th
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`cursor-pointer border-r border-slate-200 last:border-r-0 px-2 py-2.5 text-center font-bold ${
                          selectedDay === day ? 'bg-blue-50 text-blue-800' : ''
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
                    const startMin = START_HOUR * 60 + slotIdx * SLOT_MINUTES;
                    const isHourBoundary = startMin % 60 === 0;
                    const timeLabel = minutesToTime(startMin);

                    return (
                      <tr
                        key={slotIdx}
                        className={
                          isHourBoundary
                            ? 'border-t border-slate-200'
                            : 'border-t border-slate-100'
                        }
                      >
                        <td className="h-7 border-r border-slate-200 bg-slate-50/70 px-1.5 text-center font-mono-num text-[11px] text-slate-500">
                          {isHourBoundary ? timeLabel : ''}
                        </td>

                        {DAY_ORDER.map((day) => {
                          const routine = weeklyRoutine[day];
                          const wakeMin = timeToMinutes(routine.wakeTime);
                          const sleepMin = timeToMinutes(routine.sleepTime);
                          const isSleeping = startMin < wakeMin || startMin >= sleepMin;

                          const matchedBlock = findBlockForSlot(day, slotIdx);
                          const prevBlock =
                            slotIdx > 0 ? findBlockForSlot(day, slotIdx - 1) : undefined;
                          const isFirstCell =
                            matchedBlock && (!prevBlock || prevBlock.id !== matchedBlock.id);

                          return (
                            <td
                              key={day}
                              onMouseDown={() => {
                                setSelectedDay(day);
                                setIsPainting(true);
                                paintSlot(day, slotIdx);
                              }}
                              onMouseEnter={() => {
                                if (isPainting) paintSlot(day, slotIdx);
                              }}
                              className={`h-7 cursor-crosshair border-r border-slate-200 last:border-r-0 px-1 align-middle ${
                                matchedBlock
                                  ? TYPE_CELL_STYLES[matchedBlock.type]
                                  : isSleeping
                                  ? 'bg-slate-100/80 text-slate-400'
                                  : 'bg-white hover:bg-blue-50/50'
                              }`}
                            >
                              {matchedBlock && isFirstCell && (
                                <div className="truncate text-[11px] font-semibold">
                                  {matchedBlock.title}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
