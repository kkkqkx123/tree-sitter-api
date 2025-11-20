/**
 * 查询缓存 - 提高查询性能的缓存机制
 */

import { ParsedQuery } from '../types/advancedQuery';
import { queryConfig } from '../config/query';
import { log } from '../utils/Logger';

interface CacheEntry {
  query: ParsedQuery;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private timeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = queryConfig.getCacheConfig();
    this.maxSize = config.size;
    this.timeout = config.timeout;
    
    if (config.enabled) {
      this.startCleanupInterval();
    }
    
    log.debug('QueryCache', `Initialized with max size: ${this.maxSize}, timeout: ${this.timeout}ms`);
  }

  /**
   * 获取缓存的查询
   */
  public get(key: string): ParsedQuery | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      log.debug('QueryCache', `Cache miss for key: ${key}`);
      return null;
    }
    
    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      log.debug('QueryCache', `Cache entry expired for key: ${key}`);
      return null;
    }
    
    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    log.debug('QueryCache', `Cache hit for key: ${key} (access count: ${entry.accessCount})`);
    
    return entry.query;
  }

  /**
   * 设置缓存查询
   */
  public set(key: string, query: ParsedQuery): void {
    // 检查缓存是否启用
    if (!queryConfig.getCacheConfig().enabled) {
      return;
    }
    
    // 如果缓存已满，移除最少使用的条目
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }
    
    const now = Date.now();
    const entry: CacheEntry = {
      query,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };
    
    this.cache.set(key, entry);
    log.debug('QueryCache', `Cached query for key: ${key}`);
  }

  /**
   * 清空缓存
   */
  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    log.debug('QueryCache', `Cleared cache (${size} entries removed)`);
  }

  /**
   * 获取缓存大小
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期条目
   */
  public cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      log.debug('QueryCache', `Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    mostAccessed: { key: string; count: number } | null;
  } {
    if (this.cache.size === 0) {
      return {
        size: 0,
        maxSize: this.maxSize,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null,
        mostAccessed: null,
      };
    }
    
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let mostAccessedKey = '';
    let mostAccessedCount = 0;
    let totalAccessCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
      totalAccessCount += entry.accessCount;
      
      if (entry.accessCount > mostAccessedCount) {
        mostAccessedKey = key;
        mostAccessedCount = entry.accessCount;
      }
    }
    
    // 计算命中率（简化版本，实际需要跟踪命中次数）
    const hitRate = totalAccessCount > 0 ? (totalAccessCount - this.cache.size) / totalAccessCount : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
      mostAccessed: mostAccessedCount > 0 ? { key: mostAccessedKey, count: mostAccessedCount } : null,
    };
  }

  /**
   * 预热缓存
   */
  public warmup(queries: Array<{ key: string; query: ParsedQuery }>): void {
    log.debug('QueryCache', `Warming up cache with ${queries.length} queries`);
    
    for (const { key, query } of queries) {
      this.set(key, query);
    }
    
    log.debug('QueryCache', `Cache warmup completed, current size: ${this.cache.size}`);
  }

  /**
   * 导出缓存内容
   */
  public export(): Array<{ key: string; query: ParsedQuery; metadata: CacheEntry }> {
    const exportData: Array<{ key: string; query: ParsedQuery; metadata: CacheEntry }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      exportData.push({
        key,
        query: entry.query,
        metadata: { ...entry },
      });
    }
    
    return exportData;
  }

  /**
   * 导入缓存内容
   */
  public import(data: Array<{ key: string; query: ParsedQuery; metadata: CacheEntry }>): void {
    this.clear();
    
    for (const { key, query, metadata } of data) {
      // 检查条目是否过期
      if (this.isExpired(metadata)) {
        continue;
      }
      
      this.cache.set(key, metadata);
    }
    
    log.debug('QueryCache', `Imported ${this.cache.size} cache entries`);
  }

  /**
   * 销毁缓存
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
    log.debug('QueryCache', 'Cache destroyed');
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.timeout;
  }

  /**
   * 移除最少使用的条目
   */
  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastAccessCount = Infinity;
    let oldestLastAccessed = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastAccessCount || 
          (entry.accessCount === leastAccessCount && entry.lastAccessed < oldestLastAccessed)) {
        leastUsedKey = key;
        leastAccessCount = entry.accessCount;
        oldestLastAccessed = entry.lastAccessed;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      log.debug('QueryCache', `Evicted least used entry: ${leastUsedKey}`);
    }
  }

  /**
   * 启动清理间隔
   */
  private startCleanupInterval(): void {
    // 每分钟清理一次过期条目
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 生成缓存键
   */
  public static generateKey(query: string, language?: string): string {
    const baseKey = query;
    const languageSuffix = language ? `:${language}` : '';
    return `${baseKey}${languageSuffix}`;
  }

  /**
   * 验证缓存键
   */
  public static isValidKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0 && key.length <= 1000;
  }
}

// 导出单例实例
export const queryCache = new QueryCache();