
/**
 * 获取当前内存使用情况
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * 格式化内存大小为可读字符串（带单位）
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 记录内存使用情况到控制台
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
 * 计算堆内存使用百分比
 */
export function getMemoryUsagePercentage(): number {
  const usage = getMemoryUsage();
  return (usage.heapUsed / usage.heapTotal) * 100;
}

/**
 * 检查已用堆内存是否超过指定阈值（以 MB 为单位）
 */
export function isMemoryOverThreshold(thresholdMB: number): boolean {
  const heapUsedMB = getMemoryUsage().heapUsed / 1024 / 1024;
  return heapUsedMB > thresholdMB;
}

/**
 * 获取简化的内存使用统计数据（单位：MB，整数）
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
 * 强制垃圾回收（如果可用）
 */
export function forceGarbageCollection(): void {
  // 检查全局作用域中是否有 gc 函数（需要 Node.js 以 --expose-gc 参数运行）
  if (typeof global.gc === 'function') {
    global.gc();
  } else {
    // 如果没有暴露 gc 函数，则记录警告
    console.warn('Garbage collection is not exposed. Run Node.js with --expose-gc flag to enable forceGarbageCollection.');
  }
}