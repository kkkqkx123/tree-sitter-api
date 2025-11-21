/**
 * 高级查询控制器单元测试
 */

import { Request, Response } from 'express';
import { createAdvancedQueryController } from '../../src/controllers/advancedQueryController';
import { TreeSitterService } from '../../src/core/TreeSitterService';
import { AdvancedParseRequest, AdvancedParseResult, QueryFeatures } from '../../src/types/advancedQuery';
// import { ApiResponse, ErrorResponse } from '../../src/types/api'; // 这些类型在测试中不需要直接使用
import { log } from '../../src/utils/Logger';

// 模拟 Logger
jest.mock('../../src/utils/Logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// 模拟 TreeSitterService
const mockTreeSitterService = {
  processAdvancedRequest: jest.fn(),
  analyzeQuery: jest.fn(),
  validateAdvancedQuery: jest.fn(),
  getQueryOptimizations: jest.fn(),
  getQueryStatistics: jest.fn(),
} as unknown as jest.Mocked<TreeSitterService>;

// 模拟 Express Request 和 Response
const mockRequest = (body: any, headers: any = {}): Partial<Request> => ({
  body,
  headers: {
    'x-request-id': 'test-request-id',
    ...headers,
  },
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

// 创建测试用的示例数据
const createMockAdvancedParseResult = (overrides: Partial<AdvancedParseResult> = {}): AdvancedParseResult => ({
  success: true,
  matches: [
    {
      captureName: 'test',
      type: 'identifier',
      text: 'testVariable',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: 12 },
    },
  ],
  errors: [],
  performance: {
    parseTime: 10,
    queryTime: 5,
    totalTime: 15,
    memoryUsage: 50,
    matchCount: 1,
    predicatesProcessed: 0,
    directivesApplied: 0,
  },
  queryFeatures: {
    hasPredicates: false,
    hasDirectives: false,
    hasAnchors: false,
    hasAlternations: false,
    hasQuantifiers: false,
    hasWildcards: false,
    predicateCount: 0,
    directiveCount: 0,
    complexity: 'simple',
  },
  ...overrides,
});

const createMockQueryFeatures = (overrides: Partial<QueryFeatures> = {}): QueryFeatures => ({
  hasPredicates: false,
  hasDirectives: false,
  hasAnchors: false,
  hasAlternations: false,
  hasQuantifiers: false,
  hasWildcards: false,
  predicateCount: 0,
  directiveCount: 0,
  complexity: 'simple',
  ...overrides,
});

describe('AdvancedQueryController', () => {
  let controller: ReturnType<typeof createAdvancedQueryController>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = createAdvancedQueryController(mockTreeSitterService);
  });

  describe('parseWithAdvancedFeatures', () => {
    it('should process a valid advanced query request successfully', async () => {
      // 准备测试数据
      const requestBody: AdvancedParseRequest = {
        language: 'javascript',
        code: 'const testVariable = 42;',
        query: '(identifier) @id',
        enableAdvancedFeatures: true,
      };

      const expectedResult = createMockAdvancedParseResult();

      mockTreeSitterService.processAdvancedRequest.mockResolvedValue(expectedResult);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.parseWithAdvancedFeatures(req, res);

      // 验证结果
      expect(mockTreeSitterService.processAdvancedRequest).toHaveBeenCalledWith(requestBody);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-Match-Count', '1');
      expect(res.setHeader).toHaveBeenCalledWith('X-Query-Complexity', 'simple');
      expect(res.setHeader).toHaveBeenCalledWith('X-Predicate-Count', '0');
      expect(res.setHeader).toHaveBeenCalledWith('X-Directive-Count', '0');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expectedResult,
        errors: expectedResult.errors,
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(2); // 一次开始，一次成功
    });

    it('should handle request validation errors', async () => {
      // 准备无效的请求数据
      const requestBody = {
        language: '', // 无效的语言
        code: 'const testVariable = 42;',
      };

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.parseWithAdvancedFeatures(req, res);

      // 验证结果
      expect(mockTreeSitterService.processAdvancedRequest).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(1); // 只有开始日志
    });

    it('should handle service errors gracefully', async () => {
      // 准备测试数据
      const requestBody: AdvancedParseRequest = {
        language: 'javascript',
        code: 'const testVariable = 42;',
        query: '(identifier) @id',
      };

      // 模拟服务返回错误
      mockTreeSitterService.processAdvancedRequest.mockResolvedValue({
        success: false,
        matches: [],
        errors: ['Query syntax error'],
        performance: {
          parseTime: 5,
          queryTime: 0,
          totalTime: 5,
          memoryUsage: 50,
          matchCount: 0,
          predicatesProcessed: 0,
          directivesApplied: 0,
        },
      });

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.parseWithAdvancedFeatures(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: expect.any(Object),
        errors: ['Query syntax error'],
        timestamp: expect.any(String),
      });
      expect(log.warn).toHaveBeenCalledTimes(1); // 警告日志
    });

    it('should handle exceptions thrown by the service', async () => {
      // 准备测试数据
      const requestBody: AdvancedParseRequest = {
        language: 'javascript',
        code: 'const testVariable = 42;',
        query: '(identifier) @id',
      };

      // 模拟服务抛出异常
      mockTreeSitterService.processAdvancedRequest.mockRejectedValue(new Error('Service error'));

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.parseWithAdvancedFeatures(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
      expect(log.error).toHaveBeenCalledTimes(1); // 错误日志
    });

    it('should handle requests with multiple queries', async () => {
      // 准备测试数据
      const requestBody: AdvancedParseRequest = {
        language: 'javascript',
        code: 'const testVariable = 42;',
        queries: ['(identifier) @id', '(function_declaration) @func'],
      };

      const expectedResult = createMockAdvancedParseResult({
        matches: [
          {
            captureName: 'test',
            type: 'identifier',
            text: 'testVariable',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 12 },
          },
          {
            captureName: 'func',
            type: 'function_declaration',
            text: 'function test() {}',
            startPosition: { row: 1, column: 0 },
            endPosition: { row: 1, column: 20 },
          },
        ],
      });

      mockTreeSitterService.processAdvancedRequest.mockResolvedValue(expectedResult);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.parseWithAdvancedFeatures(req, res);

      // 验证结果
      expect(mockTreeSitterService.processAdvancedRequest).toHaveBeenCalledWith(requestBody);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Match-Count', '2');
    });
  });

  describe('analyzeQuery', () => {
    it('should analyze a query successfully', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      const mockAnalysisResult = {
        language: 'javascript',
        query: '(identifier) @id',
        validationResult: {
          isValid: true,
          errors: [],
          warnings: [],
        },
        parsedQuery: {
          originalQuery: '(identifier) @id',
          patterns: [],
          predicates: [],
          directives: [],
          features: createMockQueryFeatures(),
        },
        optimizationSuggestions: [],
      };

      mockTreeSitterService.analyzeQuery.mockResolvedValue(mockAnalysisResult);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.analyzeQuery(req, res);

      // 验证结果
      expect(mockTreeSitterService.analyzeQuery).toHaveBeenCalledWith('javascript', '(identifier) @id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalysisResult,
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(2); // 一次开始，一次成功
    });

    it('should handle missing language field', async () => {
      // 准备无效的请求数据
      const requestBody = {
        query: '(identifier) @id',
      };

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.analyzeQuery(req, res);

      // 验证结果
      expect(mockTreeSitterService.analyzeQuery).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
    });

    it('should handle missing query field', async () => {
      // 准备无效的请求数据
      const requestBody = {
        language: 'javascript',
      };

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.analyzeQuery(req, res);

      // 验证结果
      expect(mockTreeSitterService.analyzeQuery).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: query'],
        timestamp: expect.any(String),
      });
    });

    it('should handle service exceptions', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      // 模拟服务抛出异常
      mockTreeSitterService.analyzeQuery.mockRejectedValue(new Error('Analysis error'));

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.analyzeQuery(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Analysis error'],
        timestamp: expect.any(String),
      });
      expect(log.error).toHaveBeenCalledTimes(1); // 错误日志
    });
  });

  describe('validateAdvancedQuery', () => {
    it('should validate a query successfully', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        features: createMockQueryFeatures(),
        suggestions: [],
      };

      mockTreeSitterService.validateAdvancedQuery.mockResolvedValue(mockValidationResult);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.validateAdvancedQuery(req, res);

      // 验证结果
      expect(mockTreeSitterService.validateAdvancedQuery).toHaveBeenCalledWith('javascript', '(identifier) @id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-Validation-Result', 'valid');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: true,
          language: 'javascript',
          query: '(identifier) @id',
          features: mockValidationResult.features,
          errors: mockValidationResult.errors,
          warnings: mockValidationResult.warnings,
          suggestions: mockValidationResult.suggestions,
        },
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(2); // 一次开始，一次成功
    });

    it('should handle invalid query validation', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(invalid',
      };

      const mockValidationResult = {
        isValid: false,
        errors: [{ type: 'syntax', message: 'Unexpected end of input', severity: 'error' }],
        warnings: [],
        features: createMockQueryFeatures(),
        suggestions: ['Check query syntax'],
      };

      mockTreeSitterService.validateAdvancedQuery.mockResolvedValue(mockValidationResult);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.validateAdvancedQuery(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Validation-Result', 'invalid');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: false,
          language: 'javascript',
          query: '(invalid',
          features: mockValidationResult.features,
          errors: mockValidationResult.errors,
          warnings: mockValidationResult.warnings,
          suggestions: mockValidationResult.suggestions,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle missing language field', async () => {
      // 准备无效的请求数据
      const requestBody = {
        query: '(identifier) @id',
      };

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.validateAdvancedQuery(req, res);

      // 验证结果
      expect(mockTreeSitterService.validateAdvancedQuery).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
    });

    it('should handle service exceptions', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      // 模拟服务抛出异常
      mockTreeSitterService.validateAdvancedQuery.mockRejectedValue(new Error('Validation error'));

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.validateAdvancedQuery(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Validation error'],
        timestamp: expect.any(String),
      });
      expect(log.error).toHaveBeenCalledTimes(1); // 错误日志
    });
  });

  describe('getQueryOptimizations', () => {
    it('should get query optimizations successfully', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      const mockOptimizations = [
        {
          type: 'predicate',
          description: 'Use more specific predicates',
          impact: 'medium',
          example: '(identifier) @id (#eq? @id "specificName")',
        },
      ];

      mockTreeSitterService.getQueryOptimizations.mockResolvedValue(mockOptimizations);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryOptimizations(req, res);

      // 验证结果
      expect(mockTreeSitterService.getQueryOptimizations).toHaveBeenCalledWith('javascript', '(identifier) @id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-Optimization-Count', '1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'javascript',
          query: '(identifier) @id',
          optimizations: mockOptimizations,
        },
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(2); // 一次开始，一次成功
    });

    it('should handle empty optimizations', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      mockTreeSitterService.getQueryOptimizations.mockResolvedValue([]);

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryOptimizations(req, res);

      // 验证结果
      expect(res.setHeader).toHaveBeenCalledWith('X-Optimization-Count', '0');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'javascript',
          query: '(identifier) @id',
          optimizations: [],
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle missing language field', async () => {
      // 准备无效的请求数据
      const requestBody = {
        query: '(identifier) @id',
      };

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryOptimizations(req, res);

      // 验证结果
      expect(mockTreeSitterService.getQueryOptimizations).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
    });

    it('should handle service exceptions', async () => {
      // 准备测试数据
      const requestBody = {
        language: 'javascript',
        query: '(identifier) @id',
      };

      // 模拟服务抛出异常
      mockTreeSitterService.getQueryOptimizations.mockRejectedValue(new Error('Optimization error'));

      const req = mockRequest(requestBody) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryOptimizations(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Optimization error'],
        timestamp: expect.any(String),
      });
      expect(log.error).toHaveBeenCalledTimes(1); // 错误日志
    });
  });

  describe('getQueryStatistics', () => {
    it('should get query statistics successfully', async () => {
      // 准备测试数据
      const mockStatistics = {
        totalQueries: 100,
        successfulQueries: 95,
        failedQueries: 5,
        averageQueryTime: 25.5,
        averageMatchesPerQuery: 3.2,
        mostUsedPredicates: {
          'eq': 40,
          'match': 30,
        },
        mostUsedDirectives: {
          'set': 10,
          'strip': 5,
        },
        queryComplexityDistribution: {
          'simple': 60,
          'moderate': 30,
          'complex': 10,
        },
      };

      mockTreeSitterService.getQueryStatistics.mockResolvedValue(mockStatistics);

      const req = mockRequest({}) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryStatistics(req, res);

      // 验证结果
      expect(mockTreeSitterService.getQueryStatistics).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('X-Processing-Time', expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatistics,
        timestamp: expect.any(String),
      });
      expect(log.info).toHaveBeenCalledTimes(2); // 一次开始，一次成功
    });

    it('should handle service exceptions', async () => {
      // 模拟服务抛出异常
      mockTreeSitterService.getQueryStatistics.mockRejectedValue(new Error('Statistics error'));

      const req = mockRequest({}) as Request;
      const res = mockResponse() as Response;

      // 执行测试
      await controller.getQueryStatistics(req, res);

      // 验证结果
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Statistics error'],
        timestamp: expect.any(String),
      });
      expect(log.error).toHaveBeenCalledTimes(1); // 错误日志
    });
  });
});

