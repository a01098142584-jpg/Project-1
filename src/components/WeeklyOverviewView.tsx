import React from 'react';
import {
  DAY_LABELS,
  DAY_ORDER,
  DayOfWeek,
  DayRoutineConfig,
  SubjectConfig,
  TASK_TYPE_LABELS,
  TimeBlock,
} from '../types';
import { formatDurationKo } from '../utils/scheduler';

interface WeeklyOverviewViewProps {
  todayDay: DayOfWeek;
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  subjects: SubjectConfig[];
  timeBlocks: TimeBlock[];
  onJumpToDay: (day: DayOfWeek) => void;
}

export const WeeklyOverviewView: React.FC<WeeklyOverviewViewProps> = ({
  todayDay,
  weeklyRoutine,
  subjects,
  timeBlocks,
  onJumpToDay,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">주간 공부 계획표 (월~일)</h1>
        <p className="mt-1 text-sm text-slate-600">
          요일별로 다른 고정 일과를 피해 배정된 전체 공부 시간표입니다. 날짜를 클릭하면 해당 요일의 상세 타임라인으로 이동합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        {DAY_ORDER.map((day) => {
          const blocks = timeBlocks.filter((b) => b.dayOfWeek === day);
          const totalMin = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
          const cap = weeklyRoutine[day].maxStudyMinutes;
          const isToday = day === todayDay;

          return (
            <div
              key={day}
              className={`flex flex-col rounded-xl border bg-white ${
                isToday ? 'border-blue-600' : 'border-slate-200'
              }`}
            >
              <button
                onClick={() => onJumpToDay(day)}
                className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    {DAY_LABELS[day]}요일
                  </span>
                  {isToday && (
                    <span className="ml-1.5 text-xs font-semibold text-blue-600">오늘</span>
                  )}
                </div>
                <span className="font-mono-num text-xs font-semibold text-slate-600">
                  {formatDurationKo(totalMin)}
                </span>
              </button>

              <div className="flex-1 divide-y divide-slate-100 p-2">
                {blocks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">배정 없음</p>
                ) : (
                  blocks.map((b) => {
                    const subj = subjects.find((s) => s.id === b.subjectId);
                    return (
                      <div key={b.id} className="px-1.5 py-2.5 text-xs">
                        <div className="flex items-center justify-between font-mono-num text-[11px] text-slate-500">
                          <span>
                            {b.startTime}–{b.endTime}
                          </span>
                          <span>{b.durationMinutes}분</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-900">
                          <span
                            className="inline-block h-2 w-2 rounded-xs shrink-0"
                            style={{ backgroundColor: subj?.color || '#2563EB' }}
                          />
                          <span className="truncate">{subj?.name}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">
                          {TASK_TYPE_LABELS[b.taskType]} · {b.unitTag}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-slate-100 px-3.5 py-2 text-[11px] text-slate-500 font-mono-num">
                일일 상한 {formatDurationKo(cap)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
