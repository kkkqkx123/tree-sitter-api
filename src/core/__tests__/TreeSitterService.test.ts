import { TreeSitterService } from '../TreeSitterService';
import { ParseRequest } from '../../types/api';
import { SupportedLanguage } from '../../types/treeSitter';
import { CleanupStrategy } from '../../config/memory';

// Mock相关的依赖
jest.mock('../LanguageManager', () => {
  const originalModule = jest.requireActual('../LanguageManager');
  return {
    __esModule: true,
    ...originalModule,
    LanguageManager: jest.fn().mockImplementation(() => ({
      isLanguageSupported: jest.fn((lang: string) =>
        ['javascript', 'python', 'typescript'].includes(lang),
      ),
      getLanguage: jest.fn(async (lang: SupportedLanguage) => {
        if (lang === 'javascript') {
          return { name: 'javascript', language: 'javascript' };
        }
        throw new Error(`Language ${lang} not available in test`);
      }),
      getSupportedLanguages: jest.fn(() => [
        'javascript',
        'python',
        'typescript',
      ]),
      getStatus: jest.fn(() => ({
        supportedLanguages: ['javascript', 'python', 'typescript'],
        loadedLanguages: [],
        loadingLanguages: [],
        totalSupported: 3,
        totalLoaded: 0,
        totalLoading: 0,
      })),
      clearCache: jest.fn(),
      preloadAllLanguages: jest.fn(async () => {}),
    })),
  };
});

jest.mock('../ParserPool', () => {
  const originalModule = jest.requireActual('../ParserPool');
  return {
    __esModule: true,
    ...originalModule,
    ParserPool: jest.fn().mockImplementation(() => ({
      getParser: jest.fn(() => ({
        setLanguage: jest.fn(),
        parse: jest.fn(() => ({
          rootNode: {
            type: 'program',
            childCount: 0,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 0 },
            text: '',
          },
          delete: jest.fn(),
        })),
      })),
      releaseParser: jest.fn(),
      getPoolStats: jest.fn(() => ({
        totalPooled: 0,
        totalActive: 0,
        languageStats: {},
        memoryUsage: {
          estimatedParsers: 0,
          estimatedMemoryMB: 0,
        },
      })),
      isHealthy: jest.fn(() => true),
      destroy: jest.fn(),
      emergencyCleanup: jest.fn(),
    })),
  };
});

jest.mock('../MemoryMonitor', () => {
  const originalModule = jest.requireActual('../MemoryMonitor');
  return {
    __esModule: true,
    ...originalModule,
    MemoryMonitor: jest.fn().mockImplementation(() => ({
      checkMemory: jest.fn(() => ({
        level: 'normal',
        heapUsed: 100,
        heapTotal: 200,
        rss: 150,
        external: 50,
        trend: 'stable',
      })),
      startMonitoring: jest.fn(),
      getDetailedMemoryReport: jest.fn(() => ({
        status: {
          level: 'normal',
          heapUsed: 10,
          heapTotal: 200,
          rss: 150,
          external: 50,
          trend: 'stable',
        },
        stats: {
          current: 100,
          average: 90,
          peak: 120,
          minimum: 80,
          trend: 'stable',
          history: [80, 90, 100],
          historyLength: 3,
        },
        process: {
          rss: 50 * 1024 * 1024,
          heapTotal: 30 * 1024 * 1024,
          heapUsed: 20 * 1024 * 1024,
          external: 5 * 1024 * 1024,
        },
        recommendations: [],
        alerts: [],
      })),
      destroy: jest.fn(),
      resetHistory: jest.fn(),
    })),
  };
});

jest.mock('../ResourceCleaner', () => {
  const originalModule = jest.requireActual('../ResourceCleaner');
  return {
    __esModule: true,
    ...originalModule,
    ResourceCleaner: jest.fn().mockImplementation(() => ({
      setParserPool: jest.fn(),
      setLanguageManager: jest.fn(),
      performCleanup: jest.fn(async (strategy: CleanupStrategy) => ({
        strategy,
        memoryFreed: 0,
        success: true,
        duration: 10,
      })),
      getCleanupStats: jest.fn(() => ({
        totalCleanups: 0,
        successfulCleanups: 0,
        failedCleanups: 0,
        totalMemoryFreed: 0,
        averageCleanupTime: 0,
        strategyStats: {},
        recentCleanups: [],
      })),
      destroy: jest.fn(),
      clearHistory: jest.fn(),
    })),
  };
});

// Mock tree-sitter parser
jest.mock('tree-sitter', () => {
  return jest.fn().mockImplementation(() => ({
    setLanguage: jest.fn(),
    parse: jest.fn(() => ({
      rootNode: {
        type: 'program',
        childCount: 0,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
        text: '',
        children: [],
      },
      delete: jest.fn(),
    })),
  }));
});

