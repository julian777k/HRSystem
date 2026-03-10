import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';

// ============================================================
// 근태 공통 유틸리티
// 7개 API 파일에서 중복되던 함수를 통합
// ============================================================

export interface WorkSettings {
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
}

/**
 * 근무시간 설정 조회 (우선순위: 개인 → 부서 → 회사)
 */
export async function getWorkSettings(employeeId?: string): Promise<WorkSettings> {
  // 1. 개인 설정 확인
  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        workStartTime: true,
        workEndTime: true,
        lunchStartTime: true,
        lunchEndTime: true,
        departmentId: true,
      },
    });

    if (employee) {
      // 개인 설정이 있으면 사용 (부분적으로 설정 가능)
      const hasPersonal = employee.workStartTime || employee.workEndTime;
      if (hasPersonal) {
        const deptSettings = await getDepartmentWorkSettings(employee.departmentId);
        const companySettings = await getCompanyWorkSettings();
        return {
          workStartTime: employee.workStartTime || deptSettings.workStartTime || companySettings.workStartTime,
          workEndTime: employee.workEndTime || deptSettings.workEndTime || companySettings.workEndTime,
          lunchStartTime: employee.lunchStartTime || deptSettings.lunchStartTime || companySettings.lunchStartTime,
          lunchEndTime: employee.lunchEndTime || deptSettings.lunchEndTime || companySettings.lunchEndTime,
        };
      }

      // 2. 부서 설정 확인
      const deptSettings = await getDepartmentWorkSettings(employee.departmentId);
      if (deptSettings.workStartTime || deptSettings.workEndTime) {
        const companySettings = await getCompanyWorkSettings();
        return {
          workStartTime: deptSettings.workStartTime || companySettings.workStartTime,
          workEndTime: deptSettings.workEndTime || companySettings.workEndTime,
          lunchStartTime: deptSettings.lunchStartTime || companySettings.lunchStartTime,
          lunchEndTime: deptSettings.lunchEndTime || companySettings.lunchEndTime,
        };
      }
    }
  }

  // 3. 회사 설정 (기본값)
  return getCompanyWorkSettings();
}

/**
 * 부서 근무시간 설정 조회
 */
async function getDepartmentWorkSettings(departmentId: string): Promise<Partial<WorkSettings>> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      workStartTime: true,
      workEndTime: true,
      lunchStartTime: true,
      lunchEndTime: true,
    },
  });
  return {
    workStartTime: dept?.workStartTime || undefined,
    workEndTime: dept?.workEndTime || undefined,
    lunchStartTime: dept?.lunchStartTime || undefined,
    lunchEndTime: dept?.lunchEndTime || undefined,
  };
}

/**
 * 회사 전체 근무시간 설정 조회 (SystemConfig)
 */
export async function getCompanyWorkSettings(): Promise<WorkSettings> {
  const configs = await prisma.systemConfig.findMany({
    where: { group: 'company' },
  });
  const settings: Record<string, string> = {};
  for (const cfg of configs) {
    settings[cfg.key] = cfg.value;
  }
  return {
    workStartTime: settings['work_start_time'] || '09:00',
    workEndTime: settings['work_end_time'] || '18:00',
    lunchStartTime: settings['lunch_start_time'] || '12:00',
    lunchEndTime: settings['lunch_end_time'] || '13:00',
  };
}

/**
 * 공휴일 + 회사휴무 + 부서휴무 통합 확인
 */
export async function isHoliday(date: Date, departmentId?: string): Promise<boolean> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const whereConditions: Array<Record<string, unknown>> = [
    // 공휴일
    { type: 'PUBLIC', date: { gte: startOfDay, lte: endOfDay } },
    // 회사 휴무일
    { type: 'COMPANY', date: { gte: startOfDay, lte: endOfDay } },
  ];

  // 부서 휴무일
  if (departmentId) {
    whereConditions.push({
      type: 'DEPARTMENT',
      targetId: departmentId,
      date: { gte: startOfDay, lte: endOfDay },
    });
  }

  const holiday = await prisma.holiday.findFirst({
    where: { OR: whereConditions },
  });

  if (holiday) return true;

  // Check recurring holidays by comparing month/day
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const recurringHolidays = await prisma.holiday.findMany({
    where: { isRecurring: true },
  });
  const isRecurringMatch = recurringHolidays.some(h => {
    const hDate = new Date(h.date);
    return hDate.getMonth() + 1 === month && hDate.getDate() === day;
  });
  if (isRecurringMatch) return true;

  return false;
}

/**
 * 범위 내 휴일 날짜 Set 반환
 */
