/**
 * 指令处理器 - 处理tree-sitter查询中的指令
 */

import {
  QueryDirective,
  EnhancedMatchResult,
  DirectiveResult,
  DirectiveType,
  ProcessedMatchResult,
  Transformation
} from '../types/advancedQuery';
import {
  DirectiveError
} from '../types/errors';
import { log } from '../utils/Logger';

export class DirectiveProcessor {
  /**
   * 应用指令到匹配结果
   */
  public async applyDirectives(
    matches: EnhancedMatchResult[],
    directives: QueryDirective[]
  ): Promise<{ processedMatches: ProcessedMatchResult[]; directiveResults: DirectiveResult[] }> {
    const results: DirectiveResult[] = [];
    let currentMatches = [...matches];

    for (const directive of directives) {
      let directiveResult: DirectiveResult;
      try {
        directiveResult = await this.applySingleDirective(currentMatches, directive);
        // 更新当前匹配项为处理后的结果（仅在成功应用时）
        if (directiveResult.applied && directiveResult.result) {
          currentMatches = directiveResult.result.matches || currentMatches;
        }
      } catch (error) {
        // 如果发生错误，记录错误但继续处理其他指令
        directiveResult = {
          directive,
          applied: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      results.push(directiveResult);
    }

    // 将EnhancedMatchResult转换为ProcessedMatchResult
    const processedMatches: ProcessedMatchResult[] = currentMatches.map(match => ({
      ...match,
      processedBy: results.map(r => r.directive.type),
      transformations: results.flatMap(r => r.result?.transformations || []),
    }));

    return {
      processedMatches,
      directiveResults: results,
    };
  }

  /**
   * 应用单个指令
   */
  public async applySingleDirective(
    matches: EnhancedMatchResult[],
    directive: QueryDirective
  ): Promise<DirectiveResult> {
    switch (directive.type) {
      case 'set':
        return await this.processSetDirective(matches, directive);
      case 'strip':
        return await this.processStripDirective(matches, directive);
      case 'select-adjacent':
        return await this.processSelectAdjacentDirective(matches, directive);
      default:
        const error = new DirectiveError(
          directive.type,
          `Unsupported directive type: ${directive.type}`,
          directive.capture
        );
        log.warn('DirectiveProcessor', `Error applying directive: ${error.message}`);
        throw error;
    }
  }

  /**
   * 处理set指令
   */
  private async processSetDirective(
    matches: EnhancedMatchResult[],
    directive: QueryDirective
  ): Promise<DirectiveResult> {
    if (directive.parameters.length < 2) {
      throw new DirectiveError(
        directive.type,
        'Set directive requires at least 2 parameters',
        directive.capture
      );
    }

    const key = directive.parameters[0];
    const value = directive.parameters[1];

    // 根据捕获名称过滤匹配项
    const filteredMatches = directive.capture
      ? matches.filter(match => match.captureName === directive.capture)
      : matches;

    // 更新匹配项的元数据
    const updatedMatches: EnhancedMatchResult[] = matches.map(match => {
      if (filteredMatches.includes(match)) {
        return {
          ...match,
          metadata: {
            ...match.metadata,
            [key]: value,
          }
        };
      }
      return match;
    });

    const transformations: Transformation[] = [{
      type: 'set',
      description: `Set metadata property '${key}' to '${value}'`,
    }];

    return {
      directive,
      applied: true,
      result: {
        ...this.createProcessedResult(updatedMatches),
        transformations,
      },
    };
  }

  /**
   * 处理strip指令
   */
  private async processStripDirective(
    matches: EnhancedMatchResult[],
    directive: QueryDirective
  ): Promise<DirectiveResult> {
    if (directive.parameters.length === 0) {
      throw new DirectiveError(
        directive.type,
        'Strip directive requires a regex pattern parameter',
        directive.capture
      );
    }

    const pattern = directive.parameters[0];
    if (typeof pattern !== 'string') {
      throw new DirectiveError(
        directive.type,
        'Strip directive pattern must be a string',
        directive.capture
      );
    }

    try {
      // 根据捕获名称过滤匹配项
      const filteredMatches = directive.capture
        ? matches.filter(match => match.captureName === directive.capture)
        : matches;

      // 从匹配项文本中移除模式
      const updatedMatches: EnhancedMatchResult[] = matches.map(match => {
        if (filteredMatches.includes(match)) {
          const originalText = match.processedText || match.text;
          // 确保正则表达式有全局标志以替换所有匹配项
          const globalRegex = new RegExp(pattern, 'g');
          const strippedText = originalText.replace(globalRegex, '');

          return {
            ...match,
            processedText: strippedText,
          };
        }
        return match;
      });

      const transformation: Transformation = {
        type: 'strip',
        description: `Stripped pattern '${pattern}' from text`,
      };

      if (matches[0] && matches[0].text !== undefined) {
        transformation.before = matches[0].text;
      }
      if (updatedMatches[0] && updatedMatches[0].processedText !== undefined) {
        transformation.after = updatedMatches[0].processedText;
      }

      const transformations: Transformation[] = [transformation];

      return {
        directive,
        applied: true,
        result: {
          ...this.createProcessedResult(updatedMatches),
          transformations,
        },
      };
    } catch (error) {
      throw new DirectiveError(
        directive.type,
        `Invalid regex pattern for strip directive: ${pattern}`,
        directive.capture
      );
    }
  }

  /**
   * 处理select-adjacent指令
   */
  private async processSelectAdjacentDirective(
    matches: EnhancedMatchResult[],
    directive: QueryDirective
  ): Promise<DirectiveResult> {
    if (directive.parameters.length < 2) {
      throw new DirectiveError(
        directive.type,
        'Select-adjacent directive requires 2 capture names',
        directive.capture
      );
    }

    const capture1 = directive.parameters[0];
    const capture2 = directive.parameters[1];

    if (typeof capture1 !== 'string' || typeof capture2 !== 'string') {
      throw new DirectiveError(
        directive.type,
        'Select-adjacent directive parameters must be capture names',
        directive.capture
      );
    }

    // 查找相邻的匹配项
    const capture1Matches = matches.filter(match => match.captureName === capture1);
    const capture2Matches = matches.filter(match => match.captureName === capture2);

    // 简化实现：查找在位置上相邻的匹配项
    const adjacentMatches: EnhancedMatchResult[] = [];

    for (const match1 of capture1Matches) {
      for (const match2 of capture2Matches) {
        // 检查是否在行上相邻（简化判断）
        const rowDiff = Math.abs(match1.endPosition.row - match2.startPosition.row);
        const colDiff = match1.endPosition.column - match2.startPosition.column;

        if (rowDiff <= 1 && Math.abs(colDiff) <= 5) { // 简化的相邻判断
          adjacentMatches.push({
            ...match1,
            adjacentNodes: [match2],
          });

          adjacentMatches.push({
            ...match2,
            adjacentNodes: [match1],
          });
        }
      }
    }

    const transformations: Transformation[] = [{
      type: 'select',
      description: `Selected adjacent nodes between '${capture1}' and '${capture2}'`,
    }];

    return {
      directive,
      applied: true,
      result: {
        ...this.createProcessedResult(adjacentMatches),
        transformations,
      },
    };
  }

  /**
   * 创建处理结果
   */
  private createProcessedResult(matches: EnhancedMatchResult[]): any {
    return {
      matches,
      transformations: [] as Transformation[],
    };
  }

  /**
   * 验证指令配置
   */
  public validateDirective(directive: QueryDirective): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查指令类型
    const validTypes: DirectiveType[] = ['set', 'strip', 'select-adjacent'];

    if (!validTypes.includes(directive.type)) {
      errors.push(`Invalid directive type: ${directive.type}`);
    }

    // 根据指令类型验证参数
    switch (directive.type) {
      case 'set':
        if (directive.parameters.length < 2) {
          errors.push('Set directive requires at least 2 parameters');
        }
        break;

      case 'strip':
        if (directive.parameters.length === 0) {
          errors.push('Strip directive requires a regex pattern parameter');
        } else if (typeof directive.parameters[0] !== 'string') {
          errors.push('Strip directive pattern must be a string');
        } else {
          try {
            new RegExp(directive.parameters[0]);
          } catch (e) {
            errors.push(`Invalid regex pattern for strip directive: ${directive.parameters[0]}`);
          }
        }
        break;

      case 'select-adjacent':
        if (directive.parameters.length < 2) {
          errors.push('Select-adjacent directive requires 2 capture names');
        } else if (typeof directive.parameters[0] !== 'string' || typeof directive.parameters[1] !== 'string') {
          errors.push('Select-adjacent directive parameters must be capture names');
        }
        break;
    }

    // 检查捕获名称（可选，但如果有则必须是字符串）
    if (directive.capture && typeof directive.capture !== 'string') {
      errors.push('Directive capture name must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 批量验证指令
   */
  public validateDirectives(directives: QueryDirective[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < directives.length; i++) {
      const directive = directives[i]!;
      const validation = this.validateDirective(directive);

      if (!validation.isValid) {
        errors.push(`Directive at index ${i}: ${validation.errors.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查指令冲突
   */
  public checkDirectiveConflicts(directives: QueryDirective[]): { hasConflicts: boolean; conflicts: string[] } {
    const conflicts: string[] = [];

    // 检查同一捕获上的多个strip指令
    const stripDirectives = directives.filter(d => d.type === 'strip');
    const stripCaptures = new Map<string, QueryDirective[]>();

    for (const directive of stripDirectives) {
      const capture = directive.capture || 'all';
      if (!stripCaptures.has(capture)) {
        stripCaptures.set(capture, []);
      }
      stripCaptures.get(capture)!.push(directive);
    }

    for (const [capture, directives] of stripCaptures.entries()) {
      if (directives.length > 1) {
        conflicts.push(`Multiple strip directives for capture '${capture}' may have unexpected results`);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * 优化指令序列
   */
  public optimizeDirectives(directives: QueryDirective[]): QueryDirective[] {
    // 合并相同的set指令
    const setDirectives = directives.filter(d => d.type === 'set');
    const otherDirectives = directives.filter(d => d.type !== 'set');

    // 按捕获名称和键分组set指令
    const groupedSets = new Map<string, QueryDirective>();

    for (const directive of setDirectives) {
      if (directive.parameters.length >= 2) {
        const capture = directive.capture || 'all';
        const key = directive.parameters[0];
        const mapKey = `${capture}:${key}`;

        // 用后面的值覆盖前面的值
        groupedSets.set(mapKey, directive);
      }
    }

    // 将分组后的set指令与其它指令合并
    const optimizedSetDirectives = Array.from(groupedSets.values());

    return [...optimizedSetDirectives, ...otherDirectives];
  }
}