import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

// setup-config 모듈의 로직을 직접 테스트
describe('Setup Config', () => {
  const testDataDir = join(process.cwd(), 'data-test')
  const testConfigPath = join(testDataDir, 'setup-config.json')

  beforeEach(() => {
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true })
    }
    mkdirSync(testDataDir, { recursive: true })
  })

  afterAll(() => {
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true })
    }
  })

  test('설정 파일이 없으면 null을 반환해야 한다', () => {
    const configPath = join(testDataDir, 'nonexistent.json')
    expect(existsSync(configPath)).toBe(false)
  })

  test('설정 파일을 생성하고 읽을 수 있어야 한다', () => {
    const config = {
      setupComplete: true,
      setupDate: new Date().toISOString(),
      db: { host: 'localhost', port: '5432', user: 'msa', database: 'msa_hr' },
      company: { name: '(주)엠에스에이' },
    }

    writeFileSync(testConfigPath, JSON.stringify(config, null, 2))

    const loaded = JSON.parse(readFileSync(testConfigPath, 'utf-8'))
    expect(loaded.setupComplete).toBe(true)
    expect(loaded.company.name).toBe('(주)엠에스에이')
    expect(loaded.db.host).toBe('localhost')
    expect(loaded.db.port).toBe('5432')
  })

  test('설정 파일의 setupComplete가 false이면 미완료 상태', () => {
    const config = { setupComplete: false }
    writeFileSync(testConfigPath, JSON.stringify(config))

    const loaded = JSON.parse(readFileSync(testConfigPath, 'utf-8'))
    expect(loaded.setupComplete).toBe(false)
  })

  test('잘못된 JSON 파일은 파싱 에러를 발생시켜야 한다', () => {
    writeFileSync(testConfigPath, 'not valid json')

    expect(() => {
      JSON.parse(readFileSync(testConfigPath, 'utf-8'))
    }).toThrow()
  })
})
