/**
 * healthController 单元测试
 */

import { Request, Response } from 'express';
import { createHealthController } from '../healthController';
import { TreeSitterService } from '../../core/TreeSitterService';
import { SupportedLanguage } from '../../types/treeSitter';
import { MemoryStatus, CleanupResult } from '../../types/errors';
import { MemoryTrend } from '../../config/memory';

// 模拟 TreeSitterService
const mockTreeSitterService = {
  getHealthStatus: jest.fn(),
  getDetailedStats: jest.fn(),
  getSupportedLanguages: jest.fn(),
  performCleanup: jest.fn(),
  resetStats: jest.fn(),
} as unknown as jest.Mocked<TreeSitterService>;

// 模拟 Logger
jest.mock('@/utils/Logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('healthController', () => {
  let healthController: ReturnType<typeof createHealthController>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    healthController = createHealthController(mockTreeSitterService);

    // 创建模拟的请求和响应对象
    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id',
      },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe('basicHealthCheck', () => {
    it('应该返回健康状态信息', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'healthy',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'healthy',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: [
            'javascript',
            'typescript',
            'python',
          ] as SupportedLanguage[],
          loadedLanguages: ['javascript', 'typescript'] as SupportedLanguage[],
          loadingLanguages: ['python'] as SupportedLanguage[],
          totalSupported: 3,
          totalLoaded: 2,
          totalLoading: 1,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
        'tsx',
        'python',
      ];

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      // 执行测试
      await healthController.basicHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          memory: {
            rss: 100,
            heapTotal: 200,
            heapUsed: 150,
            external: 50,
          },
          supportedLanguages: ['javascript', 'typescript', 'python'],
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        timestamp: expect.any(String),
      });
    });

    it('当健康状态为错误时应该返回503状态码', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'critical',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'critical',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'error' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: ['javascript'] as SupportedLanguage[],
          loadedLanguages: [] as SupportedLanguage[],
          loadingLanguages: ['javascript'] as SupportedLanguage[],
          totalSupported: 1,
          totalLoaded: 0,
          totalLoading: 1,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      // 执行测试
      await healthController.basicHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('当健康状态为警告时应该返回200状态码', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'warning',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'warning',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'warning' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: ['javascript'] as SupportedLanguage[],
          loadedLanguages: ['javascript'] as SupportedLanguage[],
          loadingLanguages: [] as SupportedLanguage[],
          totalSupported: 1,
          totalLoaded: 1,
          totalLoading: 0,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      // 执行测试
      await healthController.basicHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.getHealthStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      // 执行测试
      await healthController.basicHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });

    it('应该在没有请求ID时使用默认值', async () => {
      // 准备测试数据
      mockRequest.headers = {};
      const mockMemoryStatus: MemoryStatus = {
        level: 'healthy',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'healthy',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: [] as SupportedLanguage[],
          loadedLanguages: [] as SupportedLanguage[],
          loadingLanguages: [] as SupportedLanguage[],
          totalSupported: 0,
          totalLoaded: 0,
          totalLoading: 0,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([]);

      // 执行测试
      await healthController.basicHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('detailedHealthCheck', () => {
    it('应该返回详细的健康状态信息', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'healthy',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'healthy',
        threshold: 500,
        usage: 150,
      };

      const mockDetailedStats = {
        health: {
          status: 'healthy' as const,
          memory: mockMemoryStatus,
          parserPool: {
            totalPooled: 10,
            totalActive: 3,
            languageStats: {} as Record<SupportedLanguage, number>,
            memoryUsage: {
              estimatedParsers: 13,
              estimatedMemoryMB: 13,
            },
          },
          languageManager: {
            supportedLanguages: [
              'javascript',
              'typescript',
              'python',
            ] as SupportedLanguage[],
            loadedLanguages: [
              'javascript',
              'typescript',
            ] as SupportedLanguage[],
            loadingLanguages: ['python'] as SupportedLanguage[],
            totalSupported: 3,
            totalLoaded: 2,
            totalLoading: 1,
          },
          service: {
            requestCount: 100,
            errorCount: 5,
            errorRate: 5,
            activeResources: {
              trees: 2,
              queries: 3,
              parsers: 5,
            },
          },
          timestamp: '2023-01-01T00:00:00.000Z',
          },
          memory: {
          status: mockMemoryStatus,
          stats: {
            current: 150,
            average: 140,
            peak: 160,
            minimum: 130,
            trend: MemoryTrend.STABLE,
            history: [130, 140, 150, 140, 150],
            historyLength: 5,
          },
          process: {
            rss: 104857600,
            heapTotal: 209715200,
            heapUsed: 157286400,
            external: 52428800,
            arrayBuffers: 10485760,
          },
          recommendations: ['Memory usage is normal'],
          alerts: [],
          config: {
            thresholds: {
              WARNING: 300,
              CRITICAL: 450,
              MAXIMUM: 500,
            },
            limits: {
              MAX_REQUEST_SIZE: 5 * 1024 * 1024,
              MAX_CODE_LENGTH: 100 * 1024,
              MAX_CONCURRENT_REQUESTS: 10,
              PARSER_POOL_SIZE: 3,
              QUERY_TIMEOUT: 30000,
              MEMORY_HISTORY_SIZE: 10,
            },
          },
        },
        cleanup: {
          totalCleanups: 5,
          successfulCleanups: 4,
          failedCleanups: 1,
          totalMemoryFreed: 250,
          averageCleanupTime: 100,
          strategyStats: {
            basic: {
              count: 3,
              successRate: 1,
              avgMemoryFreed: 50,
            },
            aggressive: {
              count: 2,
              successRate: 0.5,
              avgMemoryFreed: 75,
            },
          },
          recentCleanups: [
            {
              strategy: 'basic',
              memoryFreed: 50,
              success: true,
              duration: 100,
            },
            {
              strategy: 'aggressive',
              memoryFreed: 75,
              success: true,
              duration: 150,
            },
          ] as CleanupResult[],
        },
      };

      mockTreeSitterService.getDetailedStats.mockReturnValue({
        ...mockDetailedStats,
        performance: {},
        statistics: {},
      });

      // 执行测试
      await healthController.detailedHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.getDetailedStats.mockImplementation(() => {
        throw new Error('Service error');
      });

      // 执行测试
      await healthController.detailedHealthCheck(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('memoryUsage', () => {
    it('应该返回内存使用情况', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'healthy',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'healthy',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: ['javascript'] as SupportedLanguage[],
          loadedLanguages: ['javascript'] as SupportedLanguage[],
          loadingLanguages: [] as SupportedLanguage[],
          totalSupported: 1,
          totalLoaded: 1,
          totalLoading: 0,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);

      // 模拟 process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: jest.fn().mockReturnValue(104857600), // 100MB in bytes
        heapTotal: jest.fn().mockReturnValue(209715200), // 200MB in bytes
        heapUsed: jest.fn().mockReturnValue(157286400), // 150MB in bytes
        external: jest.fn().mockReturnValue(52428800), // 50MB in bytes
        arrayBuffers: jest.fn().mockReturnValue(10485760), // 10MB in bytes
      }) as any;

      // 执行测试
      await healthController.memoryUsage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          current: {
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
            arrayBuffers: expect.any(Number),
          },
          status: mockHealthStatus.memory,
          history: mockHealthStatus.memory,
          gc: {
            available: expect.any(Boolean),
          },
        },
        timestamp: expect.any(String),
      });

      // 恢复原始方法
      process.memoryUsage = originalMemoryUsage;
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.getHealthStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      // 执行测试
      await healthController.memoryUsage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('serviceStats', () => {
    it('应该返回服务统计信息', async () => {
      // 准备测试数据
      const mockMemoryStatus: MemoryStatus = {
        level: 'healthy',
        rss: 100,
        heapTotal: 200,
        heapUsed: 150,
        external: 50,
        status: 'healthy',
        threshold: 500,
        usage: 150,
      };

      const mockHealthStatus = {
        status: 'healthy' as const,
        memory: mockMemoryStatus,
        parserPool: {
          totalPooled: 10,
          totalActive: 3,
          languageStats: {} as Record<SupportedLanguage, number>,
          memoryUsage: {
            estimatedParsers: 13,
            estimatedMemoryMB: 13,
          },
        },
        languageManager: {
          supportedLanguages: ['javascript'] as SupportedLanguage[],
          loadedLanguages: ['javascript'] as SupportedLanguage[],
          loadingLanguages: [] as SupportedLanguage[],
          totalSupported: 1,
          totalLoaded: 1,
          totalLoading: 0,
        },
        service: {
          requestCount: 100,
          errorCount: 5,
          errorRate: 5,
          activeResources: {
            trees: 2,
            queries: 3,
            parsers: 5,
          },
        },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      mockTreeSitterService.getHealthStatus.mockReturnValue(mockHealthStatus);

      // 执行测试
      await healthController.serviceStats(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          service: mockHealthStatus.service,
          parserPool: mockHealthStatus.parserPool,
          languageManager: mockHealthStatus.languageManager,
          uptime: expect.any(Number),
          process: {
            pid: expect.any(Number),
            version: expect.any(String),
            platform: expect.any(String),
            arch: expect.any(String),
          },
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.getHealthStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      // 执行测试
      await healthController.serviceStats(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('triggerCleanup', () => {
    it('应该触发内存清理', async () => {
      // 准备测试数据
      const mockCleanupResult = {
        memoryFreed: 50,
        duration: 100,
        success: true,
        freedMemory: 50,
        cleanedResources: 0,
      };

      mockTreeSitterService.performCleanup.mockResolvedValue(mockCleanupResult);

      mockRequest.body = {
        strategy: 'basic',
      };

      // 执行测试
      await healthController.triggerCleanup(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.performCleanup).toHaveBeenCalledWith(
        'basic',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          strategy: 'basic',
          memoryFreed: 50,
          duration: 100,
          success: true,
        },
        timestamp: expect.any(String),
      });
    });

    it('应该使用默认清理策略', async () => {
      // 准备测试数据
      const mockCleanupResult = {
        memoryFreed: 50,
        duration: 100,
        success: true,
        freedMemory: 50,
        cleanedResources: 0,
      };

      mockTreeSitterService.performCleanup.mockResolvedValue(mockCleanupResult);

      mockRequest.body = {};

      // 执行测试
      await healthController.triggerCleanup(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.performCleanup).toHaveBeenCalledWith(
        'basic',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.performCleanup.mockRejectedValue(
        new Error('Cleanup error'),
      );

      // 执行测试
      await healthController.triggerCleanup(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Cleanup error'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('resetStats', () => {
    it('应该重置统计信息', async () => {
      // 执行测试
      await healthController.resetStats(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.resetStats).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Statistics reset successfully',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.resetStats.mockImplementation(() => {
        throw new Error('Reset error');
      });

      // 执行测试
      await healthController.resetStats(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Reset error'],
        timestamp: expect.any(String),
      });
    });
  });
});
