import React from 'react';
import { CheckCircle2, AlertCircle, Brain } from 'lucide-react';
import { ConditionRecord, WeaknessRecord } from '../types';

interface WeaknessAndMemoryViewProps {
  weaknesses: WeaknessRecord[];
  conditionRecords: ConditionRecord[];
  onToggleResolveWeakness: (id: string) => void;
}

export const WeaknessAndMemoryView: React.FC<WeaknessAndMemoryViewProps> = ({
  weaknesses,
  conditionRecords,
  onToggleResolveWeakness,
}) => {
  return (
    <div className="space-y-8">
      {/* 오답 및 서술형 감점 취약 단원 목록 */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900">오답 취약 단원 & 20초 핵심 암기 보관함</h1>
          <p className="mt-1 text-sm text-slate-600">
            확인 테스트에서 틀렸거나 1등급 서술형에서 감점된 단원은 다음 날 계획에 자동 반영되며, 이곳에서 누적 관리됩니다.
          </p>
        </div>

        <h2 className="text-base font-bold text-slate-900">
          확인 문제 오답·서술형 보충 기록 ({weaknesses.length}건)
        </h2>

        {weaknesses.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            아직 기록된 오답이나 서술형 감점 내역이 없습니다. 오늘의 타임라인에서 ‘완료 & 확인문제’를 풀면 자동으로 누적됩니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {weaknesses.map((w) => (
              <div key={w.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {w.resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="font-bold text-slate-900">{w.subjectName}</span>
                    <span>·</span>
                    <span>{w.unitTag}</span>
                    <span>·</span>
                    <span className="font-mono-num">점수 {w.score}점</span>
                  </div>
                  <button
                    onClick={() => onToggleResolveWeakness(w.id)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                      w.resolved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {w.resolved ? '복습 완료됨' : '복습 완료로 표시'}
                  </button>
                </div>
                <p className="text-sm font-medium text-slate-900">{w.questionText}</p>
                <p className="text-xs text-slate-600">내 답안: {w.userAnswer}</p>
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  피드백: {w.feedback}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 20초 컨디션 테스트에서 외운 시험범위 핵심 문장 */}
      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            컨디션 체크에서 암기한 시험범위 핵심 개념 ({conditionRecords.length}개)
          </h2>
        </div>

        {conditionRecords.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            아침 또는 저녁 컨디션 체크를 완료하면 외웠던 시험범위 핵심 문장이 이곳에 저장되어 시험 직전에 한 번에 복습할 수 있습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {conditionRecords.map((rec) => (
              <div key={rec.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {rec.dateStr} · {rec.period === 'morning' ? '아침' : '저녁'} · {rec.subjectName}
                  </span>
                  <span className="font-mono-num font-semibold text-slate-700">
                    회상 {rec.recallScore}점 · 판정:{' '}
                    {rec.judgedCondition === 'optimal'
                      ? '최상'
                      : rec.judgedCondition === 'normal'
                      ? '보통'
                      : '저하'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{rec.conceptSentence}</p>
                <p className="mt-1 text-xs text-slate-500">
                  핵심 키워드: {rec.keywords.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
