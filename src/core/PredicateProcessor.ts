/**
 * 谓词处理器 - 处理tree-sitter查询中的谓词
 */

import {
  QueryPredicate,
  EnhancedMatchResult,
  PredicateResult,
  PredicateType
} from '../types/advancedQuery';
import { PredicateError } from '../types/errors';
import { log } from '../utils/Logger';

export class PredicateProcessor {
  /**
   * 应用谓词到匹配结果
   */
  public async applyPredicates(
    matches: EnhancedMatchResult[],
    predicates: QueryPredicate[]
  ): Promise<{ filteredMatches: EnhancedMatchResult[]; predicateResults: PredicateResult[] }> {
    const results: PredicateResult[] = [];
    const filteredMatches: EnhancedMatchResult[] = [];

    // 对每个匹配项应用所有谓词
    for (const match of matches) {
      let allPredicatesPassed = true;
      const matchPredicateResults: PredicateResult[] = [];
      let hasMatchingPredicate = false;

      // 应用所有谓词到当前匹配项
      for (const predicate of predicates) {
        try {
          // 检查谓词的capture名称是否与匹配项的captureName匹配
          if (predicate.capture !== match.captureName) {
            // 如果capture名称不匹配，则跳过此谓词，但仍添加到结果中
            matchPredicateResults.push({
              predicate,
              passed: false,
              details: `Predicate capture "${predicate.capture}" does not match match capture "${match.captureName}"`,
            });
            continue;
          }

          hasMatchingPredicate = true;
          const predicateResult = await this.evaluatePredicate(match, predicate);
          matchPredicateResults.push(predicateResult);

          // 如果有任何一个谓词不通过（且不是否定谓词），则该匹配项不满足条件
          if (!predicateResult.passed && !predicate.negate) {
            allPredicatesPassed = false;
          }
        } catch (error) {
          log.warn('PredicateProcessor', `Error evaluating predicate: ${error}`);

          matchPredicateResults.push({
            predicate,
            passed: false,
            details: error instanceof Error ? error.message : String(error),
          });

          allPredicatesPassed = false;
        }
      }

      // 修改逻辑：只有当有谓词应用到这个匹配项且所有谓词都通过时，才保留该匹配项
      // 这样可以确保只有真正满足谓词条件的匹配项才会被保留
      if (hasMatchingPredicate && allPredicatesPassed) {
        filteredMatches.push({
          ...match,
          predicateResults: matchPredicateResults,
        });
      } else if (!hasMatchingPredicate) {
        // 不保留没有匹配谓词的匹配项
      }

      results.push(...matchPredicateResults);
    }

    return {
      filteredMatches,
      predicateResults: results,
    };
  }

  /**
   * 应用单个谓词
   */
  public async applySinglePredicate(
    matches: EnhancedMatchResult[],
    predicate: QueryPredicate
  ): Promise<PredicateResult[]> {
    const results: PredicateResult[] = [];

    for (const match of matches) {
      try {
        const result = await this.evaluatePredicate(match, predicate);
        results.push(result);
      } catch (error) {
        log.warn('PredicateProcessor', `Error evaluating predicate: ${error}`);

        results.push({
          predicate,
          passed: false,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 评估单个谓词
   */
  public async evaluatePredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): Promise<PredicateResult> {
    switch (predicate.type) {
      case 'eq':
        return this.processEqualityPredicate(match, predicate);
      case 'match':
        return this.processMatchPredicate(match, predicate);
      case 'any-of':
        return this.processAnyOfPredicate(match, predicate);
      case 'is':
        return this.processIsPredicate(match, predicate);
      case 'not-eq':
        return this.processNotEqualityPredicate(match, predicate);
      case 'not-match':
        return this.processNotMatchPredicate(match, predicate);
      case 'not-is':
        return this.processNotIsPredicate(match, predicate);
      case 'any-eq':
        return this.processAnyEqualityPredicate(match, predicate);
      case 'any-match':
        return this.processAnyMatchPredicate(match, predicate);
      default:
        throw new PredicateError(
          predicate.type,
          `Unsupported predicate type: ${predicate.type}`,
          predicate.capture
        );
    }
  }

  /**
   * 处理相等谓词
   */
  private processEqualityPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Equality predicate requires a string value',
        predicate.capture
      );
    }

    const passed = match.text === predicate.value;
    const details = `Text "${match.text}" ${passed ? 'equals' : 'does not equal'} "${predicate.value}"`;

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理不相等谓词
   */
  private processNotEqualityPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Not-equality predicate requires a string value',
        predicate.capture
      );
    }

