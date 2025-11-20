/**
 * 查询处理器 - 处理查询执行和结果处理
 */

import { TreeSitterTree } from '../types/treeSitter';
import { MatchResult } from '../types/api';
import { EnhancedMatchResult, AdvancedParseResult } from '../types/advancedQuery';
import { QueryExecutor } from './QueryExecutor';
import { log } from '../utils/Logger';

export interface IQueryProcessor {
  executeQueries(tree: TreeSitterTree, queries: string[], languageModule: any): Promise<MatchResult[]>;
  executeAdvancedQueries(tree: TreeSitterTree, queries: string[], languageModule: any): Promise<EnhancedMatchResult[]>;
  processResults(results: any[]): any;
  mergeResults(results: AdvancedParseResult[], request: any): AdvancedParseResult;
}

export class QueryProcessor implements IQueryProcessor {
  private queryExecutor: QueryExecutor;

  constructor(queryExecutor: QueryExecutor) {
    this.queryExecutor = queryExecutor;
  }

  /**
   * 执行基础查询
   */
  public async executeQueries(
    tree: TreeSitterTree,
    queries: string[],
    languageModule: any,
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    log.info('QueryProcessor', `Executing ${queries.length} basic queries`);

    for (const queryString of queries) {
      try {
        // 使用QueryExecutor执行查询（支持高级功能）
        const result = await this.queryExecutor.executeQueryWithAdvancedFeatures(
          tree,
          queryString,
          languageModule
        );

        if (result.success) {
          // 将EnhancedMatchResult转换为MatchResult
          const basicMatches = result.matches.map(match => ({
            captureName: match.captureName,
            type: match.type,
            text: match.text,
            startPosition: match.startPosition,
            endPosition: match.endPosition,
          }));
          
          matches.push(...basicMatches);
          log.debug('QueryProcessor', `Query "${queryString}" found ${basicMatches.length} matches`);
        } else {
          log.warn(
            'QueryProcessor',
            `Query execution failed: ${result.errors.join(', ')}`,
          );
          // 继续处理其他查询，不中断整个请求
        }
      } catch (error) {
        log.warn(
          'QueryProcessor',
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 继续处理其他查询，不中断整个请求
      }
    }

    log.info('QueryProcessor', `Basic query execution completed. Total matches: ${matches.length}`);
    return matches;
  }

  /**
   * 执行高级查询
   */
  public async executeAdvancedQueries(
    tree: TreeSitterTree,
    queries: string[],
    languageModule: any,
  ): Promise<EnhancedMatchResult[]> {
    const matches: EnhancedMatchResult[] = [];

    log.info('QueryProcessor', `Executing ${queries.length} advanced queries`);

    for (const queryString of queries) {
      try {
        // 使用QueryExecutor执行高级查询
        const result = await this.queryExecutor.executeQueryWithAdvancedFeatures(
          tree,
          queryString,
          languageModule
        );

        if (result.success) {
          matches.push(...result.matches);
          log.debug('QueryProcessor', `Advanced query "${queryString}" found ${result.matches.length} matches`);
        } else {
          log.warn(
            'QueryProcessor',
            `Advanced query execution failed: ${result.errors.join(', ')}`,
          );
          // 继续处理其他查询，不中断整个请求
        }
      } catch (error) {
        log.warn(
          'QueryProcessor',
          `Advanced query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 继续处理其他查询，不中断整个请求
      }
    }

    log.info('QueryProcessor', `Advanced query execution completed. Total matches: ${matches.length}`);
    return matches;
  }

  /**
   * 处理查询结果
   */
  public processResults(results: any[]): any {
    // 这里可以添加结果处理逻辑，如过滤、排序、转换等
    return results;
  }

  /**
   * 合并多个查询结果
   */
  public mergeResults(results: AdvancedParseResult[], request: any): AdvancedParseResult {
    const allMatches = results.flatMap(r => r.matches);
    const allErrors = results.flatMap(r => r.errors);
    const allPredicates = results.flatMap(r => r.predicates || []);
    const allDirectives = results.flatMap(r => r.directives || []);
    
    // 应用结果限制
    const limitedMatches = request.maxResults 
      ? allMatches.slice(0, request.maxResults)
      : allMatches;

    // 计算聚合性能指标
    const totalQueryTime = results.reduce((sum, r) => sum + (r.performance?.queryTime || 0), 0);
    const totalPredicatesProcessed = results.reduce((sum, r) => sum + (r.performance?.predicatesProcessed || 0), 0);
    const totalDirectivesApplied = results.reduce((sum, r) => sum + (r.performance?.directivesApplied || 0), 0);
    const totalMatchCount = results.reduce((sum, r) => sum + (r.performance?.matchCount || 0), 0);

    const hasAnySuccess = results.some(r => r.success);

    // 分析查询特性
    const queryFeatures = this.analyzeQueryFeatures(allPredicates, allDirectives);

    return {
      success: hasAnySuccess && allErrors.length === 0,
      matches: limitedMatches,
      errors: allErrors,
      queryFeatures,
      directives: allDirectives,
      predicates: allPredicates,
      performance: {
        parseTime: 0, // 解析时间在外部计算
        queryTime: totalQueryTime,
        totalTime: totalQueryTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        matchCount: totalMatchCount,
        predicatesProcessed: totalPredicatesProcessed,
        directivesApplied: totalDirectivesApplied,
      },
    };
  }

  /**
   * 分析查询特性
   */
  private analyzeQueryFeatures(predicates: any[], directives: any[]): any {
    const hasPredicates = predicates.length > 0;
    const hasDirectives = directives.length > 0;
    
    // 简化的特性分析
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (predicates.length > 5 || directives.length > 3) {
      complexity = 'complex';
    } else if (predicates.length > 2 || directives.length > 1) {
      complexity = 'moderate';
    }

    return {
      hasPredicates,
      hasDirectives,
      hasAnchors: false, // 需要从查询字符串中分析
      hasAlternations: false, // 需要从查询字符串中分析
      hasQuantifiers: false, // 需要从查询字符串中分析
      hasWildcards: false, // 需要从查询字符串中分析
      predicateCount: predicates.length,
      directiveCount: directives.length,
      complexity,
    };
  }

  /**
   * 过滤重复匹配
   */
  public filterDuplicateMatches(matches: EnhancedMatchResult[]): EnhancedMatchResult[] {
    const seen = new Set<string>();
    const filtered: EnhancedMatchResult[] = [];

    for (const match of matches) {
      const key = `${match.startPosition.row}:${match.startPosition.column}-${match.endPosition.row}:${match.endPosition.column}-${match.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(match);
      }
    }

    log.debug('QueryProcessor', `Filtered ${matches.length - filtered.length} duplicate matches`);
    return filtered;
  }

  /**
   * 排序匹配结果
   */
  public sortMatches(matches: EnhancedMatchResult[], sortBy: 'position' | 'text' | 'type' = 'position'): EnhancedMatchResult[] {
    const sorted = [...matches];

    switch (sortBy) {
      case 'position':
        sorted.sort((a, b) => {
          if (a.startPosition.row !== b.startPosition.row) {
            return a.startPosition.row - b.startPosition.row;
          }
          return a.startPosition.column - b.startPosition.column;
        });
        break;
      case 'text':
        sorted.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'type':
        sorted.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }

    return sorted;
  }

  /**
   * 分组匹配结果
   */
  public groupMatches(matches: EnhancedMatchResult[], groupBy: 'type' | 'captureName'): Record<string, EnhancedMatchResult[]> {
    const groups: Record<string, EnhancedMatchResult[]> = {};

    for (const match of matches) {
      const key = groupBy === 'type' ? match.type : match.captureName;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(match);
    }

    return groups;
  }

  /**
   * 获取查询统计信息
   */
  public getQueryStatistics(matches: EnhancedMatchResult[]): {
    totalMatches: number;
    uniqueTypes: string[];
    uniqueCaptures: string[];
    averageTextLength: number;
    largestMatch: EnhancedMatchResult | null;
    smallestMatch: EnhancedMatchResult | null;
  } {
    if (matches.length === 0) {
      return {
        totalMatches: 0,
        uniqueTypes: [],
        uniqueCaptures: [],
        averageTextLength: 0,
        largestMatch: null,
        smallestMatch: null,
      };
    }

    const uniqueTypes = Array.from(new Set(matches.map(m => m.type)));
    const uniqueCaptures = Array.from(new Set(matches.map(m => m.captureName)));
    const totalTextLength = matches.reduce((sum, m) => sum + m.text.length, 0);
    const averageTextLength = totalTextLength / matches.length;

    const sortedByLength = [...matches].sort((a, b) => b.text.length - a.text.length);
    const largestMatch = sortedByLength[0] ?? null;
    const smallestMatch = sortedByLength[sortedByLength.length - 1] ?? null;

    return {
      totalMatches: matches.length,
      uniqueTypes,
      uniqueCaptures,
      averageTextLength: Math.round(averageTextLength * 100) / 100,
      largestMatch,
      smallestMatch,
    };
  }
}