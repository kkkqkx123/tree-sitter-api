/**
 * 请求验证中间件
 */

import { Request, Response, NextFunction } from 'express';
import { ParseRequest } from '../types/api';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../types/errors';
import { EnvConfig } from '../config/env';
import { log } from '../utils/Logger';

/**
 * 验证解析请求的中间件
 */
export const validateParseRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const body = req.body as ParseRequest;

    // 检查请求体是否存在
    if (!body) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Request body is required',
      );
    }

    // 验证必需字段
    if (!body.language || typeof body.language !== 'string') {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Missing or invalid field: language (string required)',
      );
    }

    if (!body.code || typeof body.code !== 'string') {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Missing or invalid field: code (string required)',
      );
    }

    // 验证语言格式
    if (!/^[a-z][a-z0-9_-]*$/i.test(body.language)) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Invalid language format. Only alphanumeric characters, hyphens and underscores are allowed',
      );
    }

    // 验证代码长度
    if (body.code.length > EnvConfig.MAX_CODE_LENGTH) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Code length exceeds maximum allowed size of ${EnvConfig.MAX_CODE_LENGTH} bytes`,
      );
    }

    // 验证查询数组
    if (!body.queries) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Missing required field: queries (array of strings expected)',
      );
    }

    if (!Array.isArray(body.queries)) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Invalid field: queries (array expected)',
      );
    }

    if (body.queries.length === 0) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'At least one query is required in the queries array',
      );
    }

    // 检查查询数组中的每个元素
    for (let i = 0; i < body.queries.length; i++) {
      if (typeof body.queries[i] !== 'string') {
        throw new TreeSitterError(
          ErrorType.VALIDATION_ERROR,
          ErrorSeverity.MEDIUM,
          `Invalid query at index ${i}: string expected`,
        );
      }
    }

    // 验证查询数量
    if (body.queries.length > 10) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Too many queries. Maximum allowed is 10, got ${body.queries.length}`,
      );
    }

    // 验证查询语法（基本检查）
    body.queries.forEach((query, index) => {
      validateQuerySyntax(query, `queries[${index}]`);
    });

    // 记录验证通过的请求
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    log.debug(
      'Validation',
      `Parse request validated successfully - RequestID: ${requestId}, Language: ${body.language}, Code length: ${body.code.length}, Query count: ${body.queries.length}`,
    );

    next();
  } catch (error) {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    log.warn(
      'Validation',
      `Parse request validation failed - RequestID: ${requestId}, Error: ${error instanceof Error ? error.message : String(error)}`,
    );

    if (error instanceof TreeSitterError) {
      res.status(400).json({
        success: false,
        errors: [error.message],
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        success: false,
        errors: ['Validation failed'],
        timestamp: new Date().toISOString(),
      });
    }
  }
};

/**
 * 验证查询语法的基本检查
 */
function validateQuerySyntax(query: string, field: string): void {
  // 基本语法检查
  if (!query.trim()) {
    throw new TreeSitterError(
      ErrorType.QUERY_ERROR,
      ErrorSeverity.MEDIUM,
      `Empty query in field: ${field}`,
    );
  }

  // 检查括号平衡
  let parenthesesCount = 0;
  for (const char of query) {
    if (char === '(') {
      parenthesesCount++;
    } else if (char === ')') {
      parenthesesCount--;
      if (parenthesesCount < 0) {
        throw new TreeSitterError(
          ErrorType.QUERY_ERROR,
          ErrorSeverity.MEDIUM,
          `Unbalanced parentheses in query: ${field}`,
        );
      }
    }
  }

  if (parenthesesCount !== 0) {
    throw new TreeSitterError(
      ErrorType.QUERY_ERROR,
      ErrorSeverity.MEDIUM,
      `Unbalanced parentheses in query: ${field}`,
    );
  }

  // 检查是否包含@符号（捕获标记）
  if (!query.includes('@')) {
    throw new TreeSitterError(
      ErrorType.QUERY_ERROR,
      ErrorSeverity.MEDIUM,
      `Query must contain at least one capture pattern with @ symbol: ${field}`,
    );
  }
}

/**
 * 通用请求验证中间件
 */
export const validateRequest = (validationFn: (req: Request) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      validationFn(req);
      next();
    } catch (error) {
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';
      log.warn(
        'Validation',
        `Request validation failed - RequestID: ${requestId}, Error: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (error instanceof TreeSitterError) {
        const statusCode = getStatusCode(error.type);
        res.status(statusCode).json({
          success: false,
          errors: [error.message],
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          errors: ['Validation failed'],
          timestamp: new Date().toISOString(),
        });
      }
    }
  };
};

/**
 * 根据错误类型获取HTTP状态码
 */
function getStatusCode(errorType: ErrorType): number {
  switch (errorType) {
    case ErrorType.VALIDATION_ERROR:
      return 400;
    case ErrorType.UNSUPPORTED_LANGUAGE:
      return 404;
    case ErrorType.PARSE_ERROR:
    case ErrorType.QUERY_ERROR:
      return 422;
    case ErrorType.MEMORY_ERROR:
    case ErrorType.TIMEOUT_ERROR:
      return 503;
    default:
      return 500;
  }
}

/**
 * 请求大小限制中间件
 */
function parseSizeString(sizeStr: string | undefined): number {
  const str = sizeStr || '5mb';
  const match = str.match(/^(\d+)([kmg]?)b?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${str}`);
  }

  const num = match[1] || '';
  const unit = match[2];
  let bytes = parseInt(num, 10);

  if (unit) {
    switch (unit.toLowerCase()) {
      case 'k':
        bytes *= 1024;
        break;
      case 'm':
        bytes *= 1024 * 1024;
        break;
      case 'g':
        bytes *= 1024 * 1024 * 1024;
        break;
    }
  }

  return bytes;
}

export const requestSizeLimit = (maxSize?: number) => {
  const finalMaxSize =
    maxSize ?? parseSizeString(EnvConfig.MAX_REQUEST_SIZE as string);
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > finalMaxSize) {
      const requestId = (req.headers['x-request-id'] as string) || 'unknown';
      log.warn(
        'Validation',
        `Request size limit exceeded - RequestID: ${requestId}, Size: ${contentLength}, Limit: ${finalMaxSize}`,
      );

      res.status(413).json({
        success: false,
        errors: [
          `Request size ${contentLength} exceeds maximum allowed size of ${finalMaxSize} bytes`,
        ],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * 并发请求限制中间件
 */
export class ConcurrencyLimiter {
  private activeRequests: Set<string> = new Set();
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId =
        (req.headers['x-request-id'] as string) || this.generateRequestId();

      if (this.activeRequests.size >= this.maxConcurrent) {
        log.warn(
          'ConcurrencyLimiter',
          `Concurrent request limit exceeded - RequestID: ${requestId}, Active: ${this.activeRequests.size}, Limit: ${this.maxConcurrent}`,
        );

        res.status(429).json({
          success: false,
          errors: [
            `Server is busy. Maximum concurrent requests (${this.maxConcurrent}) exceeded. Please try again later.`,
          ],
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.activeRequests.add(requestId);

      // 清理请求ID
      res.on('finish', () => {
        this.activeRequests.delete(requestId);
      });

      res.on('close', () => {
        this.activeRequests.delete(requestId);
      });

      next();
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getActiveCount(): number {
    return this.activeRequests.size;
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }
}

// 创建默认的并发限制器实例
export const defaultConcurrencyLimiter = new ConcurrencyLimiter(10);
