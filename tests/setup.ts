/**
 * Jest测试设置文件
 */

// 设置测试超时时间
jest.setTimeout(60000);

// 设置测试环境变量
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';
process.env['ENABLE_REQUEST_LOGGING'] = 'false';

// 为Tree-sitter设置额外的环境变量
process.env['TREE_SITTER_WASM_MEMORY_LIMIT'] = '512MB';

// Node.js WASM支持
process.env['NODE_OPTIONS'] = '--expose-gc --max-old-space-size=2048 --experimental-wasm-modules';

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
  
  // 强制垃圾回收
  if (global.gc) {
    global.gc();
  }
});

// 在每个测试后清理资源
afterEach(async () => {
  // 等待一段时间让异步操作完成
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 强制垃圾回收
  if (global.gc) {
    global.gc();
  }
});

// 在所有测试后清理
afterAll(async () => {
  jest.restoreAllMocks();
  
  // 最终清理
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (global.gc) {
    global.gc();
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in tests:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in tests:', reason);
});

// 设置Tree-sitter WASM初始化
let treeSitterInitialized = false;

const initializeTreeSitter = async () => {
  if (treeSitterInitialized) return;
  
  try {
    // 尝试导入Tree-sitter以确保WASM模块正确加载
    const Parser = require('tree-sitter');
    
    // 创建一个简单的解析器实例来测试WASM加载
    const parser = new Parser();
    
    // 如果成功，标记为已初始化
    treeSitterInitialized = true;
    
    // 清理测试解析器
    if (typeof parser.delete === 'function') {
      parser.delete();
    }
  } catch (error) {
    console.warn('Tree-sitter WASM initialization failed:', error);
    // 不抛出错误，让测试继续运行
  }
};

// 在所有测试开始前初始化Tree-sitter
beforeAll(async () => {
  await initializeTreeSitter();
});