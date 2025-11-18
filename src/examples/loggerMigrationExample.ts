/**
 * Logger迁移示例
 * 演示如何从console.log迁移到新的Logger模块
 */

import { log } from '../utils/Logger';

// ============================================================================
// 迁移前后的对比示例
// ============================================================================

// 1. 基本日志记录
// 迁移前
console.log('TreeSitterService initialized');
console.warn('Critical memory usage detected, attempting cleanup');
console.error('Recovery failed:', { success: false, reason: 'timeout' });

// 迁移后
log.info('TreeSitterService', 'TreeSitterService initialized');
log.warn('TreeSitterService', 'Critical memory usage detected, attempting cleanup');
log.error('ErrorHandler', 'Recovery failed:', { success: false, reason: 'timeout' });

// 2. 带时间戳的请求日志
// 迁移前
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`);
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

// 迁移后 (时间戳自动添加)
log.info('RequestLogger', `${req.method} ${req.path} - Request started`);
log.info('RequestLogger', `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

// 3. 错误处理日志
// 迁移前
switch (error.severity) {
  case 'CRITICAL':
    console.error(`[CRITICAL]${contextStr}`, error);
    break;
  case 'HIGH':
    console.error(`[HIGH]${contextStr}`, error);
    break;
  case 'MEDIUM':
    console.warn(`[MEDIUM]${contextStr}`, error);
    break;
  case 'LOW':
    console.info(`[LOW]${contextStr}`, error);
    break;
}

// 迁移后
switch (error.severity) {
  case 'CRITICAL':
    log.fatal('ErrorHandler', `[CRITICAL]${contextStr}`, error);
    break;
  case 'HIGH':
    log.error('ErrorHandler', `[HIGH]${contextStr}`, error);
    break;
  case 'MEDIUM':
    log.warn('ErrorHandler', `[MEDIUM]${contextStr}`, error);
    break;
  case 'LOW':
    log.info('ErrorHandler', `[LOW]${contextStr}`, error);
    break;
}

// ============================================================================
// 实际使用示例
// ============================================================================

export class ExampleService {
  private moduleName = 'ExampleService';

  async processRequest(request: any): Promise<any> {
    log.info(this.moduleName, 'Processing request started', { requestId: request.id });

    try {
      // 模拟处理过程
      const result = await this.doWork(request);
      
      log.info(this.moduleName, 'Request processed successfully', {
        requestId: request.id,
        duration: result.duration
      });
      
      return result;
    } catch (error) {
      log.error(this.moduleName, 'Request processing failed', error, {
        requestId: request.id,
        errorType: error.constructor.name
      });
      throw error;
    }
  }

  private async doWork(request: any): Promise<any> {
    log.debug(this.moduleName, 'Starting work', { requestSize: JSON.stringify(request).length });
    
    // 模拟一些工作
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log.debug(this.moduleName, 'Work completed');
    return { duration: 100 };
  }

  handleMemoryWarning(): void {
    log.warn(this.moduleName, 'Memory usage is high', {
      memoryUsage: process.memoryUsage(),
      threshold: '200MB'
    });
  }

  handleCriticalError(error: Error): void {
    log.fatal(this.moduleName, 'Critical error occurred', error, {
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
  }
}

// ============================================================================
// 环境配置示例
// ============================================================================

/*
开发环境 (.env.development):
LOG_LEVEL=debug
ENABLE_LOG_TIMESTAMP=true
ENABLE_LOG_MODULE=true

输出示例:
[2023-11-18T05:39:00.000Z] [DEBUG] [ExampleService] Starting work {"requestSize":123}
[2023-11-18T05:39:00.100Z] [DEBUG] [ExampleService] Work completed
[2023-11-18T05:39:00.101Z] [INFO] [ExampleService] Request processed successfully {"requestId":"abc123","duration":100}

生产环境 (.env.production):
LOG_LEVEL=warn
ENABLE_LOG_TIMESTAMP=true
ENABLE_LOG_MODULE=false

输出示例:
[2023-11-18T05:39:00.000Z] [WARN] Memory usage is high {"memoryUsage":{"rss":134217728,"heapTotal":67108864,"heapUsed":45088768,"external":2097152},"threshold":"200MB"}
[2023-11-18T05:39:00.100Z] [ERROR] Request processing failed Error: Something went wrong {"requestId":"abc123","errorType":"Error"}

测试环境 (.env.test):
LOG_LEVEL=error
ENABLE_LOG_TIMESTAMP=false
ENABLE_LOG_MODULE=false

输出示例:
[ERROR] Critical error occurred Error: Database connection failed {"timestamp":"2023-11-18T05:39:00.000Z","stack":"Error: Database connection failed\n    at ExampleService.handleCriticalError ..."}
*/

// ============================================================================
// 运行示例
// ============================================================================

if (require.main === module) {
  const service = new ExampleService();
  
  // 模拟请求处理
  service.processRequest({ id: 'test-123' })
    .then(() => {
      log.info('Main', 'Example completed successfully');
    })
    .catch((error) => {
      log.error('Main', 'Example failed', error);
    });
}