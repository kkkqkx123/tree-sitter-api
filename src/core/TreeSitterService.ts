/**
 * 核心Tree-sitter服务 - 统一的请求处理和资源管理
 */

import { LanguageManager } from './LanguageManager';
import { ParserPool } from './ParserPool';
import { MemoryMonitor } from './MemoryMonitor';
import { ResourceCleaner } from './ResourceCleaner';
import { ParseRequest, ParseResult, MatchResult } from '../types/api';
import {
  SupportedLanguage,
  TreeSitterTree,
  TreeSitterQuery,
} from '../types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../types/errors';
import { EnvConfig } from '../config/env';
import { CleanupStrategy } from '../config/memory';
import { log } from '../utils/Logger';

// 导入Tree-sitter
import Parser from 'tree-sitter';

export class TreeSitterService {
  private languageManager: LanguageManager;
  private parserPool: ParserPool;
  private memoryMonitor: MemoryMonitor;
  private resourceCleaner: ResourceCleaner;
  private activeTrees: Set<TreeSitterTree> = new Set();
  private activeQueries: Set<TreeSitterQuery> = new Set();
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.languageManager = new LanguageManager();
    this.parserPool = new ParserPool();
    this.memoryMonitor = new MemoryMonitor();
    this.resourceCleaner = new ResourceCleaner();

    // 设置资源清理器的依赖
    this.resourceCleaner.setParserPool(this.parserPool);
    this.resourceCleaner.setLanguageManager(this.languageManager);

    // 启动内存监控
    this.memoryMonitor.startMonitoring();

