import { Request, Response, NextFunction } from 'express';
import { ErrorSeverity, ErrorType, TreeSitterError } from '@/types/errors';
import { ErrorHandler } from '@/errors/ErrorHandler';
import { RecoveryStrategy } from '@/errors/RecoveryStrategy';

/**
 * 全局错误处理中间件
 * 捕获所有错误，进行分类处理并尝试恢复
 */
export const globalErrorHandler = (
  errorHandler: ErrorHandler,
  recoveryStrategy: RecoveryStrategy
) => {
  return async (error: Error, req: Request, res: Response, _next: NextFunction) => {
    // 处理错误
    const treeSitterError = errorHandler.handleError(error, `${req.method} ${req.path}`);

    // 尝试恢复
    const recoveryResult = await recoveryStrategy.attemptRecovery(treeSitterError);

    // 记录恢复结果
    if (!recoveryResult.success) {
      console.error('Recovery failed:', recoveryResult);
    }

    // 获取适当的HTTP状态码
    const statusCode = getStatusCode(treeSitterError.type);

    // 构建错误响应
    const errorResponse = {
      success: false,
      errors: [treeSitterError.message],
      errorType: treeSitterError.type,
      severity: treeSitterError.severity,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || generateRequestId(),
      recovery: recoveryResult.success ? {
        attempted: true,
        action: recoveryResult.action,
        message: recoveryResult.message
      } : {
        attempted: false,
        reason: 'Recovery not applicable or failed'
      }
    };

    // 在开发环境中包含更多错误详情
    if (process.env['NODE_ENV'] === 'development') {
      (errorResponse as Record<string, unknown>)['details'] = treeSitterError.details;
      (errorResponse as Record<string, unknown>)['stack'] = treeSitterError.stack;
    }

    // 发送错误响应
    res.status(statusCode).json(errorResponse);
  };
};

/**
 * 获取错误类型对应的HTTP状态码
 * @param errorType 错误类型
 * @returns HTTP状态码
 */
function getStatusCode(errorType: ErrorType): number {
  switch (errorType) {
    case ErrorType.VALIDATION_ERROR:
      return 400; // Bad Request
    case ErrorType.UNSUPPORTED_LANGUAGE:
      return 404; // Not Found
    case ErrorType.PARSE_ERROR:
    case ErrorType.QUERY_ERROR:
      return 422; // Unprocessable Entity
    case ErrorType.MEMORY_ERROR:
    case ErrorType.RESOURCE_ERROR:
    case ErrorType.TIMEOUT_ERROR:
      return 503; // Service Unavailable
    case ErrorType.INTERNAL_ERROR:
      return 500; // Internal Server Error
    default:
      return 500; // Internal Server Error
  }
}

/**
 * 生成请求ID
 * @returns 请求ID字符串
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获Promise rejection
 * @param fn 异步函数
 * @returns 包装后的函数
 */
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 错误日志中间件
 * 记录请求和错误信息
 */
export const errorLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // 记录请求开始
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`);

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

    // 如果是错误响应，记录更多信息
    if (res.statusCode >= 400) {
      console.error(`[ERROR] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
    }
  });

  next();
};

/**
 * 404错误处理中间件
 * 处理未找到的路由
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  const error = new TreeSitterError(
    ErrorType.VALIDATION_ERROR,
    ErrorSeverity.LOW,
    `Route ${req.method} ${req.path} not found`,
    { method: req.method, path: req.path, ip: req.ip }
  );

  res.status(404).json({
    success: false,
    errors: [error.message],
    errorType: error.type,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || generateRequestId()
  });
};