/**
 * E2E测试文件，实际启动应用服务器并处理请求
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import TreeSitterServer from '../../src/server';

// 测试数据接口
interface TestData {
  language: string;
  code: string;
  query?: string;
  queries?: string[];
}

// 测试结果接口
interface TestResult {
  testName: string;
  requestData: TestData;
  responseData: any;
  statusCode: number;
  duration: number;
  timestamp: string;
}

describe('Tree-sitter API E2E Tests', () => {
  let server: TreeSitterServer;
  let baseURL: string;
  let originalExit: typeof process.exit;
  const testResults: TestResult[] = [];

  // 在所有测试开始前启动服务器
  beforeAll(async () => {
    // 保存原始的process.exit函数
    originalExit = process.exit;
    
    // 模拟process.exit以避免Jest工作进程崩溃
    process.exit = jest.fn() as any;
    
    // 创建服务器实例
    server = new TreeSitterServer();
    
    // 启动服务器
    server.start();
    
    // 设置基础URL
    const port = process.env['PORT'] || 3001;
    const host = process.env['HOST'] || 'localhost';
    baseURL = `http://${host}:${port}`;
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  // 在所有测试结束后关闭服务器并保存结果
  afterAll(async () => {
    if (server) {
      try {
        // 通过模拟SIGTERM信号来触发优雅关闭
        process.emit('SIGTERM' as any);
        
        // 等待服务器关闭
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn('Error during server shutdown:', error);
      }
    }
    
    // 恢复原始的process.exit函数
    process.exit = originalExit;

    // 保存测试结果到JSON文件
    saveTestResults();
  });

  // 保存测试结果到文件
  const saveTestResults = (): void => {
    try {
      const resultDir = path.join(__dirname, '..', 'result');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultFile = path.join(resultDir, `e2e-test-results-${timestamp}.json`);
      
      // 确保result目录存在
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }
      
      // 写入测试结果
      fs.writeFileSync(resultFile, JSON.stringify({
        testSuite: 'Tree-sitter API E2E Tests',
        timestamp: new Date().toISOString(),
        totalTests: testResults.length,
        results: testResults
      }, null, 2));
      
      console.log(`\n📄 测试结果已保存到: ${resultFile}`);
      
      // 也保存一个最新的结果文件
      const latestFile = path.join(resultDir, 'latest-e2e-results.json');
      fs.writeFileSync(latestFile, JSON.stringify({
        testSuite: 'Tree-sitter API E2E Tests',
        timestamp: new Date().toISOString(),
        totalTests: testResults.length,
        results: testResults
      }, null, 2));
      
    } catch (error) {
      console.error('保存测试结果失败:', error);
    }
  };

  // 读取测试数据文件
  const loadTestData = (fileName: string): TestData => {
    const filePath = path.join(__dirname, '..', 'data', fileName);
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  };

  // 辅助函数：检查是否为Axios错误
  const isAxiosError = (error: any): error is any => {
    return error && error.isAxiosError === true;
  };

  // 执行测试请求并记录结果
  const executeTestRequest = async (
    testName: string,
    testData: TestData,
    requestFn: () => Promise<any>
  ): Promise<any> => {
    const startTime = Date.now();
    
    try {
      const response = await requestFn();
      const duration = Date.now() - startTime;
      
      // 记录成功的测试结果
      const testResult: TestResult = {
        testName,
        requestData: testData,
        responseData: response.data,
        statusCode: response.status,
        duration,
        timestamp: new Date().toISOString()
      };
      
      testResults.push(testResult);
      return response;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // 记录失败的测试结果
      const testResult: TestResult = {
        testName,
        requestData: testData,
        responseData: error.response?.data || { error: error.message },
        statusCode: error.response?.status || 0,
        duration,
        timestamp: new Date().toISOString()
      };
      
      testResults.push(testResult);
      throw error;
    }
  };

  // 测试JavaScript解析
  test('should parse JavaScript code successfully', async () => {
    const testData = loadTestData('javascript_test.json');
    
    const response = await executeTestRequest(
      'JavaScript代码解析测试',
      testData,
      async () => axios.post(`${baseURL}/api/parse`, testData)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    
    // 检查响应数据结构 - 根据实际API响应调整
    if (Array.isArray(response.data.data)) {
      // 如果data直接是matches数组
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    } else {
      // 如果data是包含matches的对象
      expect(response.data.data).toHaveProperty('matches');
      expect(Array.isArray(response.data.data.matches)).toBe(true);
    }
  });

  // 测试Python解析
  test('should parse Python code successfully', async () => {
    const testData = loadTestData('python_test.json');
    
    const response = await executeTestRequest(
      'Python代码解析测试',
      testData,
      async () => axios.post(`${baseURL}/api/parse`, testData)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    
    // 检查响应数据结构 - 根据实际API响应调整
    if (Array.isArray(response.data.data)) {
      // 如果data直接是matches数组
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    } else {
      // 如果data是包含matches的对象
      expect(response.data.data).toHaveProperty('matches');
      expect(Array.isArray(response.data.data.matches)).toBe(true);
    }
  });

  // 测试Java解析
  test('should parse Java code successfully', async () => {
    const testData = loadTestData('java_test.json');
    
    const response = await executeTestRequest(
      'Java代码解析测试',
      testData,
      async () => axios.post(`${baseURL}/api/parse`, testData)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    
    // 检查响应数据结构 - 根据实际API响应调整
    if (Array.isArray(response.data.data)) {
      // 如果data直接是matches数组
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    } else {
      // 如果data是包含matches的对象
      expect(response.data.data).toHaveProperty('matches');
      expect(Array.isArray(response.data.data.matches)).toBe(true);
    }
  });

  // 测试错误处理 - 不支持的语言
  test('should handle unsupported language error', async () => {
    const testData = loadTestData('error_test.json');
    
    try {
      const response = await executeTestRequest(
        '不支持语言错误处理测试',
        testData,
        async () => axios.post(`${baseURL}/api/parse`, testData)
      );
      
      // 应该返回422错误（Unprocessable Entity）
      expect(response.status).toBe(422);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
      expect(Array.isArray(response.data.errors)).toBe(true);
      expect(response.data.errors?.length).toBeGreaterThan(0);
    } catch (error: any) {
      if (isAxiosError(error) && error.response) {
        // 如果返回了错误响应，验证错误格式
        expect(error.response.status).toBe(422);
        expect(error.response.data).toHaveProperty('success', false);
        expect(error.response.data).toHaveProperty('errors');
        return;
      }
      throw error;
    }
  });

  // 测试健康检查端点
  test('should return health status', async () => {
    const response = await executeTestRequest(
      '健康检查端点测试',
      {} as TestData,
      async () => axios.get(`${baseURL}/api/health`)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('status');
    expect(['healthy', 'warning', 'error']).toContain(response.data.data.status);
    expect(response.data.data).toHaveProperty('supportedLanguages');
    expect(Array.isArray(response.data.data.supportedLanguages)).toBe(true);
  });

  // 测试语言列表端点
  test('should return supported languages', async () => {
    const response = await executeTestRequest(
      '语言列表端点测试',
      {} as TestData,
      async () => axios.get(`${baseURL}/api/languages`)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('languages');
    expect(Array.isArray(response.data.data.languages)).toBe(true);
    
    // 验证至少有一些支持的语言
    expect(response.data.data.languages.length).toBeGreaterThan(0);
  });

  // 测试根路径
  test('should return root endpoint info', async () => {
    const response = await executeTestRequest(
      '根路径端点测试',
      {} as TestData,
      async () => axios.get(`${baseURL}/`)
    );
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('name', 'Tree-sitter API');
    expect(response.data).toHaveProperty('version');
    expect(response.data).toHaveProperty('status', 'running');
    expect(response.data).toHaveProperty('timestamp');
  });
});