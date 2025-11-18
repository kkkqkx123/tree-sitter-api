/**
 * globalErrorHandler 中间件单元测试
 */

import { Request, Response, NextFunction } from 'express';
import { 
  globalErrorHandler, 
  asyncErrorHandler, 
  errorLogger, 
  notFoundHandler 
} from '../globalErrorHandler';
import { ErrorHandler } from '@/errors/ErrorHandler';
import { RecoveryStrategy } from '@/errors/RecoveryStrategy';
import { TreeSitterError, ErrorType, ErrorSeverity } from '@/types/errors';

// 模拟 ErrorHandler
const mockErrorHandler = {
  handleError: jest.fn(),
  getErrorStats: jest.fn(),
} as unknown as jest.Mocked<ErrorHandler>;

// 模拟 RecoveryStrategy
const mockRecoveryStrategy = {
  attemptRecovery: jest.fn(),
} as unknown as jest.Mocked<RecoveryStrategy>;

// 模拟 Logger
jest.mock('@/utils/Logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('globalErrorHandler 中间件', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let middleware: ReturnType<typeof globalErrorHandler>;
  let testError: Error;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建模拟的请求和响应对象
    mockRequest = {
      method: 'POST',
      path: '/api/parse',
      headers: {
        'x-request-id': 'test-request-id',
      },
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // 创建中间件实例
    middleware = globalErrorHandler(mockErrorHandler, mockRecoveryStrategy);

    // 创建测试错误
    testError = new Error('Test error');
  });

  describe('globalErrorHandler', () => {
    it('应该处理基本错误', async () => {
      // 准备测试数据
      const treeSitterError = new TreeSitterError(
        ErrorType.INTERNAL_ERROR,
        ErrorSeverity.MEDIUM,
        'Test error message'
      );

      const recoveryResult = {
        success: true,
        action: 'test_action',
        message: 'Recovery successful',
      };

      mockErrorHandler.handleError.mockReturnValue(treeSitterError);
      mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

      // 执行测试
      await middleware(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(testError, 'POST /api/parse');
      expect(mockRecoveryStrategy.attemptRecovery).toHaveBeenCalledWith(treeSitterError);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Test error message'],
        errorType: ErrorType.INTERNAL_ERROR,
        severity: ErrorSeverity.MEDIUM,
        timestamp: expect.any(String),
        requestId: 'test-request-id',
        recovery: {
          attempted: true,
          action: 'test_action',
          message: 'Recovery successful',
        },
      });
    });

    it('应该在恢复失败时记录错误', async () => {
      // 准备测试数据
      const treeSitterError = new TreeSitterError(
        ErrorType.MEMORY_ERROR,
        ErrorSeverity.HIGH,
        'Memory error'
      );

      const recoveryResult = {
        success: false,
        action: 'test_action',
        message: 'Recovery failed',
      };

      mockErrorHandler.handleError.mockReturnValue(treeSitterError);
      mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

      // 执行测试
      await middleware(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockRecoveryStrategy.attemptRecovery).toHaveBeenCalledWith(treeSitterError);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Memory error'],
        errorType: ErrorType.MEMORY_ERROR,
        severity: ErrorSeverity.HIGH,
        timestamp: expect.any(String),
        requestId: 'test-request-id',
        recovery: {
          attempted: false,
          reason: 'Recovery not applicable or failed',
        },
      });
    });

    it('应该在开发环境中包含更多错误详情', async () => {
      // 准备测试数据
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const treeSitterError = new TreeSitterError(
        ErrorType.PARSE_ERROR,
        ErrorSeverity.MEDIUM,
        'Parse error',
        { detail: 'Additional error detail' }
      );

      const recoveryResult = {
        success: true,
        action: 'test_action',
        message: 'Recovery successful',
      };

      mockErrorHandler.handleError.mockReturnValue(treeSitterError);
      mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

      // 执行测试
      await middleware(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Parse error'],
        errorType: ErrorType.PARSE_ERROR,
        severity: ErrorSeverity.MEDIUM,
        timestamp: expect.any(String),
        requestId: 'test-request-id',
        recovery: {
          attempted: true,
          action: 'test_action',
          message: 'Recovery successful',
        },
        details: { detail: 'Additional error detail' },
        stack: expect.any(String),
      });

      // 恢复环境变量
      process.env['NODE_ENV'] = originalEnv;
    });

    it('应该在没有请求ID时生成新的ID', async () => {
      // 准备测试数据
      const request = {
        ...mockRequest,
        headers: {},
      };
      
      const treeSitterError = new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        'Validation error'
      );

      const recoveryResult = {
        success: true,
        action: 'test_action',
        message: 'Recovery successful',
      };

      mockErrorHandler.handleError.mockReturnValue(treeSitterError);
      mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

      // 执行测试
      await middleware(testError, request as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Validation error'],
        errorType: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        timestamp: expect.any(String),
        requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
        recovery: {
          attempted: true,
          action: 'test_action',
          message: 'Recovery successful',
        },
      });
    });

    it('应该根据错误类型返回正确的HTTP状态码', async () => {
      // 测试不同错误类型的状态码
      const errorTypes = [
        { type: ErrorType.VALIDATION_ERROR, expectedStatus: 400 },
        { type: ErrorType.UNSUPPORTED_LANGUAGE, expectedStatus: 404 },
        { type: ErrorType.PARSE_ERROR, expectedStatus: 422 },
        { type: ErrorType.QUERY_ERROR, expectedStatus: 422 },
        { type: ErrorType.MEMORY_ERROR, expectedStatus: 503 },
        { type: ErrorType.RESOURCE_ERROR, expectedStatus: 503 },
        { type: ErrorType.TIMEOUT_ERROR, expectedStatus: 503 },
        { type: ErrorType.INTERNAL_ERROR, expectedStatus: 500 },
      ];

      for (const { type, expectedStatus } of errorTypes) {
        // 准备测试数据
        const treeSitterError = new TreeSitterError(
          type,
          ErrorSeverity.MEDIUM,
          `${type} error`
        );

        const recoveryResult = {
          success: true,
          action: 'test_action',
          message: 'Recovery successful',
        };

        mockErrorHandler.handleError.mockReturnValue(treeSitterError);
        mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

        // 重置mock
        jest.clearAllMocks();
        
        // 重新设置mock
        mockErrorHandler.handleError.mockReturnValue(treeSitterError);
        mockRecoveryStrategy.attemptRecovery.mockResolvedValue(recoveryResult);

        // 执行测试
        await middleware(testError, mockRequest as Request, mockResponse as Response, mockNext);

        // 验证结果
        expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus);
      }
    });
  });

  describe('asyncErrorHandler', () => {
    it('应该捕获异步函数中的错误', async () => {
      // 准备测试数据
      const asyncFunction = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrappedFunction = asyncErrorHandler(asyncFunction);

      // 执行测试
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(asyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('应该允许成功的异步函数执行', async () => {
      // 准备测试数据
      const asyncFunction = jest.fn().mockResolvedValue('Success');
      const wrappedFunction = asyncErrorHandler(asyncFunction);

      // 执行测试
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(asyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('errorLogger', () => {
    it('应该记录请求开始', () => {
      // 准备测试数据
      const response = {
        ...mockResponse,
        on: jest.fn(),
        statusCode: 200,
      };

      // 执行测试
      errorLogger(mockRequest as Request, response as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该在响应完成时记录请求信息', () => {
      // 准备测试数据
      let finishCallback: (() => void) | undefined;
      const response = {
        ...mockResponse,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            finishCallback = callback as () => void;
          }
        }),
        statusCode: 200,
      };

      // 执行测试
      errorLogger(mockRequest as Request, response as Response, mockNext);

      // 模拟响应完成
      if (finishCallback) {
        finishCallback();
      }

      // 验证结果
      expect(response.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('应该在错误响应时记录更多信息', () => {
      // 准备测试数据
      let finishCallback: (() => void) | undefined;
      const response = {
        ...mockResponse,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            finishCallback = callback as () => void;
          }
        }),
        statusCode: 500,
      };

      // 执行测试
      errorLogger(mockRequest as Request, response as Response, mockNext);

      // 模拟响应完成
      if (finishCallback) {
        finishCallback();
      }

      // 验证结果
      expect(response.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  describe('notFoundHandler', () => {
    it('应该返回404错误', () => {
      // 执行测试
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Route POST /api/parse not found'],
        errorType: ErrorType.VALIDATION_ERROR,
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
    });

    it('应该在没有请求ID时生成新的ID', () => {
      // 准备测试数据
      const request = {
        ...mockRequest,
        headers: {},
      };

      // 执行测试
      notFoundHandler(request as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Route POST /api/parse not found'],
        errorType: ErrorType.VALIDATION_ERROR,
        timestamp: expect.any(String),
        requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
      });
    });

    it('应该处理不同的请求方法和路径', () => {
      // 准备测试数据
      const request = {
        ...mockRequest,
        method: 'GET',
        path: '/unknown/route',
      };

      // 执行测试
      notFoundHandler(request as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Route GET /unknown/route not found'],
        errorType: ErrorType.VALIDATION_ERROR,
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
    });
  });
});