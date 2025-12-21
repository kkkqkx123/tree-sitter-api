/**
 * 监控服务 - 简化版，提供基本的内存监控和统计功能
 */

import {
  MemoryConfig,
  CleanupStrategy
} from '../config/memory';
import { MemoryStatus, CleanupResult } from '../types/errors';
import { getMemoryUsage } from '../utils/memoryUtils';
import { log } from '../utils/Logger';

export interface ServiceStats {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageQueryTime: number;
  uptime: number;
  timestamp: string;
}

export interface IMonitoringService {
  // 内存监控方法
  startMonitoring(intervalMs?: number): void;
  stopMonitoring(): void;
  checkMemory(): MemoryStatus;
  performCleanup(strategy?: CleanupStrategy): Promise<CleanupResult>;

  // 服务统计方法
  incrementRequestCount(): void;
  incrementErrorCount(): void;
  recordQueryTime(time: number): void;
  getStatistics(): ServiceStats;
  resetStatistics(): void;

  // 通用方法
  destroy(): void;
}

export class MonitoringService implements IMonitoringService {
  // 内存监控相关
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private configRefreshInterval: NodeJS.Timeout | null = null;

  // 服务统计相关
  private requestCount = 0;
  private errorCount = 0;
  private totalQueryTime = 0;
  private queryTimes: number[] = [];
  private startTime = Date.now();

  /**
   * 开始内存监控
   */
  startMonitoring(intervalMs: number = MemoryConfig.MONITORING.METRICS_INTERVAL): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      if (MemoryConfig.MONITORING.ENABLED) {
        const status = this.checkMemory();
        if (status.level === 'warning' || status.level === 'critical') {
          log.warn(
            'MonitoringService',
            `Memory usage ${status.level}: ${status.heapUsed}MB`,
          );
        }
      }
    }, intervalMs);

    log.info('MonitoringService', 'Monitoring started');
  }

  /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    log.info('MonitoringService', 'Monitoring stopped');
  }

  /**
   * 检查当前内存状态
   */
  checkMemory(): MemoryStatus {
    const usage = getMemoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

    let level: MemoryStatus['level'];
    if (heapUsedMB >= MemoryConfig.THRESHOLDS.MAXIMUM) {
      level = 'critical';
    } else if (heapUsedMB >= MemoryConfig.THRESHOLDS.CRITICAL) {
      level = 'warning';
    } else {
      level = 'healthy';
    }

    return {
      level,
      status: level,
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      threshold: MemoryConfig.THRESHOLDS.WARNING,
      usage: Math.round((heapUsedMB / heapTotalMB) * 100),
    };
  }

  /**
   * 统一的清理方法
   */
  async performCleanup(strategy: CleanupStrategy = CleanupStrategy.BASIC): Promise<CleanupResult> {
    const startTime = Date.now();
    const beforeMemory = getMemoryUsage();

    try {
      log.info('MonitoringService', `Performing ${strategy} cleanup...`);

      // Manual garbage collection has been removed to rely on Node.js automatic GC
      // In production environments, manual GC calls should be avoided

      const afterMemory = getMemoryUsage();
      // Calculate memory change (may be negative if memory increased during operation)
      const memoryChange = Math.round(
        (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024,
      );
      const duration = Date.now() - startTime;

      const result: CleanupResult = {
        strategy: strategy,
        memoryFreed: Math.max(0, memoryChange), // Only report positive freed memory
        success: true,
        duration,
      };

      log.info(
        'MonitoringService',
        `${strategy} cleanup completed: ${result.memoryFreed}MB apparent change in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      log.error('MonitoringService', `${strategy} cleanup failed:`, error);

      return {
        strategy: strategy,
        memoryFreed: 0,
        success: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 增加请求计数
   */
  incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * 增加错误计数
   */
  incrementErrorCount(): void {
    this.errorCount++;
  }

  /**
   * 记录查询时间
   */
  recordQueryTime(time: number): void {
    this.totalQueryTime += time;
    this.queryTimes.push(time);

    // 保持最近100次查询的时间记录
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): ServiceStats {
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const averageQueryTime = this.requestCount > 0 ? this.totalQueryTime / this.requestCount : 0;
    const uptime = Date.now() - this.startTime;

    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      uptime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalQueryTime = 0;
    this.queryTimes = [];
    this.startTime = Date.now();
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopMonitoring();
    this.resetStatistics();

    if (this.configRefreshInterval) {
      clearInterval(this.configRefreshInterval);
      this.configRefreshInterval = null;
    }
  }
}