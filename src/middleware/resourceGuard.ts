import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../core/MonitoringService';
import { ResourceService } from '../core/ResourceService';
import { CleanupStrategy } from '../config/memory';
import { log } from '../utils/Logger';

/**
 * 资源保护中间件配置
 */
interface ResourceGuardConfig {
  maxRequestSize: number; // 最大请求大小（字节）
  maxCodeLength: number; // 最大代码长度（字节）
  requestTimeout: number; // 请求超时时间（毫秒）
  memoryCheckInterval: number; // 内存检查间隔（毫秒）- 已调整为减少重复检查
  maxConcurrentRequests: number; // 最大并发请求数
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ResourceGuardConfig = {
  maxRequestSize: 5 * 1024 * 1024, // 5MB
  maxCodeLength: 100 * 1024, // 100KB
  requestTimeout: 30000, // 30秒
  memoryCheckInterval: 15000, // 15秒 - 调整间隔以减少重复检查
  maxConcurrentRequests: 10, // 10个并发请求
};

/**
 * 资源保护中间件
 * 监控内存使用情况，限制请求大小，防止资源耗尽
 */
export const resourceGuard = (
  monitoringService: MonitoringService,
  _resourceService: ResourceService, // 暂时未使用，但保留以备将来扩展
  config: Partial<ResourceGuardConfig> = {},
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let activeRequests = 0;
  let lastMemoryCheck = 0;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // 检查并发请求数
    if (activeRequests >= finalConfig.maxConcurrentRequests) {
      return void res.status(503).json({
        success: false,
        errors: [
          'Service temporarily unavailable: too many concurrent requests',
        ],
        timestamp: new Date().toISOString(),
      });
    }

    // 增加活跃请求计数
    activeRequests++;

    try {
      // 检查请求大小
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > finalConfig.maxRequestSize) {
        return void res.status(413).json({
          success: false,
          errors: [
            `Request too large: ${contentLength} bytes (max: ${finalConfig.maxRequestSize} bytes)`,
          ],
          timestamp: new Date().toISOString(),
        });
      }

      // 检查请求体中的代码长度
      if (req.body && req.body.code && typeof req.body.code === 'string') {
        if (req.body.code.length > finalConfig.maxCodeLength) {
          return void res.status(413).json({
            success: false,
            errors: [
              `Code too long: ${req.body.code.length} characters (max: ${finalConfig.maxCodeLength} characters)`,
            ],
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 定期检查内存状态
      const now = Date.now();
      if (now - lastMemoryCheck > finalConfig.memoryCheckInterval) {
        lastMemoryCheck = now;
        const memoryStatus = monitoringService.checkMemory();

        // 如果内存状态严重，尝试清理
        if (memoryStatus.level === 'critical') {
          log.warn(
            'ResourceGuard',
            'Critical memory usage detected, attempting cleanup',
          );
          await monitoringService.performCleanup(CleanupStrategy.EMERGENCY);

          // 再次检查内存状态
          const statusAfterCleanup = monitoringService.checkMemory();
          if (statusAfterCleanup.level === 'critical') {
            return void res.status(503).json({
              success: false,
              errors: ['Service temporarily unavailable: out of memory'],
              timestamp: new Date().toISOString(),
              memoryStatus: statusAfterCleanup,
            });
          }
        }
      }

      // 记录请求开始时的内存状态
      const startMemory = process.memoryUsage();

      // 设置请求超时
      req.setTimeout(finalConfig.requestTimeout, () => {
        log.warn('ResourceGuard', `Request timeout: ${req.method} ${req.path}`);
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            errors: ['Request timeout'],
            timestamp: new Date().toISOString(),
          });
        }
      });

      // 监听响应完成事件
      res.on('finish', () => {
        // 减少活跃请求计数
        activeRequests--;

        // 检查内存增长
        const endMemory = process.memoryUsage();
        const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;

        if (memoryGrowth > 10 * 1024 * 1024) {
          // 10MB增长
          log.warn(
            'ResourceGuard',
            `High memory growth detected: ${Math.round(memoryGrowth / 1024 / 1024)}MB`,
          );

          // 如果需要，触发清理
          const currentMemoryStatus = monitoringService.checkMemory();
          if (
            currentMemoryStatus.level === 'warning' ||
            currentMemoryStatus.level === 'critical'
          ) {
            const strategy =
              currentMemoryStatus.level === 'critical'
                ? CleanupStrategy.EMERGENCY
                : CleanupStrategy.AGGRESSIVE;
            void monitoringService.performCleanup(strategy);
          }
        }
      });

      // 继续处理请求
      next();
    } catch (error) {
      // 确保在错误情况下也减少活跃请求计数
      activeRequests--;
      next(error);
    }
  };
};

/**
 * 内存监控中间件
 * 专门用于监控内存使用情况
 */
export const memoryMonitor = (monitor: MonitoringService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const memoryStatus = monitor.checkMemory();

    // 添加内存状态到请求对象
    (req as any).memoryStatus = memoryStatus;

    // 如果内存状态严重，添加警告头
    if (memoryStatus.level === 'critical') {
      res.setHeader('X-Memory-Status', 'critical');
    } else if (memoryStatus.level === 'warning') {
      res.setHeader('X-Memory-Status', 'warning');
    }

    next();
  };
};

/**
 * 请求限制中间件
 * 基于IP和请求频率的限制
 */
export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 60000,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // 获取或创建IP记录
    let ipRequests = requests.get(ip);
    if (!ipRequests || now > ipRequests.resetTime) {
      ipRequests = { count: 0, resetTime: now + windowMs };
      requests.set(ip, ipRequests);
    }

    // 增加请求计数
    ipRequests.count++;

    // 检查是否超过限制
    if (ipRequests.count > maxRequests) {
      return void res.status(429).json({
        success: false,
        errors: [
          `Too many requests: ${ipRequests.count}/${maxRequests} per ${windowMs / 1000
          }s`,
        ],
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil((ipRequests.resetTime - now) / 1000),
      });
    }

    // 添加限制信息到响应头
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, maxRequests - ipRequests.count),
    );
    res.setHeader('X-RateLimit-Reset', ipRequests.resetTime);

    next();
  };
};

/**
 * 健康检查中间件
 * 提供详细的系统健康状态
 */
export const healthCheck = (
  monitoringService: MonitoringService,
  errorHandler: any,
): ((req: Request, res: Response) => void) => {
  return (_req: Request, res: Response): void => {
    const memoryStatus = monitoringService.checkMemory();
    const errorStats = errorHandler.getErrorStats();
    const memoryStats = monitoringService.getStatistics();

    // 确定整体健康状态
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

    if (memoryStatus.level === 'critical' || errorStats.recentErrors > 10) {
      overallStatus = 'error';
    } else if (
      memoryStatus.level === 'warning' ||
      errorStats.recentErrors > 5
    ) {
      overallStatus = 'warning';
    }

    const response = {
      status: overallStatus,
      memory: {
        ...memoryStatus,
        stats: memoryStats,
      },
      errors: errorStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] || '1.0.0',
    };

    // 根据健康状态设置HTTP状态码
    const statusCode =
      overallStatus === 'error' ? 503 : overallStatus === 'warning' ? 200 : 200;

    res.status(statusCode).json(response);
  };
};
