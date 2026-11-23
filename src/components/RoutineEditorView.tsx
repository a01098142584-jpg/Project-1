import React from 'react';
import { DayOfWeek, DayRoutineConfig } from '../types';
import { TimetableGridEditor } from './TimetableGridEditor';

interface RoutineEditorViewProps {
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  onUpdateDayRoutine: (day: DayOfWeek, updated: DayRoutineConfig) => void;
  onReplaceWeeklyRoutine: (next: Record<DayOfWeek, DayRoutineConfig>) => void;
  onCopyDayToAllWeekdays: (sourceDay: DayOfWeek) => void;
  onClearAllRoutines: () => void;
  onRegeneratePlan: () => void;
}

export const RoutineEditorView: React.FC<RoutineEditorViewProps> = ({
  weeklyRoutine,
  onUpdateDayRoutine,
  onReplaceWeeklyRoutine,
  onCopyDayToAllWeekdays,
  onClearAllRoutines,
  onRegeneratePlan,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">요일별 내 하루 시간표 설정</h1>
          <p className="mt-1 text-sm text-slate-600">
            한 줄로 적거나 프리셋·여러 요일 묶음 추가로 빠르게 일과를 채우면, 빈 시간대에 맞춰 공부 계획표를 다시 짭니다.
          </p>
        </div>
        <button
          onClick={onRegeneratePlan}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          수정한 시간표로 계획표 다시 짜기
        </button>
      </div>

      <TimetableGridEditor
        weeklyRoutine={weeklyRoutine}
        onUpdateDayRoutine={onUpdateDayRoutine}
        onReplaceWeeklyRoutine={onReplaceWeeklyRoutine}
        onCopyDayToAllWeekdays={onCopyDayToAllWeekdays}
        onClearAllRoutines={onClearAllRoutines}
      />
    </div>
  );
};
