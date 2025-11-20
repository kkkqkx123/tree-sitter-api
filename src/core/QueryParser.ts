/**
 * 查询解析器 - 解析tree-sitter查询字符串并提取谓词和指令
 */

import {
  QueryPredicate,
  QueryDirective,
  QueryPattern,
  ParsedQuery,
  QueryFeatures,
  StructureValidationResult,
  PredicateType,
  DirectiveType,
  Position,
} from '../types/advancedQuery';
import { queryConfig } from '../config/query';
import { log } from '../utils/Logger';

export class QueryParser {
  private predicateRegex: RegExp;
  private directiveRegex: RegExp;
  private anchorRegex: RegExp;
  private alternationRegex: RegExp;
  private quantifierRegex: RegExp;
  private wildcardRegex: RegExp;

  constructor() {
    // 谓词正则表达式
    this.predicateRegex = /#(\w+)(?:-?(\w+))?\?([^)]*)/g;
    
    // 指令正则表达式
    this.directiveRegex = /#(\w+)!([^)]*)/g;
    
    // 锚点正则表达式
    this.anchorRegex = /\./g;
    
    // 交替查询正则表达式
    this.alternationRegex = /\[[^\]]*\]/g;
    
    // 量词正则表达式
    this.quantifierRegex = /[+*?]/g;
    
