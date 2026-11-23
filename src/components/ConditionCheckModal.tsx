import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, X, Brain, ArrowRight, RotateCcw } from 'lucide-react';
import {
  ConditionLevel,
  ConditionPeriod,
  ConditionPromptData,
  ConditionRecord,
  DayOfWeek,
  SubjectConfig,
} from '../types';

interface ConditionCheckModalProps {
  isOpen: boolean;
  period: ConditionPeriod;
  dayOfWeek: DayOfWeek;
  subjects: SubjectConfig[];
  onClose: () => void;
  onComplete: (record: ConditionRecord) => void;
}

type Step = 'loading' | 'memorize' | 'recall' | 'evaluating' | 'result' | 'error';

export const ConditionCheckModal: React.FC<ConditionCheckModalProps> = ({
  isOpen,
  period,
  dayOfWeek,
  subjects,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [promptData, setPromptData] = useState<ConditionPromptData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [recallStartTime, setRecallStartTime] = useState<number>(0);
  const [userRecall, setUserRecall] = useState('');
  const [sleepHours, setSleepHours] = useState('6시간 이상 (충분)');
  const [fatigueLevel, setFatigueLevel] = useState('보통');
  const [evalResult, setEvalResult] = useState<{
    recallScore: number;
    judgedCondition: ConditionLevel;
    aiReason: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPrompt = async () => {
    setStep('loading');
    setErrorMsg('');
    setUserRecall('');
    setSecondsLeft(20);
    setEvalResult(null);

    try {
      const res = await fetch('/api/condition/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          subjects: subjects.map((s) => ({
            name: s.name,
            examScope: s.examScope,
            textbookPublisher: s.textbookPublisher,
            supplementaryMaterial: s.supplementaryMaterial,
            targetGrade: s.targetGrade,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '컨디션 체크 문장을 불러오지 못했습니다.');
      }
      setPromptData(data);
      setStep('memorize');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setStep('error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrompt();
    }
  }, [isOpen, period]);

  useEffect(() => {
    if (!isOpen || step !== 'memorize') return;
    if (secondsLeft <= 0) {
      setRecallStartTime(Date.now());
      setStep('recall');
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isOpen, step, secondsLeft]);

  const handleEvaluate = async () => {
    if (!promptData) return;
    setStep('evaluating');
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - recallStartTime) / 1000));

    try {
      const res = await fetch('/api/condition/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptSentence: promptData.conceptSentence,
          keywords: promptData.keywords,
          userRecall,
          elapsedSeconds,
          sleepHours,
          fatigueLevel,
          period,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '컨디션 판정 중 오류가 발생했습니다.');
      }

      setEvalResult(data);
      setStep('result');

      const record: ConditionRecord = {
        id: `cond-${Date.now()}`,
        dateStr: new Date().toISOString().split('T')[0],
        dayOfWeek,
        period,
        subjectName: promptData.subjectName,
        conceptSentence: promptData.conceptSentence,
        keywords: promptData.keywords,
        userRecall,
        recallScore: data.recallScore,
        elapsedSeconds,
        sleepHours,
        fatigueLevel,
        judgedCondition: data.judgedCondition,
        aiReason: data.aiReason,
        createdAt: new Date().toISOString(),
      };
      onComplete(record);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  const conditionBadgeText = (level: ConditionLevel) => {
    if (level === 'optimal') return '컨디션 최상 — 고난도·서술형 집중 적합';
    if (level === 'normal') return '컨디션 보통 — 표준 계획표대로 진행';
    return '컨디션 저하 — 암기·복습 중심 경량 일정으로 자동 조정됨';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Brain className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              {period === 'morning' ? '아침' : '저녁'} 컨디션 체크 · 20초 시험범위 암기 테스트
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {step === 'loading' && (
            <div className="space-y-4 py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-slate-600">
                등록된 시험범위에서 꼭 외워야 할 핵심 개념 문장을 준비하고 있습니다...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">컨디션 테스트를 불러오지 못했습니다</p>
                  <p className="mt-1 text-red-700">{errorMsg}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={fetchPrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {step === 'memorize' && promptData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {promptData.subjectName} · {promptData.unitTag}
                </span>
                <span className="font-mono-num font-semibold text-blue-700">
                  남은 암기 시간 {secondsLeft}초
                </span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${(secondsLeft / 20) * 100}%` }}
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-medium text-slate-500">
                  아래 시험범위 핵심 문장을 20초 안에 머릿속에 외워주세요
                </p>
                <p className="mt-2.5 text-lg font-semibold leading-relaxed text-slate-900">
                  {promptData.conceptSentence}
                </p>
                <p className="mt-3 text-xs text-slate-500">출제 포인트: {promptData.hint}</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  시험범위 필수 암기 문장으로 컨디션과 암기 효율을 함께 점검합니다.
                </span>
                <button
                  onClick={() => {
                    setRecallStartTime(Date.now());
                    setStep('recall');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  외웠어요, 바로 테스트
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'recall' && promptData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {promptData.subjectName} · {promptData.unitTag}
                </span>
                <span className="font-medium text-slate-700">문장이 가려졌습니다</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  1. 방금 외운 핵심 문장 또는 핵심 키워드를 떠올려 적어보세요
                </label>
                <textarea
                  rows={3}
                  value={userRecall}
                  onChange={(e) => setUserRecall(e.target.value)}
                  placeholder="기억나는 문장이나 핵심 키워드들을 자유롭게 입력하세요 (완벽히 똑같지 않아도 됩니다)"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">2. 최근 수면 시간</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {['6시간 이상 (충분)', '5시간 내외 (보통)', '4시간 이하 (부족)'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSleepHours(opt)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                          sleepHours === opt
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700">3. 현재 눈·머리 피로도</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {['가볍고 맑음', '보통', '눈·몸이 무거움'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFatigueLevel(opt)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                          fatigueLevel === opt
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleEvaluate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  컨디션 판정 및 일정 반영하기
                </button>
              </div>
            </div>
          )}

          {step === 'evaluating' && (
            <div className="space-y-4 py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-slate-600">
                암기 회상 정확도와 피로도를 분석해 오늘 시간표를 최적화하고 있습니다...
              </p>
            </div>
          )}

          {step === 'result' && evalResult && promptData && (
            <div className="space-y-5">
              <div
                className={`rounded-lg border p-4 ${
                  evalResult.judgedCondition === 'optimal'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                    : evalResult.judgedCondition === 'normal'
                    ? 'border-blue-200 bg-blue-50 text-blue-950'
                    : 'border-amber-200 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{conditionBadgeText(evalResult.judgedCondition)}</span>
                  </div>
                  <span className="font-mono-num text-sm font-bold">
                    회상 {evalResult.recallScore}점
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{evalResult.aiReason}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="text-xs font-semibold text-slate-500">방금 외운 시험범위 핵심 문장 (오답노트 보관함 자동 저장)</p>
                <p className="mt-1.5 font-medium text-slate-900">{promptData.conceptSentence}</p>
                <p className="mt-2 text-xs text-slate-500">
                  핵심 키워드: {promptData.keywords.join(' · ')}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  반영된 오늘 계획표 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
