/**
 * Setup Wizard 유효성 검증 테스트
 * - DB 설정, 회사 정보, 관리자 계정, 규정 설정의 유효성을 검증
 */

// 유효성 검증 함수들
function validateDbConfig(config: {
  host: string; port: string; user: string; password: string; database: string
}) {
  const errors: Record<string, string> = {}
  if (!config.host.trim()) errors.host = 'DB 호스트를 입력해주세요'
  if (!config.port.trim()) errors.port = 'DB 포트를 입력해주세요'
  if (isNaN(parseInt(config.port))) errors.port = '포트는 숫자여야 합니다'
  if (!config.user.trim()) errors.user = 'DB 사용자를 입력해주세요'
  if (!config.database.trim()) errors.database = 'DB 이름을 입력해주세요'
  return errors
}

function validateCompanyInfo(info: { name: string; serverUrl: string }) {
  const errors: Record<string, string> = {}
  if (!info.name.trim()) errors.name = '회사명을 입력해주세요'
  if (info.serverUrl && !info.serverUrl.startsWith('http')) {
    errors.serverUrl = 'URL은 http:// 또는 https://로 시작해야 합니다'
  }
  return errors
}

function validateAdminAccount(admin: {
  employeeNumber: string; name: string; email: string;
  password: string; passwordConfirm: string
}) {
  const errors: Record<string, string> = {}
  if (!admin.employeeNumber.trim()) errors.employeeNumber = '사번을 입력해주세요'
  if (!admin.name.trim()) errors.name = '이름을 입력해주세요'
  if (!admin.email.trim()) errors.email = '이메일을 입력해주세요'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
    errors.email = '올바른 이메일 형식을 입력해주세요'
  }
  if (!admin.password) errors.password = '비밀번호를 입력해주세요'
  else if (admin.password.length < 8) errors.password = '비밀번호는 8자 이상이어야 합니다'
  if (admin.password !== admin.passwordConfirm) {
    errors.passwordConfirm = '비밀번호가 일치하지 않습니다'
  }
  return errors
}

function calculateAnnualLeave(yearsWorked: number): number {
  if (yearsWorked < 1) return 0  // 월별 부여 (별도 로직)
  const extraDays = Math.floor((yearsWorked - 1) / 2)
  return Math.min(15 + extraDays, 25)
}

describe('DB 설정 유효성 검증', () => {
  test('유효한 DB 설정은 에러가 없어야 한다', () => {
    const errors = validateDbConfig({
      host: 'localhost', port: '5432', user: 'msa',
      password: 'password', database: 'msa_hr',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('호스트가 비어있으면 에러', () => {
    const errors = validateDbConfig({
      host: '', port: '5432', user: 'msa',
      password: '', database: 'msa_hr',
    })
    expect(errors.host).toBeDefined()
  })

  test('포트가 숫자가 아니면 에러', () => {
    const errors = validateDbConfig({
      host: 'localhost', port: 'abc', user: 'msa',
      password: '', database: 'msa_hr',
    })
    expect(errors.port).toBe('포트는 숫자여야 합니다')
  })

  test('DB 이름이 비어있으면 에러', () => {
    const errors = validateDbConfig({
      host: 'localhost', port: '5432', user: 'msa',
      password: '', database: '',
    })
    expect(errors.database).toBeDefined()
  })
})

describe('회사 정보 유효성 검증', () => {
  test('유효한 회사 정보는 에러가 없어야 한다', () => {
    const errors = validateCompanyInfo({
      name: '(주)엠에스에이', serverUrl: 'http://localhost:3000',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('회사명이 비어있으면 에러', () => {
    const errors = validateCompanyInfo({ name: '', serverUrl: '' })
    expect(errors.name).toBeDefined()
  })

  test('잘못된 URL 형식이면 에러', () => {
    const errors = validateCompanyInfo({
      name: 'MSA', serverUrl: 'invalid-url',
    })
    expect(errors.serverUrl).toBeDefined()
  })
})

describe('관리자 계정 유효성 검증', () => {
  test('유효한 관리자 정보는 에러가 없어야 한다', () => {
    const errors = validateAdminAccount({
      employeeNumber: '1088148326', name: '변인수',
      email: 'admin@msa.co.kr', password: 'password123!',
      passwordConfirm: 'password123!',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('이메일 형식이 틀리면 에러', () => {
    const errors = validateAdminAccount({
      employeeNumber: '1088', name: '테스트',
      email: 'not-an-email', password: 'password123!',
      passwordConfirm: 'password123!',
    })
    expect(errors.email).toBe('올바른 이메일 형식을 입력해주세요')
  })

  test('비밀번호가 8자 미만이면 에러', () => {
    const errors = validateAdminAccount({
      employeeNumber: '1088', name: '테스트',
      email: 'test@test.com', password: '1234',
      passwordConfirm: '1234',
    })
    expect(errors.password).toBe('비밀번호는 8자 이상이어야 합니다')
  })

  test('비밀번호 확인이 불일치하면 에러', () => {
    const errors = validateAdminAccount({
      employeeNumber: '1088', name: '테스트',
      email: 'test@test.com', password: 'password123!',
      passwordConfirm: 'different!',
    })
    expect(errors.passwordConfirm).toBe('비밀번호가 일치하지 않습니다')
  })

  test('모든 필드가 비어있으면 다수 에러', () => {
    const errors = validateAdminAccount({
      employeeNumber: '', name: '', email: '',
      password: '', passwordConfirm: '',
    })
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(4)
  })
})

describe('연차 자동 계산', () => {
  test('1년차: 15일', () => {
    expect(calculateAnnualLeave(1)).toBe(15)
  })

  test('2년차: 15일', () => {
    expect(calculateAnnualLeave(2)).toBe(15)
  })

  test('3년차: 16일 (15 + 1)', () => {
    expect(calculateAnnualLeave(3)).toBe(16)
  })

  test('5년차: 17일 (15 + 2)', () => {
    expect(calculateAnnualLeave(5)).toBe(17)
  })

  test('10년차: 19일 (15 + 4)', () => {
    expect(calculateAnnualLeave(10)).toBe(19)
  })

  test('20년차: 24일 (15 + 9)', () => {
    expect(calculateAnnualLeave(20)).toBe(24)
  })

  test('21년차: 25일 (최대값)', () => {
    expect(calculateAnnualLeave(21)).toBe(25)
  })

  test('30년차: 25일 (최대값 초과 안함)', () => {
    expect(calculateAnnualLeave(30)).toBe(25)
  })

  test('1년 미만: 0 (월별 부여 별도)', () => {
    expect(calculateAnnualLeave(0)).toBe(0)
  })
})
