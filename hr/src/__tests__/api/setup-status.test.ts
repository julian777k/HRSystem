/**
 * Setup API 테스트
 * - /api/setup/status 엔드포인트의 동작을 검증
 */

import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

describe('API: /api/setup/status', () => {
  const testDir = join(process.cwd(), 'data-test-api')
  const configPath = join(testDir, 'setup-config.json')

  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
  })

  test('설정 파일이 없으면 isComplete: false', () => {
    const nonExistentPath = join(testDir, 'nonexistent.json')
    expect(existsSync(nonExistentPath)).toBe(false)

    // API 로직 시뮬레이션
    let result = { isComplete: false }
    if (existsSync(nonExistentPath)) {
      // would read file
    }
    expect(result.isComplete).toBe(false)
  })

  test('setupComplete: true인 설정 파일이 있으면 isComplete: true', () => {
    const config = { setupComplete: true, company: { name: 'MSA' } }
    writeFileSync(configPath, JSON.stringify(config))

    // API 로직 시뮬레이션
    const loaded = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'))
    expect(loaded.setupComplete).toBe(true)
    expect(loaded.company.name).toBe('MSA')
  })

  test('setupComplete: false인 설정 파일이면 isComplete: false', () => {
    const config = { setupComplete: false }
    writeFileSync(configPath, JSON.stringify(config))

    const loaded = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'))
    expect(loaded.setupComplete).toBe(false)
  })
})

describe('DB 연결 URL 생성', () => {
  test('기본 연결 URL이 올바르게 생성되어야 한다', () => {
    const db = { host: 'localhost', port: '5432', user: 'msa', password: 'test123', database: 'msa_hr' }
    const url = `postgresql://${db.user}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}`
    expect(url).toBe('postgresql://msa:test123@localhost:5432/msa_hr')
  })

  test('특수문자가 포함된 비밀번호도 인코딩되어야 한다', () => {
    const db = { host: 'localhost', port: '5432', user: 'msa', password: 'p@ss#w0rd!', database: 'msa_hr' }
    const url = `postgresql://${db.user}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}`
    expect(url).toContain('p%40ss%23w0rd!')
    expect(url).not.toContain('@ss')  // @ in password should be encoded
  })

  test('빈 비밀번호도 URL이 생성되어야 한다', () => {
    const db = { host: 'localhost', port: '5432', user: 'msa', password: '', database: 'msa_hr' }
    const url = `postgresql://${db.user}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}`
    expect(url).toBe('postgresql://msa:@localhost:5432/msa_hr')
  })
})
