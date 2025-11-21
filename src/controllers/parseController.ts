/**
 * 解析控制器 - 处理代码解析请求
 */

import { Request, Response } from 'express';
import { TreeSitterService } from '../core/TreeSitterService';
import { ParseRequest, ParseResult, ApiResponse } from '../types/api';
import { log } from '../utils/Logger';

/**
 * 创建解析控制器
 */
export const createParseController = (service: TreeSitterService) => {
  /**
   * 处理解析请求
   */
  const parseCode = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const parseRequest = req.body as ParseRequest;

      log.info(
        'ParseController',
        `Processing parse request - RequestID: ${requestId}, Language: ${parseRequest.language}, Code length: ${parseRequest.code.length}`,
      );

      // 处理解析请求
      const result: ParseResult = await service.processRequest(parseRequest);

      // 计算处理时间
      const duration = Date.now() - startTime;

      // 构建响应
      const response: ApiResponse<ParseResult['matches']> = {
        success: result.success,
        data: result.matches,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };

      // 记录处理结果
      if (result.success) {
        log.info(
          'ParseController',
          `Parse request completed successfully - RequestID: ${requestId}, Duration: ${duration}ms, Matches: ${result.matches.length}`,
        );
      } else {
        log.warn(
          'ParseController',
          `Parse request completed with errors - RequestID: ${requestId}, Duration: ${duration}ms, Errors: ${result.errors.length}`,
        );
      }

      // 设置响应头
      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.setHeader('X-Match-Count', result.matches.length.toString());

      // 发送响应
      res.status(result.success ? 200 : 422).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'ParseController',
        `Parse request failed - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ApiResponse<null> = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(500).json(response);
    }
  };

  /**
   * 批量解析请求
   */
  const parseBatch = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const startTime = Date.now();

    try {
      const requests = req.body.requests as ParseRequest[];

      if (!Array.isArray(requests)) {
        throw new Error('Invalid request format: requests array is required');
      }

      if (requests.length === 0) {
        throw new Error('Empty requests array');
      }

      if (requests.length > 10) {
        throw new Error('Too many requests in batch. Maximum allowed is 10');
      }

      log.info(
        'ParseController',
        `Processing batch parse request - RequestID: ${requestId}, Count: ${requests.length}`,
      );

      const results: ParseResult[] = [];

      // 处理每个请求
      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        if (!request) {
          throw new Error(`Invalid request at index ${i}: request is required`);
        }
        try {
          const result = await service.processRequest(request);
          results.push(result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          results.push({
            success: false,
            matches: [],
            errors: [errorMessage],
          });
        }
      }

      // 计算处理时间
      const duration = Date.now() - startTime;

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const totalMatches = results.reduce(
        (sum, r) => sum + r.matches.length,
        0,
      );

      log.info(
        'ParseController',
        `Batch parse request completed - RequestID: ${requestId}, Duration: ${duration}ms, Success: ${successCount}/${requests.length}, Total matches: ${totalMatches}`,
      );

      // 构建响应
      const response = {
        success: true,
        data: {
          results,
          summary: {
            total: requests.length,
            successful: successCount,
            failed: requests.length - successCount,
            totalMatches,
          },
        },
        timestamp: new Date().toISOString(),
      };

      // 设置响应头
      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.setHeader('X-Batch-Size', requests.length.toString());
      res.setHeader('X-Success-Count', successCount.toString());

      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'ParseController',
        `Batch parse request failed - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response: ApiResponse<null> = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(400).json(response);
    }
  };

  /**
   * 验证查询语法
   */
  const validateQuery = async (req: Request, res: Response): Promise<void> => {
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
        'ParseController',
        `Validating query - RequestID: ${requestId}, Language: ${language}`,
      );

      // 创建一个简单的解析请求来验证查询
      const testRequest: ParseRequest = {
        language,
        code: 'test', // 简单的测试代码
        queries: [query],
      };

      // 尝试处理请求以验证查询
      const result = await service.processRequest(testRequest);

      const duration = Date.now() - startTime;

      if (result.success) {
        log.info(
          'ParseController',
          `Query validation successful - RequestID: ${requestId}, Duration: ${duration}ms`,
        );

        const response = {
          success: true,
          data: {
            valid: true,
            language,
            query,
            message: 'Query syntax is valid',
          },
          timestamp: new Date().toISOString(),
        };

        res.setHeader('X-Processing-Time', `${duration}ms`);
        res.status(200).json(response);
      } else {
        log.warn(
          'ParseController',
          `Query validation failed - RequestID: ${requestId}, Duration: ${duration}ms, Errors: ${result.errors.join(', ')}`,
        );

        const response = {
          success: false,
          data: {
            valid: false,
            language,
            query,
            errors: result.errors,
          },
          timestamp: new Date().toISOString(),
        };

        res.setHeader('X-Processing-Time', `${duration}ms`);
        res.status(422).json(response);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error(
        'ParseController',
        `Query validation error - RequestID: ${requestId}, Duration: ${duration}ms, Error: ${errorMessage}`,
      );

      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.setHeader('X-Processing-Time', `${duration}ms`);
      res.status(400).json(response);
    }
  };

  return {
    parseCode,
    parseBatch,
    validateQuery,
  };
};

/**
 * 解析控制器类型定义
 */
export type ParseController = ReturnType<typeof createParseController>;