// 单独测试 validateAdvancedRequest 函数
describe('validateAdvancedRequest', () => {
  // 由于 validateAdvancedRequest 不是导出的函数，我们需要通过测试控制器来间接测试它
  it('should validate request with all required fields', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody: AdvancedParseRequest = {
      language: 'javascript',
      code: 'const test = 42;',
      query: '(identifier) @id',
    };

    const expectedResult = createMockAdvancedParseResult();
    mockTreeSitterService.processAdvancedRequest.mockResolvedValue(expectedResult);

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should reject request with missing language', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      code: 'const test = 42;',
      query: '(identifier) @id',
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('Missing or invalid field: language');
  });

  it('should reject request with missing code', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      query: '(identifier) @id',
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('Missing or invalid field: code');
  });

  it('should reject request with invalid query type', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      query: 123, // 应该是字符串
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('Query must be a string');
  });

  it('should reject request with invalid queries array', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      queries: 'not an array', // 应该是数组
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('Queries must be an array');
  });

  it('should reject request with invalid query in queries array', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      queries: ['(identifier) @id', 123], // 第二个元素应该是字符串
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('Query at index 1 must be a string');
  });

  it('should reject request with invalid enableAdvancedFeatures', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      query: '(identifier) @id',
      enableAdvancedFeatures: 'true', // 应该是布尔值
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('enableAdvancedFeatures must be a boolean');
  });

  it('should reject request with invalid maxResults', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      query: '(identifier) @id',
      maxResults: -1, // 应该是非负数
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('maxResults must be a non-negative number');
  });

  it('should reject request with invalid timeout', async () => {
    const controller = createAdvancedQueryController(mockTreeSitterService);
    
    const requestBody = {
      language: 'javascript',
      code: 'const test = 42;',
      query: '(identifier) @id',
      timeout: '1000', // 应该是数字
    };

    const req = mockRequest(requestBody) as Request;
    const res = mockResponse() as Response;

    await controller.parseWithAdvancedFeatures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].errors).toContain('timeout must be a non-negative number');
  });
});