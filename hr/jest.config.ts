import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/release/', '<rootDir>/dist-electron/'],
  // release/·dist-electron/에는 빌드 산출물(.next/standalone)이 있어 haste 모듈 맵 중복을 유발 — 스캔에서 제외
  modulePathIgnorePatterns: ['<rootDir>/release/', '<rootDir>/dist-electron/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/components/ui/**',
  ],
}

export default config
