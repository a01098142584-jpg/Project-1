import {
  ConditionLevel,
  DAY_ORDER,
  DayOfWeek,
  DayRoutineConfig,
  PlanAdjustmentRule,
  StudyTask,
  SubjectConfig,
  TimeBlock,
} from '../types';

export function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDurationKo(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}분`;
  if (rem === 0) return `${h}시간`;
  return `${h}시간 ${rem}분`;
}

export interface AvailableSlot {
  dayOfWeek: DayOfWeek;
  startMin: number;
  endMin: number;
  duration: number;
  context: 'desk' | 'commute';
  energy: 'high' | 'medium' | 'low';
}

function getEnergyForTime(startMin: number): 'high' | 'medium' | 'low' {
  const hour = startMin / 60;
  // 오전 골든타임(09:00~12:30), 저녁 집중 타임(19:00~22:00)
  if ((hour >= 9 && hour < 12.5) || (hour >= 19 && hour < 22)) {
    return 'high';
  }
  if ((hour >= 14 && hour < 19) || (hour >= 7 && hour < 9)) {
    return 'medium';
  }
  return 'low';
}

export function extractAvailableSlots(routine: DayRoutineConfig): AvailableSlot[] {
  const wakeMin = timeToMinutes(routine.wakeTime);
  const sleepMin = timeToMinutes(routine.sleepTime);
  const dayEnd = sleepMin > wakeMin ? sleepMin : 24 * 60;

  const sortedBlocks = [...routine.blocks]
    .map((b) => ({
      ...b,
      s: Math.max(wakeMin, timeToMinutes(b.startTime)),
      e: Math.min(dayEnd, timeToMinutes(b.endTime)),
    }))
    .filter((b) => b.e > b.s)
    .sort((a, b) => a.s - b.s);

  const slots: AvailableSlot[] = [];
  let cursor = wakeMin;

  for (const block of sortedBlocks) {
    if (block.s > cursor) {
      const gap = block.s - cursor;
      if (gap >= 30) {
        slots.push({
          dayOfWeek: routine.dayOfWeek,
          startMin: cursor,
          endMin: block.s,
          duration: gap,
          context: 'desk',
          energy: getEnergyForTime(cursor),
        });
      }
    }
    if (block.allowLightStudy && block.e - block.s >= 25) {
      slots.push({
        dayOfWeek: routine.dayOfWeek,
        startMin: block.s,
        endMin: block.e,
        duration: block.e - block.s,
        context: 'commute',
        energy: 'low',
      });
    }
    cursor = Math.max(cursor, block.e);
  }

  if (dayEnd > cursor && dayEnd - cursor >= 30) {
    slots.push({
      dayOfWeek: routine.dayOfWeek,
      startMin: cursor,
      endMin: dayEnd,
      duration: dayEnd - cursor,
      context: 'desk',
      energy: getEnergyForTime(cursor),
    });
  }

  return slots;
}

export function getDifficultyMultiplier(diff: 'high' | 'medium' | 'low'): number {
  if (diff === 'high') return 1.25;
  if (diff === 'low') return 0.85;
  return 1.0;
}

export function estimateTaskRemainingMinutes(task: StudyTask): number {
  const remainingUnits = Math.max(0, task.totalUnits - task.completedUnits);
  return Math.round(remainingUnits * task.minutesPerUnit * getDifficultyMultiplier(task.difficulty));
}

export interface SubjectInvestment {
  subject: SubjectConfig;
  investmentScore: number;
  sharePercent: number;
  requiredMinutes: number;
  gradeGap: number;
  remedialCount: number;
}

export function calculateSubjectInvestments(
  subjects: SubjectConfig[],
  tasks: StudyTask[]
): SubjectInvestment[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const raw = subjects.map((subj) => {
    const gradeGap = Math.max(0.5, subj.prevGrade - subj.targetGrade + 0.8);
    const subjTasks = tasks.filter((t) => t.subjectId === subj.id);
    const remedialCount = subjTasks.filter((t) => t.isRemedial && t.completedUnits < t.totalUnits).length;
    const requiredMinutes = subjTasks.reduce((acc, t) => acc + estimateTaskRemainingMinutes(t), 0);

    // 과목별 시험 날짜가 가까울수록(특히 7일 이내) 시급성 가중치 반영
    let urgencyFactor = 1.0;
    if (subj.examDate) {
      const ex = new Date(subj.examDate);
      ex.setHours(0, 0, 0, 0);
      const daysLeft = Math.max(1, Math.ceil((ex.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysLeft <= 3) urgencyFactor = 1.35;
      else if (daysLeft <= 7) urgencyFactor = 1.2;
      else if (daysLeft <= 14) urgencyFactor = 1.08;
    }

    // 직전 성적 격차 × 단위수 × 취약 태그 보정 × 오답 보충 시급성 × 시험일 임박도
    const weaknessFactor = 1 + Math.min(0.4, subj.weaknessTags.length * 0.12);
    const remedialFactor = 1 + remedialCount * 0.25;
    const score = gradeGap * subj.credits * weaknessFactor * remedialFactor * urgencyFactor;

    return {
      subject: subj,
      investmentScore: Math.round(score * 10) / 10,
      requiredMinutes,
      gradeGap: subj.prevGrade - subj.targetGrade,
      remedialCount,
    };
  });

  const totalScore = raw.reduce((sum, item) => sum + item.investmentScore, 0) || 1;
  return raw
    .map((item) => ({
      ...item,
      sharePercent: Math.round((item.investmentScore / totalScore) * 100),
    }))
    .sort((a, b) => b.investmentScore - a.investmentScore);
}

export interface FeasibilitySummary {
  weeklyAvailableMinutes: number;
  totalAvailableUntilExam: number;
  totalRequiredMinutes: number;
  bufferMinutes: number;
  surplusMinutes: number;
  isFeasible: boolean;
  daysUntilExam: number;
}

export function computeFeasibility(
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>,
  tasks: StudyTask[],
  examDateStr: string
): FeasibilitySummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(examDateStr);
  examDate.setHours(0, 0, 0, 0);
  const diffDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  let weeklyAvailableMinutes = 0;
  for (const day of DAY_ORDER) {
    const slots = extractAvailableSlots(weeklyRoutine[day]);
    const rawDayAvail = slots.reduce((sum, s) => sum + s.duration, 0);
    weeklyAvailableMinutes += Math.min(rawDayAvail, weeklyRoutine[day].maxStudyMinutes);
  }

  const weeksFactor = diffDays / 7;
  const grossAvailable = Math.round(weeklyAvailableMinutes * weeksFactor);
  const bufferMinutes = Math.round(grossAvailable * 0.12);
  const totalAvailableUntilExam = Math.max(0, grossAvailable - bufferMinutes);
  const totalRequiredMinutes = tasks.reduce((sum, t) => sum + estimateTaskRemainingMinutes(t), 0);
  const surplusMinutes = totalAvailableUntilExam - totalRequiredMinutes;

  return {
    weeklyAvailableMinutes,
    totalAvailableUntilExam,
    totalRequiredMinutes,
    bufferMinutes,
    surplusMinutes,
    isFeasible: surplusMinutes >= 0,
    daysUntilExam: diffDays,
  };
}

export function getTodayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
  const map: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[jsDay];
}

interface GeneratePlanOptions {
  weeklyRoutine: Record<DayOfWeek, DayRoutineConfig>;
  subjects: SubjectConfig[];
  tasks: StudyTask[];
  todayDay: DayOfWeek;
  todayCondition?: ConditionLevel;
  adjustmentRules: PlanAdjustmentRule[];
  existingBlocks?: TimeBlock[];
}

/**
 * 요일별 일과 슬롯 + 직전 시험 투자 가중치 + 컨디션 + 오답 보충 + 추가 요청을 결합해
 * 가용 시간을 절대 넘지 않는 7일 타임블록 계획표를 생성합니다.
 */
export function generateWeeklySchedule(opts: GeneratePlanOptions): TimeBlock[] {
  const {
    weeklyRoutine,
    subjects,
    tasks,
    todayDay,
    todayCondition,
    adjustmentRules,
    existingBlocks = [],
  } = opts;

  const investments = calculateSubjectInvestments(subjects, tasks);
  const weightBySubjectId = new Map<string, number>();
  investments.forEach((inv) => weightBySubjectId.set(inv.subject.id, inv.investmentScore));

  // 완료되었거나 진행 중인 오늘 블록은 보존 가능성 체크 (단, 강제 재생성 시 미완료 블록만 새로 구성)
  const completedMap = new Map<string, TimeBlock[]>();
  for (const b of existingBlocks) {
    if (b.status === 'completed') {
      const arr = completedMap.get(b.dayOfWeek) ?? [];
      arr.push(b);
      completedMap.set(b.dayOfWeek, arr);
    }
  }

  // 남은 과제 풀 (분 단위 예산 추적)
  const taskPool = tasks
    .map((t) => ({
      task: t,
      remainingMin: estimateTaskRemainingMinutes(t),
      subjWeight: weightBySubjectId.get(t.subjectId) ?? 1,
    }))
    .filter((item) => item.remainingMin > 0);

  // 주간 라운드로빈 시 모든 과목이 골고루 돌도록 과목별 누적 배정 시간 추적
  const allocatedBySubject = new Map<string, number>();
  subjects.forEach((s) => allocatedBySubject.set(s.id, 0));

  const generated: TimeBlock[] = [];

  for (const day of DAY_ORDER) {
    const routine = weeklyRoutine[day];
    const dayCompleted = completedMap.get(day) ?? [];
    const completedMinutesToday = dayCompleted.reduce((s, b) => s + b.durationMinutes, 0);
    generated.push(...dayCompleted);

    // 해당 요일의 추가 조정 규칙 추출
    const dayRules = adjustmentRules.filter((r) => r.dayOfWeek === day);
    const excludedSubjectNames = new Set(
      dayRules.filter((r) => r.action === 'exclude_subject' && r.subjectName).map((r) => r.subjectName!)
    );
    const focusOnlySubjectName = dayRules.find((r) => r.action === 'focus_only' && r.subjectName)?.subjectName;
    const capDelta = dayRules
      .filter((r) => r.action === 'reduce_cap')
      .reduce((acc, r) => acc + (r.minutesDelta ?? 0), 0);

    const boostedMinutesBySubjectName = new Map<string, number>();
    dayRules
      .filter((r) => r.action === 'boost_subject' && r.subjectName)
      .forEach((r) => {
        const cur = boostedMinutesBySubjectName.get(r.subjectName!) ?? 0;
        boostedMinutesBySubjectName.set(r.subjectName!, cur + (r.minutesDelta ?? 60));
      });

    let effectiveCap = Math.max(30, routine.maxStudyMinutes + capDelta) - completedMinutesToday;
    if (day === todayDay && todayCondition === 'low') {
      // 컨디션 저하 시 일일 상한을 20% 줄여 과부하 방지
      effectiveCap = Math.max(40, Math.round(effectiveCap * 0.8));
    }

    const slots = extractAvailableSlots(routine);
    let lastSubjectIdOnDay = '';

    for (const slot of slots) {
      if (effectiveCap < 25) break;

      // 완료된 블록과 겹치지 않는지 확인
      let cursor = slot.startMin;
      const slotEnd = slot.endMin;

      while (cursor + 25 <= slotEnd && effectiveCap >= 25) {
        // 완료 블록과 겹치면 점프
        const overlap = dayCompleted.find((cb) => {
          const cs = timeToMinutes(cb.startTime);
          const ce = timeToMinutes(cb.endTime);
          return cursor < ce && cursor + 25 > cs;
        });
        if (overlap) {
          cursor = timeToMinutes(overlap.endTime) + 5;
          continue;
        }

        const availSpan = Math.min(slotEnd - cursor, effectiveCap);
        if (availSpan < 25) break;

        // 컨디션 반영: 오늘 컨디션이 low면 고집중 블록 길이 축소(최대 40분), 고난도 회피
        const isTodayLow = day === todayDay && todayCondition === 'low';
        const isTodayOptimal = day === todayDay && todayCondition === 'optimal';
        const idealChunk = slot.context === 'commute' ? Math.min(availSpan, 40) : isTodayLow ? Math.min(availSpan, 40) : Math.min(availSpan, 65);

        // 후보 태스크 점수화
        const candidates = taskPool.filter((item) => {
          if (item.remainingMin < 15) return false;
          const subj = subjects.find((s) => s.id === item.task.subjectId);
          if (!subj) return false;
          if (excludedSubjectNames.has(subj.name)) return false;
          if (focusOnlySubjectName && subj.name !== focusOnlySubjectName) return false;
          if (slot.context === 'commute') {
            return item.task.taskType === 'memorize' || item.task.difficulty === 'low';
          }
          return true;
        });

        if (candidates.length === 0) break;

        candidates.sort((a, b) => {
          const subjA = subjects.find((s) => s.id === a.task.subjectId)!;
          const subjB = subjects.find((s) => s.id === b.task.subjectId)!;

          const scoreItem = (item: typeof a, subj: SubjectConfig) => {
            let score = item.subjWeight * 10;

            // 1. 오답 보충 태스크 최우선!
            if (item.task.isRemedial) score += 120;

            // 2. 사용자 추가 조정 요청 반영 (boost_subject)
            const boost = boostedMinutesBySubjectName.get(subj.name) ?? 0;
            if (boost > 0) score += 90;

            // 3. 컨디션 & 슬롯 에너지 매칭
            if (isTodayLow) {
              if (item.task.difficulty === 'high') score -= 70;
              if (item.task.taskType === 'memorize' || item.task.taskType === 'concept' || item.task.isRemedial) {
                score += 45;
              }
            } else if (isTodayOptimal || slot.energy === 'high') {
              if (item.task.difficulty === 'high' || item.task.taskType === 'essay') score += 35;
            } else if (slot.energy === 'low') {
              if (item.task.difficulty === 'low' || item.task.taskType === 'memorize') score += 25;
            }

            // 4. 과목 교차 배치 (연속 같은 과목 피로 방지)
            if (item.task.subjectId === lastSubjectIdOnDay && candidates.length > 1) {
              score -= 35;
            }

            // 5. 아직 적게 배정된 과목 우선 균형 보정
            const alreadyAlloc = allocatedBySubject.get(subj.id) ?? 0;
            score -= alreadyAlloc * 0.08;

            return score;
          };

          return scoreItem(b, subjB) - scoreItem(a, subjA);
        });

        const chosen = candidates[0];
        const chosenSubj = subjects.find((s) => s.id === chosen.task.subjectId)!;
        const duration = Math.min(idealChunk, Math.max(25, Math.min(chosen.remainingMin, idealChunk)));

        const noteParts: string[] = [];
        if (chosen.task.isRemedial) noteParts.push('오답 기반 보충');
        if (isTodayLow && chosen.task.difficulty !== 'high') noteParts.push('컨디션 저하 반영 경량 배치');
        if (dayRules.length > 0) {
          const matchingRule = dayRules.find((r) => !r.subjectName || r.subjectName === chosenSubj.name);
          if (matchingRule) noteParts.push(matchingRule.note);
        }

        generated.push({
          id: `tb-${day}-${cursor}-${chosen.task.id}-${Math.random().toString(36).slice(2, 6)}`,
          dayOfWeek: day,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(cursor + duration),
          durationMinutes: duration,
          subjectId: chosen.task.subjectId,
          taskId: chosen.task.id,
          title: chosen.task.title,
          unitTag: chosen.task.unitTag,
          taskType: chosen.task.taskType,
          difficulty: chosen.task.difficulty,
          slotContext: slot.context,
          energyLevel: isTodayLow ? 'low' : slot.energy,
          status: 'planned',
          isRemedial: chosen.task.isRemedial,
          adjustmentNote: noteParts.length > 0 ? noteParts[0] : undefined,
        });

        // 풀 및 예산 차감
        chosen.remainingMin = Math.max(0, chosen.remainingMin - duration);
        allocatedBySubject.set(chosenSubj.id, (allocatedBySubject.get(chosenSubj.id) ?? 0) + duration);
        const boostLeft = boostedMinutesBySubjectName.get(chosenSubj.name) ?? 0;
        if (boostLeft > 0) {
          boostedMinutesBySubjectName.set(chosenSubj.name, Math.max(0, boostLeft - duration));
        }

        lastSubjectIdOnDay = chosenSubj.id;
        effectiveCap -= duration;

        // 책상 학습 블록이 길면 다음 블록 전 10분 휴식 삽입
        const restGap = slot.context === 'desk' && duration >= 45 ? 10 : 0;
        cursor += duration + restGap;
      }
    }
  }

  return generated.sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}
