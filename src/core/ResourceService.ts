/**
 * 资源服务 - 统一资源管理和解析器池功能
 * 提供解析器和语法树的完整生命周期管理
 */

import Parser from 'tree-sitter';
import { SupportedLanguage, TreeSitterTree } from '../types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../types/errors';
import { EnvConfig } from '../config/env';
import { log } from '../utils/Logger';

export interface IResourceService {
  acquireParser(language: SupportedLanguage): Promise<Parser>;
  releaseParser(parser: Parser, language: SupportedLanguage): void;
  createTree(parser: Parser, code: string): Promise<TreeSitterTree>;
  destroyTree(tree: TreeSitterTree): void;
  cleanup(): void;
  getActiveResourcesCount(): { trees: number; parsers: number };
  getPoolStats(): {
    totalPooled: number;
    totalActive: number;
    languageStats: Record<SupportedLanguage, number>;
    memoryUsage: {
      estimatedParsers: number;
      estimatedMemoryMB: number;
    };
  };
  isHealthy(): boolean;
  emergencyCleanup(): void;
  destroy(): void;
}

export class ResourceService implements IResourceService {
  // 解析器池相关
  private pools: Map<SupportedLanguage, Parser[]> = new Map();
  private activeParsers: Set<Parser> = new Set();
  private parserTimestamps: Map<Parser, number> = new Map();
  private maxPoolSize: number;
  private parserTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // 资源管理相关
  private activeTrees: Set<TreeSitterTree> = new Set();
  private activeParsersByLanguage: Map<SupportedLanguage, Parser[]> = new Map();

  constructor() {
    this.maxPoolSize = EnvConfig.PARSER_POOL_SIZE;
    this.parserTimeout = EnvConfig.PARSER_TIMEOUT;
    this.startCleanupTimer();
  }

