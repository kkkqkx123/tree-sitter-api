/**
 * 核心Tree-sitter服务 - 统一的请求处理和资源管理
 */

import { LanguageManager } from './LanguageManager';
import { LightweightParserPool } from './LightweightParserPool';
import { MemoryMonitor } from './MemoryMonitor';
import { ResourceCleaner } from './ResourceCleaner';
import { ParseRequest, ParseResult, MatchResult } from '@/types/api';
import { SupportedLanguage, TreeSitterTree, TreeSitterQuery } from '@/types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '@/types/errors';
import { EnvConfig } from '@/config/env';
import { CleanupStrategy } from '@/config/memory';

export class TreeSitterService {
  private languageManager: LanguageManager;
  private parserPool: LightweightParserPool;
  private memoryMonitor: MemoryMonitor;
  private resourceCleaner: ResourceCleaner;
  private activeTrees: Set<TreeSitterTree> = new Set();
  private activeQueries: Set<TreeSitterQuery> = new Set();
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.languageManager = new LanguageManager();
    this.parserPool = new LightweightParserPool();
    this.memoryMonitor = new MemoryMonitor();
    this.resourceCleaner = new ResourceCleaner();

    // 设置资源清理器的依赖
    this.resourceCleaner.setParserPool(this.parserPool);
    this.resourceCleaner.setLanguageManager(this.languageManager);

    // 启动内存监控
    this.memoryMonitor.startMonitoring();

    console.log('TreeSitterService initialized');
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
      console.log(`Request processed in ${duration}ms`);

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
    if (!request.language || !request.code) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        'Missing required fields: language or code'
      );
    }

    if (!this.languageManager.isLanguageSupported(request.language)) {
      throw new TreeSitterError(
        ErrorType.UNSUPPORTED_LANGUAGE,
        ErrorSeverity.MEDIUM,
        `Unsupported language: ${request.language}`
      );
    }

    if (request.code.length > EnvConfig.MAX_CODE_LENGTH) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Code length exceeds maximum allowed size of ${EnvConfig.MAX_CODE_LENGTH} bytes`
      );
    }

    const queryCount = (request.query ? 1 : 0) + (request.queries?.length || 0);
    if (queryCount > 10) {
      throw new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        `Too many queries. Maximum allowed is 10, got ${queryCount}`
      );
    }
  }

  /**
   * 执行请求
   */
  private async executeRequest(request: ParseRequest): Promise<ParseResult> {
    const { language, code, query, queries = [] } = request;

    let parser: any | null = null;
    let tree: TreeSitterTree | null = null;

    try {
      // 获取语言模块
      const languageModule = await this.languageManager.getLanguage(language as SupportedLanguage);

      // 获取解析器
      parser = this.parserPool.getParser(language as SupportedLanguage);
      parser.setLanguage(languageModule);

      // 解析代码
      tree = parser.parse(code) as any as TreeSitterTree;
      this.activeTrees.add(tree);

      // 验证解析结果
      if (!tree || !tree.rootNode) {
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.MEDIUM,
          'Failed to parse code: invalid tree structure'
        );
      }

      // 执行查询
      const allQueries = query ? [query, ...queries] : queries;
      const matches = await this.executeQueries(tree, allQueries);

      return { success: true, matches, errors: [] };

    } finally {
      // 清理资源
      if (tree) {
        this.destroyTree(tree);
      }

      if (parser) {
        this.parserPool.releaseParser(parser, language as SupportedLanguage);
      }
    }
  }

  /**
   * 执行查询
   */
  private async executeQueries(tree: TreeSitterTree, queries: string[]): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    for (const queryString of queries) {
      try {
        const query = tree.getLanguage().query(queryString) as TreeSitterQuery;
        this.activeQueries.add(query);

        try {
          const queryMatches = query.matches(tree.rootNode);

          const queryResults = queryMatches.flatMap(match =>
            match.captures.map(capture => ({
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
            }))
          );

          matches.push(...queryResults);
        } finally {
          this.destroyQuery(query);
        }
      } catch (error) {
        console.warn(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
        // 继续处理其他查询，不中断整个请求
      }
    }

    return matches;
  }

  /**
   * 处理严重内存状态
   */
  private async handleCriticalMemory(): Promise<void> {
    console.warn('Critical memory usage detected, performing emergency cleanup');

    try {

      // 再次检查内存状态
      const memoryStatus = this.memoryMonitor.checkMemory();
      if (memoryStatus.level === 'critical') {
        throw new TreeSitterError(
          ErrorType.MEMORY_ERROR,
          ErrorSeverity.CRITICAL,
          'Service temporarily unavailable: out of memory after emergency cleanup'
        );
      }
    } catch (error) {
      if (error instanceof TreeSitterError) {
        throw error;
      }
      throw new TreeSitterError(
        ErrorType.MEMORY_ERROR,
        ErrorSeverity.CRITICAL,
        'Emergency cleanup failed'
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
      console.warn('Failed to destroy tree:', error);
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
      console.warn('Failed to destroy query:', error);
    }
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    memory: ReturnType<MemoryMonitor['checkMemory']>;
    parserPool: ReturnType<LightweightParserPool['getPoolStats']>;
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
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    // 确定整体状态
    let status: 'healthy' | 'warning' | 'error' = 'healthy';

    if (memory.level === 'critical' || errorRate > 20) {
      status = 'error';
    } else if (memory.level === 'warning' || errorRate > 10 || !this.parserPool.isHealthy()) {
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
  async performCleanup(strategy: CleanupStrategy = CleanupStrategy.BASIC): Promise<{
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
    console.warn('Performing emergency cleanup');

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
    console.log('Destroying TreeSitterService...');

    // 清理所有活跃资源
    this.activeTrees.forEach(tree => this.destroyTree(tree));
    this.activeQueries.forEach(query => this.destroyQuery(query));

    // 销毁组件
    this.parserPool.destroy();
    this.memoryMonitor.destroy();
    this.resourceCleaner.destroy();

    console.log('TreeSitterService destroyed');
  }
}