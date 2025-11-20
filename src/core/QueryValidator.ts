/**
 * 查询验证器 - 验证查询语法、谓词和指令
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PredicateValidationResult,
  DirectiveValidationResult,
  QueryFeatures,
  QueryPredicate,
  QueryDirective,
  PredicateType,
  DirectiveType,
} from '../types/advancedQuery';
import { queryConfig } from '../config/query';
import { log } from '../utils/Logger';

export class QueryValidator {
  /**
   * 验证查询语法
   */
  public validateQuerySyntax(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    log.debug('QueryValidator', `Validating query syntax: ${query}`);
    
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
    
    // 检查括号匹配
    const bracketErrors = this.validateBrackets(query);
    errors.push(...bracketErrors);
    
    // 检查引号匹配
    const quoteErrors = this.validateQuotes(query);
    errors.push(...quoteErrors);
    
    // 检查基本模式语法
    const patternErrors = this.validatePatterns(query);
    errors.push(...patternErrors);
    
    // 性能警告
    const performanceWarnings = this.checkPerformanceIssues(query);
    warnings.push(...performanceWarnings);
    
    // 分析查询特性
    const features = this.analyzeQueryFeatures(query);
    
    const isValid = errors.length === 0;
    
    log.debug('QueryValidator', `Query validation result: ${isValid ? 'valid' : 'invalid'} (${errors.length} errors, ${warnings.length} warnings)`);
    
    return {
      isValid,
      errors,
      warnings,
      features,
      suggestions: this.generateSuggestions(errors, warnings, features),
    };
  }

  /**
   * 验证谓词
   */
  public validatePredicates(query: string): PredicateValidationResult {
    const errors: ValidationError[] = [];
    const predicates = this.extractPredicates(query);
    
    log.debug('QueryValidator', `Validating ${predicates.length} predicates`);
    
    // 检查谓词数量
    if (!queryConfig.isPredicateCountValid(predicates.length)) {
      errors.push({
        type: 'predicate',
        message: `Too many predicates (${predicates.length}). Maximum allowed is ${queryConfig.getConfig().maxPredicatesPerQuery}`,
        severity: 'error',
      });
    }
    
    // 验证每个谓词
    for (const predicate of predicates) {
      const predicateErrors = this.validateSinglePredicate(predicate);
      errors.push(...predicateErrors);
    }
    
    // 检查重复的谓词
    const duplicateErrors = this.checkDuplicatePredicates(predicates);
    errors.push(...duplicateErrors);
    
    const isValid = errors.length === 0;
    
    log.debug('QueryValidator', `Predicate validation result: ${isValid ? 'valid' : 'invalid'} (${errors.length} errors)`);
    
    return {
      isValid,
      predicates,
      issues: errors,
    };
  }

  /**
   * 验证指令
   */
  public validateDirectives(query: string): DirectiveValidationResult {
    const errors: ValidationError[] = [];
    const directives = this.extractDirectives(query);
    
    log.debug('QueryValidator', `Validating ${directives.length} directives`);
    
    // 检查指令数量
    if (!queryConfig.isDirectiveCountValid(directives.length)) {
      errors.push({
        type: 'directive',
        message: `Too many directives (${directives.length}). Maximum allowed is ${queryConfig.getConfig().maxDirectivesPerQuery}`,
        severity: 'error',
      });
    }
    
    // 验证每个指令
    for (const directive of directives) {
      const directiveErrors = this.validateSingleDirective(directive);
      errors.push(...directiveErrors);
    }
    
    // 检查指令冲突
    const conflictErrors = this.checkDirectiveConflicts(directives);
    errors.push(...conflictErrors);
    
    const isValid = errors.length === 0;
    
    log.debug('QueryValidator', `Directive validation result: ${isValid ? 'valid' : 'invalid'} (${errors.length} errors)`);
    
    return {
      isValid,
      directives,
      issues: errors,
    };
  }

  /**
   * 提取查询特性
   */
  public extractQueryFeatures(query: string): QueryFeatures {
    return this.analyzeQueryFeatures(query);
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
   * 分析查询特性
   */
  private analyzeQueryFeatures(query: string): QueryFeatures {
    const hasPredicates = /#\w+\?/.test(query);
    const hasDirectives = /#\w+!/.test(query);
    const hasAnchors = /\./.test(query);
    const hasAlternations = /\[[^\]]*\]/.test(query);
    const hasQuantifiers = /[+*?]/.test(query);
    const hasWildcards = /\(_\)/.test(query);
    
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
  }

  /**
   * 提取谓词
   */
  private extractPredicates(query: string): QueryPredicate[] {
    const predicates: QueryPredicate[] = [];
    const predicateRegex = /#(\w+)(?:-?(\w+))?\?([^)]*)/g;
    let match;
    
    while ((match = predicateRegex.exec(query)) !== null) {
      const predicateType = match[1] as PredicateType;
      const modifier = match[2];
      const args = match[3];
      
      let negate = false;
      let quantifier: 'any' | 'all' = 'all';
      
      if (modifier === 'not') {
        negate = true;
      } else if (modifier === 'any') {
        quantifier = 'any';
      }
      
      let value: string | string[] = '';
      if (args) {
        const trimmedArgs = args.trim();
        if (trimmedArgs.startsWith('[') && trimmedArgs.endsWith(']')) {
          try {
            value = JSON.parse(trimmedArgs);
          } catch (error) {
            // 忽略解析错误，在验证阶段会处理
          }
        } else {
          value = trimmedArgs.replace(/^["']|["']$/g, '');
        }
      }
      
      predicates.push({
        type: predicateType,
        capture: this.extractCaptureFromMatch(match[0]),
        value,
        negate,
        quantifier,
      });
    }
    
    return predicates;
  }

  /**
   * 提取指令
   */
  private extractDirectives(query: string): QueryDirective[] {
    const directives: QueryDirective[] = [];
    const directiveRegex = /#(\w+)!([^)]*)/g;
    let match;
    
    while ((match = directiveRegex.exec(query)) !== null) {
      const directiveType = match[1] as DirectiveType;
      const args = match[2];
      
      const parameters: any[] = [];
      if (args) {
        const trimmedArgs = args.trim();
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
      
      directives.push({
        type: directiveType,
        capture: this.extractCaptureFromMatch(match[0]),
        parameters,
      });
    }
    
    return directives;
  }

  /**
   * 从匹配中提取捕获名称
   */
  private extractCaptureFromMatch(match: string): string {
    const captureMatch = match.match(/@(\w+)/);
    return captureMatch && captureMatch[1] ? captureMatch[1] : '';
  }

  /**
   * 验证单个谓词
   */
  private validateSinglePredicate(predicate: QueryPredicate): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // 检查谓词类型是否被允许
    if (!queryConfig.isPredicateAllowed(predicate.type)) {
      errors.push({
        type: 'predicate',
        message: `Predicate type '${predicate.type}' is not allowed`,
        severity: 'error',
      });
    }
    
    // 检查捕获名称
    if (!predicate.capture) {
      errors.push({
        type: 'predicate',
        message: `Predicate '${predicate.type}' missing capture name`,
        severity: 'error',
      });
    }
    
    // 检查谓词特定的参数
    switch (predicate.type) {
      case 'eq':
      case 'not-eq':
      case 'any-eq':
        if (!predicate.value) {
          errors.push({
            type: 'predicate',
            message: `Predicate '${predicate.type}' requires a value`,
            severity: 'error',
          });
        }
        break;
        
      case 'match':
      case 'not-match':
      case 'any-match':
        if (!predicate.value || typeof predicate.value !== 'string') {
          errors.push({
            type: 'predicate',
            message: `Predicate '${predicate.type}' requires a regex pattern`,
            severity: 'error',
          });
        } else {
          // 验证正则表达式
          try {
            new RegExp(predicate.value as string);
          } catch (error) {
            errors.push({
              type: 'predicate',
              message: `Invalid regex pattern in predicate '${predicate.type}': ${predicate.value}`,
              severity: 'error',
            });
          }
        }
        break;
        
      case 'any-of':
        if (!Array.isArray(predicate.value) || predicate.value.length === 0) {
          errors.push({
            type: 'predicate',
            message: `Predicate '${predicate.type}' requires a non-empty array`,
            severity: 'error',
          });
        }
        break;
        
      case 'is':
      case 'not-is':
        if (!predicate.value || typeof predicate.value !== 'string') {
          errors.push({
            type: 'predicate',
            message: `Predicate '${predicate.type}' requires a property name`,
            severity: 'error',
          });
        }
        break;
    }
    
    return errors;
  }

  /**
   * 验证单个指令
   */
  private validateSingleDirective(directive: QueryDirective): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // 检查指令类型是否被允许
    if (!queryConfig.isDirectiveAllowed(directive.type)) {
      errors.push({
        type: 'directive',
        message: `Directive type '${directive.type}' is not allowed`,
        severity: 'error',
      });
    }
    
    // 检查捕获名称
    if (!directive.capture) {
      errors.push({
        type: 'directive',
        message: `Directive '${directive.type}' missing capture name`,
        severity: 'error',
      });
    }
    
    // 检查指令特定的参数
    switch (directive.type) {
      case 'set':
        if (directive.parameters.length < 2) {
          errors.push({
            type: 'directive',
            message: `Directive '${directive.type}' requires at least 2 parameters (key and value)`,
            severity: 'error',
          });
        }
        break;
        
      case 'strip':
        if (directive.parameters.length === 0) {
          errors.push({
            type: 'directive',
            message: `Directive '${directive.type}' requires a regex pattern`,
            severity: 'error',
          });
        } else if (typeof directive.parameters[0] === 'string') {
          // 验证正则表达式
          try {
            new RegExp(directive.parameters[0]);
          } catch (error) {
            errors.push({
              type: 'directive',
              message: `Invalid regex pattern in directive '${directive.type}': ${directive.parameters[0]}`,
              severity: 'error',
            });
          }
        }
        break;
        
      case 'select-adjacent':
        if (directive.parameters.length < 2) {
          errors.push({
            type: 'directive',
            message: `Directive '${directive.type}' requires 2 capture names`,
            severity: 'error',
          });
        }
        break;
    }
    
    return errors;
  }

  /**
   * 检查重复的谓词
   */
  private checkDuplicatePredicates(predicates: QueryPredicate[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seen = new Set<string>();
    
    for (const predicate of predicates) {
      const key = `${predicate.type}:${predicate.capture}`;
      if (seen.has(key)) {
        errors.push({
          type: 'predicate',
          message: `Duplicate predicate '${predicate.type}' for capture '${predicate.capture}'`,
          severity: 'warning',
        });
      } else {
        seen.add(key);
      }
    }
    
    return errors;
  }

  /**
   * 检查指令冲突
   */
  private checkDirectiveConflicts(directives: QueryDirective[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // 检查同一捕获上的多个strip指令
    const stripDirectives = directives.filter(d => d.type === 'strip');
    const stripCaptures = new Map<string, number>();
    
    for (const directive of stripDirectives) {
      const captureKey = directive.capture || '';
      const count = stripCaptures.get(captureKey) || 0;
      stripCaptures.set(captureKey, count + 1);
      
      if (count > 0) {
        errors.push({
          type: 'directive',
          message: `Multiple 'strip' directives for capture '${captureKey}' may have unexpected results`,
          severity: 'warning',
        });
      }
    }
    
    return errors;
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
}