import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Plus, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react';
import {
  DayOfWeek,
  DayRoutineConfig,
  ExamMeta,
  StudyTask,
  SubjectConfig,
} from '../types';
import { TimetableGridEditor } from './TimetableGridEditor';
import { computeFeasibility, formatDurationKo } from '../utils/scheduler';

interface SetupOnboardingFlowProps {
  examMeta: ExamMeta;
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  subjects: SubjectConfig[];
  tasks: StudyTask[];
  onUpdateExamMeta: (meta: ExamMeta) => void;
  onUpdateDayRoutine: (day: DayOfWeek, updated: DayRoutineConfig) => void;
  onReplaceWeeklyRoutine: (next: Record<DayOfWeek, DayRoutineConfig>) => void;
  onCopyDayToAllWeekdays: (sourceDay: DayOfWeek) => void;
  onClearAllRoutines: () => void;
  onResetToSampleData: () => void;
  onUpdateSubject: (updated: SubjectConfig) => void;
  onAddSubject: (subject: SubjectConfig) => void;
  onDeleteSubject: (subjectId: string) => void;
  onFinishSetupAndEnterLobby: () => void;
}

const COLOR_PALETTE = ['#2563EB', '#0D9488', '#D97706', '#7C3AED', '#DB2777', '#059669'];

