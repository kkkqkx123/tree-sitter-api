/**
 * 资源管理器 - 管理解析器和树的生命周期
 */

import { ParserPool } from './ParserPool';
import { LanguageManager } from './LanguageManager';
import { TreeSitterTree, SupportedLanguage } from '../types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../types/errors';
import { log } from '../utils/Logger';

// 导入Tree-sitter
import Parser from 'tree-sitter';

export interface IResourceManager {
  acquireParser(language: SupportedLanguage): Promise<Parser>;
  releaseParser(parser: Parser, language: SupportedLanguage): void;
  createTree(parser: Parser, code: string): Promise<TreeSitterTree>;
  destroyTree(tree: TreeSitterTree): void;
  cleanup(): void;
  getActiveResourcesCount(): { trees: number; parsers: number };
}

export class ResourceManager implements IResourceManager {
  private parserPool: ParserPool;
  private languageManager: LanguageManager;
  private activeTrees: Set<TreeSitterTree> = new Set();
  private activeParsers: Map<SupportedLanguage, Parser[]> = new Map();

  constructor(parserPool: ParserPool, languageManager: LanguageManager) {
    this.parserPool = parserPool;
    this.languageManager = languageManager;
  }

  /**
   * 获取解析器
   */
  public async acquireParser(language: SupportedLanguage): Promise<Parser> {
    try {
      // 获取语言模块
      const languageModule = await this.languageManager.getLanguage(language);

      // 获取解析器
      const parser = this.parserPool.getParser(language);
      parser.setLanguage(languageModule as any);

      // 跟踪活跃解析器
      if (!this.activeParsers.has(language)) {
        this.activeParsers.set(language, []);
      }
      this.activeParsers.get(language)!.push(parser);

      log.debug('ResourceManager', `Acquired parser for language: ${language}`);
      return parser;
    } catch (error) {
      log.error('ResourceManager', `Failed to acquire parser for language ${language}:`, error);
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
    try {
      // 从活跃解析器列表中移除
      const parsers = this.activeParsers.get(language);
      if (parsers) {
        const index = parsers.indexOf(parser);
        if (index > -1) {
          parsers.splice(index, 1);
        }
      }

      // 释放到池中
      this.parserPool.releaseParser(parser, language);

      log.debug('ResourceManager', `Released parser for language: ${language}`);
    } catch (error) {
      log.warn('ResourceManager', `Failed to release parser for language ${language}:`, error);
    }
  }

  /**
   * 创建语法树
   */
  public async createTree(parser: Parser, code: string): Promise<TreeSitterTree> {
    try {
      // 特殊处理空代码情况
      if (code === '') {
        log.debug('ResourceManager', 'Skipping tree creation for empty code');
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
        log.warn('ResourceManager', 'Parsed tree has no root node');
        throw new TreeSitterError(
          ErrorType.PARSE_ERROR,
          ErrorSeverity.MEDIUM,
          'Parsed tree has no root node',
        );
      }

      // 添加到活跃树集合
      this.activeTrees.add(tree);

      log.debug(
        'ResourceManager',
        `Created tree with type: ${tree.rootNode.type}, childCount: ${tree.rootNode.childCount}`,
      );

      return tree;
    } catch (error) {
      if (error instanceof TreeSitterError) {
        throw error;
      }

      log.error('ResourceManager', 'Failed to create tree:', error);
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

      // 销毁树
      if (typeof tree.delete === 'function') {
        tree.delete();
      }

      log.debug('ResourceManager', 'Tree destroyed successfully');
    } catch (error) {
      log.warn('ResourceManager', 'Failed to destroy tree:', error);
    }
  }

  /**
   * 清理所有资源
   */
  public cleanup(): void {
    log.info('ResourceManager', 'Performing resource cleanup...');

    // 清理所有活跃树
    const treesToDestroy = Array.from(this.activeTrees);
    for (const tree of treesToDestroy) {
      this.destroyTree(tree);
    }

    // 清理所有活跃解析器
    for (const [language, parsers] of this.activeParsers.entries()) {
      for (const parser of parsers) {
        try {
          this.releaseParser(parser, language);
        } catch (error) {
          log.warn('ResourceManager', `Failed to release parser during cleanup:`, error);
        }
      }
    }

    // 清空活跃解析器映射
    this.activeParsers.clear();

    log.info('ResourceManager', 'Resource cleanup completed');
  }

  /**
   * 获取活跃资源数量
   */
  public getActiveResourcesCount(): { trees: number; parsers: number } {
    let parserCount = 0;
    for (const parsers of this.activeParsers.values()) {
      parserCount += parsers.length;
    }

    return {
      trees: this.activeTrees.size,
      parsers: parserCount,
    };
  }

  /**
   * 检查资源健康状态
   */
  public checkResourceHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const activeResources = this.getActiveResourcesCount();

    // 检查活跃树数量
    if (activeResources.trees > 100) {
      issues.push(`High number of active trees: ${activeResources.trees}`);
      recommendations.push('Consider reducing tree lifetime or implementing more aggressive cleanup');
    }

    // 检查活跃解析器数量
    if (activeResources.parsers > 50) {
      issues.push(`High number of active parsers: ${activeResources.parsers}`);
      recommendations.push('Consider reducing parser usage or implementing parser pooling');
    }

    // 检查解析器池健康状态
    if (!this.parserPool.isHealthy()) {
      issues.push('Parser pool is not healthy');
      recommendations.push('Check parser pool configuration and consider emergency cleanup');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * 紧急清理
   */
  public emergencyCleanup(): void {
    log.warn('ResourceManager', 'Performing emergency cleanup...');

    // 清理所有活跃资源
    this.cleanup();

    // 执行解析器池紧急清理
    this.parserPool.emergencyCleanup();

    // 清理语言管理器缓存
    this.languageManager.clearCache();

    log.warn('ResourceManager', 'Emergency cleanup completed');
  }

  /**
   * 获取资源统计信息
   */
  public getResourceStats(): {
    active: { trees: number; parsers: number };
    pool: ReturnType<ParserPool['getPoolStats']>;
    health: ReturnType<ResourceManager['checkResourceHealth']>;
  } {
    return {
      active: this.getActiveResourcesCount(),
      pool: this.parserPool.getPoolStats(),
      health: this.checkResourceHealth(),
    };
  }
}