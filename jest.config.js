module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/errors/(.*)$': '<rootDir>/src/errors/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  testTimeout: 60000, // 增加超时时间到60秒
  workerIdleMemoryLimit: '1024MB', // 增加内存限制到1GB
  maxWorkers: 1, // 使用单工作进程以避免内存竞争
  maxConcurrency: 1, // 限制并发测试数量
  verbose: true, // 启用详细输出以便调试
  detectOpenHandles: false, // 关闭句柄检测以避免超时
  forceExit: true, // 强制退出
  // 环境变量
  globals: {
    'NODE_OPTIONS': '--expose-gc --max-old-space-size=2048 --experimental-wasm-modules'
  }
};