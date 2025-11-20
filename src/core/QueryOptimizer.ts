/**
 * 查询优化器 - 优化查询性能
 */

import {
  ParsedQuery,
  QueryPredicate,
  QueryDirective,
  OptimizationSuggestion,
} from '../types/advancedQuery';
import { log } from '../utils/Logger';

export class QueryOptimizer {
  /**
   * 优化查询
   */
  public optimizeQuery(query: ParsedQuery): ParsedQuery {
    log.debug('QueryOptimizer', 'Optimizing query');

    let optimizedQuery = { ...query };

    // 优化谓词
    optimizedQuery = this.optimizePredicates(optimizedQuery);

    // 优化指令
    optimizedQuery = this.optimizeDirectives(optimizedQuery);

    // 优化模式
    optimizedQuery = this.optimizePatterns(optimizedQuery);

    // 重新分析特性
    optimizedQuery.features = this.reanalyzeFeatures(optimizedQuery);

    log.debug('QueryOptimizer', 'Query optimization completed');

    return optimizedQuery;
  }

  /**
   * 生成优化建议
   */
  public suggestOptimizations(query: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 谓词优化建议
    suggestions.push(...this.suggestPredicateOptimizations(query.predicates));

    // 指令优化建议
    suggestions.push(...this.suggestDirectiveOptimizations(query.directives));

    // 模式优化建议
    suggestions.push(...this.suggestPatternOptimizations(query));

    // 结构优化建议
    suggestions.push(...this.suggestStructureOptimizations(query));

    return suggestions;
  }

  /**
   * 优化谓词
   */
  private optimizePredicates(query: ParsedQuery): ParsedQuery {
    const optimizedPredicates = [...query.predicates];

    // 合并相同的eq谓词为any-of
    const eqPredicates = optimizedPredicates.filter(p => p.type === 'eq' && !p.negate);
    if (eqPredicates.length > 2) {
      const groupedByCapture = new Map<string, QueryPredicate[]>();

      for (const predicate of eqPredicates) {
        const capture = predicate.capture;
        if (!groupedByCapture.has(capture)) {
          groupedByCapture.set(capture, []);
        }
        groupedByCapture.get(capture)!.push(predicate);
      }

      for (const [capture, predicates] of groupedByCapture.entries()) {
        if (predicates.length > 2) {
          // 创建any-of谓词
          const values = predicates.map(p => p.value as string);
          const anyOfPredicate: QueryPredicate = {
            type: 'any-of',
            capture,
            value: values,
          };

          // 移除原始的eq谓词
          for (const predicate of predicates) {
            const index = optimizedPredicates.indexOf(predicate);
            if (index > -1) {
              optimizedPredicates.splice(index, 1);
            }
          }

          // 添加any-of谓词
          optimizedPredicates.push(anyOfPredicate);

          log.debug('QueryOptimizer', `Merged ${predicates.length} eq predicates into any-of for capture ${capture}`);
        }
      }
    }

    // 优化正则表达式
    for (let i = 0; i < optimizedPredicates.length; i++) {
      const predicate = optimizedPredicates[i];
      if (predicate && (predicate.type === 'match' || predicate.type === 'not-match') && typeof predicate.value === 'string') {
        const optimizedRegex = this.optimizeRegex(predicate.value);
        if (optimizedRegex !== predicate.value) {
          const updatedPredicate: QueryPredicate = {
            type: predicate.type,
            capture: predicate.capture,
            value: optimizedRegex,
          };
          if (predicate.negate !== undefined) updatedPredicate.negate = predicate.negate;
          if (predicate.quantifier !== undefined) updatedPredicate.quantifier = predicate.quantifier;
          if (predicate.position !== undefined) updatedPredicate.position = predicate.position;
          optimizedPredicates[i] = updatedPredicate;
          log.debug('QueryOptimizer', `Optimized regex for predicate ${predicate.type}`);
        }
      }
    }

    return {
      ...query,
      predicates: optimizedPredicates,
    };
  }

  /**
   * 优化指令
   */
  private optimizeDirectives(query: ParsedQuery): ParsedQuery {
    const optimizedDirectives = [...query.directives];

    // 合并连续的strip指令
    const stripDirectives = optimizedDirectives.filter(d => d.type === 'strip');
    const groupedByCapture = new Map<string, QueryDirective[]>();

    for (const directive of stripDirectives) {
      const capture = directive.capture;
      if (!groupedByCapture.has(capture)) {
        groupedByCapture.set(capture, []);
      }
      groupedByCapture.get(capture)!.push(directive);
    }

    for (const [capture, directives] of groupedByCapture.entries()) {
      if (directives.length > 1) {
        // 合并strip模式
        const patterns = directives.map(d => d.parameters[0] as string);
        const combinedPattern = patterns.join('|');

        // 移除原始的strip指令
        for (const directive of directives) {
          const index = optimizedDirectives.indexOf(directive);
          if (index > -1) {
            optimizedDirectives.splice(index, 1);
          }
        }

        // 添加合并的strip指令
        const combinedDirective: QueryDirective = {
          type: 'strip',
          capture,
          parameters: [combinedPattern],
        };

        optimizedDirectives.push(combinedDirective);

        log.debug('QueryOptimizer', `Merged ${directives.length} strip directives for capture ${capture}`);
      }
    }

    return {
      ...query,
      directives: optimizedDirectives,
    };
  }