export const SetupOnboardingFlow: React.FC<SetupOnboardingFlowProps> = ({
  examMeta,
  weeklyRoutine,
  subjects,
  tasks,
  onUpdateExamMeta,
  onUpdateDayRoutine,
  onReplaceWeeklyRoutine,
  onCopyDayToAllWeekdays,
  onClearAllRoutines,
  onResetToSampleData,
  onUpdateSubject,
  onAddSubject,
  onDeleteSubject,
  onFinishSetupAndEnterLobby,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjPublisher, setNewSubjPublisher] = useState('');
  const [newSubjSupp, setNewSubjSupp] = useState('');
  const [newSubjScope, setNewSubjScope] = useState('');

  const feasibility = computeFeasibility(weeklyRoutine, tasks, examMeta.examDate);

  const handleAddNewSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    const color = COLOR_PALETTE[subjects.length % COLOR_PALETTE.length];
    onAddSubject({
      id: `subj-${Date.now()}`,
      name: newSubjName.trim(),
      color,
      credits: 4,
      prevScore: 80,
      prevGrade: 3,
      targetGrade: 1,
      textbookPublisher: newSubjPublisher.trim(),
      supplementaryMaterial: newSubjSupp.trim(),
      examScope: newSubjScope.trim() || '교과서 1~3단원',
      weaknessTags: [],
    });
    setNewSubjName('');
    setNewSubjPublisher('');
    setNewSubjSupp('');
    setNewSubjScope('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 온보딩 상단 바 */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
              페이스메이커 High
            </span>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`font-semibold whitespace-nowrap ${
                  step === 1 ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                1단계. 하루 일과 시간표
              </button>
              <span className="text-slate-300">/</span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`font-semibold whitespace-nowrap ${
                  step === 2 ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                2단계. 교과서(출판사)·시험범위 입력
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetToSampleData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            고1 기본 예시 다시 불러오기
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] p-6 lg:p-8">
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 headline-balance">
                  1단계. 내 하루 일과를 시간표 표에 먼저 채워주세요
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  학교 수업, 학원, 이동, 식사 시간을 표에 칠하거나 수정하면, AI가 아닌 정확한 시간 계산으로 공부 가능한 빈 시간만 추출합니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs text-slate-500 font-mono-num">
                  <p>주간 확보 공부 시간</p>
                  <p className="text-base font-bold text-blue-700">
                    {formatDurationKo(feasibility.weeklyAvailableMinutes)} / 주
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  다음: 시험범위 입력하기
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <TimetableGridEditor
              weeklyRoutine={weeklyRoutine}
              onUpdateDayRoutine={onUpdateDayRoutine}
              onReplaceWeeklyRoutine={onReplaceWeeklyRoutine}
              onCopyDayToAllWeekdays={onCopyDayToAllWeekdays}
              onClearAllRoutines={onClearAllRoutines}
            />

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                일과 작성 완료 · 다음 단계로
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 headline-balance">
                  2단계. 시험 일정과 학교 교과서(출판사)·시험범위를 입력하세요
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  직전 시험 등급과 목표 등급, 학교 출판사·부교재를 입력하고 나면 내 맞춤형 계획표가 생성되어 로비로 입장합니다.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <ArrowLeft className="h-4 w-4" />
                  이전: 시간표 수정
                </button>
                <button
                  type="button"
                  onClick={onFinishSetupAndEnterLobby}
                  disabled={subjects.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  계획표 만들고 로비로 들어가기
                </button>
              </div>
            </div>

            {/* 시험명 & 시험일 */}
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600">이번 시험 이름</label>
                <input
                  type="text"
                  value={examMeta.title}
                  onChange={(e) => onUpdateExamMeta({ ...examMeta, title: e.target.value })}
                  placeholder="예: 고1 2학기 기말고사"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">시험 시작 날짜</label>
                <input
                  type="date"
                  value={examMeta.examDate}
                  onChange={(e) => onUpdateExamMeta({ ...examMeta, examDate: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900"
                />
              </div>
              <div className="flex flex-col justify-center rounded-lg bg-slate-50 px-4 py-2.5 text-xs">
                <span className="text-slate-500">1단계에서 확보된 주간 공부 가능 시간</span>
                <span className="mt-0.5 font-mono-num text-base font-bold text-slate-900">
                  주 {formatDurationKo(feasibility.weeklyAvailableMinutes)} (남은 {feasibility.daysUntilExam}일)
                </span>
              </div>
            </div>

            <datalist id="onboarding-publisher-suggestions">
              <option value="미래엔" />
              <option value="비상교육" />
              <option value="신사고" />
              <option value="천재교육" />
              <option value="능률(김)" />
              <option value="능률(양)" />
              <option value="YBM(박)" />
              <option value="YBM(한)" />
              <option value="창비" />
              <option value="지학사" />
              <option value="동아출판" />
              <option value="금성출판사" />
            </datalist>

            {/* 과목별 입력 표 */}
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {subjects.map((s) => (
                <div key={s.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="inline-block h-3 w-3 rounded-xs"
                        style={{ backgroundColor: s.color }}
                      />
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => onUpdateSubject({ ...s, name: e.target.value })}
                        className="w-36 rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-bold text-slate-900"
                      />
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span>직전</span>
                        <select
                          value={s.prevGrade}
                          onChange={(e) => onUpdateSubject({ ...s, prevGrade: Number(e.target.value) })}
                          className="rounded border border-slate-200 bg-white px-2 py-1 font-mono-num"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                            <option key={g} value={g}>
                              {g}등급
                            </option>
                          ))}
                        </select>
                        <span>→ 목표</span>
                        <select
                          value={s.targetGrade}
                          onChange={(e) => onUpdateSubject({ ...s, targetGrade: Number(e.target.value) })}
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-mono-num font-bold text-blue-800"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                            <option key={g} value={g}>
                              {g}등급
                            </option>
                          ))}
                        </select>
                        <span>· 단위수</span>
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={s.credits}
                          onChange={(e) =>
                            onUpdateSubject({ ...s, credits: Math.max(1, Number(e.target.value) || 3) })
                          }
                          className="w-12 rounded border border-slate-200 px-1.5 py-1 text-center font-mono-num"
                        />
                      </div>
                    </div>

                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSubject(s.id)}
                        aria-label="과목 삭제"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-slate-600">
                        교과서 출판사
                      </label>
                      <input
                        type="text"
                        list="onboarding-publisher-suggestions"
                        value={s.textbookPublisher}
                        onChange={(e) =>
                          onUpdateSubject({ ...s, textbookPublisher: e.target.value })
                        }
                        placeholder="예: 미래엔, 비상교육, 능률(김)"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-slate-600">
                        부교재 · 학교 프린트
                      </label>
                      <input
                        type="text"
                        value={s.supplementaryMaterial}
                        onChange={(e) =>
                          onUpdateSubject({ ...s, supplementaryMaterial: e.target.value })
                        }
                        placeholder="예: 올림포스, 쎈, 학교 자체 유인물"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-xs font-medium text-slate-600">
                        이번 시험범위 (단원·쪽수)
                      </label>
                      <input
                        type="text"
                        value={s.examScope}
                        onChange={(e) =>
                          onUpdateSubject({ ...s, examScope: e.target.value })
                        }
                        placeholder="예: 3~4과 본문, 나머지정리~이차함수"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 과목 추가 폼 */}
            <form
              onSubmit={handleAddNewSubject}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-bold text-slate-800">시험 과목 직접 추가하기</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="과목명 (예: 통합사회1)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    list="onboarding-publisher-suggestions"
                    value={newSubjPublisher}
                    onChange={(e) => setNewSubjPublisher(e.target.value)}
                    placeholder="교과서 출판사"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={newSubjSupp}
                    onChange={(e) => setNewSubjSupp(e.target.value)}
                    placeholder="부교재/프린트"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    value={newSubjScope}
                    onChange={(e) => setNewSubjScope(e.target.value)}
                    placeholder="시험범위"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    추가
                  </button>
                </div>
              </div>
            </form>

            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                이전: 하루 시간표로
              </button>
              <button
                type="button"
                onClick={onFinishSetupAndEnterLobby}
                disabled={subjects.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                내 맞춤 계획표 만들고 로비로 들어가기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
