/**
 * 内存监控器 - 简化的内存监控功能
 */

import { MemoryConfig, MemoryTrend } from '@/config/memory';
import { MemoryStatus } from '@/types/errors';
import { forceGarbageCollection, getMemoryUsage } from '@/utils/memoryUtils';
import { log } from '@/utils/Logger';

export class MemoryMonitor {
  private lastCleanup = 0;
  private lastForceGC = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {}

  /**
   * 开始内存监控
   */
  startMonitoring(intervalMs: number = MemoryConfig.MONITORING.METRICS_INTERVAL): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      // 简化：只记录日志，不记录历史数据
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
      trend: MemoryTrend.STABLE, // 简化：默认稳定
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
      peak: current, // 简化：返回当前值作为峰值
      trend: MemoryTrend.STABLE, // 简化：默认稳定
      historyLength: 0, // 简化：无历史记录
    };
  }

  /**
   * 获取简化的内存使用报告
   */
  getDetailedMemoryReport(): {
    status: MemoryStatus;
    stats: ReturnType<MemoryMonitor['getMemoryStats']>;
    process: NodeJS.MemoryUsage;
  } {
    const status = this.checkMemory();
    const stats = this.getMemoryStats();
    const process = getMemoryUsage();
    
    return {
      status,
      stats,
      process,
    };
  }

  /**
   * 执行内存清理
   */
  async performCleanup(): Promise<{
    beforeMemory: number;
    afterMemory: number;
    freedMemory: number;
    gcPerformed: boolean;
  }> {
    const beforeMemory = Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
    
    // 尝试强制垃圾回收
    let gcPerformed = false;
    if (this.shouldForceGC()) {
      gcPerformed = forceGarbageCollection();
      this.markForceGC();
    }

    // 等待一小段时间让GC完成
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterMemory = Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
    const freedMemory = beforeMemory - afterMemory;

    this.markCleanup();

    return {
      beforeMemory,
      afterMemory,
      freedMemory,
      gcPerformed,
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
  } {
    return {
      isMonitoring: this.isMonitoring,
      uptime: process.uptime(),
    };
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopMonitoring();
    this.resetHistory();
  }
}