  /**
   * 优化模式
   */
  private optimizePatterns(query: ParsedQuery): ParsedQuery {
    const optimizedPatterns = query.patterns.map(pattern => {
      let optimizedPattern = pattern.pattern;

      // 优化通配符
      optimizedPattern = this.optimizeWildcards(optimizedPattern);

      // 优化交替模式
      optimizedPattern = this.optimizeAlternations(optimizedPattern);

      // 优化量词
      optimizedPattern = this.optimizeQuantifiers(optimizedPattern);

      return {
        ...pattern,
        pattern: optimizedPattern,
      };
    });

    return {
      ...query,
      patterns: optimizedPatterns,
    };
  }

  /**
   * 优化通配符
   */
  private optimizeWildcards(pattern: string): string {
    // 将通配符替换为更具体的类型（如果可能）
    // 这是一个简化的实现，实际可能需要更复杂的逻辑
    return pattern.replace(/\(_\)/g, '(identifier)');
  }

  /**
   * 优化交替模式
   */
  private optimizeAlternations(pattern: string): string {
    // 简化交替模式
    // 这是一个简化的实现
    return pattern;
  }

  /**
   * 优化量词
   */
  private optimizeQuantifiers(pattern: string): string {
    // 移除不必要的量词
    // 这是一个简化的实现
    return pattern.replace(/\*\+/g, '+');
  }

  /**
   * 重新分析特性
   */
  private reanalyzeFeatures(query: ParsedQuery): any {
    // 重新计算查询特性
    const hasPredicates = query.predicates.length > 0;
    const hasDirectives = query.directives.length > 0;
    const hasAnchors = query.originalQuery.includes('.');
    const hasAlternations = /\[[^\]]*\]/.test(query.originalQuery);
    const hasQuantifiers = /[+*?]/.test(query.originalQuery);
    const hasWildcards = /\(_\)/.test(query.originalQuery);

    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    const featureCount = [
      hasPredicates,
      hasDirectives,
      hasAnchors,
      hasAlternations,
      hasQuantifiers,
      hasWildcards,
    ].filter(Boolean).length;

    if (featureCount >= 4 || query.predicates.length > 5 || query.directives.length > 3) {
      complexity = 'complex';
    } else if (featureCount >= 2 || query.predicates.length > 2 || query.directives.length > 1) {
      complexity = 'moderate';
    }

    return {
      hasPredicates,
      hasDirectives,
      hasAnchors,
      hasAlternations,
      hasQuantifiers,
      hasWildcards,
      predicateCount: query.predicates.length,
      directiveCount: query.directives.length,
      complexity,
    };
  }

  /**
   * 优化正则表达式
   */
  private optimizeRegex(pattern: string): string {
    let optimized = pattern;

    // 移除不必要的捕获组
    optimized = optimized.replace(/\((?!\?:)([^()]*?)\)/g, '(?:$1)');

    // 简化字符类
    optimized = optimized.replace(/\[a-zA-Z\]/g, '[a-zA-Z]');
    optimized = optimized.replace(/\[0-9\]/g, '\\d');

    // 移除不必要的转义
    optimized = optimized.replace(/\\\./g, '.');

    return optimized;
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
      const count = stripCaptures.get(directive.capture) || 0;
      stripCaptures.set(directive.capture, count + 1);
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
  private suggestPatternOptimizations(query: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查通配符使用
    const wildcardCount = (query.originalQuery.match(/\(_\)/g) || []).length;
    if (wildcardCount > 3) {
      suggestions.push({
        type: 'structure',
        description: 'Consider replacing wildcards with specific node types',
        impact: 'high',
        example: 'Replace "(_)" with "(identifier)" or other specific types',
      });
    }

    // 检查交替模式
    const alternationCount = (query.originalQuery.match(/\[[^\]]*\]/g) || []).length;
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
  private suggestStructureOptimizations(query: ParsedQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查嵌套量词
    const nestedQuantifiers = query.originalQuery.match(/([+*?]\s*){2,}/g);
    if (nestedQuantifiers) {
      suggestions.push({
        type: 'structure',
        description: 'Nested quantifiers can cause exponential performance degradation',
        impact: 'high',
        example: 'Avoid patterns like "*+" and consider restructuring the query',
      });
    }

    // 检查查询复杂度
    if (query.features.complexity === 'complex') {
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
}