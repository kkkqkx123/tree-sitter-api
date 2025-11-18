/**
 * Logger演示示例
 * 展示新Logger模块的基本功能
 */

import { log } from '../utils/Logger';

// ============================================================================
// 基本使用示例
// ============================================================================

console.log('=== Logger 演示开始 ===\n');

// 1. 基本日志记录
log.info('Demo', 'Logger演示开始');
log.debug('Demo', '这是调试信息');
log.warn('Demo', '这是警告信息');
log.error('Demo', '这是错误信息');
log.fatal('Demo', '这是严重错误信息');

// 2. 带参数的日志
const user = { id: 123, name: '张三' };
const error = new Error('示例错误');

log.info('UserService', '用户登录成功', user);
log.error('UserService', '用户登录失败', error, { userId: user.id });

// 3. 不同模块的日志
log.info('Database', '连接数据库');
log.info('API', '处理请求 GET /api/users');
log.info('Cache', '缓存更新完成');

// ============================================================================
// 模拟服务类
// ============================================================================

class ExampleService {
  private moduleName = 'ExampleService';

  async processRequest(requestId: string): Promise<void> {
    log.info(this.moduleName, '开始处理请求', { requestId });

    try {
      // 模拟处理过程
      log.debug(this.moduleName, '执行业务逻辑', { requestId });
      await this.simulateWork(requestId);
      
      log.info(this.moduleName, '请求处理成功', { requestId, duration: '100ms' });
    } catch (error) {
      log.error(this.moduleName, '请求处理失败', error as Error, { requestId });
      throw error;
    }
  }

  private async simulateWork(requestId: string): Promise<void> {
    log.debug(this.moduleName, '开始执行工作', { requestId });
    
    // 模拟一些工作
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 模拟随机错误
    if (Math.random() < 0.3) {
      throw new Error('模拟工作失败');
    }
    
    log.debug(this.moduleName, '工作执行完成', { requestId });
  }

  checkMemoryUsage(): void {
    const memory = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
    };

    log.info(this.moduleName, '内存使用情况', memoryMB);

    if (memoryMB.heapUsed > 100) {
      log.warn(this.moduleName, '内存使用较高', memoryMB);
    }
  }
}

// ============================================================================
// 运行演示
// ============================================================================

async function runDemo(): Promise<void> {
  const service = new ExampleService();

  // 检查内存使用
  service.checkMemoryUsage();

  // 处理几个请求
  const requests = ['req-001', 'req-002', 'req-003', 'req-004', 'req-005'];
  
  for (const requestId of requests) {
    try {
      await service.processRequest(requestId);
    } catch (error) {
      // 错误已经在service中记录了
    }
  }

  // 最终检查
  service.checkMemoryUsage();
  
  log.info('Demo', 'Logger演示完成');
  console.log('\n=== Logger 演示结束 ===');
}

// 运行演示
if (require.main === module) {
  runDemo().catch((error) => {
    console.error('演示运行失败:', error);
    process.exit(1);
  });
}

export { ExampleService, runDemo };