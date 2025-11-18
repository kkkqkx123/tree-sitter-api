/**
 * 内存管理工具函数
 */

/**
 * 强制垃圾回收
 */
export function forceGarbageCollection(): boolean {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
}

/**
 * 获取当前内存使用情况
 */
export function getMemoryUsage() {
  return process.memoryUsage();
}

/**
 * 格式化内存大小为可读字符串
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 记录内存使用情况
 */
export function logMemoryUsage(prefix: string = ''): void {
  const usage = getMemoryUsage();
  console.log(
    `${prefix} Memory - RSS: ${formatMemorySize(usage.rss)}, ` +
    `Heap Total: ${formatMemorySize(usage.heapTotal)}, ` +
    `Heap Used: ${formatMemorySize(usage.heapUsed)}, ` +
    `External: ${formatMemorySize(usage.external)}`
  );
}

/**
 * 计算内存使用百分比
 */
export function getMemoryUsagePercentage(): number {
  const usage = getMemoryUsage();
  return (usage.heapUsed / usage.heapTotal) * 100;
}

/**
 * 检查内存是否超过阈值
 */
export function isMemoryOverThreshold(thresholdMB: number): boolean {
  const usage = getMemoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  return heapUsedMB > thresholdMB;
}

/**
 * 获取内存使用统计
 */
export function getMemoryStats() {
  const usage = getMemoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    usagePercentage: Math.round(getMemoryUsagePercentage()),
  };
}

/**
 * 内存使用监控器
 */
export class MemoryMonitor {
  private measurements: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private maxMeasurements: number = 10;

  /**
   * 记录内存使用情况
   */
  recordMeasurement(): void {
    const usage = getMemoryUsage();
    this.measurements.push({
      timestamp: Date.now(),
      usage,
    });

    // 限制测量记录数量
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  /**
   * 获取内存使用趋势
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.measurements.length < 3) {
      return 'stable';
    }

    const recent = this.measurements.slice(-3);
    const first = recent[0]?.usage.heapUsed ?? 0;
    const last = recent[recent.length - 1]?.usage.heapUsed ?? 0;
    const diff = last - first;
    const threshold = 10 * 1024 * 1024; // 10MB

    if (diff > threshold) {
      return 'increasing';
    } else if (diff < -threshold) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * 获取平均内存使用
   */
  getAverageMemoryUsage(): NodeJS.MemoryUsage | null {
    if (this.measurements.length === 0) {
      return null;
    }

    const sum = this.measurements.reduce(
      (acc, measurement) => ({
        rss: acc.rss + measurement.usage.rss,
        heapTotal: acc.heapTotal + measurement.usage.heapTotal,
        heapUsed: acc.heapUsed + measurement.usage.heapUsed,
        external: acc.external + measurement.usage.external,
        arrayBuffers: acc.arrayBuffers + measurement.usage.arrayBuffers,
      }),
      { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
    );

    const count = this.measurements.length;
    return {
      rss: sum.rss / count,
      heapTotal: sum.heapTotal / count,
      heapUsed: sum.heapUsed / count,
      external: sum.external / count,
      arrayBuffers: sum.arrayBuffers / count,
    };
  }

  /**
   * 获取峰值内存使用
   */
  getPeakMemoryUsage(): NodeJS.MemoryUsage | null {
    if (this.measurements.length === 0) {
      return null;
    }

    return this.measurements.reduce((max, measurement) => {
      if (measurement.usage.heapUsed > max.heapUsed) {
        return measurement.usage;
      }
      return max;
    }, this.measurements[0]?.usage ?? { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 });
  }

  /**
   * 清除测量记录
   */
  clearMeasurements(): void {
    this.measurements = [];
  }

  /**
   * 获取测量记录数量
   */
  getMeasurementCount(): number {
    return this.measurements.length;
  }
}