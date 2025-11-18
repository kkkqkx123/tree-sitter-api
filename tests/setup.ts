/**
 * Jest测试设置文件
 */

// 设置测试超时时间
jest.setTimeout(10000);

// 设置测试环境变量
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';
process.env['ENABLE_REQUEST_LOGGING'] = 'false';

// 全局测试工具
(global as any).testUtils = {
  /**
   * 创建测试用的解析请求
   */
  createParseRequest: (overrides: any = {}) => ({
    language: 'javascript',
    code: 'function test() { return "hello"; }',
    query: '(function_declaration) @func',
    ...overrides,
  }),

  /**
   * 等待指定时间
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 生成随机字符串
   */
  randomString: (length: number = 10) => {
    return Math.random().toString(36).substring(2, length + 2);
  },
};

// 在每个测试前重置所有模拟
beforeEach(() => {
  jest.clearAllMocks();
});

// 在所有测试后清理
afterAll(() => {
  jest.restoreAllMocks();
});