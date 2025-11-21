/**
 * 查询处理器 - 合并查询解析、验证和优化功能
 * 提供统一的查询处理接口
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
  ValidationResult,
  ValidationError,
  ValidationWarning,
  OptimizationSuggestion,
} from '../types/advancedQuery';
import { Position } from '../types/api';
import { queryConfig } from '../config/query';
import { log } from '../utils/Logger';

export class QueryProcessor {
  private predicateRegex: RegExp;
  private directiveRegex: RegExp;
  private anchorRegex: RegExp;
  private alternationRegex: RegExp;
  private quantifierRegex: RegExp;
  private wildcardRegex: RegExp;

  constructor() {
    // 谓词正则表达式 - 支持not-eq?, not-match?, any-eq?, any-match?等复合谓词
    // 修复：正确匹配谓词参数，包括引号内的内容
    this.predicateRegex = /#([a-z-]+)\?([^)]*)/g;

    // 指令正则表达式
    this.directiveRegex = /#([a-z-]+)!([^)]*)/g;

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
   * 处理查询 - 解析、验证和优化
   */
  public processQuery(query: string): {
    parsedQuery: ParsedQuery;
    validationResult: ValidationResult;
    optimizationSuggestions: OptimizationSuggestion[];
  } {
    log.debug('QueryProcessor', `Processing query: ${query}`);

    // 解析查询
    const parsedQuery = this.parseQuery(query);

    // 验证查询
    const validationResult = this.validateQuerySyntax(query);

    // 生成优化建议
    const optimizationSuggestions = this.generateOptimizationSuggestions(parsedQuery);

    log.debug('QueryProcessor', `Query processing completed: ${validationResult.isValid ? 'valid' : 'invalid'}`);

    return {
      parsedQuery,
      validationResult,
      optimizationSuggestions,
    };
  }

  /**
   * 解析查询字符串
   */
  public parseQuery(query: string): ParsedQuery {
    const patterns = this.extractPatterns(query);
    const predicates = this.extractPredicates(query);
    const directives = this.extractDirectives(query);
    const features = this.analyzeQueryFeatures(query, predicates, directives);

    // 将谓词和指令添加到每个模式中，以便于处理
    const enrichedPatterns = patterns.map(pattern => ({
      ...pattern,
      predicates,
      directives,
    }));

    const parsedQuery: ParsedQuery = {
      originalQuery: query,
      patterns: enrichedPatterns,
      predicates,
      directives,
      features,
    };

    return parsedQuery;
  }

  /**
   * 验证查询语法
   */
  public validateQuerySyntax(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    log.debug('QueryProcessor', `Validating query syntax: ${query}`);

    // 基本语法检查
    if (!query || query.trim().length === 0) {
      errors.push({
        type: 'syntax',
        message: 'Query cannot be empty',
        severity: 'error',
      });
      return {
        isValid: false,
        errors,
        warnings,
        features: this.getEmptyFeatures(),
      };
    }

    // 检查谓词中的正则表达式
    const matchPredicateRegex = /#(match|not-match)\?\s*@\w+\s+("[^"]*"|'[^']*')/g;
    let matchMatch;
    while ((matchMatch = matchPredicateRegex.exec(query)) !== null) {
      const fullMatch = matchMatch[2]; // 获取引号内的内容
      if (fullMatch) {
        const regexPattern = fullMatch.slice(1, -1); // 移除首尾引号
        try {
          new RegExp(regexPattern);
        } catch (e) {
          errors.push({
            type: 'syntax',
            message: 'Invalid regex pattern',
            severity: 'error',
          });
          // 如果有无效的正则表达式，直接返回
          return {
            isValid: false,
            errors,
            warnings,
            features: this.getEmptyFeatures(),
          };
        }
      }
    }

    // 检查括号匹配
    const bracketErrors = this.validateBrackets(query);
    errors.push(...bracketErrors);

    // 检查引号匹配
    const quoteErrors = this.validateQuotes(query);
    errors.push(...quoteErrors);

    // 检查基本模式语法
    const patternErrors = this.validatePatterns(query);
    errors.push(...patternErrors);

    // 验证strip指令中的正则表达式
    const stripDirectiveRegex = /#strip!\s*@\w+\s+("[^"]*"|'[^']*')/g;
    let stripMatch;
    while ((stripMatch = stripDirectiveRegex.exec(query)) !== null) {
      const fullMatch = stripMatch[1]; // 获取引号内的内容
      if (fullMatch) {
        const regexPattern = fullMatch.slice(1, -1); // 移除首尾引号
        try {
          new RegExp(regexPattern);
        } catch (e) {
          errors.push({
            type: 'syntax',
            message: `Invalid regex pattern in strip directive: ${regexPattern}`,
            severity: 'error',
          });
        }
      }
    }
    
    // 我们不需要在语法验证阶段检查select-adjacent参数，因为这在指令处理器中会检查

    // 性能警告
    const performanceWarnings = this.checkPerformanceIssues(query);
    warnings.push(...performanceWarnings);

    // 分析查询特性
    const features = this.analyzeQueryFeatures(query);

    const isValid = errors.length === 0;

    log.debug('QueryProcessor', `Query validation result: ${isValid ? 'valid' : 'invalid'} (${errors.length} errors, ${warnings.length} warnings)`);

    return {
      isValid,
      errors,
      warnings,
      features,
      suggestions: this.generateSuggestions(errors, warnings, features),
    };
  }

  /**
   * 生成优化建议
   */
  public generateOptimizationSuggestions(parsedQuery: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 谓词优化建议
    suggestions.push(...this.suggestPredicateOptimizations(parsedQuery.predicates));

    // 指令优化建议
    suggestions.push(...this.suggestDirectiveOptimizations(parsedQuery.directives));

    // 模式优化建议
    suggestions.push(...this.suggestPatternOptimizations(parsedQuery));

    // 结构优化建议
    suggestions.push(...this.suggestStructureOptimizations(parsedQuery));

    return suggestions;
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
      // 只将包含节点模式的行作为模式
      if (trimmedLine.includes('(') && trimmedLine.includes(')')) {
        const captures = this.extractCaptures(trimmedLine);
        // 注意：这里不再从单行提取谓词和指令，而是从整个查询中提取
        // 这样可以确保谓词和指令被正确处理

        patterns.push({
          pattern: trimmedLine,
          captures,
          predicates: [], // 将在parseQuery中从整个查询中提取
          directives: [], // 将在parseQuery中从整个查询中提取
        });
      }
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
      if (match[1]) {
        captures.push(match[1]);
      }
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
    const predicateTypeStr = match[1];
    const args = match[2];

    if (!predicateTypeStr) {
      log.warn('QueryProcessor', 'Predicate type is undefined');
      return null;
    }

    // 解析复合谓词类型 (如 not-eq, any-eq 等)
    let predicateType: PredicateType;
    let negate = false;
    let quantifier: 'any' | 'all' | undefined;

    if (predicateTypeStr.startsWith('not-')) {
      negate = true;
      // 保持完整的谓词类型，包括 not- 前缀
      predicateType = predicateTypeStr as PredicateType;
    } else if (predicateTypeStr.startsWith('any-')) {
      quantifier = 'any';
      // 保持完整的谓词类型，包括 any- 前缀
      predicateType = predicateTypeStr as PredicateType;
    } else {
      predicateType = predicateTypeStr as PredicateType;
    }

    // 检查谓词类型是否被允许
    if (!queryConfig.isPredicateAllowed(predicateType)) {
      log.warn('QueryProcessor', `Predicate type '${predicateType}' is not allowed`);
      return null;
    }
    
    // 检查谓词类型是否有效
    const validTypes: PredicateType[] = [
      'eq', 'match', 'any-of', 'is', 'not-eq', 'not-match', 'not-is', 'any-eq', 'any-match'
    ];
    
    if (!validTypes.includes(predicateType)) {
      log.warn('QueryProcessor', `Invalid predicate type: ${predicateType}`);
      return null;
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
          log.warn('QueryProcessor', `Failed to parse predicate arguments: ${trimmedArgs}`);
          return null;
        }
      } else {
        // 解析谓词参数 - 格式: @capture "value" 或 @capture ["value1", "value2"]
        const argMatches = trimmedArgs.match(/@(\w+)|"([^"]*)"|'([^']*)'|(\[.*?\])|(\w+)/g);
        
        if (argMatches && argMatches.length > 1) {
          // 第一个匹配是捕获名称，第二个是值
          const valueMatch = argMatches[1];
          if (valueMatch) {
            if (valueMatch.startsWith('[') && valueMatch.endsWith(']')) {
              // 处理数组值
              try {
                value = JSON.parse(valueMatch);
              } catch (error) {
                log.warn('QueryProcessor', `Failed to parse array value: ${valueMatch}`);
                return null;
              }
            } else if (valueMatch.startsWith('"') || valueMatch.startsWith("'")) {
              value = valueMatch.slice(1, -1); // 移除引号
            } else {
              value = valueMatch;
            }
          }
        } else if (argMatches && argMatches.length === 1) {
          // 只有一个参数，可能是值
          const valueMatch = argMatches[0];
          if (valueMatch) {
            // 如果是捕获名称（以@开头），则跳过
            if (valueMatch.startsWith('@')) {
              // 对于 any-of 谓词，如果没有提供数组参数，则返回错误
              if (predicateType === 'any-of') {
                log.warn('QueryProcessor', `Any-of predicate requires an array value, got: ${valueMatch}`);
                return null;
              }
              // 对于其他谓词，如果没有值，则返回错误
              log.warn('QueryProcessor', `${predicateType} predicate requires a value`);
              return null;
            } else if (valueMatch.startsWith('[') && valueMatch.endsWith(']')) {
              // 处理数组值
              try {
                value = JSON.parse(valueMatch);
              } catch (error) {
                log.warn('QueryProcessor', `Failed to parse array value: ${valueMatch}`);
                return null;
              }
            } else if (valueMatch.startsWith('"') || valueMatch.startsWith("'")) {
              value = valueMatch.slice(1, -1); // 移除引号
            } else {
              value = valueMatch;
            }
          }
        } else {
          // 移除引号作为后备方案
          value = trimmedArgs.replace(/^["']|["']$/g, '');
        }
      }

      // 对于 match 和 not-match 谓词，验证正则表达式
      if ((predicateType === 'match' || predicateType === 'not-match') && typeof value === 'string') {
        try {
          new RegExp(value);
        } catch (error) {
          log.warn('QueryProcessor', `Invalid regex pattern in ${predicateType} predicate: ${value}`);
          return null;
        }
      }
      
      // 对于 any-of 谓词，如果没有提供数组参数，则返回错误
      if (predicateType === 'any-of' && !Array.isArray(value)) {
        log.warn('QueryProcessor', `Any-of predicate requires an array value, got: ${typeof value}`);
        return null;
      }
    } else if (predicateType === 'any-of') {
      // any-of 谓词必须有参数
      log.warn('QueryProcessor', `Any-of predicate requires parameters`);
      return null;
    }

    // 获取位置信息
    const position = this.getPosition(query, match.index);

    const predicate: QueryPredicate = {
      type: predicateType,
      capture: this.extractCaptureFromPredicate(fullMatch),
      value,
      negate,
      position,
    };

    if (quantifier) {
      predicate.quantifier = quantifier;
    }

    return predicate;
  }

  /**
   * 从谓词中提取捕获名称
   */
  private extractCaptureFromPredicate(predicate: string): string {
    const captureMatch = predicate.match(/@(\w+)/);
    return captureMatch?.[1] ?? '';
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
      const error = `Unsupported directive type: ${directiveType}`;
      log.warn('QueryProcessor', error);
      // 对于不支持的指令类型，我们仍然返回一个指令对象，让上层处理错误
      // 这样可以确保测试能够正确检测到错误
      return {
        type: directiveType,
        capture: this.extractCaptureFromDirective(match[0]),
        parameters: [],
        position: this.getPosition(query, match.index),
      };
    }

    // 解析参数
    const parameters: any[] = [];
    if (args) {
      const trimmedArgs = args.trim();

      // 解析指令参数 - 正确处理set指令的参数
      if (directiveType === 'set') {
        // set指令格式: (#set! @capture "key" "value")
        // 第一个参数是捕获名称，后面是键值对
        const argMatches = trimmedArgs.match(/@(\w+)|"([^"]*)"|'([^']*)'|(\w+)/g);
        if (argMatches) {
          for (let i = 0; i < argMatches.length; i++) {
            const argMatch = argMatches[i];
            if (!argMatch) continue;
            
            if (argMatch.startsWith('@')) {
              // 捕获名称，不作为参数
              continue;
            } else if (argMatch.startsWith('"') || argMatch.startsWith("'")) {
              parameters.push(argMatch.slice(1, -1));
            } else {
              parameters.push(argMatch);
            }
          }
        }
      } else if (directiveType === 'select-adjacent') {
        // select-adjacent指令格式: (#select-adjacent! @capture1 @capture2)
        // 两个都是参数，不需要目标捕获
        const argMatches = trimmedArgs.match(/@(\w+)|"([^"]*)"|'([^']*)'|(\w+)/g);
        if (argMatches) {
          for (const argMatch of argMatches) {
            if (argMatch.startsWith('@')) {
              // 对于select-adjacent，所有@符号后面的捕获名称都作为参数
              parameters.push(argMatch.substring(1)); // 移除@符号
            } else if (argMatch.startsWith('"') || argMatch.startsWith("'")) {
              parameters.push(argMatch.slice(1, -1));
            } else {
              parameters.push(argMatch);
            }
          }
        }
      } else {
        // 其他指令的通用参数解析
        const argMatches = trimmedArgs.match(/@(\w+)|"([^"]*)"|'([^']*)'|(\w+)/g);
        if (argMatches) {
          for (const argMatch of argMatches) {
            if (argMatch.startsWith('@')) {
              // 捕获名称，不作为参数
              continue;
            } else if (argMatch.startsWith('"') || argMatch.startsWith("'")) {
              parameters.push(argMatch.slice(1, -1));
            } else {
              parameters.push(argMatch);
            }
          }
        }
      }
    }

    // 获取位置信息
    const position = this.getPosition(query, match.index);
    
    // 提取捕获名称（select-adjacent除外，因为它不需要目标捕获）
    const capture = directiveType === 'select-adjacent' ? '' : this.extractCaptureFromDirective(match[0]);
    
    // 对于某些指令类型，如果没有捕获名称，应该返回错误
    if (!capture && parameters.length > 0) {
      // 检查是否是缺少捕获名称的指令格式
      // 例如 (#set! "category" "variable") - 没有@捕获名称
      if (directiveType === 'set' && parameters.length >= 2) {
        // 这种情况是缺少捕获名称的set指令，应该在验证阶段处理
      }
    }

    return {
      type: directiveType,
      capture,
      parameters,
      position,
    };
  }

  /**
   * 从指令中提取捕获名称
   */
  private extractCaptureFromDirective(directive: string): string {
    const captureMatch = directive.match(/@(\w+)/);
    return captureMatch?.[1] ?? '';
  }

  /**
   * 获取文本位置
   */
  private getPosition(text: string, index: number): Position {
    const lines = text.substring(0, index).split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    return {
      row: lines.length - 1,
      column: lastLine.length,
    };
  }

  /**
   * 分析查询特性
   */
  public analyzeQueryFeatures(
    query?: string,
    predicates?: QueryPredicate[],
    directives?: QueryDirective[]
  ): QueryFeatures {
    if (query) {
      const hasPredicates = /#\w+\?/.test(query);
      const hasDirectives = /#\w+!/.test(query);
      const hasAnchors = this.anchorRegex.test(query);
      const hasAlternations = this.alternationRegex.test(query);
      const hasQuantifiers = this.quantifierRegex.test(query);
      const hasWildcards = this.wildcardRegex.test(query);

      // 计算谓词和指令数量
      const predicateCount = (query.match(/#\w+\?/g) || []).length;
      const directiveCount = (query.match(/#\w+!/g) || []).length;

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

      if (featureCount >= 4 || predicateCount > 5 || directiveCount > 3) {
        complexity = 'complex';
      } else if (featureCount >= 2 || predicateCount > 2 || directiveCount > 1) {
        complexity = 'moderate';
      }

      return {
        hasPredicates,
        hasDirectives,
        hasAnchors,
        hasAlternations,
        hasQuantifiers,
        hasWildcards,
        predicateCount,
        directiveCount,
        complexity,
      };
    } else if (predicates && directives) {
      const hasPredicates = predicates.length > 0;
      const hasDirectives = directives.length > 0;

      // 计算复杂度
      let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
      const featureCount = [hasPredicates, hasDirectives].filter(Boolean).length;

      if (featureCount >= 2 || predicates.length > 5 || directives.length > 3) {
        complexity = 'complex';
      } else if (predicates.length > 2 || directives.length > 1) {
        complexity = 'moderate';
      }

      return {
        hasPredicates,
        hasDirectives,
        hasAnchors: false,
        hasAlternations: false,
        hasQuantifiers: false,
        hasWildcards: false,
        predicateCount: predicates.length,
        directiveCount: directives.length,
        complexity,
      };
    }

    return this.getEmptyFeatures();
  }

  /**
   * 验证括号匹配
   */
  private validateBrackets(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const stack: string[] = [];
    const bracketPairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
    };

    for (let i = 0; i < query.length; i++) {
      const char = query[i]!;

      if (char in bracketPairs) {
        stack.push(char);
      } else if (Object.values(bracketPairs).includes(char)) {
        const lastOpen = stack.pop();
        if (!lastOpen || bracketPairs[lastOpen as keyof typeof bracketPairs] !== char) {
          errors.push({
            type: 'syntax',
            message: `Unmatched closing bracket '${char}' at position ${i}`,
            severity: 'error',
          });
        }
      }
    }

    // 检查未闭合的括号
    while (stack.length > 0) {
      const unclosed = stack.pop()!;
      errors.push({
        type: 'syntax',
        message: `Unclosed bracket '${unclosed}'`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * 验证引号匹配
   */
  private validateQuotes(query: string): ValidationError[] {
    const errors: ValidationError[] = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i]!;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    if (inSingleQuote) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed single quote',
        severity: 'error',
      });
    }

    if (inDoubleQuote) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed double quote',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * 验证模式语法
   */
  private validatePatterns(query: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // 检查无效的节点类型
    const invalidNodePattern = /\([^)]*[^a-zA-Z_][^)]*\)/g;
    let match;

    while ((match = invalidNodePattern.exec(query)) !== null) {
      const pattern = match[0];
      if (!pattern.includes('@') && !pattern.includes('_') && !/^[a-zA-Z_]/.test(pattern.substring(1))) {
        errors.push({
          type: 'syntax',
          message: `Invalid node pattern: ${pattern}`,
          severity: 'error',
        });
      }
    }

    // 检查无效的捕获名称
    const invalidCapturePattern = /@([^a-zA-Z_]\w*)/g;

    while ((match = invalidCapturePattern.exec(query)) !== null) {
      errors.push({
        type: 'syntax',
        message: `Invalid capture name: @${match[1]}`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * 检查性能问题
   */
  private checkPerformanceIssues(query: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // 检查过多的通配符
    const wildcardCount = (query.match(/\(_\)/g) || []).length;
    if (wildcardCount > 5) {
      warnings.push({
        type: 'performance',
        message: `Too many wildcards (${wildcardCount}). This may impact performance.`,
        suggestion: 'Consider using more specific patterns instead of wildcards.',
      });
    }

    // 检查复杂的交替模式
    const alternationCount = (query.match(/\[[^\]]*\]/g) || []).length;
    if (alternationCount > 3) {
      warnings.push({
        type: 'performance',
        message: `Complex alternation patterns detected (${alternationCount}). This may impact performance.`,
        suggestion: 'Consider simplifying alternation patterns or using multiple queries.',
      });
    }

    // 检查嵌套的量词
    const nestedQuantifiers = query.match(/([+*?]\s*){2,}/g);
    if (nestedQuantifiers) {
      warnings.push({
        type: 'performance',
        message: 'Nested quantifiers detected. This may cause exponential performance degradation.',
        suggestion: 'Avoid nested quantifiers and consider restructuring the query.',
      });
    }

    return warnings;
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    features: QueryFeatures
  ): string[] {
    const suggestions: string[] = [];

    if (errors.length > 0) {
      suggestions.push('Fix syntax errors before proceeding');
    }

    if (warnings.length > 0) {
      suggestions.push('Consider addressing performance warnings for better query performance');
    }

    if (features.complexity === 'complex') {
      suggestions.push('Consider breaking down complex queries into simpler ones');
    }

    if (features.predicateCount === 0 && features.directiveCount === 0) {
      suggestions.push('Consider using predicates or directives for more precise query results');
    }

    return suggestions;
  }

  /**
   * 获取空特性对象
   */
  private getEmptyFeatures(): QueryFeatures {
    return {
      hasPredicates: false,
      hasDirectives: false,
      hasAnchors: false,
      hasAlternations: false,
      hasQuantifiers: false,
      hasWildcards: false,
      predicateCount: 0,
      directiveCount: 0,
      complexity: 'simple',
    };
  }

  /**
   * 生成谓词优化建议
   */
  private suggestPredicateOptimizations(predicates: QueryPredicate[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查可以合并的eq谓词
    const eqPredicates = predicates.filter(p => p.type === 'eq' && !p.negate);
    if (eqPredicates.length > 2) {
      suggestions.push({
        type: 'predicate',
        description: 'Consider using #any-of? predicate instead of multiple #eq? predicates',
        impact: 'medium',
        example: 'Replace multiple "#eq? @capture "value"" with "#any-of? @capture ["value1", "value2"]"',
      });
    }

    // 检查复杂的正则表达式
    for (const predicate of predicates) {
      if ((predicate.type === 'match' || predicate.type === 'not-match') && typeof predicate.value === 'string') {
        const regexComplexity = this.analyzeRegexComplexity(predicate.value);
        if (regexComplexity > 5) {
          suggestions.push({
            type: 'predicate',
            description: `Complex regex pattern in predicate '${predicate.type}' may impact performance`,
            impact: 'medium',
            example: 'Consider simplifying the regex or using string comparison',
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * 生成指令优化建议
   */
  private suggestDirectiveOptimizations(directives: QueryDirective[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查重复的strip指令
    const stripDirectives = directives.filter(d => d.type === 'strip');
    const stripCaptures = new Map<string, number>();

    for (const directive of stripDirectives) {
      if (directive.capture) {
        const count = stripCaptures.get(directive.capture) || 0;
        stripCaptures.set(directive.capture, count + 1);
      }
    }

    for (const [capture, count] of stripCaptures.entries()) {
      if (count > 1) {
        suggestions.push({
          type: 'directive',
          description: `Multiple strip directives for capture '${capture}' can be combined`,
          impact: 'low',
          example: 'Combine multiple strip patterns into a single regex with alternation',
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成模式优化建议
   */
  private suggestPatternOptimizations(parsedQuery: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查通配符使用
    const wildcardCount = (parsedQuery.originalQuery.match(/\(_\)/g) || []).length;
    if (wildcardCount > 3) {
      suggestions.push({
        type: 'structure',
        description: 'Consider replacing wildcards with specific node types',
        impact: 'high',
        example: 'Replace "(_)" with "(identifier)" or other specific types',
      });
    }

    // 检查交替模式
    const alternationCount = (parsedQuery.originalQuery.match(/\[[^\]]*\]/g) || []).length;
    if (alternationCount > 2) {
      suggestions.push({
        type: 'structure',
        description: 'Multiple alternation patterns may impact performance',
        impact: 'medium',
        example: 'Consider using separate queries or simplifying alternation patterns',
      });
    }

    return suggestions;
  }

  /**
   * 生成结构优化建议
   */
  private suggestStructureOptimizations(parsedQuery: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查嵌套的量词
    const nestedQuantifiers = parsedQuery.originalQuery.match(/([+*?]\s*){2,}/g);
    if (nestedQuantifiers) {
      suggestions.push({
        type: 'structure',
        description: 'Nested quantifiers can cause exponential performance degradation',
        impact: 'high',
        example: 'Avoid patterns like "*+" and consider restructuring the query',
      });
    }

    // 检查查询复杂度
    if (parsedQuery.features.complexity === 'complex') {
      suggestions.push({
        type: 'structure',
        description: 'Complex query may benefit from being split into simpler queries',
        impact: 'medium',
        example: 'Consider breaking down complex queries into multiple simpler ones',
      });
    }

    return suggestions;
  }

  /**
   * 分析正则表达式复杂度
   */
  private analyzeRegexComplexity(pattern: string): number {
    let complexity = 0;

    // 基础复杂度
    complexity += pattern.length * 0.1;

    // 特殊字符增加复杂度
    const specialChars = pattern.match(/[.*+?^${}()|[\]\\]/g);
    if (specialChars) {
      complexity += specialChars.length * 0.5;
    }

    // 量词增加复杂度
    const quantifiers = pattern.match(/[+*?]/g);
    if (quantifiers) {
      complexity += quantifiers.length * 0.3;
    }

    // 字符类增加复杂度
    const charClasses = pattern.match(/\[.*?\]/g);
    if (charClasses) {
      complexity += charClasses.length * 0.5;
    }

    // 分组增加复杂度
    const groups = pattern.match(/\(.*?\)/g);
    if (groups) {
      complexity += groups.length * 0.3;
    }

    return complexity;
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
   * 重置处理器状态
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