/**
 * 资源清理器 - 简化的资源清理机制
 */

import { CleanupStrategy } from '@/config/memory';
import { CleanupResult } from '@/types/errors';
import { forceGarbageCollection, getMemoryUsage } from '@/utils/memoryUtils';
import { log } from '@/utils/Logger';

export class ResourceCleaner {
  private cleanupHistory: CleanupResult[] = [];
  private maxHistorySize = 50;
  private isCleaning = false;
  private parserPool: { cleanup(): void; emergencyCleanup(): void } | null =
    null;
  private treeManager: { emergencyCleanup(): void } | null = null;
  private languageManager: { clearCache(): void } | null = null;

  constructor() {}

  /**
   * 设置解析器池
   */
  setParserPool(parserPool: {
    cleanup(): void;
    emergencyCleanup(): void;
  }): void {
    this.parserPool = parserPool;
  }

  /**
   * 设置树管理器
   */
  setTreeManager(treeManager: { emergencyCleanup(): void }): void {
    this.treeManager = treeManager;
  }

  /**
   * 设置语言管理器
   */
  setLanguageManager(languageManager: { clearCache(): void }): void {
    this.languageManager = languageManager;
  }

  /**
   * 执行清理
   */
  async performCleanup(
    strategy: CleanupStrategy = CleanupStrategy.BASIC,
  ): Promise<CleanupResult> {
    // 如果正在清理，直接返回
    if (this.isCleaning) {
      return {
        strategy: strategy,
        memoryFreed: 0,
        success: false,
        duration: 0,
      };
    }

    this.isCleaning = true;

    try {
      const startTime = Date.now();
      const beforeMemory = getMemoryUsage();

      log.info('ResourceCleaner', `Performing ${strategy} cleanup...`);

      // 根据策略执行清理
      switch (strategy) {
        case CleanupStrategy.EMERGENCY:
          // 紧急清理：清理所有缓存和资源
          if (this.languageManager) {
            this.languageManager.clearCache();
          }
          if (this.treeManager) {
            this.treeManager.emergencyCleanup();
          }
          if (this.parserPool) {
            this.parserPool.emergencyCleanup();
          }
          // 强制垃圾回收
          for (let i = 0; i < 3; i++) {
            forceGarbageCollection();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          break;
        case CleanupStrategy.AGGRESSIVE:
          // 激进清理：清理解析器池
          if (this.parserPool) {
            this.parserPool.cleanup();
          }
          // 强制垃圾回收
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

      const afterMemory = getMemoryUsage();
      const freed = Math.round(
        (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024,
      );
      const duration = Date.now() - startTime;

      const result: CleanupResult = {
        strategy: strategy,
        memoryFreed: Math.max(0, freed),
        success: true,
        duration,
      };

      // 记录清理结果
      this.recordCleanupResult(result);

      log.info(
        'ResourceCleaner',
        `${strategy} cleanup completed: ${result.memoryFreed}MB freed in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      const errorResult: CleanupResult = {
        strategy: strategy,
        memoryFreed: 0,
        success: false,
        duration: 0,
      };

      this.recordCleanupResult(errorResult);

      log.error('ResourceCleaner', `${strategy} cleanup failed:`, error);

      return errorResult;
    } finally {
      this.isCleaning = false;
    }
  }

  /**
   * 记录清理结果
   */
  private recordCleanupResult(result: CleanupResult): void {
    this.cleanupHistory.push(result);

    // 限制历史记录大小
    if (this.cleanupHistory.length > this.maxHistorySize) {
      this.cleanupHistory.shift();
    }
  }

  /**
   * 强制垃圾回收
   */
  async forceGarbageCollection(): Promise<boolean> {
    return forceGarbageCollection();
  }

  /**
   * 获取清理统计
   */
  getCleanupStats(): {
    totalCleanups: number;
    successfulCleanups: number;
    failedCleanups: number;
    totalMemoryFreed: number;
    averageCleanupTime: number;
    strategyStats: Record<
      string,
      { count: number; successRate: number; avgMemoryFreed: number }
    >;
    recentCleanups: CleanupResult[];
  } {
    const totalCleanups = this.cleanupHistory.length;
    const successfulCleanups = this.cleanupHistory.filter(
      r => r.success,
    ).length;
    const failedCleanups = totalCleanups - successfulCleanups;
    const totalMemoryFreed = this.cleanupHistory.reduce(
      (sum, r) => sum + r.memoryFreed,
      0,
    );
    const averageCleanupTime =
      totalCleanups > 0
        ? this.cleanupHistory.reduce((sum, r) => sum + r.duration, 0) /
          totalCleanups
        : 0;

    // 按策略分组统计
    const strategyGroups: Record<string, CleanupResult[]> = {};
    this.cleanupHistory.forEach(result => {
      const strategy = result.strategy || 'unknown';
      if (!strategyGroups[strategy]) {
        strategyGroups[strategy] = [];
      }
      strategyGroups[strategy].push(result);
    });

    const strategyStats: Record<
      string,
      { count: number; successRate: number; avgMemoryFreed: number }
    > = {};
    Object.entries(strategyGroups).forEach(([strategy, results]) => {
      const count = results.length;
      const successCount = results.filter(r => r.success).length;
      const avgMemoryFreed =
        results.reduce((sum, r) => sum + r.memoryFreed, 0) / count;

      strategyStats[strategy] = {
        count,
        successRate: (successCount / count) * 100,
        avgMemoryFreed,
      };
    });

    const recentCleanups = this.cleanupHistory.slice(-10);

    return {
      totalCleanups,
      successfulCleanups,
      failedCleanups,
      totalMemoryFreed,
      averageCleanupTime,
      strategyStats,
      recentCleanups,
    };
  }

  /**
   * 获取可用的清理策略
   */
  getAvailableStrategies(): CleanupStrategy[] {
    return [
      CleanupStrategy.BASIC,
      CleanupStrategy.AGGRESSIVE,
      CleanupStrategy.EMERGENCY,
    ];
  }

  /**
   * 检查清理器是否健康
   */
  isHealthy(): boolean {
    const stats = this.getCleanupStats();

    // 检查失败率
    if (
      stats.totalCleanups > 10 &&
      stats.failedCleanups / stats.totalCleanups > 0.3
    ) {
      return false;
    }

    return true;
  }

  /**
   * 清理历史记录
   */
  clearHistory(): void {
    this.cleanupHistory = [];
  }

  /**
   * 重置清理器
   */
  reset(): void {
    this.clearHistory();
    this.isCleaning = false;
  }

  /**
   * 销毁清理器
   */
  destroy(): void {
    this.reset();
  }
}
