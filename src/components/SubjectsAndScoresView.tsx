import React, { useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import {
  ExamMeta,
  StudyTask,
  SubjectConfig,
  TASK_TYPE_LABELS,
  TaskType,
} from '../types';
import {
  calculateSubjectInvestments,
  estimateTaskRemainingMinutes,
  formatDurationKo,
} from '../utils/scheduler';

interface SubjectsAndScoresViewProps {
  examMeta: ExamMeta;
  onUpdateExamMeta: (meta: ExamMeta) => void;
  subjects: SubjectConfig[];
  tasks: StudyTask[];
  onUpdateSubject: (updated: SubjectConfig) => void;
  onAddTask: (task: StudyTask) => void;
  onUpdateTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: string) => void;
  onRegeneratePlan: () => void;
}

export const SubjectsAndScoresView: React.FC<SubjectsAndScoresViewProps> = ({
  examMeta,
  onUpdateExamMeta,
  subjects,
  tasks,
  onUpdateSubject,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onRegeneratePlan,
}) => {
  const investments = calculateSubjectInvestments(subjects, tasks);

  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id ?? '');
  const [newTitle, setNewTitle] = useState('');
  const [newUnitTag, setNewUnitTag] = useState('');
  const [newType, setNewType] = useState<TaskType>('problems');
  const [newTotalUnits, setNewTotalUnits] = useState(20);
  const [newUnitLabel, setNewUnitLabel] = useState('문항');
  const [newMinPerUnit, setNewMinPerUnit] = useState(5);
  const [newDifficulty, setNewDifficulty] = useState<'high' | 'medium' | 'low'>('medium');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedSubjectId) return;

    onAddTask({
      id: `task-${Date.now()}`,
      subjectId: selectedSubjectId,
      title: newTitle.trim(),
      unitTag: newUnitTag.trim() || '핵심 단원',
      taskType: newType,
      totalUnits: Math.max(1, newTotalUnits),
      completedUnits: 0,
      unitLabel: newUnitLabel.trim() || '개',
      minutesPerUnit: Math.max(1, newMinPerUnit),
      difficulty: newDifficulty,
    });
    setNewTitle('');
    setNewUnitTag('');
  };

  return (
    <div className="space-y-8">
      {/* 상단 시험 메타 & 재생성 */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600">시험 이름</label>
            <input
              type="text"
              value={examMeta.title}
              onChange={(e) => onUpdateExamMeta({ ...examMeta, title: e.target.value })}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">시험 시작일</label>
            <input
              type="date"
              value={examMeta.examDate}
              onChange={(e) => onUpdateExamMeta({ ...examMeta, examDate: e.target.value })}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-num text-sm text-slate-900"
            />
          </div>
        </div>
        <button
          onClick={onRegeneratePlan}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
        >
          성적·소요시간 반영해 계획 재계산
        </button>
      </div>

      {/* 직전 시험 데이터 기반 과목별 집중 투자 분석 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            직전 시험 성적 기반 집중 투자 우선순위
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          직전 시험 등급과 목표 등급의 차이, 단위수, 취약점 및 오답 수를 계산해 어느 과목에 시간을 집중 투자할지 자동으로 결정합니다. (목표가 1등급이면 서술형 문제가 출제됩니다.)
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">과목</th>
                <th className="px-3 py-3 text-right">단위수</th>
                <th className="px-3 py-3 text-right">직전 점수</th>
                <th className="px-3 py-3 text-right">직전 등급</th>
                <th className="px-3 py-3 text-right">목표 등급</th>
                <th className="px-4 py-3 text-right">권장 시간 비중</th>
                <th className="px-4 py-3 text-right">남은 필요 시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {investments.map((inv) => {
                const s = inv.subject;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num">
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={s.credits}
                        onChange={(e) =>
                          onUpdateSubject({ ...s, credits: Math.max(1, Number(e.target.value) || 3) })
                        }
                        className="w-14 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={s.prevScore}
                        onChange={(e) =>
                          onUpdateSubject({ ...s, prevScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                        }
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num">
                      <select
                        value={s.prevGrade}
                        onChange={(e) => onUpdateSubject({ ...s, prevGrade: Number(e.target.value) })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                          <option key={g} value={g}>
                            {g}등급
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num">
                      <select
                        value={s.targetGrade}
                        onChange={(e) => onUpdateSubject({ ...s, targetGrade: Number(e.target.value) })}
                        className="rounded border border-blue-200 bg-blue-50/50 px-2 py-1 text-sm font-semibold text-blue-800"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                          <option key={g} value={g}>
                            {g}등급
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-bold text-blue-700">
                      {inv.sharePercent}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num font-semibold text-slate-900">
                      {formatDurationKo(inv.requiredMinutes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 학교 교과서(출판사) · 부교재 · 시험범위 입력 */}
      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            우리 학교 교과서(출판사) · 부교재 · 시험범위 설정
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            사용 중인 교과서 출판사와 부교재(프린트)를 입력하면, 20초 암기 문장과 목표 등급 확인 문제(서술형 포함)가 해당 교재 스타일과 범위에 맞춰 출제됩니다.
          </p>
        </div>

        <datalist id="publisher-suggestions">
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

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {subjects.map((s) => (
            <div key={s.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-bold text-slate-900">{s.name}</span>
                  <span className="text-xs text-slate-500">· 목표 {s.targetGrade}등급</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-600">
                    교과서 출판사
                  </label>
                  <input
                    type="text"
                    list="publisher-suggestions"
                    value={s.textbookPublisher}
                    onChange={(e) =>
                      onUpdateSubject({ ...s, textbookPublisher: e.target.value })
                    }
                    placeholder="예: 미래엔, 비상교육, 능률(김)"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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
                    placeholder="예: 올림포스, 수능특강 Light, 학교 유인물"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
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
                    placeholder="예: 교과서 3~4과, 나머지정리~이차함수"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 과업별 정량 소요 시간 목록 */}
      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              과목별 세부 학습량 & 예상 소요 시간 산정
            </h2>
            <p className="text-sm text-slate-600">
              분량(문항/쪽/강) × 단위당 소요 시간 × 난이도 가중치로 실제 걸리는 시간을 정확히 계산합니다.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {tasks.map((task) => {
            const subj = subjects.find((s) => s.id === task.subjectId);
            const remainMin = estimateTaskRemainingMinutes(task);
            return (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{subj?.name}</span>
                    <span>·</span>
                    <span>{TASK_TYPE_LABELS[task.taskType]}</span>
                    <span>·</span>
                    <span>{task.unitTag}</span>
                    {task.isRemedial && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-amber-700">오답 자동 추가</span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{task.title}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">완료/전체</span>
                    <input
                      type="number"
                      min={0}
                      max={task.totalUnits}
                      value={task.completedUnits}
                      onChange={(e) =>
                        onUpdateTask({
                          ...task,
                          completedUnits: Math.min(task.totalUnits, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-14 rounded border border-slate-200 px-2 py-1 text-right font-mono-num text-sm"
                    />
                    <span className="text-slate-400">/</span>
                    <input
                      type="number"
                      min={1}
                      value={task.totalUnits}
                      onChange={(e) =>
                        onUpdateTask({
                          ...task,
                          totalUnits: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-14 rounded border border-slate-200 px-2 py-1 text-right font-mono-num text-sm"
                    />
                    <span className="text-slate-600">{task.unitLabel}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">개당</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={task.minutesPerUnit}
                      onChange={(e) =>
                        onUpdateTask({
                          ...task,
                          minutesPerUnit: Math.max(1, Number(e.target.value) || 5),
                        })
                      }
                      className="w-12 rounded border border-slate-200 px-2 py-1 text-right font-mono-num text-sm"
                    />
                    <span className="text-slate-600">분</span>
                  </div>

                  <span className="min-w-[84px] text-right font-mono-num text-sm font-bold text-slate-900">
                    남은 {formatDurationKo(remainMin)}
                  </span>

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    aria-label="과업 삭제"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 새 학습 과제 추가 */}
        <form
          onSubmit={handleAddTask}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <p className="text-xs font-bold text-slate-800">새 학습 과제 추가</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div>
              <label className="block text-xs text-slate-500">과목</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">학습 유형</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TaskType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="concept">개념 정리·인강</option>
                <option value="problems">유형·기출 풀이</option>
                <option value="essay">서술형 대비</option>
                <option value="memorize">핵심 암기</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">과제명</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 복소수 고난도 프린트 2회독"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500">단원명</label>
              <input
                type="text"
                value={newUnitTag}
                onChange={(e) => setNewUnitTag(e.target.value)}
                placeholder="예: 복소수와 이차방정식"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500">총 분량</label>
              <input
                type="number"
                min={1}
                value={newTotalUnits}
                onChange={(e) => setNewTotalUnits(Number(e.target.value) || 1)}
                className="mt-1 w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono-num text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">단위</label>
              <input
                type="text"
                value={newUnitLabel}
                onChange={(e) => setNewUnitLabel(e.target.value)}
                className="mt-1 w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">단위당 시간(분)</label>
              <input
                type="number"
                min={1}
                value={newMinPerUnit}
                onChange={(e) => setNewMinPerUnit(Number(e.target.value) || 5)}
                className="mt-1 w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono-num text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">체감 난이도</label>
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value as 'high' | 'medium' | 'low')}
                className="mt-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="high">상 (1.25x)</option>
                <option value="medium">중 (1.0x)</option>
                <option value="low">하 (0.85x)</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              과제 추가
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
