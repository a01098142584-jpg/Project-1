import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Settings > Secrets 패널에서 API 키를 확인해 주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleApiError(res: express.Response, err: unknown) {
  const message = err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.';
  console.error('[Gemini API Error]', err);
  const status = message.includes('GEMINI_API_KEY') ? 400 : 500;
  res.status(status).json({ error: message });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. 아침/저녁 컨디션 체크용: 시험범위 핵심 개념 20초 암기 문장 생성
  app.post('/api/condition/generate', async (req, res) => {
    try {
      const { subjects, period } = req.body as {
        subjects: Array<{
          name: string;
          examScope: string;
          textbookPublisher?: string;
          supplementaryMaterial?: string;
          targetGrade: number;
        }>;
        period: 'morning' | 'evening';
      };

      const ai = getAiClient();
      const subjectSummary = (subjects ?? [])
        .map(
          (s) =>
            `- ${s.name} (목표 ${s.targetGrade}등급 | 교과서 출판사: ${s.textbookPublisher || '미지정'} | 부교재: ${s.supplementaryMaterial || '없음'}): ${s.examScope}`
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `너는 고등학교 1학년 내신 시험 멘토야.
학생의 현재 교과서(출판사), 부교재 및 시험범위 목록은 다음과 같아:
${subjectSummary}

지금은 ${period === 'morning' ? '아침(등교 전/오전 공부 전)' : '저녁(하교/야간 자율학습 전)'} 컨디션 체크 시간이야.
학생이 쓰는 교과서 출판사와 부교재, 시험범위를 반영해서 20초 안에 외울 수 있으면서도, 실제 이번 고1 내신 시험에 반드시 출제될 법한 **쓸모 있는 핵심 개념·공식·영어 핵심 표현 문장 1개**를 뽑아줘.
너무 길지 않게 한국어 1~2문장(또는 영어 1문장 + 핵심 뜻)으로 작성해.
그리고 학생이 20초 뒤 가려진 화면에서 반드시 회상해내야 하는 핵심 키워드 2~3개를 추출해줘.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjectName: { type: Type.STRING, description: '선택된 과목명' },
              unitTag: { type: Type.STRING, description: '해당 단원명' },
              conceptSentence: { type: Type.STRING, description: '20초 안에 외울 시험범위 핵심 개념 문장 (45~90자 내외)' },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '회상 테스트에서 반드시 들어가야 할 핵심 키워드 2~3개',
              },
              hint: { type: Type.STRING, description: '학생에게 보여줄 짧은 학습 포인트 1줄' },
            },
            required: ['subjectName', 'unitTag', 'conceptSentence', 'keywords', 'hint'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 2. 20초 암기 회상 + 간단 설문 기반 객관적 컨디션 판정
  app.post('/api/condition/evaluate', async (req, res) => {
    try {
      const {
        conceptSentence,
        keywords,
        userRecall,
        elapsedSeconds,
        sleepHours,
        fatigueLevel,
        period,
      } = req.body as {
        conceptSentence: string;
        keywords: string[];
        userRecall: string;
        elapsedSeconds: number;
        sleepHours: string;
        fatigueLevel: string;
        period: 'morning' | 'evening';
      };

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `고1 학생의 ${period === 'morning' ? '아침' : '저녁'} 컨디션을 객관적으로 판정해줘.

[제시된 시험범위 핵심 문장]
${conceptSentence}
[핵심 키워드]
${(keywords ?? []).join(', ')}

[학생의 20초 암기 후 회상 입력]
"${userRecall || '(입력 없음)'}"
[회상 작성 소요 시간] ${elapsedSeconds}초
[수면 상태] ${sleepHours}
[체감 피로도 설문] ${fatigueLevel}

판정 기준:
1. 핵심 키워드와 문맥을 정확히 기억해냈으면 recallScore를 높게(80~100), 일부 누락이면 50~79, 거의 못 외웠으면 0~49로 채점해.
2. 암기 성공 여부와 수면/피로도 설문을 종합해 judgedCondition을 'optimal'(최상), 'normal'(보통), 'low'(저하) 중 하나로 판단해.
   - 특히 20초 핵심 문장을 제대로 못 외웠다면 학생이 스스로 괜찮다고 느껴도 뇌 피로가 있는 것이므로 'low' 또는 보수적으로 판단해.
3. aiReason에는 왜 그렇게 판정했는지와 오늘 공부 스케줄을 어떻게 조절할지 고1 학생에게 친근하고 구체적으로 2문장으로 설명해줘.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recallScore: { type: Type.INTEGER, description: '0~100 사이의 암기 정확도 점수' },
              judgedCondition: {
                type: Type.STRING,
                description: "'optimal', 'normal', 'low' 중 하나",
              },
              aiReason: { type: Type.STRING, description: '판정 근거 및 오늘 스케줄 조정 안내 (2문장)' },
            },
            required: ['recallScore', 'judgedCondition', 'aiReason'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const normalized =
        parsed.judgedCondition === 'optimal' ||
        parsed.judgedCondition === 'normal' ||
        parsed.judgedCondition === 'low'
          ? parsed.judgedCondition
          : 'normal';

      res.json({
        recallScore: Math.max(0, Math.min(100, Number(parsed.recallScore) || 0)),
        judgedCondition: normalized,
        aiReason: parsed.aiReason || '테스트 결과를 반영해 오늘 일정을 최적화했습니다.',
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 3. 목표 등급 맞춤형 학습 확인 문제 생성 (1등급 목표 시 서술형 필수 포함)
  app.post('/api/quiz/generate', async (req, res) => {
    try {
      const {
        subjectName,
        targetGrade,
        textbookPublisher,
        supplementaryMaterial,
        examScope,
        taskTitle,
        unitTag,
        weaknessTags,
      } = req.body as {
        subjectName: string;
        targetGrade: number;
        textbookPublisher?: string;
        supplementaryMaterial?: string;
        examScope: string;
        taskTitle: string;
        unitTag: string;
        weaknessTags: string[];
      };

      const ai = getAiClient();
      const gradeInstruction =
        targetGrade === 1
          ? `이 학생의 목표는 **내신 1등급**이야.
반드시 총 2문제를 출제하되:
- 1번 문제(type: "multiple_choice"): 1등급 변별력용 고난도 응용/함정 객관식 (4지선다)
- 2번 문제(type: "essay"): **고1 내신형 서술형/논술형 문제** (단순 단답형이 아니라 개념 근거, 풀이 단계 또는 영작/논리 서술을 요구하는 문제). rubricPoints에 채점 기준 3가지를 명확히 적어줘.`
          : targetGrade <= 3
          ? `이 학생의 목표는 **내신 ${targetGrade}등급**이야.
총 2문제를 출제하되:
- 1번 문제(type: "multiple_choice"): 핵심 개념 응용 객관식 (4지선다)
- 2번 문제(type: "short_answer"): 내신 빈출 단답형/핵심 서술 요약 문제`
          : `이 학생의 목표는 **내신 ${targetGrade}등급**이야.
총 2문제를 출제하되:
- 1번 문제(type: "multiple_choice"): 기본 개념 정확히 이해했는지 확인하는 객관식 (4지선다)
- 2번 문제(type: "short_answer"): 핵심 용어·공식을 확인하는 기초 단답형 문제`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `고1 내신 시험 대비 확인 문제를 출제해줘.
- 과목: ${subjectName}
- 학교 교과서 출판사: ${textbookPublisher || '미지정'}
- 사용 부교재/프린트: ${supplementaryMaterial || '없음'}
- 전체 시험범위: ${examScope}
- 방금 학습한 단원/과제: ${unitTag} (${taskTitle})
- 기존 취약점: ${(weaknessTags ?? []).join(', ') || '없음'}

${gradeInstruction}

주의사항:
- 한국 고1 교육과정(2022 개정)과 입력된 교과서 출판사·부교재 출제 경향에 맞춰 출제하고, 수식이나 문법 설명은 일반 텍스트로 깔끔하게 표기해.
- options는 multiple_choice일 때만 4개 배열로 제공하고, short_answer나 essay일 때는 빈 배열 []로 줘.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, description: "'multiple_choice' | 'short_answer' | 'essay'" },
                    difficultyLabel: { type: Type.STRING, description: "예: '1등급 서술형', '2~3등급 응용', '기본 개념'" },
                    unitTag: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING, description: '객관식은 정답 보기 텍스트, 서술형/단답형은 모범 답안' },
                    rubricPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: '서술형 채점 포인트 목록' },
                    explanation: { type: Type.STRING, description: '상세 해설' },
                  },
                  required: ['id', 'type', 'difficultyLabel', 'unitTag', 'question', 'options', 'correctAnswer', 'rubricPoints', 'explanation'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 4. 확인 문제(특히 1등급 서술형·단답형) AI 채점 및 취약 개념 도출
  app.post('/api/quiz/grade', async (req, res) => {
    try {
      const { subjectName, targetGrade, question, userAnswer } = req.body as {
        subjectName: string;
        targetGrade: number;
        question: {
          id: string;
          type: string;
          unitTag: string;
          question: string;
          correctAnswer: string;
          rubricPoints?: string[];
        };
        userAnswer: string;
      };

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `고1 ${subjectName} (목표 ${targetGrade}등급) 학생의 답안을 채점해줘.

[문제] (${question.type})
${question.question}

[모범 답안]
${question.correctAnswer}

[채점 기준]
${(question.rubricPoints ?? []).join(' / ') || '핵심 개념 정확성'}

[학생 답안]
"${userAnswer || '(무응답)'}"

채점 규칙:
- 목표가 1등급이고 서술형(essay)이면 핵심 근거·논리 단계가 빠졌을 때 감점(deductionReasons에 명시)하고, 75점 미만이면 isCorrect: false로 판정해 다음 공부 계획에 오답 보충으로 들어가게 해.
- 객관식(multiple_choice)이거나 단답형은 정답 일치 여부(핵심 의미 일치)로 판정해.
- 틀렸거나 감점된 경우 weakConcept에 다음 날 복습할 구체적인 세부 개념명을 15자 이내로 적어줘.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questionId: { type: Type.STRING },
              isCorrect: { type: Type.BOOLEAN },
              score: { type: Type.INTEGER },
              feedback: { type: Type.STRING },
              deductionReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
              weakConcept: { type: Type.STRING },
            },
            required: ['questionId', 'isCorrect', 'score', 'feedback', 'deductionReasons', 'weakConcept'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        questionId: question.id,
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 5. 학생의 자연어 추가 요구사항을 스케줄 조정 규칙으로 변환
  app.post('/api/plan/adjust', async (req, res) => {
    try {
      const { userRequest, subjects, todayDay } = req.body as {
        userRequest: string;
        subjects: Array<{ name: string }>;
        todayDay: string;
      };

      const ai = getAiClient();
      const subjectNames = (subjects ?? []).map((s) => s.name).join(', ');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `고1 학생이 공부 계획표에 대해 다음과 같은 추가 수정 요청을 했어.
학생 요청: "${userRequest}"

등록된 과목명 목록: ${subjectNames}
오늘 요일 코드: ${todayDay} (요일 코드: mon=월, tue=화, wed=수, thu=목, fri=금, sat=토, sun=일)

이 요청을 스케줄 엔진이 바로 실행할 수 있는 규칙 배열(rules)로 변환해줘.
사용 가능한 action:
- "exclude_subject": 해당 요일에 특정 과목을 제외 (subjectName 필수)
- "boost_subject": 해당 요일에 특정 과목 시간을 늘림 (subjectName, minutesDelta 양수 필수, 예: 60)
- "focus_only": 해당 요일에는 특정 과목만 집중 배치 (subjectName 필수)
- "reduce_cap": 해당 요일의 전체 공부 상한 시간을 줄이거나 늘림 (minutesDelta 음수 또는 양수, 예: -60)

요청에 여러 요일이나 여러 지시가 있으면 rules 배열에 모두 담아줘. 과목명은 반드시 등록된 과목명 목록 중 가장 일치하는 정확한 이름으로 매핑해.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: '학생에게 보여줄 변경 요약 1~2문장' },
              rules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOfWeek: { type: Type.STRING, description: "'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'" },
                    action: { type: Type.STRING, description: "'boost_subject'|'exclude_subject'|'reduce_cap'|'focus_only'" },
                    subjectName: { type: Type.STRING },
                    minutesDelta: { type: Type.INTEGER },
                    note: { type: Type.STRING, description: '타임블록에 표시할 짧은 사유 (15자 이내)' },
                  },
                  required: ['dayOfWeek', 'action', 'note'],
                },
              },
            },
            required: ['summary', 'rules'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"summary":"","rules":[]}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 6. 한 줄 일과 설명을 월~일 주간 시간표 구조로 자동 변환
  app.post('/api/routine/parse', async (req, res) => {
    try {
      const { description } = req.body as { description: string };
      if (!description || !description.trim()) {
        res.status(400).json({ error: '하루 일과 설명을 입력해 주세요.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `고1 학생이 자신의 일주일 일과를 다음과 같이 설명했어:
"${description}"

이 설명을 바탕으로 월요일(mon)~일요일(sun) 7일간의 고정 일과 시간표 JSON을 만들어줘.
규칙:
1. 각 요일(dayOfWeek: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')마다 wakeTime("HH:MM"), sleepTime("HH:MM"), blocks 배열을 생성해.
   - 언급되지 않은 평일 기상/취침은 보통 고1 기준(07:00 기상, 23:50 취침), 주말은 08:30~09:00 기상, 24:00 취침으로 합리적으로 채워.
   - 식사 시간 언급이 없어도 점심/저녁 중 학교 밖 저녁 시간(예: 17:30~18:20)이 비면 가볍게 저녁 식사를 넣어주거나, 학생이 언급한 일정만 정확히 반영해.
2. 각 block의 type은 반드시 'school' | 'academy' | 'commute' | 'meal' | 'activity' | 'rest' 중 하나여야 해.
3. 시간 형식은 반드시 24시간제 "HH:MM" (예: "08:20", "16:10", "18:00", "21:30", "23:50")으로 맞춰.
4. summary에는 "평일 학교 수업과 월·수·금 수학학원을 반영해 시간표를 채웠어요."처럼 1문장 요약을 적어줘.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOfWeek: { type: Type.STRING },
                    wakeTime: { type: Type.STRING },
                    sleepTime: { type: Type.STRING },
                    blocks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          startTime: { type: Type.STRING },
                          endTime: { type: Type.STRING },
                          title: { type: Type.STRING },
                          type: { type: Type.STRING },
                          allowLightStudy: { type: Type.BOOLEAN },
                        },
                        required: ['startTime', 'endTime', 'title', 'type'],
                      },
                    },
                  },
                  required: ['dayOfWeek', 'wakeTime', 'sleepTime', 'blocks'],
                },
              },
            },
            required: ['summary', 'days'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"summary":"","days":[]}').trim());
      res.json(parsed);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PaceMaker High server listening on http://localhost:${PORT}`);
  });
}

startServer();
