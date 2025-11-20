/**
 * 错误处理系统使用示例
 */

import express from 'express';
import { ErrorHandler } from '../errors/ErrorHandler';
import { RecoveryStrategy } from '../errors/RecoveryStrategy';
import { MonitoringService } from '../core/MonitoringService';
import { ResourceService } from '../core/ResourceService';
import {
  globalErrorHandler,
  resourceGuard,
  errorLogger,
  asyncErrorHandler,
  healthCheck,
} from '../middleware';
import { TreeSitterService } from '../core/TreeSitterService';
import { ErrorSeverity, ErrorType, TreeSitterError } from '../types/errors';

/**
 * 创建Express应用并配置错误处理
 */
export function createAppWithErrorHandling(): express.Application {
  const app = express();

  // 初始化核心组件
  const monitoringService = new MonitoringService();
  const resourceService = new ResourceService();
  const errorHandler = new ErrorHandler();
  const recoveryStrategy = new RecoveryStrategy(resourceService, monitoringService);
  const treeSitterService = new TreeSitterService();

  // 基础中间件
  app.use(express.json({ limit: '5mb' }));
  app.use(errorLogger);

  // 资源保护中间件
  app.use(resourceGuard(monitoringService, resourceService));

  // 健康检查端点
  app.get('/api/health', healthCheck(monitoringService, errorHandler));

  // 解析API端点
  app.post(
    '/api/parse',
    asyncErrorHandler(async (req: express.Request, res: express.Response) => {
      try {
        const result = await treeSitterService.processRequest(req.body);
        res.json(result);
      } catch (error) {
        // 这里可以添加特定的错误处理逻辑
        throw error;
      }
    }),
  );

  // 错误统计端点
  app.get(
    '/api/errors/stats',
    (_req: express.Request, res: express.Response) => {
      const stats = errorHandler.getErrorStats();
      res.json(stats);
    },
  );

  // 手动触发错误恢复的端点（仅用于测试）
  app.post(
    '/api/errors/recover',
    asyncErrorHandler(async (req: express.Request, res: express.Response) => {
      const { errorType, message } = req.body;

      if (!errorType || !message) {
        throw new TreeSitterError(
          ErrorType.VALIDATION_ERROR,
          ErrorSeverity.LOW,
          'errorType and message are required',
        );
      }

      const testError = new TreeSitterError(
        errorType as ErrorType,
        ErrorSeverity.MEDIUM,
        message,
      );

      const recoveryResult = await recoveryStrategy.attemptRecovery(testError);
      res.json({
        success: true,
        error: testError.toJSON(),
        recovery: recoveryResult,
      });
    }),
  );

  // 全局错误处理中间件（必须放在最后）
  app.use(globalErrorHandler(errorHandler, recoveryStrategy));

  return app;
}

/**
 * 错误处理使用示例
 */
export function errorHandlingExamples() {
  // 创建错误处理器
  const errorHandler = new ErrorHandler();

  // 示例1: 处理普通错误
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    const treeSitterError = errorHandler.handleError(
      error as Error,
      'example-context',
    );
    console.log('Handled error:', treeSitterError.toJSON());
  }

  // 示例2: 处理特定类型的错误
  try {
    throw new Error('Unsupported language: cobol');
  } catch (error) {
    const treeSitterError = errorHandler.handleError(
      error as Error,
      'language-check',
    );
    console.log(
      'Language error:',
      treeSitterError.type,
      treeSitterError.severity,
    );
  }

  // 示例3: 获取错误统计
  const stats = errorHandler.getErrorStats();
  console.log('Error statistics:', stats);

  // 示例4: 检查错误率
  const isHighErrorRate = errorHandler.isErrorRateHigh(5);
  console.log('Is error rate high?', isHighErrorRate);
}

/**
 * 恢复策略使用示例
 */
export async function recoveryStrategyExamples() {
  // 创建恢复策略
  const monitoringService = new MonitoringService();
  const resourceService = new ResourceService();
  const recoveryStrategy = new RecoveryStrategy(resourceService, monitoringService);

  // 示例1: 尝试从内存错误恢复
  const memoryError = new TreeSitterError(
    ErrorType.MEMORY_ERROR,
    ErrorSeverity.HIGH,
    'Out of memory',
  );

  const memoryRecovery = await recoveryStrategy.attemptRecovery(memoryError);
  console.log('Memory recovery result:', memoryRecovery);

  // 示例2: 尝试从解析错误恢复
  const parseError = new TreeSitterError(
    ErrorType.PARSE_ERROR,
    ErrorSeverity.MEDIUM,
    'Invalid syntax',
  );

  const parseRecovery = await recoveryStrategy.attemptRecovery(parseError);
  console.log('Parse recovery result:', parseRecovery);

  // 示例3: 检查是否可以恢复
  const canRecover = recoveryStrategy.canRecover(parseError);
  console.log('Can recover from parse error?', canRecover);

  // 示例4: 获取恢复优先级
  const priority = recoveryStrategy.getRecoveryPriority(memoryError);
  console.log('Memory error recovery priority:', priority);
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  console.log('Running error handling examples...');
  errorHandlingExamples();

  console.log('\nRunning recovery strategy examples...');
  recoveryStrategyExamples().catch(console.error);
}