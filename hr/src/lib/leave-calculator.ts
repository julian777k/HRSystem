/**
 * 근로기준법 기반 연차 계산 유틸리티
 */

/** 근속연수 계산 */
export function getYearsWorked(hireDate: Date, referenceDate: Date = new Date()): number {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);
  let years = ref.getFullYear() - hire.getFullYear();
  const monthDiff = ref.getMonth() - hire.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < hire.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

/** 근속개월수 계산 */
export function getMonthsWorked(hireDate: Date, referenceDate: Date = new Date()): number {
  const hire = new Date(hireDate);
  const ref = new Date(referenceDate);
  let months = (ref.getFullYear() - hire.getFullYear()) * 12 + (ref.getMonth() - hire.getMonth());
  if (ref.getDate() < hire.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

/**
 * 연차 일수 계산 (근로기준법)
 * - 입사 1년 미만: 매월 1일 (최대 11일)
 * - 입사 1년 이상: 15일 + floor((근속연수-1)/2) 추가 (최대 25일)
 */
export function calculateAnnualLeave(hireDate: Date, referenceDate: Date = new Date()): number {
  const yearsWorked = getYearsWorked(hireDate, referenceDate);
  const monthsWorked = getMonthsWorked(hireDate, referenceDate);

  if (yearsWorked < 1) {
    // 입사 1년 미만: 매월 1일, 최대 11일
    return Math.min(monthsWorked, 11);
  }

  // 입사 1년 이상: 15일 기본 + 2년마다 1일 추가, 최대 25일
  const base = 15;
  const additional = Math.floor((yearsWorked - 1) / 2);
  return Math.min(base + additional, 25);
}

/**
 * 근무일수 계산 (주말/공휴일 제외)
 * @param startDate 시작일
 * @param endDate 종료일
 * @param holidays 공휴일 날짜 목록
 * @returns 근무일수 (주말, 공휴일 제외)
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[] = []
): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) return 0;

  // 공휴일을 YYYY-MM-DD 문자열 Set으로 변환하여 빠른 조회
  const holidaySet = new Set(
    holidays.map((d) => {
      const h = new Date(d);
      h.setHours(0, 0, 0, 0);
      return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    })
  );

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

    // 주말(토=6, 일=0) 및 공휴일 제외
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      workingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}