    const passed = match.text !== predicate.value;
    const details = `Text "${match.text}" ${passed ? 'does not equal' : 'equals'} "${predicate.value}"`;

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理匹配谓词
   */
  private processMatchPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Match predicate requires a regex pattern string',
        predicate.capture
      );
    }

    try {
      const regex = new RegExp(predicate.value);
      const passed = regex.test(match.text);
      const details = `Text "${match.text}" ${passed ? 'matches' : 'does not match'} pattern "${predicate.value}"`;

      return {
        predicate,
        passed,
        details,
      };
    } catch (error) {
      throw new PredicateError(
        predicate.type,
        `Invalid regex pattern: ${predicate.value}`,
        predicate.capture
      );
    }
  }

  /**
   * 处理不匹配谓词
   */
  private processNotMatchPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Not-match predicate requires a regex pattern string',
        predicate.capture
      );
    }

    try {
      const regex = new RegExp(predicate.value);
      const passed = !regex.test(match.text);
      const details = `Text "${match.text}" ${passed ? 'does not match' : 'matches'} pattern "${predicate.value}"`;

      return {
        predicate,
        passed,
        details,
      };
    } catch (error) {
      throw new PredicateError(
        predicate.type,
        `Invalid regex pattern: ${predicate.value}`,
        predicate.capture
      );
    }
  }

  /**
   * 处理any-of谓词
   */
  private processAnyOfPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (!Array.isArray(predicate.value)) {
      throw new PredicateError(
        predicate.type,
        'Any-of predicate requires an array of values',
        predicate.capture
      );
    }

    const passed = predicate.value.includes(match.text);
    const details = `Text "${match.text}" ${passed ? 'is in' : 'is not in'} list [${predicate.value.join(', ')}]`;

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理is谓词
   */
  private processIsPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Is predicate requires a property name string',
        predicate.capture
      );
    }

    // 根据属性名称检查匹配项的特定属性
    let passed = false;
    let details = '';

    switch (predicate.value.toLowerCase()) {
      case 'identifier':
        // 检查是否为标识符类型
        passed = match.type === 'identifier';
        details = `Node type "${match.type}" ${passed ? 'is' : 'is not'} an identifier`;
        break;
      case 'function':
        // 检查是否为函数相关类型
        passed = ['function', 'function_definition', 'method', 'method_definition'].includes(match.type);
        details = `Node type "${match.type}" ${passed ? 'is' : 'is not'} a function type`;
        break;
      case 'keyword':
        // 检查是否为关键字
        const keywords = ['if', 'else', 'for', 'while', 'return', 'function', 'class', 'import', 'export'];
        passed = keywords.includes(match.text);
        details = `Text "${match.text}" ${passed ? 'is' : 'is not'} a keyword`;
        break;
      case 'string':
        // 检查是否为字符串类型
        passed = ['string', 'string_literal', 'template_string'].includes(match.type);
        details = `Node type "${match.type}" ${passed ? 'is' : 'is not'} a string type`;
        break;
      case 'number':
        // 检查是否为数字类型
        passed = ['number', 'number_literal', 'integer', 'float'].includes(match.type);
        details = `Node type "${match.type}" ${passed ? 'is' : 'is not'} a number type`;
        break;
      default:
        // 默认情况下，检查属性是否存在于匹配项中
        passed = match.hasOwnProperty(predicate.value);
        details = `Match has property "${predicate.value}": ${passed}`;
    }

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理not-is谓词
   */
  private processNotIsPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Not-is predicate requires a property name string',
        predicate.capture
      );
    }

    const isResult = this.processIsPredicate(match, { ...predicate, type: 'is' as PredicateType });
    const passed = !isResult.passed;
    const details = (isResult.details ?? '').replace('is', 'is not').replace('not not', 'is');

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理any-eq谓词
   */
  private processAnyEqualityPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    // any-eq通常用于量词场景，这里简化处理
    // 在实际的tree-sitter查询中，any-eq意味着量词捕获中的任何一个满足条件即可
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Any-equality predicate requires a string value',
        predicate.capture
      );
    }

    const passed = match.text === predicate.value;
    const details = `Text "${match.text}" ${passed ? 'equals' : 'does not equal'} "${predicate.value}" (any-eq)`;

    return {
      predicate,
      passed,
      details,
    };
  }

  /**
   * 处理any-match谓词
   */
  private processAnyMatchPredicate(
    match: EnhancedMatchResult,
    predicate: QueryPredicate
  ): PredicateResult {
    if (typeof predicate.value !== 'string') {
      throw new PredicateError(
        predicate.type,
        'Any-match predicate requires a regex pattern string',
        predicate.capture
      );
    }

    try {
      const regex = new RegExp(predicate.value);
      const passed = regex.test(match.text);
      const details = `Text "${match.text}" ${passed ? 'matches' : 'does not match'} pattern "${predicate.value}" (any-match)`;

      return {
        predicate,
        passed,
        details,
      };
    } catch (error) {
      throw new PredicateError(
        predicate.type,
        `Invalid regex pattern: ${predicate.value}`,
        predicate.capture
      );
    }
  }

  /**
   * 验证谓词配置
   */
  public validatePredicate(predicate: QueryPredicate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查谓词类型
    const validTypes: PredicateType[] = [
      'eq', 'match', 'any-of', 'is', 'not-eq', 'not-match', 'not-is', 'any-eq', 'any-match'
    ];

    if (!validTypes.includes(predicate.type)) {
      errors.push(`Invalid predicate type: ${predicate.type}`);
    }

    // 根据谓词类型验证值
    switch (predicate.type) {
      case 'eq':
      case 'not-eq':
      case 'match':
      case 'not-match':
      case 'any-eq':
      case 'any-match':
      case 'is':
      case 'not-is':
        if (typeof predicate.value !== 'string') {
          errors.push(`${predicate.type} predicate requires a string value`);
        } else if (predicate.type.includes('match')) {
          try {
            new RegExp(predicate.value as string);
          } catch (e) {
            errors.push(`Invalid regex pattern for ${predicate.type}: ${predicate.value}`);
          }
        }
        break;

      case 'any-of':
        if (!Array.isArray(predicate.value)) {
          errors.push(`Any-of predicate requires an array value`);
        } else if (predicate.value.length === 0) {
          errors.push(`Any-of predicate requires a non-empty array`);
        }
        break;
    }

    // 检查捕获名称
    if (!predicate.capture) {
      errors.push('Predicate must have a capture name');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 批量验证谓词
   */
  public validatePredicates(predicates: QueryPredicate[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < predicates.length; i++) {
      const predicate = predicates[i];
      if (!predicate) {
        errors.push(`Predicate at index ${i}: predicate is undefined`);
        continue;
      }
      const validation = this.validatePredicate(predicate);

      if (!validation.isValid) {
        errors.push(`Predicate at index ${i}: ${validation.errors.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}