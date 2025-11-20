/**
 * 查询分析器 - 分析查询特性和复杂度
 */

import {
  QueryFeatures,
  QueryPredicate,
  QueryDirective,
  PerformanceEstimate,
  OptimizationSuggestion,
  QueryStatistics,
  PredicateType,
  DirectiveType,
} from '../types/advancedQuery';

export class QueryAnalyzer {
  /**
   * 分析查询复杂度
   */
  public analyzeComplexity(query: string, features: QueryFeatures): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // 基础复杂度分数
    if (features.hasPredicates) complexityScore += 2;
    if (features.hasDirectives) complexityScore += 2;
    if (features.hasAnchors) complexityScore += 1;
    if (features.hasAlternations) complexityScore += 2;
    if (features.hasQuantifiers) complexityScore += 1;
    if (features.hasWildcards) complexityScore += 1;

    // 谓词数量影响
    complexityScore += Math.min(features.predicateCount * 0.5, 3);

    // 指令数量影响
    complexityScore += Math.min(features.directiveCount * 0.5, 2);

    // 查询长度影响
    const queryLength = query.length;
    if (queryLength > 500) complexityScore += 1;
    if (queryLength > 1000) complexityScore += 1;

    // 嵌套深度影响
    const maxDepth = this.calculateNestingDepth(query);
    complexityScore += Math.min(maxDepth * 0.5, 2);

