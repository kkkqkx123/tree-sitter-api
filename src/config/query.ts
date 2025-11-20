/**
 * 查询配置 - 管理高级查询功能的配置选项
 */

import { QueryConfig, DirectiveType, PredicateType } from '../types/advancedQuery';

// 默认查询配置
export const DefaultQueryConfig: QueryConfig = {
  enablePredicates: true,
  enableDirectives: true,
  enableAdvancedValidation: true,
  maxPredicatesPerQuery: 50,
  maxDirectivesPerQuery: 20,
  allowedDirectives: ['set', 'strip', 'select-adjacent'],
  allowedPredicates: [
    'eq',
    'match',
    'any-of',
    'is',
    'not-eq',
    'not-match',
    'not-is',
    'any-eq',
    'any-match',
  ],
  enablePerformanceOptimization: true,
  enableCaching: true,
  cacheSize: 1000,
  cacheTimeout: 300000, // 5分钟
};

// 生产环境查询配置
export const ProductionQueryConfig: QueryConfig = {
  ...DefaultQueryConfig,
  maxPredicatesPerQuery: 30,
  maxDirectivesPerQuery: 10,
  cacheSize: 2000,
  cacheTimeout: 600000, // 10分钟
};

// 开发环境查询配置
export const DevelopmentQueryConfig: QueryConfig = {
  ...DefaultQueryConfig,
  enableAdvancedValidation: true,
  maxPredicatesPerQuery: 100,
  maxDirectivesPerQuery: 50,
  cacheSize: 100,
  cacheTimeout: 60000, // 1分钟
};

// 测试环境查询配置
export const TestQueryConfig: QueryConfig = {
  ...DefaultQueryConfig,
  enableCaching: false,
  enablePerformanceOptimization: false,
  maxPredicatesPerQuery: 20,
  maxDirectivesPerQuery: 10,
};

// 查询配置管理器
export class QueryConfigManager {
  private static instance: QueryConfigManager;
  private config: QueryConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): QueryConfigManager {
    if (!QueryConfigManager.instance) {
      QueryConfigManager.instance = new QueryConfigManager();
    }
    return QueryConfigManager.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): QueryConfig {
    const environment = process.env['NODE_ENV'] || 'development';

    switch (environment) {
      case 'production':
        return ProductionQueryConfig;
      case 'test':
        return TestQueryConfig;
      case 'development':
      default:
        return DevelopmentQueryConfig;
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): QueryConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<QueryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 检查谓词是否被允许
   */
  public isPredicateAllowed(predicateType: PredicateType): boolean {
    return this.config.allowedPredicates.includes(predicateType);
  }

  /**
   * 检查指令是否被允许
   */
  public isDirectiveAllowed(directiveType: DirectiveType): boolean {
    return this.config.allowedDirectives.includes(directiveType);
  }

  /**
   * 检查谓词数量是否超限
   */
  public isPredicateCountValid(count: number): boolean {
    return count <= this.config.maxPredicatesPerQuery;
  }

  /**
   * 检查指令数量是否超限
   */
  public isDirectiveCountValid(count: number): boolean {
    return count <= this.config.maxDirectivesPerQuery;
  }

  /**
   * 检查高级功能是否启用
   */
  public isAdvancedFeatureEnabled(feature: 'predicates' | 'directives' | 'validation'): boolean {
    switch (feature) {
      case 'predicates':
        return this.config.enablePredicates;
      case 'directives':
        return this.config.enableDirectives;
      case 'validation':
        return this.config.enableAdvancedValidation;
      default:
        return false;
    }
  }

  /**
   * 获取缓存配置
   */
  public getCacheConfig() {
    return {
      enabled: this.config.enableCaching,
      size: this.config.cacheSize,
      timeout: this.config.cacheTimeout,
    };
  }

  /**
   * 获取性能优化配置
   */
  public getPerformanceConfig() {
    return {
      enabled: this.config.enablePerformanceOptimization,
    };
  }

  /**
   * 重置为默认配置
   */
  public resetToDefault(): void {
    this.config = this.loadConfig();
  }

  /**
   * 验证配置的有效性
   */
  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.maxPredicatesPerQuery <= 0) {
      errors.push('maxPredicatesPerQuery must be greater than 0');
    }

    if (this.config.maxDirectivesPerQuery <= 0) {
      errors.push('maxDirectivesPerQuery must be greater than 0');
    }

    if (this.config.cacheSize <= 0) {
      errors.push('cacheSize must be greater than 0');
    }

    if (this.config.cacheTimeout <= 0) {
      errors.push('cacheTimeout must be greater than 0');
    }

    if (this.config.allowedPredicates.length === 0) {
      errors.push('allowedPredicates cannot be empty');
    }

    if (this.config.allowedDirectives.length === 0) {
      errors.push('allowedDirectives cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 导出配置为JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 从JSON导入配置
   */
  public importConfig(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson) as Partial<QueryConfig>;
      this.updateConfig(importedConfig);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 导出配置管理器实例
export const queryConfig = QueryConfigManager.getInstance();