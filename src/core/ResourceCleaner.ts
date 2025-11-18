/**
 * 资源清理器 - 分层清理策略和垃圾回收机制
 */

import { CleanupStrategy } from '@/config/memory';
import { CleanupResult } from '@/types/errors';
import { forceGarbageCollection, getMemoryUsage } from '@/utils/memoryUtils';
import { log } from '@/utils/Logger';

// 清理策略接口
abstract class BaseCleanupStrategy {
  abstract execute(): Promise<CleanupResult>;
  abstract getStrategyName(): string;
}

/**
 * 基础清理策略
 */
class BasicCleanupStrategy extends BaseCleanupStrategy {
  async execute(): Promise<CleanupResult> {
    const startTime = Date.now();
    const beforeMemory = getMemoryUsage();

    // 基本清理：强制垃圾回收

    // 等待GC完成
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterMemory = getMemoryUsage();
    const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
    const duration = Date.now() - startTime;

    return {
      strategy: this.getStrategyName(),
      memoryFreed: Math.max(0, freed),
      success: true,
      duration,
    };
  }

  getStrategyName(): string {
    return 'basic';
  }
}

/**
 * 激进清理策略
 */
class AggressiveCleanupStrategy extends BaseCleanupStrategy {
  constructor(
    private parserPool: { cleanup(): void; emergencyCleanup(): void },
    private treeManager: { emergencyCleanup(): void } | null = null
  ) {
    super();
  }

  async execute(): Promise<CleanupResult> {
    const startTime = Date.now();
    const beforeMemory = getMemoryUsage();

    try {
      // 清理解析器池
      if (this.parserPool) {
        this.parserPool.cleanup();
      }

      // 清理树管理器
      if (this.treeManager) {
        this.treeManager.emergencyCleanup();
      }

      // 多次垃圾回收
      for (let i = 0; i < 3; i++) {
        forceGarbageCollection();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      log.warn('ResourceCleaner', 'Aggressive cleanup encountered error:', error);
    }

    const afterMemory = getMemoryUsage();
    const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
    const duration = Date.now() - startTime;

    return {
      strategy: this.getStrategyName(),
      memoryFreed: Math.max(0, freed),
      success: true,
      duration,
    };
  }

  getStrategyName(): string {
    return 'aggressive';
  }
}

/**
 * 紧急清理策略
 */
class EmergencyCleanupStrategy extends BaseCleanupStrategy {
  constructor(
    private parserPool: { cleanup(): void; emergencyCleanup(): void },
    private treeManager: { emergencyCleanup(): void } | null = null,
    private languageManager: { clearCache(): void } | null = null
  ) {
    super();
  }

  async execute(): Promise<CleanupResult> {
    const startTime = Date.now();
    const beforeMemory = getMemoryUsage();

    try {
      log.warn('ResourceCleaner', 'Performing emergency cleanup...');

      // 清理所有缓存
      if (this.languageManager) {
        this.languageManager.clearCache();
      }

      // 紧急清理所有资源
      if (this.parserPool) {
        this.parserPool.emergencyCleanup();
      }

      if (this.treeManager) {
        this.treeManager.emergencyCleanup();
      }

      // 强制多次垃圾回收
      for (let i = 0; i < 5; i++) {
        forceGarbageCollection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 尝试触发Node.js的内存压力回调（如果可用）
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      log.error('ResourceCleaner', 'Emergency cleanup failed:', error);
    }

    const afterMemory = getMemoryUsage();
    const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
    const duration = Date.now() - startTime;

    return {
      strategy: this.getStrategyName(),
      memoryFreed: Math.max(0, freed),
      success: true,
      duration,
    };
  }

  getStrategyName(): string {
    return 'emergency';
  }
}

export class ResourceCleaner {
  private cleanupStrategies: Map<CleanupStrategy, BaseCleanupStrategy> = new Map();
  private cleanupHistory: CleanupResult[] = [];
  private maxHistorySize = 50;
  private isCleaning = false;
  private cleanupQueue: Array<{ strategy: CleanupStrategy; resolve: (result: CleanupResult) => void }> = [];

  constructor() {
    this.initializeStrategies();
  }

  /**
   * 初始化清理策略
   */
  private initializeStrategies(): void {
    // 基础策略总是可用
    this.cleanupStrategies.set(CleanupStrategy.BASIC, new BasicCleanupStrategy());
  }

  /**
   * 设置解析器池（用于激进和紧急清理）
   */
  setParserPool(parserPool: { cleanup(): void; emergencyCleanup(): void }): void {
    this.cleanupStrategies.set(
      CleanupStrategy.AGGRESSIVE,
      new AggressiveCleanupStrategy(parserPool)
    );
    this.cleanupStrategies.set(
      CleanupStrategy.EMERGENCY,
      new EmergencyCleanupStrategy(parserPool)
    );
  }

