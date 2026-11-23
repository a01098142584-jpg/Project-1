export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

export const DAY_ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export type FixedEventType =
  | 'school'
  | 'academy'
  | 'commute'
  | 'meal'
  | 'activity'
  | 'rest';

export const EVENT_TYPE_LABELS: Record<FixedEventType, string> = {
  school: '학교 수업',
  academy: '학원·과외',
  commute: '등하교·이동',
  meal: '식사',
  activity: '동아리·수행',
  rest: '휴식·기타',
};

export interface RoutineBlock {
  id: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  title: string;
  type: FixedEventType;
  allowLightStudy?: boolean; // 이동 중 단어/개념 암기 가능 여부
}

export interface DayRoutineConfig {
  dayOfWeek: DayOfWeek;
  wakeTime: string;      // HH:MM
  sleepTime: string;     // HH:MM
  maxStudyMinutes: number; // 일일 최대 순공시간 상한
  blocks: RoutineBlock[];
}

export type TaskType = 'concept' | 'problems' | 'essay' | 'memorize' | 'remedial';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  concept: '개념 정리·인강',
  problems: '유형·기출 풀이',
  essay: '서술형 대비',
  memorize: '핵심 암기',
  remedial: '오답 보충',
};

export interface SubjectConfig {
  id: string;
  name: string;
  color: string; // subtle accent hex for indicators
  credits: number; // 단위수 (3~4)
  prevScore: number; // 직전 시험 점수 (0~100)
  prevGrade: number; // 직전 등급 (1~9)
  targetGrade: number; // 목표 등급 (1~9)
  textbookPublisher: string; // 교과서 출판사 (예: 미래엔, 비상교육, 능률 등)
  supplementaryMaterial: string; // 부교재 및 프린트 (예: 올림포스, 쎈, 학교 유인물)
  examScope: string; // 이번 시험 범위
  examDate?: string; // 과목별 시험 날짜 (선택)
  weaknessTags: string[]; // 직전 시험 취약점
}

export interface StudyTask {
  id: string;
  subjectId: string;
  title: string;
  unitTag: string;
  taskType: TaskType;
  totalUnits: number;
  completedUnits: number;
  unitLabel: string; // 예: '강', '쪽', '문항', '세트'
  minutesPerUnit: number;
  difficulty: 'high' | 'medium' | 'low';
  isRemedial?: boolean;
  createdReason?: string;
}

export type BlockStatus = 'planned' | 'in_progress' | 'completed' | 'partial' | 'missed';

export interface TimeBlock {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subjectId: string;
  taskId: string;
  title: string;
  unitTag: string;
  taskType: TaskType;
  difficulty: 'high' | 'medium' | 'low';
  slotContext: 'desk' | 'commute';
  energyLevel: 'high' | 'medium' | 'low';
  status: BlockStatus;
  actualMinutes?: number;
  isRemedial?: boolean;
  adjustmentNote?: string;
}

export type ConditionPeriod = 'morning' | 'evening';
export type ConditionLevel = 'optimal' | 'normal' | 'low';

export interface ConditionPromptData {
  subjectName: string;
  unitTag: string;
  conceptSentence: string;
  keywords: string[];
  hint: string;
}

export interface ConditionRecord {
  id: string;
  dateStr: string;
  dayOfWeek: DayOfWeek;
  period: ConditionPeriod;
  subjectName: string;
  conceptSentence: string;
  keywords: string[];
  userRecall: string;
  recallScore: number; // 0~100
  elapsedSeconds: number;
  sleepHours: string;
  fatigueLevel: string;
  judgedCondition: ConditionLevel;
  aiReason: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'essay';
  difficultyLabel: string;
  unitTag: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  rubricPoints?: string[];
  explanation: string;
}

export interface QuizGradeResult {
  questionId: string;
  isCorrect: boolean;
  score: number; // 0~100
  feedback: string;
  deductionReasons: string[];
  weakConcept: string;
}

export interface WeaknessRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  unitTag: string;
  questionText: string;
  questionType: 'multiple_choice' | 'short_answer' | 'essay';
  userAnswer: string;
  feedback: string;
  score: number;
  createdAt: string;
  resolved: boolean;
}

export interface PlanAdjustmentRule {
  id: string;
  dayOfWeek: DayOfWeek;
  action: 'boost_subject' | 'exclude_subject' | 'reduce_cap' | 'focus_only';
  subjectName?: string;
  minutesDelta?: number;
  note: string;
  createdAt: string;
}

export interface ExamMeta {
  title: string;
  examDate: string; // YYYY-MM-DD
}
