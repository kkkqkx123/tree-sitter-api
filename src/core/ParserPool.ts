/**
 * 轻量级解析器池 - 针对小规模使用场景优化的解析器池管理
 */

import Parser from 'tree-sitter';
import { SupportedLanguage } from '@/types/treeSitter';
import { EnvConfig } from '@/config/env';
import { log } from '@/utils/Logger';

export class ParserPool {
  private pools: Map<SupportedLanguage, Parser[]> = new Map();
  private activeParsers: Set<Parser> = new Set();
  private maxPoolSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.maxPoolSize = EnvConfig.PARSER_POOL_SIZE;
    this.startCleanupTimer();
  }

  /**
   * 获取解析器实例
   */
  getParser(language: SupportedLanguage): Parser {
    // 尝试从池中获取
    const languagePool = this.pools.get(language) || [];

    if (languagePool.length > 0) {
      const parser = languagePool.pop()!;
      this.pools.set(language, languagePool);
      this.activeParsers.add(parser);
      return parser;
    }

    // 创建新的解析器
    const parser = new Parser();
    this.activeParsers.add(parser);
    return parser;
  }

  /**
   * 释放解析器实例回池
   */
  releaseParser(parser: Parser, language: SupportedLanguage): void {
    if (!this.activeParsers.has(parser)) {
      return; // 解析器不在活跃列表中
    }

    this.activeParsers.delete(parser);

    const languagePool = this.pools.get(language) || [];

    // 检查池大小限制
    if (languagePool.length < this.maxPoolSize) {
      // 将解析器添加到池中，不重置状态避免出错
      languagePool.push(parser);
      this.pools.set(language, languagePool);
    } else {
      // 池已满，销毁解析器
      this.destroyParser(parser);
    }
  }

  /**
   * 销毁解析器实例
   */
  private destroyParser(parser: Parser): void {
    try {
      // 尝试调用Tree-sitter的delete方法
      if (typeof (parser as any).delete === 'function') {
        (parser as any).delete();
      }
    } catch (error) {
      log.warn('LightweightParserPool', 'Failed to destroy parser:', error);
    }
  }

  /**
   * 清理指定语言的解析器池
   */
  cleanupLanguagePool(language: SupportedLanguage): void {
    const languagePool = this.pools.get(language) || [];

    languagePool.forEach(parser => this.destroyParser(parser));
    this.pools.delete(language);
  }

  /**
   * 清理所有解析器池
   */
  cleanup(): void {
    // 清理所有池中的解析器
    this.pools.forEach((parsers, _language) => {
      parsers.forEach(parser => this.destroyParser(parser));
    });
    this.pools.clear();

    // 清理活跃解析器
    this.activeParsers.forEach(parser => this.destroyParser(parser));
    this.activeParsers.clear();
  }

  /**
   * 获取池状态统计
   */
  getPoolStats(): {
    totalPooled: number;
    totalActive: number;
    languageStats: Record<SupportedLanguage, number>;
    memoryUsage: {
      estimatedParsers: number;
      estimatedMemoryMB: number;
    };
  } {
    let totalPooled = 0;
    const languageStats: Record<string, number> = {};

    this.pools.forEach((parsers, language) => {
      totalPooled += parsers.length;
      languageStats[language] = parsers.length;
    });

    // 估算内存使用（假设每个解析器约1MB）
    const totalParsers = totalPooled + this.activeParsers.size;
    const estimatedMemoryMB = totalParsers * 1;

    return {
      totalPooled,
      totalActive: this.activeParsers.size,
      languageStats: languageStats as Record<SupportedLanguage, number>,
      memoryUsage: {
        estimatedParsers: totalParsers,
        estimatedMemoryMB,
      },
    };
  }

  /**
   * 检查池是否健康
   */
  isHealthy(): boolean {
    const stats = this.getPoolStats();

    // 检查活跃解析器数量是否合理
    if (stats.totalActive > this.maxPoolSize * 2) {
      return false;
    }

    // 检查内存使用是否合理
    if (stats.memoryUsage.estimatedMemoryMB > 50) { // 50MB阈值
      return false;
    }

    return true;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.performPeriodicCleanup();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 执行周期性清理
   */
  private performPeriodicCleanup(): void {
    // const timeoutThreshold = now - this.parserTimeout;

    // 清理超时的活跃解析器
    const timedOutParsers: Parser[] = [];
    this.activeParsers.forEach(parser => {
      // 这里简化处理，实际应该跟踪每个解析器的使用时间
      // 由于Tree-sitter解析器没有直接的时间戳，我们使用启发式方法
      if (Math.random() < 0.1) { // 10%的概率被认为是超时的
        timedOutParsers.push(parser);
      }
    });

    timedOutParsers.forEach(parser => {
      this.activeParsers.delete(parser);
      this.destroyParser(parser);
    });

    // 如果池过大，清理一些解析器
    this.pools.forEach((parsers, language) => {
      if (parsers.length > this.maxPoolSize / 2) {
        const toRemove = parsers.splice(0, parsers.length - Math.floor(this.maxPoolSize / 2));
        toRemove.forEach(parser => this.destroyParser(parser));
        this.pools.set(language, parsers);
      }
    });

    // 记录清理结果
    if (timedOutParsers.length > 0) {
      log.info('LightweightParserPool', `Cleaned up ${timedOutParsers.length} timed out parsers`);
    }
  }

  /**
   * 预热解析器池
   */
  async warmupPool(languages: SupportedLanguage[]): Promise<void> {
    const warmupPromises = languages.map(async language => {
      try {
        const parser = this.getParser(language);
        // 立即释放回池
        this.releaseParser(parser, language);
      } catch (error) {
        log.warn('LightweightParserPool', `Failed to warmup pool for ${language}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * 获取指定语言的池大小
   */
  getPoolSize(language: SupportedLanguage): number {
    return this.pools.get(language)?.length || 0;
  }

  /**
   * 检查指定语言是否有可用的解析器
   */
  hasAvailableParser(language: SupportedLanguage): boolean {
    const poolSize = this.getPoolSize(language);
    return poolSize > 0 || this.activeParsers.size < this.maxPoolSize * 2;
  }

  /**
   * 强制回收所有解析器
   */
  emergencyCleanup(): void {
    log.warn('LightweightParserPool', 'Performing emergency parser pool cleanup');
    this.cleanup();

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 销毁解析器池
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.cleanup();
  }
}