  /**
   * 获取解析器
   */
  public async acquireParser(language: SupportedLanguage): Promise<Parser> {
    try {
      // 尝试从池中获取
      const languagePool = this.pools.get(language);

      if (languagePool && languagePool.length > 0) {
        const parser = languagePool.pop()!;
        this.activeParsers.add(parser);
        this.parserTimestamps.set(parser, Date.now());
        
        // 跟踪活跃解析器
        if (!this.activeParsersByLanguage.has(language)) {
          this.activeParsersByLanguage.set(language, []);
        }
        this.activeParsersByLanguage.get(language)!.push(parser);

        log.debug('ResourceService', `Acquired parser for language: ${language}`);
        return parser;
      }

      // 创建新的解析器
      const parser = new Parser();
      this.activeParsers.add(parser);
      this.parserTimestamps.set(parser, Date.now());
      
      // 跟踪活跃解析器
      if (!this.activeParsersByLanguage.has(language)) {
        this.activeParsersByLanguage.set(language, []);
      }
      this.activeParsersByLanguage.get(language)!.push(parser);

      return parser;
    } catch (error) {
      log.error('ResourceService', `Failed to acquire parser for language ${language}:`, error);
      throw new TreeSitterError(
        ErrorType.RESOURCE_ERROR,
        ErrorSeverity.MEDIUM,
        `Failed to acquire parser for language ${language}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 释放解析器
   */
  public releaseParser(parser: Parser, language: SupportedLanguage): void {
    if (!this.activeParsers.has(parser)) {
      return; // 解析器不在活跃列表中
    }

    this.activeParsers.delete(parser);
    this.parserTimestamps.delete(parser);

    // 从活跃解析器列表中移除
    const parsers = this.activeParsersByLanguage.get(language);
    if (parsers) {
      const index = parsers.indexOf(parser);
      if (index > -1) {
        parsers.splice(index, 1);
      }
    }

    // 释放到池中
    let languagePool = this.pools.get(language);
    if (!languagePool) {
      languagePool = [];
      this.pools.set(language, languagePool);
    }

    // 检查池大小限制
    if (languagePool.length < this.maxPoolSize) {
      languagePool.push(parser);
    } else {
      // 池已满，销毁解析器
      this.destroyParser(parser);
    }

    log.debug('ResourceService', `Released parser for language: ${language}`);
  }

  /**
   * 创建语法树
   */
  public async createTree(parser: Parser, code: string): Promise<TreeSitterTree> {
    try {
      // 特殊处理空代码情况
      if (code === '') {
        log.debug('ResourceService', 'Skipping tree creation for empty code');
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.LOW,
          'Cannot create tree for empty code',
        );
      }

      // 解析代码
      const parsedTree = parser.parse(code);
      const tree = parsedTree as any as TreeSitterTree;

      // 验证解析结果
      if (!tree) {
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.MEDIUM,
          'Failed to parse code: invalid tree structure',
        );
      }

      // 检查根节点是否存在
      if (!tree.rootNode) {
        log.warn('ResourceService', 'Parsed tree has no root node');
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.MEDIUM,
          'Parsed tree has no root node',
        );
      }

      // 添加到活跃树集合
      this.activeTrees.add(tree);

      log.debug(
        'ResourceService',
        `Created tree with type: ${tree.rootNode.type}, childCount: ${tree.rootNode.childCount}`,
      );

      return tree;
    } catch (error) {
      if (error instanceof TreeSitterError) {
        throw error;
      }

      log.error('ResourceService', 'Failed to create tree:', error);
      throw new TreeSitterError(
        ErrorType.PARSE_ERROR,
        ErrorSeverity.MEDIUM,
        `Failed to create tree: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 销毁语法树
   */
  public destroyTree(tree: TreeSitterTree): void {
    try {
      // 从活跃树集合中移除
      this.activeTrees.delete(tree);

      // 销毁树 - 手动内存清理已移除，依赖垃圾回收器自动管理

      log.debug('ResourceService', 'Tree destroyed successfully');
    } catch (error) {
      log.warn('ResourceService', 'Failed to destroy tree:', error);
    }
  }

  /**
   * 清理所有资源
   */
  public cleanup(): void {
    log.info('ResourceService', 'Performing resource cleanup...');

    // 清理所有活跃树
    const treesToDestroy = Array.from(this.activeTrees);
    for (const tree of treesToDestroy) {
      this.destroyTree(tree);
    }

    // 清理所有活跃解析器
    for (const [language, parsers] of this.activeParsersByLanguage.entries()) {
      for (const parser of parsers) {
        try {
          this.releaseParser(parser, language);
        } catch (error) {
          log.warn('ResourceService', `Failed to release parser during cleanup:`, error);
        }
      }
    }

    // 清空活跃解析器映射
    this.activeParsersByLanguage.clear();

    // 清理池中的解析器
    this.pools.forEach((parsers, _language) => {
      parsers.forEach(parser => this.destroyParser(parser));
    });
    this.pools.clear();

    // 清理活跃解析器集合
    this.activeParsers.clear();
    this.parserTimestamps.clear();

    log.info('ResourceService', 'Resource cleanup completed');
  }

  /**
   * 获取活跃资源数量
   */
  public getActiveResourcesCount(): { trees: number; parsers: number } {
    let parserCount = 0;
    for (const parsers of this.activeParsersByLanguage.values()) {
      parserCount += parsers.length;
    }

    return {
      trees: this.activeTrees.size,
      parsers: parserCount,
    };
  }

  /**
   * 获取池状态统计
   */
  public getPoolStats(): {
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
  public isHealthy(): boolean {
    const stats = this.getPoolStats();

    // 检查活跃解析器数量是否合理
    if (stats.totalActive > this.maxPoolSize * 2) {
      return false;
    }

    // 检查内存使用是否合理
    if (stats.memoryUsage.estimatedMemoryMB > 50) {
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
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 执行周期性清理
   */
  private performPeriodicCleanup(): void {
    const now = Date.now();
    const timeoutThreshold = now - this.parserTimeout;

    // 清理超时的活跃解析器
    const timedOutParsers: Parser[] = [];
    this.activeParsers.forEach(parser => {
      const timestamp = this.parserTimestamps.get(parser);
      if (timestamp && timestamp < timeoutThreshold) {
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
        const keepCount = Math.floor(this.maxPoolSize / 2);
        const toKeep = parsers.slice(-keepCount);
        const toRemove = parsers.slice(0, parsers.length - keepCount);
        
        toRemove.forEach(parser => this.destroyParser(parser));
        
        this.pools.set(language, toKeep);
      }
    });

    // 记录清理结果
    if (timedOutParsers.length > 0) {
      log.info(
        'ResourceService',
        `Cleaned up ${timedOutParsers.length} timed out parsers`,
      );
    }
  }

  /**
   * 销毁解析器实例
   */
  private destroyParser(parser: Parser): void {
    try {
      this.parserTimestamps.delete(parser);

      // 手动解析器清理已移除，依赖垃圾回收器自动管理
    } catch (error) {
      log.warn('ResourceService', 'Failed to destroy parser:', error);
    }
  }

  /**
   * 紧急清理
   */
  public emergencyCleanup(): void {
    log.warn('ResourceService', 'Performing emergency cleanup...');

    // 清理所有活跃资源
    this.cleanup();

    // 手动垃圾回收已移除，依赖Node.js自动垃圾回收

    log.warn('ResourceService', 'Emergency cleanup completed');
  }

  /**
   * 销毁资源服务
   */
  public destroy(): void {
    this.stopCleanupTimer();
    this.cleanup();
  }
}