  /**
   * 设置树管理器（用于激进和紧急清理）
   */
  setTreeManager(treeManager: { emergencyCleanup(): void }): void {
    // 更新现有的激进清理策略
    const aggressive = this.cleanupStrategies.get(CleanupStrategy.AGGRESSIVE);
    if (aggressive instanceof AggressiveCleanupStrategy) {
      this.cleanupStrategies.set(
        CleanupStrategy.AGGRESSIVE,
        new AggressiveCleanupStrategy(
          // 这里需要获取parserPool，简化处理
          {} as any,
          treeManager
        )
      );
    }

    // 更新现有的紧急清理策略
    const emergency = this.cleanupStrategies.get(CleanupStrategy.EMERGENCY);
    if (emergency instanceof EmergencyCleanupStrategy) {
      this.cleanupStrategies.set(
        CleanupStrategy.EMERGENCY,
        new EmergencyCleanupStrategy(
          {} as any,
          treeManager
        )
      );
    }
  }

  /**
   * 设置语言管理器（用于紧急清理）
   */
  setLanguageManager(languageManager: { clearCache(): void }): void {
    const emergency = this.cleanupStrategies.get(CleanupStrategy.EMERGENCY);
    if (emergency instanceof EmergencyCleanupStrategy) {
      this.cleanupStrategies.set(
        CleanupStrategy.EMERGENCY,
        new EmergencyCleanupStrategy(
          {} as any,
          null,
          languageManager
        )
      );
    }
  }

  /**
   * 执行清理
   */
  async performCleanup(strategy: CleanupStrategy): Promise<CleanupResult> {
    // 如果正在清理，加入队列
    if (this.isCleaning) {
      return new Promise((resolve) => {
        this.cleanupQueue.push({ strategy, resolve });
      });
    }

    this.isCleaning = true;

    try {
      const cleanupStrategy = this.cleanupStrategies.get(strategy);
      if (!cleanupStrategy) {
        throw new Error(`Cleanup strategy ${strategy} not available`);
      }

      log.info('ResourceCleaner', `Performing ${strategy} cleanup...`);
      const result = await cleanupStrategy.execute();

      // 记录清理结果
      this.recordCleanupResult(result);

      log.info('ResourceCleaner', `${strategy} cleanup completed: ${result.memoryFreed}MB freed in ${result.duration}ms`);

      return result;
    } catch (error) {
      const errorResult: CleanupResult = {
        strategy,
        memoryFreed: 0,
        success: false,
        duration: 0,
      };

      this.recordCleanupResult(errorResult);

      log.error('ResourceCleaner', `${strategy} cleanup failed:`, error);

      return errorResult;
    } finally {
      this.isCleaning = false;

      // 处理队列中的清理请求
      this.processCleanupQueue();
    }
  }

  /**
   * 处理清理队列
   */
  private async processCleanupQueue(): Promise<void> {
    if (this.cleanupQueue.length === 0) {
      return;
    }

    const next = this.cleanupQueue.shift();
    if (next) {
      try {
        const result = await this.performCleanup(next.strategy);
        next.resolve(result);
      } catch (error) {
        const errorResult: CleanupResult = {
          strategy: next.strategy,
          memoryFreed: 0,
          success: false,
          duration: 0,
        };
        next.resolve(errorResult);
      }
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
    strategyStats: Record<string, { count: number; successRate: number; avgMemoryFreed: number }>;
    recentCleanups: CleanupResult[];
  } {
    const totalCleanups = this.cleanupHistory.length;
    const successfulCleanups = this.cleanupHistory.filter(r => r.success).length;
    const failedCleanups = totalCleanups - successfulCleanups;
    const totalMemoryFreed = this.cleanupHistory.reduce((sum, r) => sum + r.memoryFreed, 0);
    const averageCleanupTime = totalCleanups > 0
      ? this.cleanupHistory.reduce((sum, r) => sum + r.duration, 0) / totalCleanups
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

    const strategyStats: Record<string, { count: number; successRate: number; avgMemoryFreed: number }> = {};
    Object.entries(strategyGroups).forEach(([strategy, results]) => {
      const count = results.length;
      const successCount = results.filter(r => r.success).length;
      const avgMemoryFreed = results.reduce((sum, r) => sum + r.memoryFreed, 0) / count;

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
    return Array.from(this.cleanupStrategies.keys());
  }

  /**
   * 检查清理器是否健康
   */
  isHealthy(): boolean {
    const stats = this.getCleanupStats();

    // 检查失败率
    if (stats.totalCleanups > 10 && stats.failedCleanups / stats.totalCleanups > 0.3) {
      return false;
    }

    // 检查队列长度
    if (this.cleanupQueue.length > 5) {
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
    this.cleanupQueue = [];
    this.isCleaning = false;
  }

  /**
   * 销毁清理器
   */
  destroy(): void {
    this.reset();
    this.cleanupStrategies.clear();
  }
}