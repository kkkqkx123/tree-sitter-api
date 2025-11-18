/**
 * validation 中间件单元测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateParseRequest,
  validateRequest,
  requestSizeLimit,
  ConcurrencyLimiter,
  defaultConcurrencyLimiter,
} from '../validation';
import { ParseRequest } from '../../types/api';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../../types/errors';
import { EnvConfig } from '../../config/env';

// 模拟 Logger
jest.mock('@/utils/Logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// 模拟 EnvConfig
jest.mock('@/config/env', () => ({
  EnvConfig: {
    MAX_CODE_LENGTH: 1000,
    MAX_REQUEST_SIZE: '5mb',
  },
}));

describe('validation middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id',
      },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('validateParseRequest', () => {
    it('应该验证有效的请求并调用next', () => {
      // 准备测试数据
      const validBody: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      mockRequest.body = validBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('应该拒绝没有请求体的请求', () => {
      // 准备测试数据
      mockRequest.body = null;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Request body is required'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝缺少language字段的请求', () => {
      // 准备测试数据
      const invalidBody = {
        code: 'function test() { return "hello"; }',
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language (string required)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝language字段不是字符串的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 123,
        code: 'function test() { return "hello"; }',
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language (string required)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝缺少code字段的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: code (string required)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝code字段不是字符串的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 123,
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: code (string required)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝无效的language格式', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'invalid language!',
        code: 'function test() { return "hello"; }',
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          'Invalid language format. Only alphanumeric characters, hyphens and underscores are allowed',
        ],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝超过最大长度的代码', () => {
      // 准备测试数据
      const longCode = 'a'.repeat(1001); // 超过 MAX_CODE_LENGTH (1000)
      const invalidBody = {
        language: 'javascript',
        code: longCode,
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Code length exceeds maximum allowed size of 1000 bytes'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝query字段不是字符串的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: 123,
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Invalid field: query (string expected)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝queries字段不是数组的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        queries: 'not an array',
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Invalid field: queries (array expected)'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝queries数组中包含非字符串元素的请求', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        queries: ['(function_declaration) @func', 123],
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Invalid query at index 1: string expected'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝查询数量超过限制的请求', () => {
      // 准备测试数据
      const manyQueries = Array(11).fill('(function_declaration) @func'); // 11个查询，超过限制
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        queries: manyQueries,
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Too many queries. Maximum allowed is 10, got 11'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝空的查询', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '   ', // 只有空格
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Empty query in field: query'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝括号不平衡的查询', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration @func', // 缺少右括号
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Unbalanced parentheses in query: query'],
        timestamp: expect.any(String),
      });
    });

    it('应该拒绝没有@符号的查询', () => {
      // 准备测试数据
      const invalidBody = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration)', // 没有@符号
      };

      mockRequest.body = invalidBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          'Query must contain at least one capture pattern with @ symbol: query',
        ],
        timestamp: expect.any(String),
      });
    });

    it('应该验证有效的queries数组', () => {
      // 准备测试数据
      const validBody: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        queries: ['(function_declaration) @func', '(identifier) @id'],
      };

      mockRequest.body = validBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('应该在没有请求ID时使用默认值', () => {
      // 准备测试数据
      mockRequest.headers = {};
      const validBody: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      mockRequest.body = validBody;

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该处理非TreeSitterError的错误', () => {
      // 准备测试数据
      mockRequest.body = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
      };

      // 模拟一个非TreeSitterError的错误
      const originalEnvConfig = EnvConfig.MAX_CODE_LENGTH;
      (EnvConfig as any).MAX_CODE_LENGTH = null; // 这会导致一个TypeError

      // 执行测试
      validateParseRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 恢复原始值
      (EnvConfig as any).MAX_CODE_LENGTH = originalEnvConfig;

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      // 由于错误被捕获并转换为TreeSitterError，我们检查错误消息是否包含相关信息
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.arrayContaining([expect.stringContaining('null')]),
        timestamp: expect.any(String),
      });
    });
  });

  describe('validateRequest', () => {
    it('应该调用验证函数并在成功时调用next', () => {
      // 准备测试数据
      const validationFn = jest.fn();
      const middleware = validateRequest(validationFn);

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(validationFn).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('应该处理TreeSitterError', () => {
      // 准备测试数据
      const error = new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Test validation error',
      );
      const validationFn = jest.fn().mockImplementation(() => {
        throw error;
      });
      const middleware = validateRequest(validationFn);

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(validationFn).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Test validation error'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理非TreeSitterError的错误', () => {
      // 准备测试数据
      const validationFn = jest.fn().mockImplementation(() => {
        throw new Error('Generic error');
      });
      const middleware = validateRequest(validationFn);

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(validationFn).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Validation failed'],
        timestamp: expect.any(String),
      });
    });

    it('应该在没有请求ID时使用默认值', () => {
      // 准备测试数据
      mockRequest.headers = {};
      const validationFn = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const middleware = validateRequest(validationFn);

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('requestSizeLimit', () => {
    it('应该在请求大小未超过限制时调用next', () => {
      // 准备测试数据
      mockRequest.headers = {
        'content-length': '1000', // 小于默认限制
      };

      const middleware = requestSizeLimit();

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('应该拒绝超过大小限制的请求', () => {
      // 准备测试数据
      mockRequest.headers = {
        'content-length': '6000000', // 大于默认限制 (5MB)
      };

      const middleware = requestSizeLimit();

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          `Request size 6000000 exceeds maximum allowed size of 5242880 bytes`,
        ],
        timestamp: expect.any(String),
      });
    });

    it('应该使用自定义大小限制', () => {
      // 准备测试数据
      mockRequest.headers = {
        'content-length': '2000', // 大于自定义限制
      };

      const middleware = requestSizeLimit(1000);

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          `Request size 2000 exceeds maximum allowed size of 1000 bytes`,
        ],
        timestamp: expect.any(String),
      });
    });

    it('应该在没有content-length头时调用next', () => {
      // 准备测试数据
      mockRequest.headers = {};

      const middleware = requestSizeLimit();

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('应该在没有请求ID时使用默认值', () => {
      // 准备测试数据
      mockRequest.headers = {
        'content-length': '6000000', // 大于默认限制
      };

      const middleware = requestSizeLimit();

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(413);
    });
  });

  describe('ConcurrencyLimiter', () => {
    let limiter: ConcurrencyLimiter;

    beforeEach(() => {
      limiter = new ConcurrencyLimiter(2); // 设置较小的限制以便测试
    });

    it('应该在并发请求未超过限制时调用next', () => {
      // 执行测试
      const middleware = limiter.middleware();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(limiter.getActiveCount()).toBe(1);
    });

    it('应该拒绝超过并发限制的请求', () => {
      // 准备测试数据
      const middleware = limiter.middleware();

      // 创建新的请求和响应对象，避免模拟函数的干扰
      const mockRequest1 = {
        ...mockRequest,
        headers: { 'x-request-id': 'req-1' },
      };
      const mockRequest2 = {
        ...mockRequest,
        headers: { 'x-request-id': 'req-2' },
      };
      const mockRequest3 = {
        ...mockRequest,
        headers: { 'x-request-id': 'req-3' },
      };

      const mockResponse1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      const mockResponse2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      const mockResponse3 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      // 添加两个请求以达到限制
      middleware(
        mockRequest1 as Request,
        mockResponse1 as unknown as Response,
        jest.fn(),
      );
      middleware(
        mockRequest2 as Request,
        mockResponse2 as unknown as Response,
        jest.fn(),
      );

      // 重置模拟函数
      const mockNext3 = jest.fn();

      // 第三个请求应该被拒绝
      middleware(
        mockRequest3 as Request,
        mockResponse3 as unknown as Response,
        mockNext3,
      );

      // 验证结果
      expect(mockNext3).not.toHaveBeenCalled();
      expect(mockResponse3.status).toHaveBeenCalledWith(429);
      expect(mockResponse3.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          'Server is busy. Maximum concurrent requests (2) exceeded. Please try again later.',
        ],
        timestamp: expect.any(String),
      });
      expect(limiter.getActiveCount()).toBe(2);
    });

    it('应该在请求完成时减少活动请求数', () => {
      // 准备测试数据
      const middleware = limiter.middleware();
      const mockResponseWithFinish = {
        ...mockResponse,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            // 立即调用回调以模拟请求完成
            callback();
          }
        }),
      };

      // 执行测试
      middleware(
        mockRequest as Request,
        mockResponseWithFinish as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(limiter.getActiveCount()).toBe(0); // 应该在finish事件后减少
    });

    it('应该在请求关闭时减少活动请求数', () => {
      // 准备测试数据
      const middleware = limiter.middleware();
      const mockResponseWithClose = {
        ...mockResponse,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // 立即调用回调以模拟请求关闭
            callback();
          }
        }),
      };

      // 执行测试
      middleware(
        mockRequest as Request,
        mockResponseWithClose as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(limiter.getActiveCount()).toBe(0); // 应该在close事件后减少
    });

    it('应该在没有请求ID时生成一个', () => {
      // 准备测试数据
      mockRequest.headers = {};
      const middleware = limiter.middleware();

      // 执行测试
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(limiter.getActiveCount()).toBe(1);
    });

    it('应该返回正确的最大并发数', () => {
      // 验证结果
      expect(limiter.getMaxConcurrent()).toBe(2);
    });

    it('应该正确跟踪活动请求数', () => {
      // 准备测试数据
      const middleware = limiter.middleware();

      // 创建新的请求和响应对象，避免模拟函数的干扰
      const mockRequest1 = {
        ...mockRequest,
        headers: { 'x-request-id': 'req-1' },
      };
      const mockRequest2 = {
        ...mockRequest,
        headers: { 'x-request-id': 'req-2' },
      };

      const mockResponse1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      const mockResponse2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };

      // 执行测试
      expect(limiter.getActiveCount()).toBe(0);

      middleware(
        mockRequest1 as Request,
        mockResponse1 as unknown as Response,
        jest.fn(),
      );
      expect(limiter.getActiveCount()).toBe(1);

      middleware(
        mockRequest2 as Request,
        mockResponse2 as unknown as Response,
        jest.fn(),
      );
      expect(limiter.getActiveCount()).toBe(2);
    });
  });

  describe('defaultConcurrencyLimiter', () => {
    it('应该有一个默认的并发限制', () => {
      // 验证结果
      expect(defaultConcurrencyLimiter.getMaxConcurrent()).toBe(10);
    });
  });
});