    if (complexityScore <= 3) return 'low';
    if (complexityScore <= 7) return 'medium';
    return 'high';
  }

  /**
   * 估算查询性能
   */
  public estimatePerformance(
    query: string,
    features: QueryFeatures,
    predicates: QueryPredicate[],
    directives: QueryDirective[]
  ): PerformanceEstimate {
    const complexity = this.analyzeComplexity(query, features);

    // 基础时间估算（毫秒）
    let estimatedTime = 10; // 基础解析时间

    // 根据特性调整时间
    if (features.hasPredicates) estimatedTime += features.predicateCount * 5;
    if (features.hasDirectives) estimatedTime += features.directiveCount * 3;
    if (features.hasWildcards) estimatedTime += 20;
    if (features.hasAlternations) estimatedTime += 15;
    if (features.hasQuantifiers) estimatedTime += 10;

    // 根据复杂度调整
    switch (complexity) {
      case 'medium':
        estimatedTime *= 1.5;
        break;
      case 'high':
        estimatedTime *= 2.5;
        break;
    }

    // 内存影响估算
    let memoryImpact: 'low' | 'medium' | 'high' = 'low';
    if (features.hasDirectives || features.predicateCount > 5) {
      memoryImpact = 'medium';
    }
    if (features.directiveCount > 3 || features.predicateCount > 10) {
      memoryImpact = 'high';
    }

    // 生成优化建议
    const recommendations = this.generateOptimizationRecommendations(
      query,
      features,
      predicates,
      directives,
      complexity
    );

    return {
      complexity,
      estimatedTime: Math.round(estimatedTime),
      memoryImpact,
      recommendations,
    };
  }

  /**
   * 生成优化建议
   */
  public generateOptimizationSuggestions(
    query: string,
    features: QueryFeatures,
    predicates: QueryPredicate[],
    directives: QueryDirective[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 通配符优化建议
    if (features.hasWildcards) {
      const wildcardCount = (query.match(/\(_\)/g) || []).length;
      if (wildcardCount > 3) {
        suggestions.push({
          type: 'structure',
          description: 'Consider replacing wildcards with specific node types for better performance',
          impact: 'high',
          example: 'Replace "(_)" with "(identifier)" or other specific types',
        });
      }
    }

    // 谓词优化建议
    if (features.hasPredicates) {
      // 检查可以合并的谓词
      const eqPredicates = predicates.filter(p => p.type === 'eq' || p.type === 'not-eq');
      if (eqPredicates.length > 3) {
        suggestions.push({
          type: 'predicate',
          description: 'Consider using #any-of? predicate instead of multiple #eq? predicates',
          impact: 'medium',
          example: 'Replace multiple "#eq? @capture "value"" with "#any-of? @capture ["value1", "value2"]"',
        });
      }

      // 检查正则表达式复杂度
      const matchPredicates = predicates.filter(p => p.type === 'match' || p.type === 'not-match');
      for (const predicate of matchPredicates) {
        if (typeof predicate.value === 'string') {
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
    }

    // 交替模式优化建议
    if (features.hasAlternations) {
      const alternationCount = (query.match(/\[[^\]]*\]/g) || []).length;
      if (alternationCount > 2) {
        suggestions.push({
          type: 'structure',
          description: 'Multiple alternation patterns may impact performance',
          impact: 'medium',
          example: 'Consider using separate queries or simplifying alternation patterns',
        });
      }
    }

    // 量词优化建议
    if (features.hasQuantifiers) {
      const nestedQuantifiers = query.match(/([+*?]\s*){2,}/g);
      if (nestedQuantifiers) {
        suggestions.push({
          type: 'structure',
          description: 'Nested quantifiers can cause exponential performance degradation',
          impact: 'high',
          example: 'Avoid patterns like "*+" and consider restructuring the query',
        });
      }
    }

    // 指令优化建议
    if (features.hasDirectives) {
      const stripDirectives = directives.filter(d => d.type === 'strip');
      if (stripDirectives.length > 2) {
        suggestions.push({
          type: 'directive',
          description: 'Multiple strip directives may impact performance',
          impact: 'low',
          example: 'Consider combining strip operations or using more precise patterns',
        });
      }
    }

    return suggestions;
  }

  /**
   * 计算嵌套深度
   */
  private calculateNestingDepth(query: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of query) {
      if (char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === ')') {
        currentDepth--;
      }
    }

    return maxDepth;
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
   * 生成优化建议
   */
  private generateOptimizationRecommendations(
    _query: string,
    features: QueryFeatures,
    _predicates: QueryPredicate[],
    directives: QueryDirective[],
    complexity: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    if (complexity === 'high') {
      recommendations.push('Consider breaking down complex queries into simpler ones');
    }

    if (features.hasWildcards) {
      recommendations.push('Replace wildcards with specific node types where possible');
    }

    if (features.predicateCount > 5) {
      recommendations.push('Consider reducing the number of predicates or combining similar ones');
    }

    if (features.hasAlternations && features.hasQuantifiers) {
      recommendations.push('Be cautious with alternations combined with quantifiers');
    }

    if (directives.some(d => d.type === 'strip')) {
      recommendations.push('Consider using more precise patterns to reduce the need for strip directives');
    }

    return recommendations;
  }

  /**
   * 分析查询统计信息
   */
  public analyzeQueryStatistics(queries: string[]): QueryStatistics {
    const stats: QueryStatistics = {
      totalQueries: queries.length,
      successfulQueries: 0, // 需要实际执行后才能确定
      failedQueries: 0,     // 需要实际执行后才能确定
      averageQueryTime: 0,  // 需要实际执行后才能确定
      averageMatchesPerQuery: 0, // 需要实际执行后才能确定
      mostUsedPredicates: {} as Record<PredicateType, number>,
      mostUsedDirectives: {} as Record<DirectiveType, number>,
      queryComplexityDistribution: {
        simple: 0,
        moderate: 0,
        complex: 0,
      },
    };

    // 初始化谓词和指令计数
    const predicateTypes: PredicateType[] = [
      'eq', 'match', 'any-of', 'is', 'not-eq', 'not-match', 'not-is', 'any-eq', 'any-match'
    ];
    const directiveTypes: DirectiveType[] = ['set', 'strip', 'select-adjacent'];

    predicateTypes.forEach(type => {
      stats.mostUsedPredicates[type] = 0;
    });

    directiveTypes.forEach(type => {
      stats.mostUsedDirectives[type] = 0;
    });

    // 分析每个查询
    for (const query of queries) {
      // 提取谓词
      const predicateRegex = /#(\w+)(?:-?(\w+))?\?/g;
      let match;

      while ((match = predicateRegex.exec(query)) !== null) {
        const predicateType = match[1] as PredicateType;
        if (stats.mostUsedPredicates[predicateType] !== undefined) {
          stats.mostUsedPredicates[predicateType]++;
        }
      }

      // 提取指令
      const directiveRegex = /#(\w+)!/g;

      while ((match = directiveRegex.exec(query)) !== null) {
        const directiveType = match[1] as DirectiveType;
        if (stats.mostUsedDirectives[directiveType] !== undefined) {
          stats.mostUsedDirectives[directiveType]++;
        }
      }

      // 分析复杂度
      const features = this.analyzeQueryFeatures(query);
      stats.queryComplexityDistribution[features.complexity]++;
    }

    return stats;
  }

  /**
   * 分析查询特性
   */
  private analyzeQueryFeatures(query: string): QueryFeatures {
    const hasPredicates = /#\w+\?/.test(query);
    const hasDirectives = /#\w+!/.test(query);
    const hasAnchors = /\./.test(query);
    const hasAlternations = /\[[^\]]*\]/.test(query);
    const hasQuantifiers = /[+*?]/.test(query);
    const hasWildcards = /\(_\)/.test(query);

    const predicateCount = (query.match(/#\w+\?/g) || []).length;
    const directiveCount = (query.match(/#\w+!/g) || []).length;

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
  }

  /**
   * 比较查询复杂度
   */
  public compareQueryComplexity(query1: string, query2: string): {
    query1: { complexity: string; score: number };
    query2: { complexity: string; score: number };
    moreComplex: 'query1' | 'query2' | 'equal';
  } {
    const features1 = this.analyzeQueryFeatures(query1);
    const features2 = this.analyzeQueryFeatures(query2);

    const score1 = this.calculateComplexityScore(query1, features1);
    const score2 = this.calculateComplexityScore(query2, features2);

    let moreComplex: 'query1' | 'query2' | 'equal';
    if (Math.abs(score1 - score2) < 0.5) {
      moreComplex = 'equal';
    } else if (score1 > score2) {
      moreComplex = 'query1';
    } else {
      moreComplex = 'query2';
    }

    return {
      query1: {
        complexity: features1.complexity,
        score: Math.round(score1 * 100) / 100,
      },
      query2: {
        complexity: features2.complexity,
        score: Math.round(score2 * 100) / 100,
      },
      moreComplex,
    };
  }

  /**
   * 计算复杂度分数
   */
  private calculateComplexityScore(query: string, features: QueryFeatures): number {
    let score = 0;

    // 基础分数
    if (features.hasPredicates) score += 2;
    if (features.hasDirectives) score += 2;
    if (features.hasAnchors) score += 1;
    if (features.hasAlternations) score += 2;
    if (features.hasQuantifiers) score += 1;
    if (features.hasWildcards) score += 1;

    // 数量影响
    score += features.predicateCount * 0.5;
    score += features.directiveCount * 0.5;

    // 长度影响
    score += query.length * 0.001;

    // 嵌套深度影响
    score += this.calculateNestingDepth(query) * 0.5;

    return score;
  }
}