/**
 * 内存监控器 - 实时监控内存使用情况和趋势分析
 */

import { MemoryConfig, MemoryTrend } from '@/config/memory';
import { MemoryStatus } from '@/types/errors';
import { forceGarbageCollection, getMemoryUsage } from '@/utils/memoryUtils';
import { log } from '@/utils/Logger';

export class MemoryMonitor {
  private memoryHistory: number[] = [];
  private lastCleanup = 0;
  private lastForceGC = 0;
  private maxHistorySize: number;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.maxHistorySize = MemoryConfig.LIMITS.MEMORY_HISTORY_SIZE;
  }

  /**
   * 开始内存监控
   */
  startMonitoring(intervalMs: number = MemoryConfig.MONITORING.METRICS_INTERVAL): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.recordMemoryUsage();
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
    
    // 记录内存使用
    this.recordMemoryUsage(heapUsedMB);
    
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
      trend: this.calculateTrend(),
    };
  }

  /**
   * 记录内存使用情况
   */
  private recordMemoryUsage(heapUsedMB?: number): void {
    const usage = heapUsedMB ?? Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
    
    this.memoryHistory.push(usage);
    
    // 限制历史记录大小
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 计算内存使用趋势
   */
  private calculateTrend(): MemoryTrend {
    if (this.memoryHistory.length < 3) {
      return MemoryTrend.STABLE;
    }

    const recent = this.memoryHistory.slice(-3);
    const first = recent[0] ?? 0;
    const last = recent[recent.length - 1] ?? 0;
    const diff = last - first;
    
    // 趋势阈值 (MB)
    const trendThreshold = 10;
    
    if (diff > trendThreshold) {
      return MemoryTrend.INCREASING;
    } else if (diff < -trendThreshold) {
      return MemoryTrend.DECREASING;
    }
    
    return MemoryTrend.STABLE;
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
   * 获取内存统计信息
   */
  getMemoryStats(): {
    current: number;
    average: number;
    peak: number;
    minimum: number;
    trend: MemoryTrend;
    history: number[];
    historyLength: number;
  } {
    const current = this.memoryHistory.length > 0 
      ? this.memoryHistory[this.memoryHistory.length - 1] 
      : Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
    
    const average = this.memoryHistory.length > 0
      ? Math.round(this.memoryHistory.reduce((sum, val) => sum + val, 0) / this.memoryHistory.length)
      : current;
    
    const peak = this.memoryHistory.length > 0 ? Math.max(...this.memoryHistory) : current;
    const minimum = this.memoryHistory.length > 0 ? Math.min(...this.memoryHistory) : current;

    const currentVal = current ?? Math.round(getMemoryUsage().heapUsed / 1024 / 1024);
    const averageVal = average ?? currentVal;
    const peakVal = peak ?? currentVal;
    const minimumVal = minimum ?? currentVal;
    
    return {
      current: currentVal,
      average: averageVal,
      peak: peakVal,
      minimum: minimumVal,
      trend: this.calculateTrend(),
      history: [...this.memoryHistory],
      historyLength: this.memoryHistory.length,
    };
  }

  /**
   * 获取详细的内存使用报告
   */
  getDetailedMemoryReport(): {
    status: MemoryStatus;
    stats: ReturnType<MemoryMonitor['getMemoryStats']>;
    process: NodeJS.MemoryUsage;
    recommendations: string[];
    alerts: string[];
  } {
    const status = this.checkMemory();
    const stats = this.getMemoryStats();
    const process = getMemoryUsage();
    
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // 生成建议和告警
    if (status.level === 'critical') {
      alerts.push('Memory usage is critical! Immediate cleanup required.');
      recommendations.push('Consider reducing parser pool size');
      recommendations.push('Enable aggressive cleanup strategy');
    } else if (status.level === 'warning') {
      alerts.push('Memory usage is high. Monitor closely.');
      recommendations.push('Consider periodic cleanup');
    }

    if (status.trend === 'increasing' && stats.historyLength >= 5) {
      alerts.push('Memory usage is consistently increasing.');
      recommendations.push('Check for memory leaks');
    }

    if (stats.peak - stats.current > 50) {
      recommendations.push('Memory usage has decreased significantly from peak');
    }

    const heapUsagePercentage = (process.heapUsed / process.heapTotal) * 100;
    if (heapUsagePercentage > 80) {
      alerts.push(`Heap usage is at ${heapUsagePercentage.toFixed(1)}%`);
    }

    return {
      status,
      stats,
      process,
      recommendations,
      alerts,
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
   * 检查内存泄漏风险
   */
  checkMemoryLeakRisk(): {
    risk: 'low' | 'medium' | 'high';
    factors: string[];
    confidence: number;
  } {
    const stats = this.getMemoryStats();
    const status = this.checkMemory();
    
    const factors: string[] = [];
    let riskScore = 0;

    // 检查趋势
    if (status.trend === 'increasing') {
      factors.push('Memory usage is increasing');
      riskScore += 30;
    }

    // 检查当前状态
    if (status.level === 'critical') {
      factors.push('Memory usage is critical');
      riskScore += 40;
    } else if (status.level === 'warning') {
      factors.push('Memory usage is high');
      riskScore += 20;
    }

    // 检查峰值与当前值的差异
    if (stats.peak - stats.current < 10) {
      factors.push('Memory usage is consistently near peak');
      riskScore += 25;
    }

    // 检查历史数据
    if (stats.historyLength >= 5) {
      const recentHalf = stats.history.slice(-Math.floor(stats.historyLength / 2));
      const olderHalf = stats.history.slice(0, Math.floor(stats.historyLength / 2));
      const recentAvg = recentHalf.reduce((sum, val) => sum + val, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((sum, val) => sum + val, 0) / olderHalf.length;
      
      if (recentAvg > olderAvg * 1.2) {
        factors.push('Recent memory usage is significantly higher than historical average');
        riskScore += 35;
      }
    }

    // 确定风险等级
    let risk: 'low' | 'medium' | 'high';
    if (riskScore >= 70) {
      risk = 'high';
    } else if (riskScore >= 40) {
      risk = 'medium';
    } else {
      risk = 'low';
    }

    return {
      risk,
      factors,
      confidence: Math.min(100, riskScore),
    };
  }

  /**
   * 重置监控历史
   */
  resetHistory(): void {
    this.memoryHistory = [];
    this.lastCleanup = 0;
    this.lastForceGC = 0;
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    historyLength: number;
    lastCleanup: number;
    lastForceGC: number;
    uptime: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      historyLength: this.memoryHistory.length,
      lastCleanup: this.lastCleanup,
      lastForceGC: this.lastForceGC,
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