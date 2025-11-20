/**
 * 高级查询控制器 - 处理高级查询相关的HTTP请求
 */

import { Request, Response } from 'express';
import { TreeSitterService } from '../core/TreeSitterService';
import {
  AdvancedParseRequest,
  AdvancedParseResult
} from '../types/advancedQuery';
import {
  ApiResponse,
  ErrorResponse
} from '../types/api';
import { log } from '../utils/Logger';

/**
 * 创建高级查询控制器
 */
export const createAdvancedQueryController = (service: TreeSitterService) => {
  /**
   * 处理高级查询请求
   */
  const parseWithAdvancedFeatures = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const parseRequest = req.body as AdvancedParseRequest;

      log.info(
        'AdvancedQueryController',
        `Processing advanced query request - RequestID: ${requestId}, Language: ${parseRequest.language}, Code length: ${parseRequest.code.length}`,
      );

      // 验证高级查询请求
      const validationResult = validateAdvancedRequest(parseRequest);
      if (!validationResult.isValid) {
        const response: ErrorResponse = {
          success: false,
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        };

        res.setHeader('X-Processing-Time', `${Date.now() - startTime}ms`);
        res.status(400).json(response);
        return;
      }

      // 处理高级查询请求
      const result = await service.processAdvancedRequest(parseRequest);

      // 计算处理时间
      const duration = Date.now() - startTime;

      // 构建响应
      const response: ApiResponse<AdvancedParseResult> = {
        success: result.success,
        data: result,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };

      // 记录处理结果
      if (result.success) {
        log.info(
          'AdvancedQueryController',
          `Advanced query request completed successfully - RequestID: ${requestId}, Duration: ${duration}ms, Matches: ${result.matches.length}`,
        );
      } else {
        log.warn(
          'AdvancedQueryController',
          `Advanced query request completed with errors - RequestID: ${requestId}, Duration: ${duration}ms, Errors: ${result.errors.length}`,
        );
      }

      // 设置响应头
      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.setHeader('X-Match-Count', result.matches.length.toString());
      if (result.queryFeatures) {
        res.setHeader('X-Query-Complexity', result.queryFeatures.complexity);
        res.setHeader('X-Predicate-Count', result.queryFeatures.predicateCount.toString());
        res.setHeader('X-Directive-Count', result.queryFeatures.directiveCount.toString());
      }

      // 发送响应
      res.status(result.success ? 200 : 422).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'AdvancedQueryController',
        `Advanced query request failed - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ErrorResponse = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(500).json(response);
    }
  };

  /**
   * 分析查询语法
   */
  const analyzeQuery = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const { language, query } = req.body;

      if (!language || typeof language !== 'string') {
        throw new Error('Missing or invalid field: language');
      }

      if (!query || typeof query !== 'string') {
        throw new Error('Missing or invalid field: query');
      }

      log.info(
        'AdvancedQueryController',
        `Analyzing query - RequestID: ${requestId}, Language: ${language}`,
      );

      // 分析查询
      const analysis = await service.analyzeQuery(language, query);

      const duration = Date.now() - startTime;

      log.info(
        'AdvancedQueryController',
        `Query analysis completed - RequestID: ${requestId}, Duration: ${duration}ms`,
      );

      const response = {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'AdvancedQueryController',
        `Query analysis error - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ErrorResponse = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(400).json(response);
    }
  };

  /**
   * 验证高级查询语法
   */
  const validateAdvancedQuery = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const { language, query } = req.body;

      if (!language || typeof language !== 'string') {
        throw new Error('Missing or invalid field: language');
      }

      if (!query || typeof query !== 'string') {
        throw new Error('Missing or invalid field: query');
      }

      log.info(
        'AdvancedQueryController',
        `Validating advanced query - RequestID: ${requestId}, Language: ${language}`,
      );

      // 验证查询
      const validation = await service.validateAdvancedQuery(language, query);

      const duration = Date.now() - startTime;

      log.info(
        'AdvancedQueryController',
        `Advanced query validation completed - RequestID: ${requestId}, Duration: ${duration}ms, Valid: ${validation.isValid}`,
      );

      const response = {
        success: true,
        data: {
          valid: validation.isValid,
          language,
          query,
          features: validation.features,
          errors: validation.errors,
          warnings: validation.warnings,
          suggestions: validation.suggestions,
        },
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.setHeader('X-Validation-Result', validation.isValid ? 'valid' : 'invalid');
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'AdvancedQueryController',
        `Advanced query validation error - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ErrorResponse = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(400).json(response);
    }
  };

  /**
   * 获取查询优化建议
   */
  const getQueryOptimizations = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const { language, query } = req.body;

      if (!language || typeof language !== 'string') {
        throw new Error('Missing or invalid field: language');
      }

      if (!query || typeof query !== 'string') {
        throw new Error('Missing or invalid field: query');
      }

      log.info(
        'AdvancedQueryController',
        `Getting query optimizations - RequestID: ${requestId}, Language: ${language}`,
      );

      // 获取优化建议
      const optimizations = await service.getQueryOptimizations(language, query);

      const duration = Date.now() - startTime;

      log.info(
        'AdvancedQueryController',
        `Query optimization analysis completed - RequestID: ${requestId}, Duration: ${duration}ms, Suggestions: ${optimizations.length}`,
      );

      const response = {
        success: true,
        data: {
          language,
          query,
          optimizations,
        },
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.setHeader('X-Optimization-Count', optimizations.length.toString());
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'AdvancedQueryController',
        `Query optimization error - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ErrorResponse = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(400).json(response);
    }
  };

  /**
   * 获取查询统计信息
   */
  const getQueryStatistics = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      log.info(
        'AdvancedQueryController',
        `Getting query statistics - RequestID: ${requestId}`,
      );

      // 获取统计信息
      const statistics = await service.getQueryStatistics();

      const duration = Date.now() - startTime;

      log.info(
        'AdvancedQueryController',
        `Query statistics retrieved - RequestID: ${requestId}, Duration: ${duration}ms`,
      );

      const response = {
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'AdvancedQueryController',
        `Query statistics error - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ErrorResponse = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(500).json(response);
    }
  };

  return {
    parseWithAdvancedFeatures,
    analyzeQuery,
    validateAdvancedQuery,
    getQueryOptimizations,
    getQueryStatistics,
  };
};

/**
 * 验证高级查询请求
 */
function validateAdvancedRequest(request: AdvancedParseRequest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.language || typeof request.language !== 'string') {
    errors.push('Missing or invalid field: language');
  }

  if (request.code === undefined || request.code === null) {
    errors.push('Missing or invalid field: code');
  }

  if (typeof request.code !== 'string') {
    errors.push('Code must be a string');
  }

  if (request.query && typeof request.query !== 'string') {
    errors.push('Query must be a string');
  }

  if (request.queries && !Array.isArray(request.queries)) {
    errors.push('Queries must be an array');
  }

  if (request.queries) {
    for (let i = 0; i < request.queries.length; i++) {
      if (typeof request.queries[i] !== 'string') {
        errors.push(`Query at index ${i} must be a string`);
      }
    }
  }

  if (request.enableAdvancedFeatures !== undefined && typeof request.enableAdvancedFeatures !== 'boolean') {
    errors.push('enableAdvancedFeatures must be a boolean');
  }

  if (request.processDirectives !== undefined && typeof request.processDirectives !== 'boolean') {
    errors.push('processDirectives must be a boolean');
  }

  if (request.includeMetadata !== undefined && typeof request.includeMetadata !== 'boolean') {
    errors.push('includeMetadata must be a boolean');
  }

  if (request.maxResults !== undefined && (typeof request.maxResults !== 'number' || request.maxResults < 0)) {
    errors.push('maxResults must be a non-negative number');
  }

  if (request.timeout !== undefined && (typeof request.timeout !== 'number' || request.timeout < 0)) {
    errors.push('timeout must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 高级查询控制器类型定义
 */
export type AdvancedQueryController = ReturnType<typeof createAdvancedQueryController>;