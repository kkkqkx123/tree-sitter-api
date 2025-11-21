/**
 * 查询执行器 - 执行tree-sitter查询并处理高级功能
 */

import { TreeSitterTree, TreeSitterQuery, QueryMatch, QueryCapture } from '../types/treeSitter';
import {
  EnhancedMatchResult,
  ProcessedMatchResult,
  FilteredMatchResult,
  QueryPredicate,
  QueryDirective,
  AdvancedParseResult,
  PerformanceMetrics,
} from '../types/advancedQuery';
import {
  TreeSitterError,
  ErrorType,
  ErrorSeverity,
  QuerySyntaxError
} from '../types/errors';
import { log } from '../utils/Logger';
// import { QueryValidator } from './QueryValidator';
// import { QueryParser } from './QueryParser';
import { QueryProcessor } from './QueryProcessor';
import { queryConfig } from '../config/query';
import { QueryOptimizer } from './QueryOptimizer';
import { PredicateProcessor } from './PredicateProcessor';
import { DirectiveProcessor } from './DirectiveProcessor';

export class QueryExecutor {
  private queryProcessor: QueryProcessor;
  private optimizer: QueryOptimizer;
  private predicateProcessor: PredicateProcessor;
  private directiveProcessor: DirectiveProcessor;

  constructor() {
    this.queryProcessor = new QueryProcessor();
    this.optimizer = new QueryOptimizer();
    this.predicateProcessor = new PredicateProcessor();
    this.directiveProcessor = new DirectiveProcessor();
  }

