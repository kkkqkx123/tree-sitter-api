/**
 * Tree-sitter API服务器入口点
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ServerConfig } from '@/config/server';
import { TreeSitterService } from '@/core/TreeSitterService';
import { MemoryMonitor } from '@/core/MemoryMonitor';
import { ResourceCleaner } from '@/core/ResourceCleaner';
import { ErrorHandler } from '@/errors/ErrorHandler';
import { RecoveryStrategy } from '@/errors/RecoveryStrategy';
import { globalErrorHandler } from '@/middleware/globalErrorHandler';
import { resourceGuard } from '@/middleware/resourceGuard';
import { log } from '@/utils/Logger';

// 导入路由
import parseRoutes from '@/routes/parse';
import healthRoutes from '@/routes/health';
import languagesRoutes from '@/routes/languages';

class TreeSitterServer {
  private app: Application;
  private service: TreeSitterService;
  private memoryMonitor: MemoryMonitor;
  private resourceCleaner: ResourceCleaner;
  private errorHandler: ErrorHandler;
  private recoveryStrategy: RecoveryStrategy;
  private server: any;

  constructor() {
    this.app = express();
    this.service = new TreeSitterService();
    this.memoryMonitor = new MemoryMonitor();
    this.resourceCleaner = new ResourceCleaner();
    this.errorHandler = new ErrorHandler();
    this.recoveryStrategy = new RecoveryStrategy(this.resourceCleaner, this.memoryMonitor);

    // 设置资源清理器的依赖
    this.resourceCleaner.setParserPool(this.service['parserPool']);
    this.resourceCleaner.setLanguageManager(this.service['languageManager']);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * 初始化中间件
   */
  private initializeMiddleware(): void {
    // CORS配置
    this.app.use(cors({
      origin: ServerConfig.CORS.ORIGIN,
      methods: ServerConfig.CORS.METHODS,
      allowedHeaders: ServerConfig.CORS.ALLOWED_HEADERS,
      credentials: ServerConfig.CORS.CREDENTIALS,
    }));

    // 请求体解析
    this.app.use(bodyParser.json({ limit: ServerConfig.REQUEST.MAX_SIZE }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: ServerConfig.REQUEST.MAX_SIZE }));

    // 资源保护中间件
    this.app.use(resourceGuard(this.memoryMonitor, this.resourceCleaner));

    // 请求日志中间件
    if (ServerConfig.LOGGING.ENABLE_REQUEST_LOGGING) {
      this.app.use(this.requestLogger);
    }

    // 请求ID中间件
    this.app.use(this.requestIdMiddleware);
  }

  /**
   * 初始化路由
   */
  private initializeRoutes(): void {
    const apiPrefix = ServerConfig.API.PREFIX;

    // API路由
    this.app.use(`${apiPrefix}/parse`, parseRoutes(this.service));
    this.app.use(`${apiPrefix}/health`, healthRoutes(this.service));
    this.app.use(`${apiPrefix}/languages`, languagesRoutes(this.service));

    // 根路径
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'Tree-sitter API',
        version: ServerConfig.API.VERSION,
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // 404处理
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        errors: [`Route not found: ${req.method} ${req.originalUrl}`],
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * 初始化错误处理
   */
  private initializeErrorHandling(): void {
    this.app.use(globalErrorHandler(this.errorHandler, this.recoveryStrategy));
  }

  /**
   * 请求日志中间件
   */
  private requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] as string || 'unknown';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const memory = process.memoryUsage();

      log.info('RequestLogger', `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - Memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB - RequestID: ${requestId}`);
    });

    next();
  };

  /**
   * 请求ID中间件
   */
  private requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动服务器
   */
  public start(): void {
    const port = ServerConfig.SERVER.PORT;
    const host = ServerConfig.SERVER.HOST;

    this.server = this.app.listen(port, host, () => {
      log.info('Server', `Tree-sitter API server running on ${host}:${port}`);
      log.info('Server', `Environment: ${ServerConfig.SERVER.ENVIRONMENT}`);
      log.info('Server', `API prefix: ${ServerConfig.API.PREFIX}`);
    });

    // 设置服务器超时
    this.server.timeout = ServerConfig.REQUEST.TIMEOUT;

    // 设置优雅关闭
    this.setupGracefulShutdown();
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string): void => {
      log.info('Server', `Received ${signal}, shutting down gracefully`);

      this.server.close((err: Error | null) => {
        if (err) {
          log.error('Server', `Error during server shutdown: ${err.message}`);
          process.exit(1);
        }

        log.info('Server', 'HTTP server closed');

        // 清理资源
        this.cleanup()
          .then(() => {
            log.info('Server', 'Cleanup completed, exiting');
            process.exit(0);
          })
          .catch((error) => {
            log.error('Server', `Error during cleanup: ${error.message}`);
            process.exit(1);
          });
      });

      // 强制退出超时
      setTimeout(() => {
        log.error('Server', 'Forced exit due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // 处理未捕获的异常
    process.on('uncaughtException', (error: Error) => {
      log.error('Server', `Uncaught exception: ${error.message}`);
      log.error('Server', error.stack || 'No stack trace available');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: any) => {
      log.error('Server', `Unhandled rejection: ${reason}`);
      shutdown('unhandledRejection');
    });
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      // 销毁Tree-sitter服务
      this.service.destroy();

      // 销毁其他组件
      this.memoryMonitor.destroy();
      this.resourceCleaner.destroy();

      log.info('Server', 'All resources cleaned up');
    } catch (error) {
      log.error('Server', `Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取Express应用实例（用于测试）
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * 获取Tree-sitter服务实例（用于测试）
   */
  public getService(): TreeSitterService {
    return this.service;
  }
}

// 启动服务器
if (require.main === module) {
  const server = new TreeSitterServer();
  server.start();
}

export default TreeSitterServer;