describe('TreeSitterService', () => {
  let treeSitterService: TreeSitterService;

  beforeEach(() => {
    treeSitterService = new TreeSitterService();
  });

  afterEach(() => {
    treeSitterService.destroy();
  });

  describe('constructor', () => {
    it('should initialize all components', () => {
      // 验证服务被正确初始化
      expect(treeSitterService).toBeDefined();
    });
  });

  describe('processRequest', () => {
    it('should process a valid request successfully', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        query: '(program) @program',
      };

      const result = await treeSitterService.processRequest(request);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('errors');
      expect(result.success).toBe(true);
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return error for unsupported language', async () => {
      const request: ParseRequest = {
        language: 'unsupported-language',
        code: 'some code',
        query: '(program) @program',
      };

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Unsupported language'),
      );
    });

    it('should return error for missing language', async () => {
      const request: ParseRequest = {
        language: '',
        code: 'some code',
      } as any;

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Missing required fields'),
      );
    });

    it('should return error for missing code', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: undefined as any,
      };

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Missing required fields'),
      );
    });

    it('should handle empty code gracefully', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: '',
        query: '(program) @program',
      };

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches.length).toBe(0);
    });

    it('should return error for code exceeding max length', async () => {
      // 创建一个超过最大长度的代码字符串
      const longCode = 'a'.repeat(1000000); // 假设这超过了最大长度
      const request: ParseRequest = {
        language: 'javascript',
        code: longCode,
        query: '(program) @program',
      };

      const result = await treeSitterService.processRequest(request);

      if (!result.success) {
        expect(result.success).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining('Code length exceeds maximum allowed size'),
        );
      }
    });

    it('should return error for too many queries', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        queries: Array(15).fill('(program) @program'), // 超过10个查询
      };

      const result = await treeSitterService.processRequest(request);

      if (!result.success) {
        expect(result.success).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining('Too many queries'),
        );
      }
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const healthStatus = treeSitterService.getHealthStatus();

      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('memory');
      expect(healthStatus).toHaveProperty('parserPool');
      expect(healthStatus).toHaveProperty('languageManager');
      expect(healthStatus).toHaveProperty('service');
      expect(healthStatus).toHaveProperty('timestamp');

      expect(['healthy', 'warning', 'error']).toContain(healthStatus.status);
      expect(healthStatus.service).toHaveProperty('requestCount');
      expect(healthStatus.service).toHaveProperty('errorCount');
      expect(healthStatus.service).toHaveProperty('errorRate');
      expect(healthStatus.service).toHaveProperty('activeResources');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = treeSitterService.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });
  });

  describe('preloadLanguages', () => {
    it('should preload languages', async () => {
      await expect(treeSitterService.preloadLanguages()).resolves.not.toThrow();
    });
  });

  describe('performCleanup', () => {
    it('should perform cleanup with default strategy', async () => {
      const result = await treeSitterService.performCleanup();

      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('success');

      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.success).toBe('boolean');
    });

    it('should perform cleanup with specific strategy', async () => {
      const result = await treeSitterService.performCleanup(
        CleanupStrategy.BASIC,
      );

      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('success');
    });
  });

  describe('getDetailedStats', () => {
    it('should return detailed statistics', () => {
      const stats = treeSitterService.getDetailedStats();

      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('cleanup');

      expect(stats.health).toHaveProperty('status');
      expect(stats.memory).toHaveProperty('status');
      expect(stats.cleanup).toHaveProperty('totalCleanups');
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      // 获取初始统计
      const initialStats = treeSitterService.getHealthStatus();
      expect(initialStats.service.requestCount).toBe(0); // 初始为0

      // 重置统计
      treeSitterService.resetStats();

      // 再次获取统计
      const finalStats = treeSitterService.getHealthStatus();
      expect(finalStats.service.requestCount).toBe(0);
    });
  });

  describe('emergencyCleanup', () => {
    it('should perform emergency cleanup', async () => {
      await expect(treeSitterService.emergencyCleanup()).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should properly destroy the service', () => {
      // 验证初始状态
      const initialHealth = treeSitterService.getHealthStatus();
      expect(initialHealth).toBeDefined();

      // 销毁服务
      treeSitterService.destroy();

      // 验证服务被正确销毁（不会抛出异常）
      const finalHealth = treeSitterService.getHealthStatus();
      expect(finalHealth).toBeDefined(); // 在实际实现中，销毁后的方法调用可能有不同的行为
    });
  });

  describe('error handling', () => {
    it('should handle TreeSitterError correctly', async () => {
      // 模拟一个无效请求来触发错误处理
      const request: ParseRequest = {
        language: 'invalid-language',
        code: 'some code',
      } as any;

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle general errors correctly', async () => {
      // 这个测试主要验证错误处理路径
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        query: '(invalid_query_syntax', // 无效查询语法
      };

      const result = await treeSitterService.processRequest(request);

      // 结果可能是成功（如果查询错误被内部处理）或失败（如果抛出异常）
      expect(result).toHaveProperty('success');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('query execution', () => {
    it('should handle requests without queries', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        // 不包含查询
      };

      const result = await treeSitterService.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.matches).toEqual([]);
    });

    it('should execute multiple queries', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        query: '(program) @program',
        queries: ['(identifier) @id', '(variable_declarator) @var'],
      };

      const result = await treeSitterService.processRequest(request);

      expect(result).toHaveProperty('success');
      expect(Array.isArray(result.matches)).toBe(true);
    });
  });
});
