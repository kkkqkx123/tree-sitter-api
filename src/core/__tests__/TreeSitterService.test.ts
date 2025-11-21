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
          return { 
            name: 'javascript', 
            language: jest.fn().mockImplementation(() => ({
              parse: jest.fn(() => ({
                rootNode: {
                  type: 'program',
                  childCount: 0,
                  startPosition: { row: 0, column: 0 },
                  endPosition: { row: 0, column: 0 },
                  text: '',
                  children: [],
                },
              })),
            }))
          };
        }
        throw new Error(`Language ${lang} not available in test`);
      }),
      getSupportedLanguages: jest.fn(() => [
        'javascript',
        'python',
        'typescript',
        'tsx',
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
      getLoadedLanguagesCount: jest.fn(() => 0),
    })),
  };
});

jest.mock('../QueryProcessor', () => {
  return {
    QueryProcessor: jest.fn().mockImplementation(() => ({
      parseQuery: jest.fn((query: string) => ({
        originalQuery: query,
        patterns: [],
        predicates: [],
        directives: [],
        features: {
          hasPredicates: false,
          hasDirectives: false,
          hasAnchors: false,
          hasAlternations: false,
          hasQuantifiers: false,
          hasWildcards: false,
          predicateCount: 0,
          directiveCount: 0,
          complexity: 'simple' as const,
        },
      })),
      validateQuerySyntax: jest.fn(() => ({
        isValid: true,
        errors: [],
        warnings: [],
        features: {
          hasPredicates: false,
          hasDirectives: false,
          hasAnchors: false,
          hasAlternations: false,
          hasQuantifiers: false,
          hasWildcards: false,
          predicateCount: 0,
          directiveCount: 0,
          complexity: 'simple' as const,
        },
      })),
      generateOptimizationSuggestions: jest.fn(() => []),
      extractPredicates: jest.fn(() => []),
      extractDirectives: jest.fn(() => []),
    })),
  };
});

jest.mock('../ResourceService', () => {
  return {
    ResourceService: jest.fn().mockImplementation(() => ({
      getActiveResourcesCount: jest.fn(() => ({
        trees: 0,
        queries: 0,
        parsers: 0,
      })),
    })),
  };
});

jest.mock('../MonitoringService', () => {
  return {
    MonitoringService: jest.fn().mockImplementation(() => ({
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      checkMemory: jest.fn(() => ({
        level: 'healthy',
        heapUsed: 100,
        heapTotal: 200,
        rss: 150,
        external: 50,
        threshold: 150,
        usage: 50,
        status: 'healthy',
      })),
      performCleanup: jest.fn(async (strategy: CleanupStrategy) => ({
        strategy,
        memoryFreed: 10,
        success: true,
        duration: 10,
      })),
      incrementRequestCount: jest.fn(),
      incrementErrorCount: jest.fn(),
      recordQueryTime: jest.fn(),
      getStatistics: jest.fn(() => ({
        requestCount: 0,
        errorCount: 0,
        errorRate: 0,
        averageQueryTime: 0,
        uptime: 1000,
        timestamp: new Date().toISOString(),
      })),
      resetStatistics: jest.fn(),
    })),
  };
});

jest.mock('../PredicateProcessor', () => {
  return {
    PredicateProcessor: jest.fn().mockImplementation(() => ({
      applyPredicates: jest.fn(async (matches: any[], predicates: any[]) => ({
        filteredMatches: matches,
        predicateResults: matches.map(() => ({
          predicate: predicates[0] || { type: 'eq', capture: '', value: '' },
          passed: true,
        })),
      })),
      validatePredicate: jest.fn((_predicate: any) => ({
        isValid: true,
        errors: [],
      })),
    })),
  };
});

jest.mock('../DirectiveProcessor', () => {
  return {
    DirectiveProcessor: jest.fn().mockImplementation(() => ({
      applyDirectives: jest.fn(async (matches: any[], directives: any[]) => ({
        processedMatches: matches.map((match: any) => ({
          ...match,
          processedBy: directives.map((d: any) => d.type),
          transformations: [],
        })),
        directiveResults: directives.map((directive: any) => ({
          directive,
          applied: true,
        })),
      })),
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

// Mock memoryUtils
jest.mock('../../utils/memoryUtils', () => ({
  getMemoryUsage: jest.fn(() => ({
    heapUsed: 50 * 1024 * 1024,
    heapTotal: 100 * 1024 * 1024,
    rss: 80 * 1024 * 1024,
    external: 10 * 1024 * 1024,
  })),
}));

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
        queries: ['(program) @program'],
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
        queries: ['(program) @program'],
      };

      await expect(treeSitterService.processRequest(request)).rejects.toThrow('Language unsupported-language not available in test');
    });

    it('should return error for missing language', async () => {
      const request: ParseRequest = {
        language: '',
        code: 'some code',
        query: '(program) @program',
      } as any;

      await expect(treeSitterService.processRequest(request)).rejects.toThrow('Language is required');
    });

    it('should return error for missing code', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: undefined as any,
        queries: ['(program) @program'],
      };

      await expect(treeSitterService.processRequest(request)).rejects.toThrow('Code is required');
    });

    it('should return error for missing query', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: 'const x = 1;',
        queries: undefined as any,
      };

      await expect(treeSitterService.processRequest(request)).rejects.toThrow('Query is required');
    });

    it('should return error for empty code', async () => {
      const request: ParseRequest = {
        language: 'javascript',
        code: '',
        queries: ['(program) @program'],
      };

      await expect(treeSitterService.processRequest(request)).rejects.toThrow('Code is required');
    });
  });

  describe('processAdvancedRequest', () => {
    it('should process a valid advanced request successfully', async () => {
      const request = {
        language: 'javascript',
        code: 'const x = 1;',
        query: '(program) @program',
        enableAdvancedFeatures: true,
      };

      const result = await treeSitterService.processAdvancedRequest(request);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('performance');
      expect(result.success).toBe(true);
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return error for missing language', async () => {
      const request = {
        language: '',
        code: 'const x = 1;',
        query: '(program) @program',
      } as any;

      const result = await treeSitterService.processAdvancedRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Language is required');
    });

    it('should return error for missing code', async () => {
      const request = {
        language: 'javascript',
        code: undefined as any,
        query: '(program) @program',
      } as any;

      const result = await treeSitterService.processAdvancedRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Code is required');
    });

    it('should return error for missing query and queries', async () => {
      const request = {
        language: 'javascript',
        code: 'const x = 1;',
      } as any;

      const result = await treeSitterService.processAdvancedRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Either query or queries is required');
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
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('statistics');

      expect(stats.health).toHaveProperty('status');
      expect(stats.memory).toHaveProperty('status');
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

  describe('analyzeQuery', () => {
    it('should analyze query', async () => {
      const result = await treeSitterService.analyzeQuery('javascript', '(program) @program');

      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('validationResult');
      expect(result).toHaveProperty('parsedQuery');
      expect(result).toHaveProperty('optimizationSuggestions');
    });
  });

  describe('validateAdvancedQuery', () => {
    it('should validate advanced query', async () => {
      const result = await treeSitterService.validateAdvancedQuery('javascript', '(program) @program');

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('features');
    });
  });

  describe('getQueryOptimizations', () => {
    it('should get query optimizations', async () => {
      const result = await treeSitterService.getQueryOptimizations('javascript', '(program) @program');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getQueryStatistics', () => {
    it('should get query statistics', async () => {
      const result = await treeSitterService.getQueryStatistics();

      expect(result).toHaveProperty('requestCount');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('errorRate');
    });
  });
});