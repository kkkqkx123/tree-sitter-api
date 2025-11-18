/**
 * resourceGuard 中间件单元测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  resourceGuard,
  memoryMonitor,
  rateLimiter,
  healthCheck,
} from '../resourceGuard';
import { MemoryMonitor } from '../../core/MemoryMonitor';
import { ResourceCleaner } from '../../core/ResourceCleaner';
import { CleanupStrategy } from '../../config/memory';
import { MemoryStatus } from '../../types/errors';

// 模拟 MemoryMonitor
const mockMemoryMonitor = {
  checkMemory: jest.fn(),
  shouldCleanup: jest.fn(),
  getMemoryStats: jest.fn(),
} as unknown as jest.Mocked<MemoryMonitor>;

// 模拟 ResourceCleaner
const mockResourceCleaner = {
  performCleanup: jest.fn(),
} as unknown as jest.Mocked<ResourceCleaner>;

// 模拟 ErrorHandler
const mockErrorHandler = {
  getErrorStats: jest.fn(),
};

// 模拟 Logger
jest.mock('@/utils/Logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('resourceGuard 中间件', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let middleware: ReturnType<typeof resourceGuard>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建模拟的请求和响应对象
    mockRequest = {
      headers: {
        'content-length': '1000',
      },
      body: {
        code: 'function test() { return "hello"; }',
      },
      method: 'POST',
      path: '/api/parse',
      ip: '127.0.0.1',
      setTimeout: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      on: jest.fn(),
      headersSent: false,
    };

    mockNext = jest.fn();

    // 创建中间件实例
    middleware = resourceGuard(mockMemoryMonitor, mockResourceCleaner);
  });

  describe('resourceGuard', () => {
    it('应该允许正常请求通过', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockMemoryMonitor.shouldCleanup.mockReturnValue(false);

      // 模拟 process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 104857600, // 100MB in bytes
        heapTotal: 209715200, // 200MB in bytes
        heapUsed: 157286400, // 150MB in bytes
        external: 52428800, // 50MB in bytes
        arrayBuffers: 10485760, // 10MB in bytes
      }) as any;

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该拒绝过大的请求', async () => {
      // 准备测试数据
      mockRequest.headers = {
        'content-length': '6000000', // 6MB，超过默认5MB限制
      };

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Request too large: 6000000 bytes (max: 5242880 bytes)'],
        timestamp: expect.any(String),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该拒绝过长的代码', async () => {
      // 准备测试数据
      mockRequest.body = {
        code: 'a'.repeat(110000), // 超过默认100KB限制
      };

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Code too long: 110000 characters (max: 102400 characters)'],
        timestamp: expect.any(String),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该在内存状态严重时尝试清理', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'critical',
        heapUsed: 350,
        heapTotal: 400,
        rss: 300,
        external: 100,
        trend: 'increasing',
      };

      const mockCleanupResult = {
        strategy: 'emergency',
        memoryFreed: 50,
        success: true,
        duration: 100,
      };

      mockMemoryMonitor.checkMemory
        .mockReturnValueOnce(mockMemoryStatus) // 第一次检查是critical
        .mockReturnValueOnce({ ...mockMemoryStatus, level: 'warning' }); // 清理后是warning
      mockResourceCleaner.performCleanup.mockResolvedValue(mockCleanupResult);

      // 模拟 process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 314572800, // 300MB in bytes
        heapTotal: 419430400, // 400MB in bytes
        heapUsed: 367001600, // 350MB in bytes
        external: 104857600, // 100MB in bytes
        arrayBuffers: 10485760, // 10MB in bytes
      }) as any;

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResourceCleaner.performCleanup).toHaveBeenCalledWith(
        CleanupStrategy.EMERGENCY,
      );
      expect(mockNext).toHaveBeenCalled();

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该在清理后内存仍然严重时拒绝请求', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'critical',
        heapUsed: 350,
        heapTotal: 400,
        rss: 300,
        external: 100,
        trend: 'increasing',
      };

      const mockCleanupResult = {
        strategy: 'emergency',
        memoryFreed: 10,
        success: true,
        duration: 100,
      };

      mockMemoryMonitor.checkMemory
        .mockReturnValueOnce(mockMemoryStatus) // 第一次检查是critical
        .mockReturnValueOnce(mockMemoryStatus); // 清理后仍然是critical
      mockResourceCleaner.performCleanup.mockResolvedValue(mockCleanupResult);

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResourceCleaner.performCleanup).toHaveBeenCalledWith(
        CleanupStrategy.EMERGENCY,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service temporarily unavailable: out of memory'],
        timestamp: expect.any(String),
        memoryStatus: mockMemoryStatus,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该限制并发请求数', async () => {
      // 创建中间件实例，设置最大并发请求数为1
      const limitedMiddleware = resourceGuard(
        mockMemoryMonitor,
        mockResourceCleaner,
        {
          maxConcurrentRequests: 1,
        },
      );

      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockMemoryMonitor.shouldCleanup.mockReturnValue(false);

      // 模拟 process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 104857600, // 100MB in bytes
        heapTotal: 209715200, // 200MB in bytes
        heapUsed: 157286400, // 150MB in bytes
        external: 52428800, // 50MB in bytes
        arrayBuffers: 10485760, // 10MB in bytes
      }) as any;

      // 模拟响应的finish事件
      let finishCallback: (() => void) | undefined;
      mockResponse.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback as () => void;
        }
      });

      // 执行第一个请求
      await limitedMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockNext).toHaveBeenCalled();

      // 重置mockNext
      mockNext.mockClear();

      // 执行第二个请求（应该被拒绝）
      await limitedMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          'Service temporarily unavailable: too many concurrent requests',
        ],
        timestamp: expect.any(String),
      });
      expect(mockNext).not.toHaveBeenCalled();

      // 模拟第一个请求完成
      if (finishCallback) {
        finishCallback();
      }

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该设置请求超时', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockMemoryMonitor.shouldCleanup.mockReturnValue(false);

      // 模拟 process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 104857600, // 100MB in bytes
        heapTotal: 209715200, // 200MB in bytes
        heapUsed: 157286400, // 150MB in bytes
        external: 52428800, // 50MB in bytes
        arrayBuffers: 10485760, // 10MB in bytes
      }) as any;

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockRequest.setTimeout).toHaveBeenCalledWith(
        30000,
        expect.any(Function),
      );

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该在内存增长过高时触发清理', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      const mockCleanupResult = {
        strategy: 'aggressive',
        memoryFreed: 50,
        success: true,
        duration: 100,
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockMemoryMonitor.shouldCleanup.mockReturnValue(true);
      mockResourceCleaner.performCleanup.mockResolvedValue(mockCleanupResult);

      // 模拟 process.memoryUsage - 第一次返回低内存，第二次返回高内存
      const originalMemoryUsage = process.memoryUsage;
      let callCount = 0;
      process.memoryUsage = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 第一次调用（请求开始）
          return {
            rss: 104857600, // 100MB in bytes
            heapTotal: 209715200, // 200MB in bytes
            heapUsed: 157286400, // 150MB in bytes
            external: 52428800, // 50MB in bytes
            arrayBuffers: 10485760, // 10MB in bytes
          };
        } else {
          // 第二次调用（响应完成）
          return {
            rss: 104857600, // 100MB in bytes
            heapTotal: 209715200, // 200MB in bytes
            heapUsed: 268435456, // 256MB in bytes (增长超过10MB)
            external: 52428800, // 50MB in bytes
            arrayBuffers: 10485760, // 10MB in bytes
          };
        }
      }) as any;

      // 模拟响应的finish事件
      let finishCallback: (() => void) | undefined;
      mockResponse.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback as () => void;
        }
      });

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 模拟响应完成
      if (finishCallback) {
        finishCallback();
      }

      // 验证结果
      expect(mockResourceCleaner.performCleanup).toHaveBeenCalledWith(
        CleanupStrategy.AGGRESSIVE,
      );

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockMemoryMonitor.checkMemory.mockImplementation(() => {
        throw new Error('Memory check error');
      });

      // 执行测试
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('memoryMonitor 中间件', () => {
    let memoryMiddleware: ReturnType<typeof memoryMonitor>;

    beforeEach(() => {
      memoryMiddleware = memoryMonitor(mockMemoryMonitor);
    });

    it('应该添加内存状态到请求对象', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);

      // 执行测试
      memoryMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect((mockRequest as any).memoryStatus).toEqual(mockMemoryStatus);
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该在内存状态严重时添加警告头', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'critical',
        heapUsed: 350,
        heapTotal: 400,
        rss: 300,
        external: 100,
        trend: 'increasing',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);

      // 执行测试
      memoryMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Memory-Status',
        'critical',
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该在内存状态警告时添加警告头', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'warning',
        heapUsed: 250,
        heapTotal: 300,
        rss: 200,
        external: 75,
        trend: 'increasing',
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);

      // 执行测试
      memoryMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // 验证结果
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Memory-Status',
        'warning',
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('rateLimiter 中间件', () => {
    it('应该允许正常请求通过', () => {
      // 创建限流中间件
      const limiter = rateLimiter(10, 60000); // 10请求/分钟

      // 执行测试
      limiter(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        10,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        9,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number),
      );
    });

    it('应该拒绝超过限制的请求', () => {
      // 创建限流中间件
      const limiter = rateLimiter(1, 60000); // 1请求/分钟

      // 执行第一个请求
      limiter(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // 重置mockNext
      mockNext.mockClear();

      // 执行第二个请求（应该被拒绝）
      limiter(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Too many requests: 2/1 per 60s'],
        timestamp: expect.any(String),
        retryAfter: expect.any(Number),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('应该在不同IP之间分别计数', () => {
      // 创建限流中间件
      const limiter = rateLimiter(1, 60000); // 1请求/分钟

      // 创建两个不同IP的请求
      const request1 = { ...mockRequest, ip: '192.168.1.1' };
      const request2 = { ...mockRequest, ip: '192.168.1.2' };

      // 执行测试
      limiter(request1 as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // 重置mock
      mockNext.mockClear();
      (mockResponse.status as jest.Mock).mockClear();
      (mockResponse.json as jest.Mock).mockClear();

      limiter(request2 as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该处理未知IP', () => {
      // 创建限流中间件
      const limiter = rateLimiter(1, 60000); // 1请求/分钟

      // 创建没有IP的请求
      const request = { ...mockRequest };
      delete request.ip;
      (request as any).connection = { remoteAddress: undefined };

      // 执行测试
      limiter(request as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('healthCheck 中间件', () => {
    let healthMiddleware: ReturnType<typeof healthCheck>;

    beforeEach(() => {
      healthMiddleware = healthCheck(mockMemoryMonitor, mockErrorHandler);
    });

    it('应该返回健康状态', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      const mockErrorStats = {
        totalErrors: 5,
        recentErrors: 2,
        errorCounts: {} as any,
        mostCommonError: null,
        errorHistory: [],
      };

      const mockMemoryStats = {
        current: 150,
        average: 140,
        peak: 160,
        minimum: 130,
        trend: 'stable' as any,
        history: [130, 140, 150, 140, 150],
        historyLength: 5,
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockErrorHandler.getErrorStats.mockReturnValue(mockErrorStats);
      mockMemoryMonitor.getMemoryStats.mockReturnValue(mockMemoryStats);

      // 执行测试
      healthMiddleware(mockRequest as Request, mockResponse as Response);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'healthy',
        memory: {
          ...mockMemoryStatus,
          stats: mockMemoryStats,
        },
        errors: mockErrorStats,
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        version: expect.any(String),
      });
    });

    it('应该在内存状态严重时返回错误状态', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'critical',
        heapUsed: 350,
        heapTotal: 400,
        rss: 300,
        external: 100,
        trend: 'increasing',
      };

      const mockErrorStats = {
        totalErrors: 5,
        recentErrors: 2,
        errorCounts: {} as any,
        mostCommonError: null,
        errorHistory: [],
      };

      const mockMemoryStats = {
        current: 350,
        average: 340,
        peak: 360,
        minimum: 330,
        trend: 'increasing' as any,
        history: [330, 340, 350, 340, 350],
        historyLength: 5,
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockErrorHandler.getErrorStats.mockReturnValue(mockErrorStats);
      mockMemoryMonitor.getMemoryStats.mockReturnValue(mockMemoryStats);

      // 执行测试
      healthMiddleware(mockRequest as Request, mockResponse as Response);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        memory: {
          ...mockMemoryStatus,
          stats: mockMemoryStats,
        },
        errors: mockErrorStats,
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        version: expect.any(String),
      });
    });

    it('应该在错误数量高时返回警告状态', () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'normal',
        heapUsed: 150,
        heapTotal: 200,
        rss: 100,
        external: 50,
        trend: 'stable',
      };

      const mockErrorStats = {
        totalErrors: 15,
        recentErrors: 8,
        errorCounts: {} as any,
        mostCommonError: null,
        errorHistory: [],
      };

      const mockMemoryStats = {
        current: 150,
        average: 140,
        peak: 160,
        minimum: 130,
        trend: 'stable' as any,
        history: [130, 140, 150, 140, 150],
        historyLength: 5,
      };

      mockMemoryMonitor.checkMemory.mockReturnValue(mockMemoryStatus);
      mockErrorHandler.getErrorStats.mockReturnValue(mockErrorStats);
      mockMemoryMonitor.getMemoryStats.mockReturnValue(mockMemoryStats);

      // 执行测试
      healthMiddleware(mockRequest as Request, mockResponse as Response);

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'warning',
        memory: {
          ...mockMemoryStatus,
          stats: mockMemoryStats,
        },
        errors: mockErrorStats,
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        version: expect.any(String),
      });
    });
  });
});