export async function getHolidaysInRange(start: Date, end: Date, departmentId?: string): Promise<Set<string>> {
  const whereConditions: Array<Record<string, unknown>> = [
    { type: 'PUBLIC', date: { gte: start, lte: end } },
    { type: 'COMPANY', date: { gte: start, lte: end } },
  ];

  if (departmentId) {
    whereConditions.push({
      type: 'DEPARTMENT',
      targetId: departmentId,
      date: { gte: start, lte: end },
    });
  }

  const holidays = await prisma.holiday.findMany({
    where: { OR: whereConditions },
  });

  const set = new Set<string>();
  for (const h of holidays) {
    const d = new Date(h.date);
    set.add(dateKey(d));
  }

  // Check recurring holidays by comparing month/day for each date in range
  const recurringHolidays = await prisma.holiday.findMany({
    where: { isRecurring: true },
  });
  if (recurringHolidays.length > 0) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endBound = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= endBound) {
      const m = cursor.getMonth() + 1;
      const d = cursor.getDate();
      const isMatch = recurringHolidays.some(h => {
        const hDate = new Date(h.date);
        return hDate.getMonth() + 1 === m && hDate.getDate() === d;
      });
      if (isMatch) {
        set.add(dateKey(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return set;
}

/**
 * 주말 판정
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * 근무일 판정 (!주말 && !휴일)
 */
export async function isWorkday(date: Date, departmentId?: string): Promise<boolean> {
  return isWeekday(date) && !(await isHoliday(date, departmentId));
}

/**
 * 날짜 + 시간 문자열 → Date 생성
 */
export function buildDateTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * 날짜 키 문자열 (YYYY-MM-DD)
 */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * CompensationPolicy에서 일일 근무시간 조회
 */
export async function getDailyWorkHours(): Promise<number> {
  const policy = await prisma.compensationPolicy.findFirst({
    where: { isActive: true },
  });
  return policy?.dailyWorkHours ?? 8;
}

/**
 * 휴가 승인 시 근태 자동 생성
 */
export async function createLeaveAttendance(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  leaveUnit: string,
  leaveTypeName: string
): Promise<void> {
  const tenantId = await getTenantId();

  // 직원의 부서 조회
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  });
  const departmentId = employee?.departmentId;

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (cursor <= end) {
    // 근무일만 처리
    if (await isWorkday(cursor, departmentId)) {
      const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());

      let status: string;
      if (leaveUnit === 'AM_HALF') {
        status = 'AM_HALF_LEAVE';
      } else if (leaveUnit === 'PM_HALF') {
        status = 'PM_HALF_LEAVE';
      } else {
        status = 'LEAVE';
      }

      const existing = await prisma.attendance.findUnique({
        where: {
          tenantId_employeeId_date: {
            tenantId,
            employeeId,
            date: dayStart,
          },
        },
      });

      if (existing) {
        // 기존 NORMAL 근태 → 휴가 상태로 변경
        if (existing.status === 'NORMAL' || existing.status === 'LATE' || existing.status === 'EARLY_LEAVE') {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status,
              note: `${leaveTypeName} (${leaveUnit === 'AM_HALF' ? '오전반차' : leaveUnit === 'PM_HALF' ? '오후반차' : '종일'})`,
            },
          });
        }
      } else {
        // 근태 미존재 → 새로 생성
        await prisma.attendance.create({
          data: {
            employeeId,
            date: dayStart,
            clockIn: null,
            clockOut: null,
            workHours: 0,
            overtimeHours: 0,
            status,
            note: `${leaveTypeName} (${leaveUnit === 'AM_HALF' ? '오전반차' : leaveUnit === 'PM_HALF' ? '오후반차' : '종일'})`,
          },
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

/**
 * 휴가 취소 시 LEAVE 상태 근태 삭제/복원
 */
export async function removeLeaveAttendance(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dayEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  // LEAVE 상태 근태 삭제 (자동 생성된 것들)
  await prisma.attendance.deleteMany({
    where: {
      employeeId,
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ['LEAVE', 'AM_HALF_LEAVE', 'PM_HALF_LEAVE'] },
      clockIn: null, // 자동 생성된 것만 삭제 (실제 출근 기록이 있으면 유지)
    },
  });

  // 실제 출근 기록이 있는데 LEAVE로 변경된 경우 → NORMAL로 복원
  await prisma.attendance.updateMany({
    where: {
      employeeId,
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ['LEAVE', 'AM_HALF_LEAVE', 'PM_HALF_LEAVE'] },
    },
    data: {
      status: 'NORMAL',
      note: null,
    },
  });
}
