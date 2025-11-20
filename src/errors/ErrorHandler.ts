import {
  ErrorType,
  ErrorSeverity,
  TreeSitterError,
  ErrorStatistics,
} from '../types/errors';
import { log } from '../utils/Logger';

/**
 * 错误处理器类
 * 负责分类、记录和处理各种错误
 */
export class ErrorHandler {
  private errorCounts: Map<ErrorType, number> = new Map();
  private lastErrors: Array<{ error: TreeSitterError; timestamp: number }> = [];
  private readonly maxErrorHistory = 100;

  /**
   * 处理错误
   * @param error 原始错误对象
   * @param context 错误发生的上下文
   * @returns 处理后的TreeSitterError
   */
  handleError(error: Error, context?: string): TreeSitterError {
    const treeSitterError = this.classifyError(error);

    // 记录错误
    this.recordError(treeSitterError);

    // 根据严重程度采取不同措施
    this.handleBySeverity(treeSitterError, context);

    return treeSitterError;
  }

  /**
   * 分类错误
   * @param error 原始错误对象
   * @returns 分类后的TreeSitterError
   */
  private classifyError(error: Error): TreeSitterError {
    // 如果已经是TreeSitterError，直接返回
    if (error instanceof TreeSitterError) {
      return error;
    }

    const message = error.message.toLowerCase();

    // 根据错误消息内容分类
    if (
      message.includes('unsupported language') ||
      message.includes('language not supported')
    ) {
      return new TreeSitterError(
        ErrorType.UNSUPPORTED_LANGUAGE,
        ErrorSeverity.MEDIUM,
        error.message,
        { originalError: error.name },
      );
    }

    if (
      message.includes('invalid query') ||
      message.includes('query syntax') ||
      message.includes('query error')
    ) {
      return new TreeSitterError(
        ErrorType.QUERY_ERROR,
        ErrorSeverity.MEDIUM,
        error.message,
        { originalError: error.name },
      );
    }

    if (
      message.includes('parse') ||
      message.includes('syntax') ||
      message.includes('parse error')
    ) {
      return new TreeSitterError(
        ErrorType.PARSE_ERROR,
        ErrorSeverity.MEDIUM,
        error.message,
        { originalError: error.name },
      );
    }

    if (
      message.includes('memory') ||
      message.includes('out of memory') ||
      message.includes('heap')
    ) {
      return new TreeSitterError(
        ErrorType.MEMORY_ERROR,
        ErrorSeverity.HIGH,
        error.message,
        { originalError: error.name },
      );
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return new TreeSitterError(
        ErrorType.TIMEOUT_ERROR,
        ErrorSeverity.MEDIUM,
        error.message,
        { originalError: error.name },
      );
    }

    if (
      message.includes('resource') ||
      message.includes('limit') ||
      message.includes('quota')
    ) {
      return new TreeSitterError(
        ErrorType.RESOURCE_ERROR,
        ErrorSeverity.HIGH,
        error.message,
        { originalError: error.name },
      );
    }

    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        error.message,
        { originalError: error.name },
      );
    }

    // 默认为内部错误
    return new TreeSitterError(
      ErrorType.INTERNAL_ERROR,
      ErrorSeverity.HIGH,
      error.message,
      { originalError: error.name, stack: error.stack },
    );
  }

  /**
   * 记录错误
   * @param error TreeSitterError对象
   */
  private recordError(error: TreeSitterError): void {
    // 更新错误计数
    const count = this.errorCounts.get(error.type) || 0;
    this.errorCounts.set(error.type, count + 1);

    // 记录错误历史
    this.lastErrors.push({ error, timestamp: Date.now() });

    // 限制历史记录大小
    if (this.lastErrors.length > this.maxErrorHistory) {
      this.lastErrors.shift();
    }
  }

  /**
   * 根据严重程度处理错误
   * @param error TreeSitterError对象
   * @param context 错误上下文
   */
  private handleBySeverity(error: TreeSitterError, context?: string): void {
    const contextStr = context ? `[${context}]` : '';

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        log.fatal('ErrorHandler', `[CRITICAL]${contextStr}`, error);
        // 可能需要触发紧急清理或重启
        break;
      case ErrorSeverity.HIGH:
        log.error('ErrorHandler', `[HIGH]${contextStr}`, error);
        // 可能需要记录告警
        break;
      case ErrorSeverity.MEDIUM:
        log.warn('ErrorHandler', `[MEDIUM]${contextStr}`, error);
        break;
      case ErrorSeverity.LOW:
        log.info('ErrorHandler', `[LOW]${contextStr}`, error);
        break;
    }
  }

  /**
   * 获取错误统计信息
   * @returns 错误统计信息
   */
  getErrorStats(): ErrorStatistics {
    const recentErrors = this.lastErrors.filter(
      e => Date.now() - e.timestamp < 300000, // 最近5分钟
    );

    const errorCounts: Record<ErrorType, number> = {} as Record<
      ErrorType,
      number
    >;
    for (const [type, count] of this.errorCounts) {
      errorCounts[type] = count;
    }

    // 计算错误率
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = totalErrors > 0 ? (totalErrors / totalErrors) * 100 : 0;
    
    // 计算错误类型统计
    const errorsByType: Record<string, number> = {};
    recentErrors.forEach(item => {
      errorsByType[item.error.type] = (errorsByType[item.error.type] || 0) + 1;
    });
    
    // 计算错误严重程度统计
    const errorsBySeverity: Record<string, number> = {};
    recentErrors.forEach(item => {
      errorsBySeverity[item.error.severity] = (errorsBySeverity[item.error.severity] || 0) + 1;
    });

    return {
      totalErrors: totalErrors,
      errorsByType: errorsByType as any,
      errorsBySeverity: errorsBySeverity as any,
      recentErrors: recentErrors.map(item => ({
        id: `${item.error.type}_${item.timestamp}`,
        error: {
          type: item.error.type,
          severity: item.error.severity,
          message: item.error.message,
          context: item.error.context || {},
          timestamp: item.error.timestamp,
          stack: item.error.stack || '',
        },
        count: 1,
        firstOccurrence: new Date(item.timestamp),
        lastOccurrence: new Date(item.timestamp),
        resolved: false,
      })),
      errorRate: Math.round(errorRate * 100) / 100,
      averageResolutionTime: 0, // 简化实现
    };
  }

  /**
   * 获取最常见的错误类型
   * @returns 最常见的错误类型
   */
  // private getMostCommonError(): ErrorType | null { // 暂时未使用
  //   let maxCount = 0;
  //   let mostCommon: ErrorType | null = null;

  //   for (const [type, count] of this.errorCounts) {
  //     if (count > maxCount) {
  //       maxCount = count;
  //       mostCommon = type;
  //     }
  //   }

  //   return mostCommon;
  // }

  /**
   * 清理错误历史记录
   */
  clearErrorHistory(): void {
    this.lastErrors = [];
    this.errorCounts.clear();
  }

  /**
   * 检查错误率是否过高
   * @param threshold 错误率阈值（每分钟）
   * @returns 是否超过阈值
   */
  isErrorRateHigh(threshold: number = 10): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    const recentErrors = this.lastErrors.filter(
      (e: any) => e.timestamp > oneMinuteAgo,
    );
    return recentErrors.length > threshold;
  }
}
