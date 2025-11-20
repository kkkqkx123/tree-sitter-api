/**
 * 语言列表控制器 - 提供支持的语言信息
 */

import { Request, Response } from 'express';
import { TreeSitterService } from '../core/TreeSitterService';
import { ApiResponse, LanguagesResponse } from '../types/api';
import { SupportedLanguage } from '../types/treeSitter';
import { log } from '../utils/Logger';

/**
 * 创建语言列表控制器
 */
export const createLanguagesController = (service: TreeSitterService) => {
  /**
   * 获取支持的语言列表
   */
  const getSupportedLanguages = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';

    try {
      log.debug(
        'LanguagesController',
        `Getting supported languages - RequestID: ${requestId}`,
      );

      // 获取支持的语言列表
      const languages = service.getSupportedLanguages();

      // 构建响应
      const response: ApiResponse<LanguagesResponse> = {
        success: true,
        data: {
          languages: languages as string[],
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(
        'LanguagesController',
        `Failed to get supported languages - RequestID: ${requestId}, Error: ${errorMessage}`,
      );

      const response: ApiResponse<null> = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 获取语言详细信息
   */
  const getLanguageInfo = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const { language } = req.params;

    try {
      log.debug(
        'LanguagesController',
        `Getting language info - RequestID: ${requestId}, Language: ${language}`,
      );

      if (!language) {
        throw new Error('Language parameter is required');
      }

      // 验证语言是否支持
      const supportedLanguages = service.getSupportedLanguages();
      if (!supportedLanguages.includes(language as SupportedLanguage)) {
        throw new Error(`Unsupported language: ${language}`);
      }

      // 获取语言信息
      const languageInfo = getLanguageDetails(language as SupportedLanguage);

      // 构建响应
      const response = {
        success: true,
        data: languageInfo,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(
        'LanguagesController',
        `Failed to get language info - RequestID: ${requestId}, Language: ${language}, Error: ${errorMessage}`,
      );

      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      const statusCode = errorMessage.includes('Unsupported language')
        ? 404
        : 500;
      res.status(statusCode).json(response);
    }
  };

  /**
   * 预加载语言
   */
  const preloadLanguage = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const { languages } = req.body;

    try {
      log.debug(
        'LanguagesController',
        `Preloading languages - RequestID: ${requestId}, Languages: ${languages?.join(', ') || 'all'}`,
      );

      let languagesToPreload: SupportedLanguage[];

      if (!languages) {
        // 预加载所有语言
        languagesToPreload = service.getSupportedLanguages();
      } else if (Array.isArray(languages)) {
        // 验证语言列表
        const supportedLanguages = service.getSupportedLanguages();
        const invalidLanguages = languages.filter(
          lang => !supportedLanguages.includes(lang as SupportedLanguage),
        );

        if (invalidLanguages.length > 0) {
          throw new Error(
            `Unsupported languages: ${invalidLanguages.join(', ')}`,
          );
        }

        languagesToPreload = languages as SupportedLanguage[];
      } else {
        throw new Error('Languages must be an array');
      }

      // 预加载语言
      const startTime = Date.now();
      await service.preloadLanguages();
      const duration = Date.now() - startTime;

      // 构建响应
      const response = {
        success: true,
        data: {
          languages: languagesToPreload,
          count: languagesToPreload.length,
          duration,
          message: `Successfully preloaded ${languagesToPreload.length} languages in ${duration}ms`,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(
        'LanguagesController',
        `Failed to preload languages - RequestID: ${requestId}, Error: ${errorMessage}`,
      );

      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      const statusCode = errorMessage.includes('Unsupported languages')
        ? 400
        : 500;
      res.status(statusCode).json(response);
    }
  };

  /**
   * 获取语言查询示例
   */
  const getLanguageExamples = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const { language } = req.params;

    try {
      log.debug(
        'LanguagesController',
        `Getting language examples - RequestID: ${requestId}, Language: ${language}`,
      );

      if (!language) {
        throw new Error('Language parameter is required');
      }

      // 验证语言是否支持
      const supportedLanguages = service.getSupportedLanguages();
      if (!supportedLanguages.includes(language as SupportedLanguage)) {
        throw new Error(`Unsupported language: ${language}`);
      }

      // 获取语言示例
      const examples = getLanguageQueryExamples(language as SupportedLanguage);

      // 构建响应
      const response = {
        success: true,
        data: {
          language,
          examples,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(
        'LanguagesController',
        `Failed to get language examples - RequestID: ${requestId}, Language: ${language}, Error: ${errorMessage}`,
      );

      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      const statusCode = errorMessage.includes('Unsupported language')
        ? 404
        : 500;
      res.status(statusCode).json(response);
    }
  };

  return {
    getSupportedLanguages,
    getLanguageInfo,
    preloadLanguage,
    getLanguageExamples,
  };
};

/**
 * 获取语言详细信息
 */
function getLanguageDetails(language: SupportedLanguage): any {
  const languageDetails: Record<string, any> = {
    javascript: {
      name: 'JavaScript',
      extensions: ['.js', '.jsx', '.mjs'],
      mimeType: 'text/javascript',
      description: 'JavaScript programming language',
      popularity: 'high',
    },
    typescript: {
      name: 'TypeScript',
      extensions: ['.ts'],
      mimeType: 'text/typescript',
      description: 'TypeScript programming language',
      popularity: 'high',
    },
    tsx: {
      name: 'TSX',
      extensions: ['.tsx'],
      mimeType: 'text/tsx',
      description: 'TSX (TypeScript with JSX) programming language',
      popularity: 'high',
    },
    python: {
      name: 'Python',
      extensions: ['.py', '.pyw', '.py3'],
      mimeType: 'text/x-python',
      description: 'Python programming language',
      popularity: 'high',
    },
    java: {
      name: 'Java',
      extensions: ['.java'],
      mimeType: 'text/x-java-source',
      description: 'Java programming language',
      popularity: 'high',
    },
    go: {
      name: 'Go',
      extensions: ['.go'],
      mimeType: 'text/x-go',
      description: 'Go programming language',
      popularity: 'medium',
    },
    rust: {
      name: 'Rust',
      extensions: ['.rs'],
      mimeType: 'text/x-rust',
      description: 'Rust programming language',
      popularity: 'medium',
    },
    cpp: {
      name: 'C++',
      extensions: [
        '.cpp',
        '.cxx',
        '.cc',
        '.c++',
        '.hpp',
        '.hxx',
        '.hh',
        '.h++',
      ],
      mimeType: 'text/x-c++src',
      description: 'C++ programming language',
      popularity: 'high',
    },
    c: {
      name: 'C',
      extensions: ['.c', '.h'],
      mimeType: 'text/x-c',
      description: 'C programming language',
      popularity: 'high',
    },
    csharp: {
      name: 'C#',
      extensions: ['.cs'],
      mimeType: 'text/x-csharp',
      description: 'C# programming language',
      popularity: 'medium',
    },
    ruby: {
      name: 'Ruby',
      extensions: ['.rb', '.rbw'],
      mimeType: 'text/x-ruby',
      description: 'Ruby programming language',
      popularity: 'medium',
    },
  };

  return (
    languageDetails[language] || {
      name: language,
      extensions: [],
      mimeType: 'text/plain',
      description: 'Unknown language',
      popularity: 'low',
    }
  );
}

/**
 * 获取语言查询示例
 */
function getLanguageQueryExamples(language: SupportedLanguage): any[] {
  const examples: Record<string, any[]> = {
    javascript: [
      {
        name: 'Function declarations',
        description: 'Find all function declarations',
        query: '(function_declaration name: (identifier) @name) @function',
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
    typescript: [
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
    tsx: [
      {
        name: 'JSX Elements',
        description: 'Find all JSX elements',
        query: '(jsx_element open_tag: (jsx_opening_element name: (identifier) @tag)) @jsx',
      },
      {
        name: 'JSX Self-closing elements',
        description: 'Find all self-closing JSX elements',
        query: '(jsx_self_closing_element name: (identifier) @tag) @jsx',
      },
      {
        name: 'Interface declarations',
        description: 'Find all interface declarations',
        query:
          '(interface_declaration name: (type_identifier) @name) @interface',
      },
    ],
    python: [
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
    java: [
      {
        name: 'Method declarations',
        description: 'Find all method declarations',
        query: '(method_declaration name: (identifier) @name) @method',
      },
      {
        name: 'Class declarations',
        description: 'Find all class declarations',
        query: '(class_declaration name: (identifier) @name) @class',
      },
    ],
    go: [
      {
        name: 'Function declarations',
        description: 'Find all function declarations',
        query: '(function_declaration name: (identifier) @name) @function',
      },
      {
        name: 'Struct types',
        description: 'Find all struct type declarations',
        query:
          '(type_spec name: (type_identifier) @name type: (struct_type) @struct) @type_declaration',
      },
    ],
    rust: [
      {
        name: 'Function definitions',
        description: 'Find all function definitions',
        query: '(function_item name: (identifier) @name) @function',
      },
      {
        name: 'Struct definitions',
        description: 'Find all struct definitions',
        query: '(struct_item name: (type_identifier) @name) @struct',
      },
    ],
    cpp: [
      {
        name: 'Function definitions',
        description: 'Find all function definitions',
        query:
          '(function_definition declarator: (function_declarator declarator: (identifier) @name)) @function',
      },
      {
        name: 'Class definitions',
        description: 'Find all class definitions',
        query: '(class_specifier name: (type_identifier) @name) @class',
      },
    ],
    c: [
      {
        name: 'Function definitions',
        description: 'Find all function definitions',
        query:
          '(function_definition declarator: (function_declarator declarator: (identifier) @name)) @function',
      },
      {
        name: 'Struct declarations',
        description: 'Find all struct declarations',
        query: '(struct_specifier name: (type_identifier) @name) @struct',
      },
    ],
    csharp: [
      {
        name: 'Method declarations',
        description: 'Find all method declarations',
        query: '(method_declaration name: (identifier) @name) @method',
      },
      {
        name: 'Class declarations',
        description: 'Find all class declarations',
        query: '(class_declaration name: (identifier) @name) @class',
      },
    ],
    ruby: [
      {
        name: 'Method definitions',
        description: 'Find all method definitions',
        query: '(method name: (identifier) @name) @method',
      },
      {
        name: 'Class definitions',
        description: 'Find all class definitions',
        query: '(class name: (constant) @name) @class',
      },
    ],
  };

  return examples[language] || [];
}

/**
 * 语言列表控制器类型定义
 */
export type LanguagesController = ReturnType<typeof createLanguagesController>;
