import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, BookOpen, RotateCcw, ArrowRight } from 'lucide-react';
import { QuizGradeResult, QuizQuestion, SubjectConfig, TimeBlock, WeaknessRecord } from '../types';

interface QuizVerificationModalProps {
  isOpen: boolean;
  block: TimeBlock | null;
  subject: SubjectConfig | null;
  onClose: () => void;
  onPassComplete: (blockId: string) => void;
  onWeaknessDetected: (block: TimeBlock, weaknesses: WeaknessRecord[]) => void;
}

type Step = 'loading' | 'answering' | 'grading' | 'result' | 'error';

export const QuizVerificationModal: React.FC<QuizVerificationModalProps> = ({
  isOpen,
  block,
  subject,
  onClose,
  onPassComplete,
  onWeaknessDetected,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizGradeResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const generateQuiz = async () => {
    if (!block || !subject) return;
    setStep('loading');
    setErrorMsg('');
    setAnswers({});
    setResults([]);

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: subject.name,
          targetGrade: subject.targetGrade,
          textbookPublisher: subject.textbookPublisher,
          supplementaryMaterial: subject.supplementaryMaterial,
          examScope: subject.examScope,
          taskTitle: block.title,
          unitTag: block.unitTag,
          weaknessTags: subject.weaknessTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '확인 문제를 생성하지 못했습니다.');
      setQuestions(data.questions ?? []);
      setStep('answering');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setStep('error');
    }
  };

  useEffect(() => {
    if (isOpen && block && subject) {
      generateQuiz();
    }
  }, [isOpen, block?.id]);

  const handleSubmit = async () => {
    if (!block || !subject) return;
    setStep('grading');
    setErrorMsg('');

    try {
      const gradePromises = questions.map(async (q) => {
        const res = await fetch('/api/quiz/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectName: subject.name,
            targetGrade: subject.targetGrade,
            question: q,
            userAnswer: answers[q.id] ?? '',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '채점에 실패했습니다.');
        return data as QuizGradeResult;
      });

      const graded = await Promise.all(gradePromises);
      setResults(graded);
      setStep('result');

      const failedList = graded.filter((r) => !r.isCorrect);
      if (failedList.length > 0) {
        const newWeaknesses: WeaknessRecord[] = failedList.map((fail) => {
          const qObj = questions.find((q) => q.id === fail.questionId);
          return {
            id: `weak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            subjectId: subject.id,
            subjectName: subject.name,
            unitTag: fail.weakConcept || qObj?.unitTag || block.unitTag,
            questionText: qObj?.question || '',
            questionType: qObj?.type || 'multiple_choice',
            userAnswer: answers[fail.questionId] || '(무응답)',
            feedback: fail.feedback,
            score: fail.score,
            createdAt: new Date().toISOString(),
            resolved: false,
          };
        });
        onWeaknessDetected(block, newWeaknesses);
      } else {
        onPassComplete(block.id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '채점 오류가 발생했습니다.');
      setStep('error');
    }
  };

  if (!isOpen || !block || !subject) return null;

  const wrongCount = results.filter((r) => !r.isCorrect).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {subject.name} 학습 확인 테스트 · 목표 {subject.targetGrade}등급 기준
              </h2>
              <p className="text-xs text-slate-500">
                {subject.textbookPublisher ? `${subject.textbookPublisher} · ` : ''}
                {block.unitTag} · {subject.targetGrade === 1 ? '1등급 목표 서술형 문항 포함' : '목표 등급 맞춤형 문항'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'loading' && (
            <div className="space-y-4 py-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-slate-600">
                목표 {subject.targetGrade}등급 수준에 맞춘 확인 문제{subject.targetGrade === 1 ? '(서술형 포함)' : ''}를 출제하고 있습니다...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">오류가 발생했습니다</p>
                <p className="mt-1">{errorMsg}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={generateQuiz}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  다시 출제하기
                </button>
              </div>
            </div>
          )}

          {step === 'answering' && (
            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-3 border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      문항 {idx + 1} · {q.difficultyLabel} · {q.unitTag}
                    </span>
                    <span className="font-medium text-blue-700">
                      {q.type === 'essay' ? '서술형(논술형)' : q.type === 'short_answer' ? '단답형' : '객관식'}
                    </span>
                  </div>

                  <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-slate-900">
                    {q.question}
                  </p>

                  {q.type === 'multiple_choice' && q.options && q.options.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const checked = answers[q.id] === opt;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                              checked
                                ? 'border-blue-600 bg-blue-50 text-blue-950 font-medium'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-mono-num text-xs text-slate-400">{oIdx + 1}.</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {q.type === 'essay' && q.rubricPoints && q.rubricPoints.length > 0 && (
                        <p className="text-xs text-slate-500">
                          채점 요소: {q.rubricPoints.join(' / ')}
                        </p>
                      )}
                      <textarea
                        rows={q.type === 'essay' ? 4 : 2}
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={
                          q.type === 'essay'
                            ? '풀이 과정과 핵심 근거를 논리적으로 서술해 주세요.'
                            : '정답을 간단히 입력하세요.'
                        }
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 'grading' && (
            <div className="space-y-4 py-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-slate-600">
                답안과 서술형 채점 기준을 꼼꼼하게 확인하고 있습니다...
              </p>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-5">
              <div
                className={`rounded-lg border p-4 ${
                  wrongCount > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-950'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  {wrongCount > 0 ? (
                    <>
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                      <span>
                        {wrongCount}문항 보충 필요 — 다음 공부 계획표에 오답 복습 블록이 자동 추가되었습니다
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                      <span>모든 문항 통과! 오늘 학습 블록이 완벽히 완료 처리되었습니다</span>
                    </>
                  )}
                </div>
              </div>

              {questions.map((q, idx) => {
                const res = results.find((r) => r.questionId === q.id);
                if (!res) return null;
                return (
                  <div key={q.id} className="space-y-2.5 rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        문항 {idx + 1} · {q.difficultyLabel}
                      </span>
                      <span
                        className={`font-mono-num font-bold ${
                          res.isCorrect ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {res.isCorrect ? '정답' : '보충 필요'} · {res.score}점
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{q.question}</p>
                    <p className="text-xs text-slate-600">내 답안: {answers[q.id] || '(무응답)'}</p>
                    <div className="rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                      <p className="font-semibold text-slate-900">채점 피드백</p>
                      <p className="mt-1">{res.feedback}</p>
                      {res.deductionReasons.length > 0 && (
                        <p className="mt-1.5 text-red-700">
                          감점·누락 포인트: {res.deductionReasons.join(' / ')}
                        </p>
                      )}
                      <p className="mt-2 font-semibold text-slate-900">모범 답안 및 해설</p>
                      <p className="mt-0.5 text-slate-700">{q.correctAnswer}</p>
                      <p className="mt-1 text-slate-600">{q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          {step === 'answering' && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                나중에 풀기
              </button>
              <button
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                제출 및 채점하기
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
          {step === 'result' && (
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              확인 및 계획표로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
