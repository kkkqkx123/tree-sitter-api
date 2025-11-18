/**
 * languagesController 单元测试
 */

import { Request, Response } from 'express';
import { createLanguagesController } from '../languagesController';
import { TreeSitterService } from '../../core/TreeSitterService';
import { SupportedLanguage } from '../../types/treeSitter';

// 模拟 TreeSitterService
const mockTreeSitterService = {
  getSupportedLanguages: jest.fn(),
  preloadLanguages: jest.fn(),
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

describe('languagesController', () => {
  let languagesController: ReturnType<typeof createLanguagesController>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    languagesController = createLanguagesController(mockTreeSitterService);

    // 创建模拟的请求和响应对象
    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id',
      },
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe('getSupportedLanguages', () => {
    it('应该返回支持的语言列表', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
        'python',
        'java',
        'go',
        'rust',
        'cpp',
        'c',
        'csharp',
        'ruby',
      ];

      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      // 执行测试
      await languagesController.getSupportedLanguages(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          languages: [
            'javascript',
            'typescript',
            'python',
            'java',
            'go',
            'rust',
            'cpp',
            'c',
            'csharp',
            'ruby',
          ],
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理错误情况', async () => {
      // 准备测试数据
      mockTreeSitterService.getSupportedLanguages.mockImplementation(() => {
        throw new Error('Service error');
      });

      // 执行测试
      await languagesController.getSupportedLanguages(
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
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([]);

      // 执行测试
      await languagesController.getSupportedLanguages(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('getLanguageInfo', () => {
    it('应该返回JavaScript语言信息', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
      ];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'javascript',
      };

      // 执行测试
      await languagesController.getLanguageInfo(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'JavaScript',
          extensions: ['.js', '.jsx', '.mjs'],
          mimeType: 'text/javascript',
          description: 'JavaScript programming language',
          popularity: 'high',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该返回TypeScript语言信息', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['typescript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'typescript',
      };

      // 执行测试
      await languagesController.getLanguageInfo(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'TypeScript',
          extensions: ['.ts', '.tsx'],
          mimeType: 'text/typescript',
          description: 'TypeScript programming language',
          popularity: 'high',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该返回Python语言信息', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['python'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'python',
      };

      // 执行测试
      await languagesController.getLanguageInfo(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'Python',
          extensions: ['.py', '.pyw', '.py3'],
          mimeType: 'text/x-python',
          description: 'Python programming language',
          popularity: 'high',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理不支持的语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'unsupported',
      };

      // 执行测试
      await languagesController.getLanguageInfo(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Unsupported language: unsupported'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理缺少语言参数的情况', async () => {
      // 准备测试数据
      mockRequest.params = {};

      // 执行测试
      await languagesController.getLanguageInfo(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Language parameter is required'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      mockTreeSitterService.getSupportedLanguages.mockImplementation(() => {
        throw new Error('Service error');
      });

      mockRequest.params = {
        language: 'javascript',
      };

      // 执行测试
      await languagesController.getLanguageInfo(
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

  describe('preloadLanguage', () => {
    it('应该预加载所有语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
        'python',
      ];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );
      mockTreeSitterService.preloadLanguages.mockResolvedValue();

      mockRequest.body = {};

      // 执行测试
      await languagesController.preloadLanguage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.preloadLanguages).toHaveBeenCalledWith(
        mockSupportedLanguages,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          languages: mockSupportedLanguages,
          count: 3,
          duration: expect.any(Number),
          message: 'Successfully preloaded 3 languages in 0ms',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该预加载指定的语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
        'python',
      ];
      const languagesToPreload: SupportedLanguage[] = [
        'javascript',
        'typescript',
      ];

      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );
      mockTreeSitterService.preloadLanguages.mockResolvedValue();

      mockRequest.body = {
        languages: languagesToPreload,
      };

      // 执行测试
      await languagesController.preloadLanguage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockTreeSitterService.preloadLanguages).toHaveBeenCalledWith(
        languagesToPreload,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          languages: languagesToPreload,
          count: 2,
          duration: expect.any(Number),
          message: 'Successfully preloaded 2 languages in 0ms',
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理不支持的语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = [
        'javascript',
        'typescript',
      ];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.body = {
        languages: ['javascript', 'unsupported'],
      };

      // 执行测试
      await languagesController.preloadLanguage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Unsupported languages: unsupported'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理非数组语言参数', async () => {
      // 准备测试数据
      mockRequest.body = {
        languages: 'not-an-array',
      };

      // 执行测试
      await languagesController.preloadLanguage(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['languages?.join is not a function'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([
        'javascript',
      ]);
      mockTreeSitterService.preloadLanguages.mockRejectedValue(
        new Error('Service error'),
      );

      mockRequest.body = {
        languages: ['javascript'],
      };

      // 执行测试
      await languagesController.preloadLanguage(
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

  describe('getLanguageExamples', () => {
    it('应该返回JavaScript查询示例', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'javascript',
      };

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'javascript',
          examples: [
            {
              name: 'Function declarations',
              description: 'Find all function declarations',
              query:
                '(function_declaration name: (identifier) @name) @function',
            },
            {
              name: 'Variable declarations',
              description: 'Find all variable declarations',
              query:
                '(variable_declarator name: (identifier) @name value: _ @value) @variable',
            },
            {
              name: 'Class declarations',
              description: 'Find all class declarations',
              query: '(class_declaration name: (identifier) @name) @class',
            },
          ],
        },
        timestamp: expect.any(String),
      });
    });

    it('应该返回TypeScript查询示例', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['typescript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'typescript',
      };

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'typescript',
          examples: [
            {
              name: 'Interface declarations',
              description: 'Find all interface declarations',
              query:
                '(interface_declaration name: (type_identifier) @name) @interface',
            },
            {
              name: 'Type aliases',
              description: 'Find all type aliases',
              query:
                '(type_alias_declaration name: (type_identifier) @name) @type_alias',
            },
          ],
        },
        timestamp: expect.any(String),
      });
    });

    it('应该返回Python查询示例', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['python'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'python',
      };

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'python',
          examples: [
            {
              name: 'Function definitions',
              description: 'Find all function definitions',
              query: '(function_definition name: (identifier) @name) @function',
            },
            {
              name: 'Class definitions',
              description: 'Find all class definitions',
              query: '(class_definition name: (identifier) @name) @class',
            },
            {
              name: 'Import statements',
              description: 'Find all import statements',
              query: '(import_statement name: (dotted_name) @name) @import',
            },
          ],
        },
        timestamp: expect.any(String),
      });
    });

    it('应该处理不支持的语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      mockRequest.params = {
        language: 'unsupported',
      };

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Unsupported language: unsupported'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理缺少语言参数的情况', async () => {
      // 准备测试数据
      mockRequest.params = {};

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        errors: ['Language parameter is required'],
        timestamp: expect.any(String),
      });
    });

    it('应该处理服务错误', async () => {
      // 准备测试数据
      mockTreeSitterService.getSupportedLanguages.mockImplementation(() => {
        throw new Error('Service error');
      });

      mockRequest.params = {
        language: 'javascript',
      };

      // 执行测试
      await languagesController.getLanguageExamples(
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

    it('应该返回空数组对于没有示例的语言', async () => {
      // 准备测试数据
      const mockSupportedLanguages: SupportedLanguage[] = ['javascript'];
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(
        mockSupportedLanguages,
      );

      // 修改请求参数为一个不存在的语言，但绕过支持检查
      mockRequest.params = {
        language: 'nonexistent',
      };

      // 临时修改 getSupportedLanguages 以包含不存在的语言
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([
        'javascript',
        'nonexistent' as SupportedLanguage,
      ]);

      // 执行测试
      await languagesController.getLanguageExamples(
        mockRequest as Request,
        mockResponse as Response,
      );

      // 验证结果
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          language: 'nonexistent',
          examples: [],
        },
        timestamp: expect.any(String),
      });
    });
  });
});
