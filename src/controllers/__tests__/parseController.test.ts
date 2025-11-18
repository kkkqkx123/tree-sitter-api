/**
 * parseController 单元测试
 */

import { Request, Response } from 'express';
import { createParseController } from '../parseController';
import { TreeSitterService } from '../../core/TreeSitterService';
import { ParseRequest, ParseResult } from '../../types/api';

// 模拟 TreeSitterService
const mockTreeSitterService = {
  processRequest: jest.fn(),
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

describe('parseController', () => {
  let parseController: ReturnType<typeof createParseController>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    parseController = createParseController(mockTreeSitterService);

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

  describe('parseCode', () => {
    it('应该成功处理解析请求', async () => {
      // 准备测试数据
      const parseRequest: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      const parseResult: ParseResult = {
        success: true,
        matches: [
          {
            captureName: 'func',
            type: 'function_declaration',
            text: 'function test() { return "hello"; }',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 35 },
          },
        ],
        errors: [],
      };

      mockRequest.body = parseRequest;
      mockTreeSitterService.processRequest.mockResolvedValue(parseResult);

      // 执行测试
      await parseController.parseCode(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.processRequest).toHaveBeenCalledWith(
        parseRequest,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Match-Count', '1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: parseResult.matches,
        errors: [],
        timestamp: expect.any(String),
      });
    });

    it('应该处理解析失败的情况', async () => {
      // 准备测试数据
      const parseRequest: ParseRequest = {
        language: 'javascript',
        code: 'invalid code',
        query: '(function_declaration) @func',
      };

      const parseResult: ParseResult = {
        success: false,
        matches: [],
        errors: ['Parse error: invalid syntax'],
      };

      mockRequest.body = parseRequest;
      mockTreeSitterService.processRequest.mockResolvedValue(parseResult);

      // 执行测试
      await parseController.parseCode(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Match-Count', '0');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: [],
        errors: ['Parse error: invalid syntax'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      const parseRequest: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      mockRequest.body = parseRequest;
      mockTreeSitterService.processRequest.mockRejectedValue(
        new Error('Service error'),
      );

      // 执行测试
      await parseController.parseCode(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });

    it('应该在没有请求ID时使用默认值', async () => {
      // 准备测试数据
      mockRequest.headers = {};
      const parseRequest: ParseRequest = {
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      const parseResult: ParseResult = {
        success: true,
        matches: [],
        errors: [],
      };

      mockRequest.body = parseRequest;
      mockTreeSitterService.processRequest.mockResolvedValue(parseResult);

      // 执行测试
      await parseController.parseCode(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('parseBatch', () => {
    it('应该成功处理批量解析请求', async () => {
      // 准备测试数据
      const requests: ParseRequest[] = [
        {
          language: 'javascript',
          code: 'function test1() { return "hello1"; }',
          query: '(function_declaration) @func',
        },
        {
          language: 'javascript',
          code: 'function test2() { return "hello2"; }',
          query: '(function_declaration) @func',
        },
      ];

      const results: ParseResult[] = [
        {
          success: true,
          matches: [
            {
              captureName: 'func',
              type: 'function_declaration',
              text: 'function test1() { return "hello1"; }',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 36 },
            },
          ],
          errors: [],
        },
        {
          success: true,
          matches: [
            {
              captureName: 'func',
              type: 'function_declaration',
              text: 'function test2() { return "hello2"; }',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 36 },
            },
          ],
          errors: [],
        },
      ];

      mockRequest.body = { requests };
      mockTreeSitterService.processRequest
        .mockResolvedValueOnce(results[0]!)
        .mockResolvedValueOnce(results[1]!);

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.processRequest).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Batch-Size', '2');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Success-Count',
        '2',
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          results,
          summary: {
            total: 2,
            successful: 2,
            failed: 0,
            totalMatches: 2,
          },
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理部分成功的批量请求', async () => {
      // 准备测试数据
      const requests: ParseRequest[] = [
        {
          language: 'javascript',
          code: 'function test1() { return "hello1"; }',
          query: '(function_declaration) @func',
        },
        {
          language: 'javascript',
          code: 'invalid code',
          query: '(function_declaration) @func',
        },
      ];

      const results: ParseResult[] = [
        {
          success: true,
          matches: [
            {
              captureName: 'func',
              type: 'function_declaration',
              text: 'function test1() { return "hello1"; }',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 36 },
            },
          ],
          errors: [],
        },
        {
          success: false,
          matches: [],
          errors: ['Parse error: invalid syntax'],
        },
      ];

      mockRequest.body = { requests };
      mockTreeSitterService.processRequest
        .mockResolvedValueOnce(results[0]!)
        .mockResolvedValueOnce(results[1]!);

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Success-Count',
        '1',
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          results,
          summary: {
            total: 2,
            successful: 1,
            failed: 1,
            totalMatches: 1,
          },
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理空请求数组', async () => {
      // 准备测试数据
      mockRequest.body = { requests: [] };

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Empty requests array'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理过多的请求', async () => {
      // 准备测试数据
      const requests: ParseRequest[] = Array(11).fill({
        language: 'javascript',
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      });

      mockRequest.body = { requests };

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Too many requests in batch. Maximum allowed is 10'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理无效的请求格式', async () => {
      // 准备测试数据
      mockRequest.body = { requests: 'not-an-array' };

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Invalid request format: requests array is required'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理无效的请求项', async () => {
      // 准备测试数据
      const requests: any[] = [
        {
          language: 'javascript',
          code: 'function test() { return "hello"; }',
          query: '(function_declaration) @func',
        },
        null,
      ];

      mockRequest.body = { requests };

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Invalid request at index 1: request is required'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      const requests: ParseRequest[] = [
        {
          language: 'javascript',
          code: 'function test() { return "hello"; }',
          query: '(function_declaration) @func',
        },
      ];

      mockRequest.body = { requests };
      mockTreeSitterService.processRequest.mockRejectedValue(
        new Error('Service error'),
      );

      // 执行测试
      await parseController.parseBatch(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果 - 修正期望的状态码，因为控制器在批量处理中会捕获错误并返回200状态码
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          results: [
            {
              success: false,
              matches: [],
              errors: ['Service error'],
            },
          ],
          summary: {
            total: 1,
            successful: 0,
            failed: 1,
            totalMatches: 0,
          },
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe('validateQuery', () => {
    it('应该成功验证有效查询', async () => {
      // 准备测试数据
      const { language, query } = {
        language: 'javascript',
        query: '(function_declaration) @func',
      };

      const parseResult: ParseResult = {
        success: true,
        matches: [],
        errors: [],
      };

      mockRequest.body = { language, query };
      mockTreeSitterService.processRequest.mockResolvedValue(parseResult);

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.processRequest).toHaveBeenCalledWith({
        language,
        code: 'test',
        query,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: true,
          language,
          query,
          message: 'Query syntax is valid',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理无效查询', async () => {
      // 准备测试数据
      const { language, query } = {
        language: 'javascript',
        query: 'invalid query syntax',
      };

      const parseResult: ParseResult = {
        success: false,
        matches: [],
        errors: ['Invalid query syntax'],
      };

      mockRequest.body = { language, query };
      mockTreeSitterService.processRequest.mockResolvedValue(parseResult);

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          valid: false,
          language,
          query,
          errors: ['Invalid query syntax'],
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理缺少语言参数', async () => {
      // 准备测试数据
      mockRequest.body = {
        query: '(function_declaration) @func',
      };

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理缺少查询参数', async () => {
      // 准备测试数据
      mockRequest.body = {
        language: 'javascript',
      };

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: query'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理无效的语言参数类型', async () => {
      // 准备测试数据
      mockRequest.body = {
        language: 123,
        query: '(function_declaration) @func',
      };

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: language'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理无效的查询参数类型', async () => {
      // 准备测试数据
      mockRequest.body = {
        language: 'javascript',
        query: 123,
      };

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Missing or invalid field: query'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      const { language, query } = {
        language: 'javascript',
        query: '(function_declaration) @func',
      };

      mockRequest.body = { language, query };
      mockTreeSitterService.processRequest.mockRejectedValue(
        new Error('Service error'),
      );

      // 执行测试
      await parseController.validateQuery(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Processing-Time',
        expect.any(String),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Service error'],
        timestamp: expect.any(String),
      });
    });
  });
});