    // 通配符正则表达式
    this.wildcardRegex = /_\)/g;
  }

  /**
   * 解析查询字符串
   */
  public parseQuery(query: string): ParsedQuery {
    log.debug('QueryParser', `Parsing query: ${query}`);

    const patterns = this.extractPatterns(query);
    const predicates = this.extractPredicates(query);
    const directives = this.extractDirectives(query);
    const features = this.analyzeQueryFeatures(query, predicates, directives);

    const parsedQuery: ParsedQuery = {
      originalQuery: query,
      patterns,
      predicates,
      directives,
      features,
    };

    log.debug('QueryParser', `Parsed query with ${predicates.length} predicates and ${directives.length} directives`);
    
    return parsedQuery;
  }

  /**
   * 提取查询模式
   */
  private extractPatterns(query: string): QueryPattern[] {
    const patterns: QueryPattern[] = [];
    
    // 简单的模式提取 - 按行分割
    const lines = query.split('\n').filter(line => line.trim() && !line.trim().startsWith(';'));
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const captures = this.extractCaptures(trimmedLine);
      const predicates = this.extractPredicates(trimmedLine);
      const directives = this.extractDirectives(trimmedLine);
      
      patterns.push({
        pattern: trimmedLine,
        captures,
        predicates,
        directives,
      });
    }
    
    return patterns;
  }

  /**
   * 提取捕获名称
   */
  private extractCaptures(pattern: string): string[] {
    const captures: string[] = [];
    const captureRegex = /@(\w+)/g;
    let match;
    
    while ((match = captureRegex.exec(pattern)) !== null) {
      captures.push(match[1]);
    }
    
    return captures;
  }

  /**
   * 提取谓词
   */
  public extractPredicates(query: string): QueryPredicate[] {
    const predicates: QueryPredicate[] = [];
    let match;
    
    // 重置正则表达式状态
    this.predicateRegex.lastIndex = 0;
    
    while ((match = this.predicateRegex.exec(query)) !== null) {
      const predicate = this.parsePredicate(match, query);
      if (predicate) {
        predicates.push(predicate);
      }
    }
    
    return predicates;
  }

  /**
   * 解析单个谓词
   */
  private parsePredicate(match: RegExpExecArray, query: string): QueryPredicate | null {
    const fullMatch = match[0];
    const predicateType = match[1] as PredicateType;
    const modifier = match[2];
    const args = match[3];
    
    // 检查谓词类型是否被允许
    if (!queryConfig.isPredicateAllowed(predicateType)) {
      log.warn('QueryParser', `Predicate type '${predicateType}' is not allowed`);
      return null;
    }
    
    // 解析修饰符
    let negate = false;
    let quantifier: 'any' | 'all' | undefined;
    
    if (modifier === 'not') {
      negate = true;
    } else if (modifier === 'any') {
      quantifier = 'any';
    }
    
    // 解析参数
    let value: string | string[] = '';
    if (args) {
      const trimmedArgs = args.trim();
      
      // 检查是否是数组格式
      if (trimmedArgs.startsWith('[') && trimmedArgs.endsWith(']')) {
        try {
          value = JSON.parse(trimmedArgs);
        } catch (error) {
          log.warn('QueryParser', `Failed to parse predicate arguments: ${trimmedArgs}`);
          return null;
        }
      } else {
        // 移除引号
        value = trimmedArgs.replace(/^["']|["']$/g, '');
      }
    }
    
    // 获取位置信息
    const position = this.getPosition(query, match.index);
    
    return {
      type: predicateType,
      capture: this.extractCaptureFromPredicate(fullMatch),
      value,
      negate,
      quantifier,
      position,
    };
  }

  /**
   * 从谓词中提取捕获名称
   */
  private extractCaptureFromPredicate(predicate: string): string {
    const captureMatch = predicate.match(/@(\w+)/);
    return captureMatch ? captureMatch[1] : '';
  }

  /**
   * 提取指令
   */
  public extractDirectives(query: string): QueryDirective[] {
    const directives: QueryDirective[] = [];
    let match;
    
    // 重置正则表达式状态
    this.directiveRegex.lastIndex = 0;
    
    while ((match = this.directiveRegex.exec(query)) !== null) {
      const directive = this.parseDirective(match, query);
      if (directive) {
        directives.push(directive);
      }
    }
    
    return directives;
  }

  /**
   * 解析单个指令
   */
  private parseDirective(match: RegExpExecArray, query: string): QueryDirective | null {
    const directiveType = match[1] as DirectiveType;
    const args = match[2];
    
    // 检查指令类型是否被允许
    if (!queryConfig.isDirectiveAllowed(directiveType)) {
      log.warn('QueryParser', `Directive type '${directiveType}' is not allowed`);
      return null;
    }
    
    // 解析参数
    const parameters: any[] = [];
    if (args) {
      const trimmedArgs = args.trim();
      
      // 简单的参数解析
      const argMatches = trimmedArgs.match(/@(\w+)|"([^"]*)"|'([^']*)'|(\w+)/g);
      if (argMatches) {
        for (const argMatch of argMatches) {
          if (argMatch.startsWith('@')) {
            parameters.push(argMatch);
          } else if (argMatch.startsWith('"') || argMatch.startsWith("'")) {
            parameters.push(argMatch.slice(1, -1));
          } else {
            parameters.push(argMatch);
          }
        }
      }
    }
    
    // 获取位置信息
    const position = this.getPosition(query, match.index);
    
    return {
      type: directiveType,
      capture: this.extractCaptureFromDirective(match[0]),
      parameters,
      position,
    };
  }

  /**
   * 从指令中提取捕获名称
   */
  private extractCaptureFromDirective(directive: string): string {
    const captureMatch = directive.match(/@(\w+)/);
    return captureMatch ? captureMatch[1] : '';
  }

  /**
   * 获取文本位置
   */
  private getPosition(text: string, index: number): Position {
    const lines = text.substring(0, index).split('\n');
    return {
      row: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  }

  /**
   * 分析查询特性
   */
  public analyzeQueryFeatures(
    query: string,
    predicates: QueryPredicate[],
    directives: QueryDirective[]
  ): QueryFeatures {
    const hasPredicates = predicates.length > 0;
    const hasDirectives = directives.length > 0;
    const hasAnchors = this.anchorRegex.test(query);
    const hasAlternations = this.alternationRegex.test(query);
    const hasQuantifiers = this.quantifierRegex.test(query);
    const hasWildcards = this.wildcardRegex.test(query);
    
    // 计算复杂度
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    const featureCount = [
      hasPredicates,
      hasDirectives,
      hasAnchors,
      hasAlternations,
      hasQuantifiers,
      hasWildcards,
    ].filter(Boolean).length;
    
    if (featureCount >= 4 || predicates.length > 5 || directives.length > 3) {
      complexity = 'complex';
    } else if (featureCount >= 2 || predicates.length > 2 || directives.length > 1) {
      complexity = 'moderate';
    }
    
    return {
      hasPredicates,
      hasDirectives,
      hasAnchors,
      hasAlternations,
      hasQuantifiers,
      hasWildcards,
      predicateCount: predicates.length,
      directiveCount: directives.length,
      complexity,
    };
  }

  /**
   * 验证查询结构
   */
  public validateQueryStructure(query: string): StructureValidationResult {
    const issues: any[] = [];
    
    try {
      const parsedQuery = this.parseQuery(query);
      
      // 检查谓词数量
      if (!queryConfig.isPredicateCountValid(parsedQuery.predicates.length)) {
        issues.push({
          type: 'structure',
          message: `Too many predicates (${parsedQuery.predicates.length}). Maximum allowed is ${queryConfig.getConfig().maxPredicatesPerQuery}`,
          severity: 'error',
        });
      }
      
      // 检查指令数量
      if (!queryConfig.isDirectiveCountValid(parsedQuery.directives.length)) {
        issues.push({
          type: 'structure',
          message: `Too many directives (${parsedQuery.directives.length}). Maximum allowed is ${queryConfig.getConfig().maxDirectivesPerQuery}`,
          severity: 'error',
        });
      }
      
      // 检查基本语法
      if (!query.trim()) {
        issues.push({
          type: 'syntax',
          message: 'Query cannot be empty',
          severity: 'error',
        });
      }
      
      return {
        isValid: issues.length === 0,
        patterns: parsedQuery.patterns,
        issues,
      };
    } catch (error) {
      issues.push({
        type: 'syntax',
        message: `Failed to parse query: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
      
      return {
        isValid: false,
        patterns: [],
        issues,
      };
    }
  }

  /**
   * 重置解析器状态
   */
  public reset(): void {
    this.predicateRegex.lastIndex = 0;
    this.directiveRegex.lastIndex = 0;
    this.anchorRegex.lastIndex = 0;
    this.alternationRegex.lastIndex = 0;
    this.quantifierRegex.lastIndex = 0;
    this.wildcardRegex.lastIndex = 0;
  }
}