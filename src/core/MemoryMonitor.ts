/**
 * 内存监控器 - 统一内存服务
 * 提供中央化的内存管理功能，减少重复逻辑
 */

import {
  MemoryConfig,
  MemoryTrend,
  refreshMemoryConfig,
  CleanupStrategy
} from '../config/memory';
import { MemoryStatus } from '../types/errors';
import { forceGarbageCollection, getMemoryUsage } from '../utils/memoryUtils';
import { log } from '../utils/Logger';

export class MemoryMonitor {
  private lastCleanup = 0;
  private lastForceGC = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private configRefreshInterval: NodeJS.Timeout | null = null;
  private activeCleanups: number = 0; // 防止并发清理

  constructor() {
    // 设置配置刷新间隔，以便在运行时更新配置
    this.setupConfigRefresh();
  }

  /**
   * 设置配置刷新
   */
  private setupConfigRefresh(): void {
    // 每5分钟检查一次配置是否需要刷新
    this.configRefreshInterval = setInterval(
      () => {
        refreshMemoryConfig();
        log.debug('MemoryMonitor', 'Memory configuration refreshed');
      },
      5 * 60 * 1000,
    );
  }

  /**
   * 开始内存监控
   */
  startMonitoring(
    intervalMs: number = MemoryConfig.MONITORING.METRICS_INTERVAL,
  ): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      if (MemoryConfig.MONITORING.ENABLED) {
        const status = this.checkMemory();
        if (status.level === 'warning' || status.level === 'critical') {
          log.warn(
            'MemoryMonitor',
            `Memory usage ${status.level}: ${status.heapUsed}MB`,
          );
        }
      }
    }, intervalMs);

    log.info('MemoryMonitor', 'Memory monitoring started');
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
    log.info('MemoryMonitor', 'Memory monitoring stopped');
  }

  /**
   * 检查当前内存状态
   */
  checkMemory(): MemoryStatus {
    const usage = getMemoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);

    // 确定内存状态级别
    let level: MemoryStatus['level'];
    if (heapUsedMB >= MemoryConfig.THRESHOLDS.MAXIMUM) {
      level = 'critical';
    } else if (heapUsedMB >= MemoryConfig.THRESHOLDS.CRITICAL) {
      level = 'warning';
    } else {
      level = 'normal';
    }

    return {
      level,
      heapUsed: heapUsedMB,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      trend: MemoryTrend.STABLE,
    };
  }

  /**
   * 检查是否需要执行清理
   */
  shouldCleanup(): boolean {
    const now = Date.now();
    return now - this.lastCleanup > MemoryConfig.CLEANUP.INTERVAL;
  }

  /**
   * 检查是否需要强制垃圾回收
   */
  shouldForceGC(): boolean {
    const now = Date.now();
    return now - this.lastForceGC > MemoryConfig.CLEANUP.FORCE_GC_INTERVAL;
  }

  /**
   * 标记清理时间
   */
  markCleanup(): void {
    this.lastCleanup = Date.now();
  }

  /**
   * 标记强制GC时间
   */
  markForceGC(): void {
    this.lastForceGC = Date.now();
  }

  /**
   * 获取简单的内存统计信息
   */
  getMemoryStats(): {
    current: number;
    peak: number;
    trend: MemoryTrend;
    historyLength: number;
  } {
    const current = Math.round(getMemoryUsage().heapUsed / 1024 / 1024);

    return {
      current,
      peak: current,
      trend: MemoryTrend.STABLE,
      historyLength: 0,
    };
  }

  /**
   * 获取简化的内存使用报告
   */
  getDetailedMemoryReport(): {
    status: MemoryStatus;
    stats: ReturnType<MemoryMonitor['getMemoryStats']>;
    process: NodeJS.MemoryUsage;
    config: {
      thresholds: typeof MemoryConfig.THRESHOLDS;
      limits: typeof MemoryConfig.LIMITS;
    };
  } {
    const status = this.checkMemory();
    const stats = this.getMemoryStats();
    const process = getMemoryUsage();

    return {
      status,
      stats,
      process,
      config: {
        thresholds: MemoryConfig.THRESHOLDS,
        limits: MemoryConfig.LIMITS,
      },
    };
  }

  /**
   * 统一的清理方法，支持多种策略
   * 为保持向后兼容性，返回原有格式
   */
  async performCleanup(strategy: CleanupStrategy = CleanupStrategy.BASIC): Promise<any> {
    // 防止并发清理
    if (this.activeCleanups > 0) {
      return {
        beforeMemory: 0,
        afterMemory: 0,
        freedMemory: 0,
        gcPerformed: false,
      };
    }

    this.activeCleanups++;
    const beforeMemoryValue = Math.round(getMemoryUsage().heapUsed / 1024 / 1024);

    try {
      log.info('MemoryMonitor', `Performing ${strategy} cleanup...`);

      // 根据策略执行清理
      switch (strategy) {
        case CleanupStrategy.EMERGENCY:
          // 紧急清理：强制垃圾回收多次
          for (let i = 0; i < 3; i++) {
            forceGarbageCollection();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          break;
        case CleanupStrategy.AGGRESSIVE:
          // 激进清理：强制垃圾回收两次
          for (let i = 0; i < 2; i++) {
            forceGarbageCollection();
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          break;
        case CleanupStrategy.BASIC:
        default:
          // 基础清理：仅强制垃圾回收
          forceGarbageCollection();
          await new Promise(resolve => setTimeout(resolve, 50));
          break;
      }

      const afterMemoryValue = Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
      const freedMemory = beforeMemoryValue - afterMemoryValue;

      // 更新最后清理时间
      this.markCleanup();

      log.info(
        'MemoryMonitor',
        `${strategy} cleanup completed: ${freedMemory}MB freed`,
      );

      return {
        beforeMemory: beforeMemoryValue,
        afterMemory: afterMemoryValue,
        freedMemory: Math.max(0, freedMemory),
        gcPerformed: true,
      };
    } catch (error) {
      log.error('MemoryMonitor', `${strategy} cleanup failed:`, error);

      return {
        beforeMemory: beforeMemoryValue,
        afterMemory: beforeMemoryValue,
        freedMemory: 0,
        gcPerformed: false,
      };
    } finally {
      this.activeCleanups--;
    }
  }

  /**
   * 检查内存阈值
   */
  checkThresholds(): { warning: boolean; critical: boolean } {
    const currentStatus = this.checkMemory();
    return {
      warning: currentStatus.level === 'warning' || currentStatus.level === 'critical',
      critical: currentStatus.level === 'critical',
    };
  }

  /**
   * 重置监控历史
   */
  resetHistory(): void {
    this.lastCleanup = 0;
    this.lastForceGC = 0;
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    uptime: number;
    configRefreshEnabled: boolean;
  } {
    return {
      isMonitoring: this.isMonitoring,
      uptime: process.uptime(),
      configRefreshEnabled: this.configRefreshInterval !== null,
    };
  }

  /**
   * 手动刷新配置
   */
  refreshConfig(): void {
    refreshMemoryConfig();
    log.info('MemoryMonitor', 'Memory configuration manually refreshed');
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopMonitoring();
    this.resetHistory();

    // 清理配置刷新定时器
    if (this.configRefreshInterval) {
      clearInterval(this.configRefreshInterval);
      this.configRefreshInterval = null;
    }
  }
}
