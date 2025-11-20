/**
 * 性能监控器 - 监控服务性能指标
 */

export interface IPerformanceMonitor {
  startTiming(operation: string): string;
  endTiming(timerId: string): number;
  recordMetrics(operation: string, metrics: Record<string, number>): void;
  recordError(operation: string): void;
  getPerformanceReport(): PerformanceReport;
  getOperationStats(operation: string): OperationStats | null;
  resetMetrics(): void;
}

export interface PerformanceReport {
  summary: PerformanceSummary;
  operations: Record<string, OperationStats>;
  systemMetrics: SystemMetrics;
  timestamp: string;
}

export interface PerformanceSummary {
  totalOperations: number;
  averageOperationTime: number;
  slowestOperation: { name: string; time: number };
  fastestOperation: { name: string; time: number };
  totalExecutionTime: number;
  operationsPerSecond: number;
}

export interface OperationStats {
  name: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastExecutionTime: number;
  timeDistribution: Record<string, number>;
  errorCount: number;
  errorRate: number;
}

export interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  uptime: number;
}

export interface Timer {
  id: string;
  operation: string;
  startTime: number;
}

export class PerformanceMonitor implements IPerformanceMonitor {
  private timers: Map<string, Timer> = new Map();
  private operations: Map<string, OperationStats> = new Map();
  private executionHistory: Map<string, number[]> = new Map();
  private startTime = Date.now();

  /**
   * 开始计时
   */
  public startTiming(operation: string): string {
    const timerId = this.generateTimerId();
    const timer: Timer = {
      id: timerId,
      operation,
      startTime: Date.now(),
    };

    this.timers.set(timerId, timer);
    return timerId;
  }

  /**
   * 结束计时
   */
  public endTiming(timerId: string): number {
    const timer = this.timers.get(timerId);
    if (!timer) {
      throw new Error(`Timer with ID ${timerId} not found`);
    }

    const endTime = Date.now();
    const executionTime = endTime - timer.startTime;

    // 更新操作统计
    this.updateOperationStats(timer.operation, executionTime);

    // 清理计时器
    this.timers.delete(timerId);

    return executionTime;
  }