  /**
   * 执行查询并处理高级功能
   */
  public async executeQueryWithAdvancedFeatures(
    tree: TreeSitterTree,
    query: string,
    languageModule: any
  ): Promise<AdvancedParseResult> {
    const startTime = Date.now();
    const queryStartTime = Date.now();

    try {
      // 解析查询
      const parsedQuery = this.queryProcessor.parseQuery(query);
      
      // 检查是否有无效的正则表达式
      for (const predicate of parsedQuery.predicates) {
        if ((predicate.type === 'match' || predicate.type === 'not-match') && typeof predicate.value === 'string') {
          try {
            new RegExp(predicate.value);
          } catch (error) {
            return {
              success: false,
              matches: [],
              errors: [`Invalid regex pattern`],
              performance: this.getPerformanceMetrics(startTime, Date.now() - queryStartTime, 0, 0, 0, 0),
            };
          }
        }
      }

      // 验证查询语法
      const validation = this.queryProcessor.validateQuerySyntax(query);
      if (!validation.isValid) {
        throw new QuerySyntaxError(
          `Query validation failed: ${validation.errors.map((e: any) => e.message).join(', ')}`,
          validation.errors[0]?.position,
          query
        );
      }
      
      // 检查是否有无效的谓词（只检查谓词，不包括指令）
      const hasPredicates = /#\w+\?/.test(query);
      
      if (hasPredicates && parsedQuery.predicates.length === 0) {
        // 如果查询中包含谓词但没有解析出任何谓词，可能是语法错误
        return {
          success: false,
          matches: [],
          errors: ['Invalid predicate syntax or unsupported predicate type'],
          performance: this.getPerformanceMetrics(startTime, Date.now() - queryStartTime, 0, 0, 0, 0),
        };
      }
      
      // 检查是否有谓词解析错误（如any-of缺少参数）
      // 通过检查查询中是否有any-of但没有成功解析的any-of谓词
      const hasAnyOfInQuery = /#any-of\?/.test(query);
      const hasValidAnyOf = parsedQuery.predicates.some(p => p.type === 'any-of');
      
      if (hasAnyOfInQuery && !hasValidAnyOf) {
        return {
          success: false,
          matches: [],
          errors: ['Any-of predicate requires an array value'],
          performance: this.getPerformanceMetrics(startTime, Date.now() - queryStartTime, 0, 0, 0, 0),
        };
      }
      
      // 如果只有指令没有谓词，这是正常的，继续执行

      // 优化查询（如果启用）
      let optimizedQuery = parsedQuery;
      if (queryConfig.getPerformanceConfig().enabled) {
        optimizedQuery = this.optimizer.optimizeQuery(parsedQuery);
      }

      // 检查是否启用了高级功能
      const enablePredicates = queryConfig.isAdvancedFeatureEnabled('predicates');
      const enableDirectives = queryConfig.isAdvancedFeatureEnabled('directives');

      // 创建查询对象
      let treeSitterQuery: TreeSitterQuery | null = null;
      try {
        if (typeof languageModule.query === 'function') {
          treeSitterQuery = languageModule.query(optimizedQuery.originalQuery) as TreeSitterQuery;
        } else {
          const Parser = await import('tree-sitter');
          const Query = (Parser.default as any).Query;
          treeSitterQuery = new Query(languageModule, optimizedQuery.originalQuery) as TreeSitterQuery;
        }
      } catch (error) {
        throw new QuerySyntaxError(
          `Failed to create query: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          query
        );
      }

      if (!treeSitterQuery) {
        throw new TreeSitterError(
          ErrorType.QUERY_SYNTAX_ERROR,
          ErrorSeverity.MEDIUM,
          'Failed to create query object'
        );
      }

      // 执行基础查询
      const queryMatches = treeSitterQuery.matches(tree.rootNode);
      if (!queryMatches || !Array.isArray(queryMatches)) {
        log.warn('QueryExecutor', `Query returned invalid matches: ${queryMatches}`);
        return {
          success: true,
          matches: [],
          errors: [],
          performance: this.getPerformanceMetrics(startTime, 0, 0, 0, 0, 0),
        };
      }

      // 处理基础匹配结果
      const baseMatches = this.processBaseMatches(queryMatches);

      // 应用谓词（如果启用）
      let filteredMatches: FilteredMatchResult[] = baseMatches.map(match => ({
        ...match,
        filteredBy: [],
        originalMatches: 1,
      }));

      if (enablePredicates && optimizedQuery.predicates.length > 0) {
        filteredMatches = await this.applyPredicates(
          filteredMatches,
          optimizedQuery.predicates,
          query
        );
      }

      // 处理指令（如果启用）
      let processedMatches: ProcessedMatchResult[] = filteredMatches.map(match => ({
        ...match,
        processedBy: [],
        transformations: [],
      }));
      const directiveErrors: string[] = [];

      if (enableDirectives && optimizedQuery.directives.length > 0) {
        // 在应用指令之前，先验证所有指令
        const directiveValidation = this.directiveProcessor.validateDirectives(optimizedQuery.directives);
        if (!directiveValidation.isValid) {
          directiveErrors.push(...directiveValidation.errors);
        } else {
          const directiveResult = await this.applyDirectivesWithErrorHandling(
            processedMatches,
            optimizedQuery.directives,
            query
          );
          
          if (directiveResult.errors && directiveResult.errors.length > 0) {
            directiveErrors.push(...directiveResult.errors);
          }
          
          processedMatches = directiveResult.matches;
        }
      }

      // 构建最终结果
      const result: AdvancedParseResult = {
        success: directiveErrors.length === 0,
        matches: processedMatches,
        processedMatches,
        errors: directiveErrors,
        queryFeatures: optimizedQuery.features,
        directives: optimizedQuery.directives,
        predicates: optimizedQuery.predicates,
        validationResults: validation,
        performance: this.getPerformanceMetrics(
          startTime,
          Math.max(1, Date.now() - queryStartTime), // 确保queryTime至少为1ms
          processedMatches.length,  // 使用处理后的匹配数
          optimizedQuery.predicates.length,
          optimizedQuery.directives.length,
          process.memoryUsage().heapUsed / 1024 / 1024
        ),
      };

      return result;
    } catch (error) {
      const queryTime = Date.now() - queryStartTime;
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

      if (error instanceof TreeSitterError) {
        return {
          success: false,
          matches: [],
          errors: [error.message],
          performance: this.getPerformanceMetrics(
            startTime,
            queryTime,
            0,
            0,
            0,
            memoryUsage
          ),
        };
      }

      return {
        success: false,
        matches: [],
        errors: [error instanceof Error ? error.message : String(error)],
        performance: this.getPerformanceMetrics(
          startTime,
          queryTime,
          0,
          0,
          0,
          memoryUsage
        ),
      };
    }
  }

  /**
   * 处理基础匹配结果
   */
  private processBaseMatches(queryMatches: QueryMatch[]): EnhancedMatchResult[] {
    const matches: EnhancedMatchResult[] = [];

    for (const match of queryMatches) {
      if (!match || !match.captures || !Array.isArray(match.captures)) {
        continue;
      }

      const matchResults = match.captures
        .filter((capture: any) => capture && capture.name && capture.node)
        .map((capture: QueryCapture): EnhancedMatchResult | null => {
          if (!capture || !capture.name || !capture.node) {
            log.warn('QueryExecutor', 'Invalid capture object');
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
            metadata: {},
            processedText: capture.node.text,
            adjacentNodes: [],
            predicateResults: [],
            directiveResults: [],
          };
        })
        .filter((item: EnhancedMatchResult | null): item is EnhancedMatchResult => item !== null);

      matches.push(...matchResults);
    }

    return matches;
  }

  /**
   * 应用谓词
   */
  private async applyPredicates(
    matches: FilteredMatchResult[],
    predicates: QueryPredicate[],
    _query: string
  ): Promise<FilteredMatchResult[]> {
    if (predicates.length === 0) {
      return matches.map(match => ({
        ...match,
        predicateResults: [],
        filteredBy: [],
        originalMatches: 1,
      }));
    }

    const { filteredMatches, predicateResults } = await this.predicateProcessor.applyPredicates(
      matches,
      predicates
    );

    // 创建一个映射来追踪原始匹配项
    const originalMatchesMap = new Map();
    matches.forEach(match => {
      const key = `${match.captureName}-${match.text}-${match.startPosition.row}-${match.startPosition.column}`;
      originalMatchesMap.set(key, match);
    });

    return filteredMatches.map(match => {
      // 根据匹配项的特征查找原始匹配项
      const key = `${match.captureName}-${match.text}-${match.startPosition.row}-${match.startPosition.column}`;
      const originalMatch = originalMatchesMap.get(key);
      
      return {
        ...match,
        // 合并原始匹配项的metadata和当前匹配项的metadata
        metadata: { ...(originalMatch?.metadata || {}), ...(match.metadata || {}) },
        predicateResults: predicateResults.filter(pr =>
          pr.predicate.capture === match.captureName || !pr.predicate.capture
        ),
        filteredBy: predicates,
        originalMatches: matches.length,
      };
    });
  }


  /**
   * 应用指令
   */
  
  /**
   * 应用指令并处理错误
   */
  private async applyDirectivesWithErrorHandling(
    matches: ProcessedMatchResult[],
    directives: QueryDirective[],
    _query: string
  ): Promise<{ matches: ProcessedMatchResult[], errors: string[] }> {
    if (directives.length === 0) {
      return {
        matches: matches.map(match => ({
          ...match,
          processedBy: [],
          transformations: [],
        })),
        errors: []
      };
    }

    try {
      const { processedMatches, directiveResults } = await this.directiveProcessor.applyDirectives(
        matches,
        directives
      );
      
      // 检查是否有指令应用失败
      const errors = directiveResults
        .filter(dr => !dr.applied && dr.error)
        .map(dr => dr.error || '');
      
      const resultMatches = processedMatches.map(match => ({
        ...match,
        directiveResults: directiveResults.filter(dr =>
          dr.directive.capture === match.captureName || !dr.directive.capture
        ),
        processedBy: [...match.processedBy, ...directiveResults.map(dr => dr.directive.type)],
      }));

      return {
        matches: resultMatches,
        errors
      };
    } catch (error) {
      return {
        matches: matches.map(match => ({
          ...match,
          processedBy: [],
          transformations: [],
        })),
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }


  /**
   * 获取性能指标
   */
  private getPerformanceMetrics(
    startTime: number,
    queryTime: number,
    matchCount: number,
    predicatesProcessed: number,
    directivesApplied: number,
    memoryUsage: number
  ): PerformanceMetrics {
    const totalTime = Math.max(1, Date.now() - startTime); // 确保totalTime至少为1ms
    return {
      parseTime: 0, // 解析时间在外部计算
      queryTime,
      totalTime,
      memoryUsage,
      matchCount,
      predicatesProcessed,
      directivesApplied,
    };
  }

  /**
   * 验证查询（不执行）
   */
  public async validateQuery(query: string): Promise<boolean> {
    try {
      const validation = this.queryProcessor.validateQuerySyntax(query);
      return validation.isValid;
    } catch (error) {
      log.warn('QueryExecutor', `Query validation error: ${error}`);
      return false;
    }
  }
}