    log.info('TreeSitterService', 'TreeSitterService initialized');
  }

  /**
   * 处理解析请求
   */
  async processRequest(request: ParseRequest): Promise<ParseResult> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      // 验证请求
      this.validateRequest(request);

      // 检查内存状态
      const memoryStatus = this.memoryMonitor.checkMemory();
      if (memoryStatus.level === 'critical') {
        await this.handleCriticalMemory();
      }

      // 处理请求
      const result = await this.executeRequest(request);

      // 记录处理时间
      const duration = Date.now() - startTime;
      log.info('TreeSitterService', `Request processed in ${duration}ms`);

      return result;
    } catch (error) {
      this.errorCount++;
      return this.handleError(error, request);
    }
  }

  /**
   * 验证请求
   */
  private validateRequest(request: ParseRequest): void {
    if (
      !request.language ||
      request.code === undefined ||
      request.code === null
    ) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Missing required fields: language or code',
      );
    }

    if (!this.languageManager.isLanguageSupported(request.language)) {
      throw new TreeSitterError(
        ErrorType.UNSUPPORTED_LANGUAGE,
        ErrorSeverity.MEDIUM,
        `Unsupported language: ${request.language}`,
      );
    }

    if (request.code.length > EnvConfig.MAX_CODE_LENGTH) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Code length exceeds maximum allowed size of ${EnvConfig.MAX_CODE_LENGTH} bytes`,
      );
    }

    const queryCount = (request.query ? 1 : 0) + (request.queries?.length || 0);
    if (queryCount > 10) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Too many queries. Maximum allowed is 10, got ${queryCount}`,
      );
    }
  }

  /**
   * 执行请求
   */
  private async executeRequest(request: ParseRequest): Promise<ParseResult> {
    const { language, code, query, queries = [] } = request;

    // 特殊处理空代码情况
    if (code === '') {
      // 对于空代码，直接返回空匹配结果而不进行解析
      return { success: true, matches: [], errors: [] };
    }

    let parser: Parser | null = null;
    let tree: TreeSitterTree | null = null;
    const cleanup: Array<() => void> = [];

    try {
      // 获取语言模块
      const languageModule = await this.languageManager.getLanguage(
        language as SupportedLanguage,
      );

      // 获取解析器
      parser = this.parserPool.getParser(language as SupportedLanguage);
      parser.setLanguage(languageModule as any);

      // 添加解析器释放到清理队列
      cleanup.push(() => {
        if (parser) {
          this.parserPool.releaseParser(parser, language as SupportedLanguage);
        }
      });

      // 解析代码
      const parsedTree = parser.parse(code);
      tree = parsedTree as any as TreeSitterTree;
      this.activeTrees.add(tree);

      // 添加tree销毁到清理队列
      cleanup.push(() => {
        if (tree) {
          this.destroyTree(tree);
        }
      });

      // 验证解析结果 - 检查tree是否有效
      if (!tree) {
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.MEDIUM,
          'Failed to parse code: invalid tree structure',
        );
      }

      // 检查根节点是否存在
      if (!tree.rootNode) {
        log.warn('TreeSitterService', 'Parsed tree has no root node');
        return { success: true, matches: [], errors: [] };
      }

      log.info(
        'TreeSitterService',
        `Parsed tree with type: ${tree.rootNode.type}, childCount: ${tree.rootNode.childCount}`,
      );

      // 执行查询
      const allQueries = query ? [query, ...queries] : queries;

      // 如果没有查询，直接返回空结果
      if (allQueries.length === 0) {
        return { success: true, matches: [], errors: [] };
      }

      log.info(
        'TreeSitterService',
        `Executing ${allQueries.length} queries: ${allQueries.join(', ')}`,
      );
      const matches = await this.executeQueries(
        tree,
        allQueries,
        languageModule,
      );
      log.info('TreeSitterService', `Found ${matches.length} matches`);

      return { success: true, matches, errors: [] };
    } finally {
      // 确保所有资源都被清理
      for (const cleanupFn of cleanup) {
        try {
          cleanupFn();
        } catch (error) {
          log.warn(
            'TreeSitterService',
            'Error during resource cleanup:',
            error,
          );
        }
      }
    }
  }

  /**
   * 执行查询
   */
  private async executeQueries(
    tree: TreeSitterTree,
    queries: string[],
    languageModule: any,
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    for (const queryString of queries) {
      try {
        // 使用正确的方式创建查询 - Tree-sitter的查询需要通过language.query()方式创建
        // 但首先需要检查languageModule是否有query方法
        let query: TreeSitterQuery | null = null;
        
        if (typeof languageModule.query === 'function') {
          query = languageModule.query(queryString) as TreeSitterQuery;
        } else {
          // 如果languageModule没有query方法，尝试使用Parser.Query
          try {
            const Query = (Parser as any).Query;
            query = new Query(languageModule, queryString) as TreeSitterQuery;
          } catch (error) {
            log.warn(
              'TreeSitterService',
              `Failed to create query using Parser.Query: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }
        }
        
        if (!query) {
          log.warn(
            'TreeSitterService',
            `Failed to create query for: ${queryString}`,
          );
          continue;
        }

        this.activeQueries.add(query);

        try {
          // 确保rootNode存在
          if (!tree.rootNode) {
            log.warn('TreeSitterService', 'Root node is null or undefined');
            continue;
          }

          const queryMatches = query.matches(tree.rootNode);

          // 检查匹配结果
          if (!queryMatches || !Array.isArray(queryMatches)) {
            log.warn(
              'TreeSitterService',
              `Query returned invalid matches: ${queryMatches}`,
            );
            continue;
          }

          const queryResults = queryMatches.flatMap(match => {
            if (!match || !match.captures || !Array.isArray(match.captures)) {
              return [];
            }

            return match.captures
              .filter((capture: any) => capture && capture.name && capture.node)
              .map((capture: any) => {
                if (!capture || !capture.name || !capture.node) {
                  log.warn('TreeSitterService', 'Invalid capture object');
                  return null;
                }

                return {
                  captureName: capture.name,
                  type: capture.node.type,
                  text: capture.node.text,
                  startPosition: {
                    row: capture.node.startPosition.row,
                    column: capture.node.startPosition.column,
                  },
                  endPosition: {
                    row: capture.node.endPosition.row,
                    column: capture.node.endPosition.column,
                  },
                };
              })
              .filter((item: any): item is MatchResult => item !== null);
          });

          matches.push(...queryResults);
        } finally {
          this.destroyQuery(query);
        }
      } catch (error) {
        log.warn(
          'TreeSitterService',
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 继续处理其他查询，不中断整个请求
      }
    }

    return matches;
  }

  /**
   * 处理严重内存状态
   */
  private async handleCriticalMemory(): Promise<void> {
    log.warn(
      'TreeSitterService',
      'Critical memory usage detected, performing emergency cleanup',
    );

    // 再次检查内存状态
    const memoryStatus = this.memoryMonitor.checkMemory();
    if (memoryStatus.level === 'critical') {
      throw new TreeSitterError(
        ErrorType.MEMORY_ERROR,
        ErrorSeverity.CRITICAL,
        'Service temporarily unavailable: out of memory',
      );
    }
  }
  /**
   * 处理错误
   */
  private handleError(error: unknown, _request: ParseRequest): ParseResult {
    if (error instanceof TreeSitterError) {
      return {
        success: false,
        matches: [],
        errors: [error.message],
      };
    }

    return {
      success: false,
      matches: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  /**
   * 销毁树
   */
  private destroyTree(tree: TreeSitterTree): void {
    this.activeTrees.delete(tree);
    try {
      if (typeof tree.delete === 'function') {
        tree.delete();
      }
    } catch (error) {
      log.warn('TreeSitterService', 'Failed to destroy tree:', error);
    }
  }

  /**
   * 销毁查询
   */
  private destroyQuery(query: TreeSitterQuery): void {
    this.activeQueries.delete(query);
    try {
      if (typeof query.delete === 'function') {
        query.delete();
      }
    } catch (error) {
      log.warn('TreeSitterService', 'Failed to destroy query:', error);
    }
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    memory: ReturnType<MemoryMonitor['checkMemory']>;
    parserPool: ReturnType<ParserPool['getPoolStats']>;
    languageManager: ReturnType<LanguageManager['getStatus']>;
    service: {
      requestCount: number;
      errorCount: number;
      errorRate: number;
      activeResources: {
        trees: number;
        queries: number;
      };
    };
    timestamp: string;
  } {
    const memory = this.memoryMonitor.checkMemory();
    const parserPool = this.parserPool.getPoolStats();
    const languageManager = this.languageManager.getStatus();
    const errorRate =
      this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    // 确定整体状态 - 修复健康状态判断逻辑
    let status: 'healthy' | 'warning' | 'error' = 'healthy';

    // 只有在真正严重的情况下才返回error
    if (memory.level === 'critical' || errorRate > 50) {
      status = 'error';
    } else if (
      memory.level === 'warning' ||
      errorRate > 20 ||
      !this.parserPool.isHealthy()
    ) {
      status = 'warning';
    }

    return {
      status,
      memory,
      parserPool,
      languageManager,
      service: {
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
        activeResources: {
          trees: this.activeTrees.size,
          queries: this.activeQueries.size,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.languageManager.getSupportedLanguages();
  }

  /**
   * 预加载语言模块
   */
  async preloadLanguages(_languages?: SupportedLanguage[]): Promise<void> {
    await this.languageManager.preloadAllLanguages();
  }

  /**
   * 执行内存清理
   */
  async performCleanup(
    strategy: CleanupStrategy = CleanupStrategy.BASIC,
  ): Promise<{
    memoryFreed: number;
    duration: number;
    success: boolean;
  }> {
    const result = await this.resourceCleaner.performCleanup(strategy);

    return {
      memoryFreed: result.memoryFreed,
      duration: result.duration,
      success: result.success,
    };
  }

  /**
   * 获取详细统计信息
   */
  getDetailedStats(): {
    health: ReturnType<TreeSitterService['getHealthStatus']>;
    memory: ReturnType<MemoryMonitor['getDetailedMemoryReport']>;
    cleanup: ReturnType<ResourceCleaner['getCleanupStats']>;
  } {
    return {
      health: this.getHealthStatus(),
      memory: this.memoryMonitor.getDetailedMemoryReport(),
      cleanup: this.resourceCleaner.getCleanupStats(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.memoryMonitor.resetHistory();
    this.resourceCleaner.clearHistory();
  }

  /**
   * 紧急清理
   */
  async emergencyCleanup(): Promise<void> {
    log.warn('TreeSitterService', 'Performing emergency cleanup');

    // 清理所有活跃资源
    this.activeTrees.forEach(tree => this.destroyTree(tree));
    this.activeQueries.forEach(query => this.destroyQuery(query));

    // 清理解析器池
    this.parserPool.emergencyCleanup();

    // 清理语言管理器缓存
    this.languageManager.clearCache();

    // 执行紧急清理
    await this.resourceCleaner.performCleanup(CleanupStrategy.EMERGENCY);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    log.info('TreeSitterService', 'Destroying TreeSitterService...');

    // 清理所有活跃资源
    this.activeTrees.forEach(tree => this.destroyTree(tree));
    this.activeQueries.forEach(query => this.destroyQuery(query));

    // 销毁组件
    this.parserPool.destroy();
    this.memoryMonitor.destroy();
    this.resourceCleaner.destroy();

    log.info('TreeSitterService', 'TreeSitterService destroyed');
  }
}