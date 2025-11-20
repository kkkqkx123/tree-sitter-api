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
import { QueryValidator } from './QueryValidator';
import { QueryParser } from './QueryParser';
import { queryConfig } from '../config/query';
import { QueryOptimizer } from './QueryOptimizer';
import { PredicateProcessor } from './PredicateProcessor';
import { DirectiveProcessor } from './DirectiveProcessor';

export class QueryExecutor {
  private validator: QueryValidator;
  private parser: QueryParser;
  private optimizer: QueryOptimizer;
  private predicateProcessor: PredicateProcessor;
  private directiveProcessor: DirectiveProcessor;

  constructor() {
    this.validator = new QueryValidator();
    this.parser = new QueryParser();
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
      // 验证查询语法
      const validation = this.validator.validateQuerySyntax(query);
      if (!validation.isValid) {
        throw new QuerySyntaxError(
          `Query validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.position,
          query
        );
      }

      // 解析查询
      const parsedQuery = this.parser.parseQuery(query);

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

      if (enableDirectives && optimizedQuery.directives.length > 0) {
        processedMatches = await this.applyDirectives(
          processedMatches,
          optimizedQuery.directives,
          query
        );
      }

      // 构建最终结果
      const result: AdvancedParseResult = {
        success: true,
        matches: processedMatches,
        processedMatches,
        errors: [],
        queryFeatures: optimizedQuery.features,
        directives: optimizedQuery.directives,
        predicates: optimizedQuery.predicates,
        validationResults: validation,
        performance: this.getPerformanceMetrics(
          startTime,
          Date.now() - queryStartTime,
          baseMatches.length,
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
        originalMatches: matches.length,
      }));
    }

    const { filteredMatches, predicateResults } = await this.predicateProcessor.applyPredicates(
      matches,
      predicates
    );

    return filteredMatches.map(match => ({
      ...match,
      predicateResults: predicateResults.filter(pr =>
        pr.predicate.capture === match.captureName || !pr.predicate.capture
      ),
      filteredBy: predicates,
      originalMatches: matches.length,
    }));
  }


  /**
   * 应用指令
   */
  private async applyDirectives(
    matches: ProcessedMatchResult[],
    directives: QueryDirective[],
    _query: string
  ): Promise<ProcessedMatchResult[]> {
    if (directives.length === 0) {
      return matches.map(match => ({
        ...match,
        processedBy: [],
        transformations: [],
      }));
    }

    const { processedMatches, directiveResults } = await this.directiveProcessor.applyDirectives(
      matches,
      directives
    );

    return processedMatches.map(match => ({
      ...match,
      directiveResults: directiveResults.filter(dr =>
        dr.directive.capture === match.captureName || !dr.directive.capture
      ),
      processedBy: [...match.processedBy, ...directiveResults.map(dr => dr.directive.type)],
    }));
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
    return {
      parseTime: 0, // 解析时间在外部计算
      queryTime,
      totalTime: Date.now() - startTime,
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
      const validation = this.validator.validateQuerySyntax(query);
      return validation.isValid;
    } catch (error) {
      log.warn('QueryExecutor', `Query validation error: ${error}`);
      return false;
    }
  }
}