  /**
   * 记录性能指标
   */
  public recordMetrics(operation: string, metrics: Record<string, number>): void {
    let stats = this.operations.get(operation);
    if (!stats) {
      stats = this.createEmptyOperationStats(operation);
      this.operations.set(operation, stats);
    }

    // 更新自定义指标
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        (stats as any)[key] = value;
      }
    }

    stats.lastExecutionTime = Date.now();
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport(): PerformanceReport {
    const summary = this.generateSummary();
    const systemMetrics = this.getSystemMetrics();

    return {
      summary,
      operations: Object.fromEntries(this.operations),
      systemMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取特定操作的统计信息
   */
  public getOperationStats(operation: string): OperationStats | null {
    return this.operations.get(operation) || null;
  }

  /**
   * 重置所有指标
   */
  public resetMetrics(): void {
    this.timers.clear();
    this.operations.clear();
    this.executionHistory.clear();
    this.startTime = Date.now();
  }

  /**
   * 生成计时器ID
   */
  private generateTimerId(): string {
    return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新操作统计
   */
  private updateOperationStats(operation: string, executionTime: number): void {
    let stats = this.operations.get(operation);
    if (!stats) {
      stats = this.createEmptyOperationStats(operation);
      this.operations.set(operation, stats);
    }

    stats.count++;
    stats.totalTime += executionTime;
    stats.averageTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.lastExecutionTime = Date.now();

    // 更新时间分布
    this.updateTimeDistribution(stats, executionTime);

    // 记录执行历史
    if (!this.executionHistory.has(operation)) {
      this.executionHistory.set(operation, []);
    }
    this.executionHistory.get(operation)!.push(executionTime);
  }

  /**
   * 创建空的操作统计
   */
  private createEmptyOperationStats(operation: string): OperationStats {
    return {
      name: operation,
      count: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      lastExecutionTime: 0,
      timeDistribution: {
        '0-10ms': 0,
        '10-50ms': 0,
        '50-100ms': 0,
        '100-500ms': 0,
        '500ms-1s': 0,
        '1s+': 0,
      },
      errorCount: 0,
      errorRate: 0,
    };
  }

  /**
   * 更新时间分布
   */
  private updateTimeDistribution(stats: OperationStats, executionTime: number): void {
    if (executionTime < 10) {
      stats.timeDistribution['0-10ms']! ++;
    } else if (executionTime < 50) {
      stats.timeDistribution['10-50ms']! ++;
    } else if (executionTime < 100) {
      stats.timeDistribution['50-100ms']! ++;
    } else if (executionTime < 500) {
      stats.timeDistribution['100-500ms']! ++;
    } else if (executionTime < 1000) {
      stats.timeDistribution['500ms-1s']! ++;
    } else {
      stats.timeDistribution['1s+']! ++;
    }
  }

  /**
   * 生成摘要
   */
  private generateSummary(): PerformanceSummary {
    const allStats = Array.from(this.operations.values());
    
    if (allStats.length === 0) {
      return {
        totalOperations: 0,
        averageOperationTime: 0,
        slowestOperation: { name: 'N/A', time: 0 },
        fastestOperation: { name: 'N/A', time: 0 },
        totalExecutionTime: 0,
        operationsPerSecond: 0,
      };
    }

    const totalOperations = allStats.reduce((sum, stats) => sum + stats.count, 0);
    const totalExecutionTime = allStats.reduce((sum, stats) => sum + stats.totalTime, 0);
    const averageOperationTime = totalExecutionTime / totalOperations;

    // 找出最慢和最快的操作
    let slowestOperation = { name: '', time: 0 };
    let fastestOperation = { name: '', time: Infinity };

    for (const stats of allStats) {
      if (stats.maxTime > slowestOperation.time) {
        slowestOperation = { name: stats.name, time: stats.maxTime };
      }
      if (stats.minTime < fastestOperation.time) {
        fastestOperation = { name: stats.name, time: stats.minTime };
      }
    }

    const uptime = (Date.now() - this.startTime) / 1000; // 秒
    const operationsPerSecond = uptime > 0 ? totalOperations / uptime : 0;

    return {
      totalOperations,
      averageOperationTime: Math.round(averageOperationTime * 100) / 100,
      slowestOperation,
      fastestOperation,
      totalExecutionTime: Math.round(totalExecutionTime * 100) / 100,
      operationsPerSecond: Math.round(operationsPerSecond * 100) / 100,
    };
  }

  /**
   * 获取系统指标
   */
  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.round(process.uptime() * 100) / 100, // 秒
    };
  }

  /**
   * 记录操作错误
   */
  public recordError(operation: string): void {
    let stats = this.operations.get(operation);
    if (!stats) {
      stats = this.createEmptyOperationStats(operation);
      this.operations.set(operation, stats);
    }

    stats.errorCount++;
    stats.errorRate = stats.count > 0 ? (stats.errorCount / stats.count) * 100 : 0;
  }

  /**
   * 获取性能趋势 - 使用滑动窗口计算
   */
  public getPerformanceTrend(operation: string, windowSize: number = 10): number[] {
    const history = this.executionHistory.get(operation);
    if (!history || history.length === 0) {
      return [];
    }

    const result: number[] = [];
    const startIndex = Math.max(0, history.length - windowSize);

    for (let i = startIndex; i < history.length; i++) {
      const window = history.slice(Math.max(0, i - windowSize + 1), i + 1);
      const average = window.reduce((sum, time) => sum + time, 0) / window.length;
      result.push(Math.round(average * 100) / 100);
    }

    return result;
  }

  /**
   * 获取性能警告
   */
  public getPerformanceWarnings(): Array<{
    operation: string;
    type: 'slow' | 'error-rate' | 'memory';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    const warnings: Array<{
      operation: string;
      type: 'slow' | 'error-rate' | 'memory';
      message: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (const [operation, stats] of this.operations.entries()) {
      // 检查慢操作
      if (stats.averageTime > 1000) {
        warnings.push({
          operation,
          type: 'slow',
          message: `Operation "${operation}" is slow (average: ${stats.averageTime}ms)`,
          severity: 'high',
        });
      } else if (stats.averageTime > 500) {
        warnings.push({
          operation,
          type: 'slow',
          message: `Operation "${operation}" is moderately slow (average: ${stats.averageTime}ms)`,
          severity: 'medium',
        });
      }

      // 检查错误率
      if (stats.errorRate > 10) {
        warnings.push({
          operation,
          type: 'error-rate',
          message: `Operation "${operation}" has high error rate (${stats.errorRate}%)`,
          severity: 'high',
        });
      } else if (stats.errorRate > 5) {
        warnings.push({
          operation,
          type: 'error-rate',
          message: `Operation "${operation}" has moderate error rate (${stats.errorRate}%)`,
          severity: 'medium',
        });
      }
    }

    // 检查内存使用
    const systemMetrics = this.getSystemMetrics();
    const memoryUsageMB = systemMetrics.memoryUsage.heapUsed;
    if (memoryUsageMB > 500) {
      warnings.push({
        operation: 'system',
        type: 'memory',
        message: `High memory usage: ${memoryUsageMB}MB`,
        severity: 'high',
      });
    } else if (memoryUsageMB > 300) {
      warnings.push({
        operation: 'system',
        type: 'memory',
        message: `Moderate memory usage: ${memoryUsageMB}MB`,
        severity: 'medium',
      });
    }

    return warnings;
  }
}