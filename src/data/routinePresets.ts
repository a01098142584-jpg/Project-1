import { DAY_ORDER, DayOfWeek, DayRoutineConfig } from '../types';
import { DEFAULT_WEEKLY_ROUTINE } from './defaultData';

export function buildYajaFocusedRoutine(): Record<DayOfWeek, DayRoutineConfig> {
  const result = {} as Record<DayOfWeek, DayRoutineConfig>;

  for (const day of DAY_ORDER) {
    const isWeekend = day === 'sat' || day === 'sun';
    if (isWeekend) {
      result[day] = {
        dayOfWeek: day,
        wakeTime: day === 'sat' ? '08:30' : '09:00',
        sleepTime: '23:50',
        maxStudyMinutes: day === 'sat' ? 420 : 340,
        blocks: [
          { id: `${day}-m1`, startTime: '12:30', endTime: '13:30', title: '점심 식사', type: 'meal' },
          { id: `${day}-m2`, startTime: '18:00', endTime: '19:00', title: '저녁 식사', type: 'meal' },
        ],
      };
    } else {
      result[day] = {
        dayOfWeek: day,
        wakeTime: '07:00',
        sleepTime: '23:50',
        maxStudyMinutes: 300,
        blocks: [
          { id: `${day}-c1`, startTime: '07:35', endTime: '08:15', title: '등교 이동', type: 'commute', allowLightStudy: true },
          { id: `${day}-s1`, startTime: '08:20', endTime: '16:10', title: '학교 정규 수업', type: 'school' },
          { id: `${day}-m1`, startTime: '17:30', endTime: '18:30', title: '석식 및 휴식', type: 'meal' },
          { id: `${day}-c2`, startTime: '21:30', endTime: '22:00', title: '야자 후 귀가', type: 'commute', allowLightStudy: true },
        ],
      };
    }
  }
  return result;
}

export function buildEmptyRoutine(): Record<DayOfWeek, DayRoutineConfig> {
  const result = {} as Record<DayOfWeek, DayRoutineConfig>;
  for (const day of DAY_ORDER) {
    result[day] = {
      dayOfWeek: day,
      wakeTime: day === 'sat' || day === 'sun' ? '08:30' : '07:00',
      sleepTime: '23:50',
      maxStudyMinutes: day === 'sat' || day === 'sun' ? 360 : 240,
      blocks: [],
    };
  }
  return result;
}

export function getAcademyPresetRoutine(): Record<DayOfWeek, DayRoutineConfig> {
  return JSON.parse(JSON.stringify(DEFAULT_WEEKLY_ROUTINE));
}
