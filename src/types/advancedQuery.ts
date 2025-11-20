/**
 * 高级查询相关类型定义
 */

import { Position, MatchResult } from './api';

// 查询谓词类型
export type PredicateType =
  | 'eq'
  | 'match'
  | 'any-of'
  | 'is'
  | 'not-eq'
  | 'not-match'
  | 'not-is'
  | 'any-eq'
  | 'any-match';

// 查询指令类型
export type DirectiveType =
  | 'set'
  | 'strip'
  | 'select-adjacent';

// 查询谓词接口
export interface QueryPredicate {
  type: PredicateType;
  capture: string;
  value: string | string[];
  negate?: boolean;
  quantifier?: 'any' | 'all';
  position?: Position;
}

// 查询指令接口
export interface QueryDirective {
  type: DirectiveType;
  capture?: string;
  parameters: any[];
  position?: Position;
}

// 查询模式接口
export interface QueryPattern {
  pattern: string;
  captures: string[];
  predicates: QueryPredicate[];
  directives: QueryDirective[];
}

// 解析后的查询接口
export interface ParsedQuery {
  originalQuery: string;
  patterns: QueryPattern[];
  predicates: QueryPredicate[];
  directives: QueryDirective[];
  features: QueryFeatures;
}

// 查询特性接口
export interface QueryFeatures {
  hasPredicates: boolean;
  hasDirectives: boolean;
  hasAnchors: boolean;
  hasAlternations: boolean;
  hasQuantifiers: boolean;
  hasWildcards: boolean;
  predicateCount: number;
  directiveCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

// 验证错误接口
export interface ValidationError {
  type: 'syntax' | 'predicate' | 'directive' | 'structure';
  message: string;
  position?: Position;
  severity: 'error' | 'warning';
}

// 验证警告接口
export interface ValidationWarning {
  type: 'performance' | 'compatibility' | 'best-practice';
  message: string;
  position?: Position;
  suggestion?: string;
}

// 验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  features: QueryFeatures;
  suggestions?: string[];
}

// 结构验证结果接口
export interface StructureValidationResult {
  isValid: boolean;
  patterns: QueryPattern[];
  issues: ValidationError[];
}

// 谓词验证结果接口
export interface PredicateValidationResult {
  isValid: boolean;
  predicates: QueryPredicate[];
  issues: ValidationError[];
}

// 指令验证结果接口
export interface DirectiveValidationResult {
  isValid: boolean;
  directives: QueryDirective[];
  issues: ValidationError[];
}

// 增强的匹配结果接口
export interface EnhancedMatchResult extends MatchResult {
  metadata?: Record<string, any>;
  processedText?: string;
  adjacentNodes?: MatchResult[];
  predicateResults?: PredicateResult[];
  directiveResults?: DirectiveResult[];
}

// 谓词结果接口
export interface PredicateResult {
  predicate: QueryPredicate;
  passed: boolean;
  details?: string;
}

// 指令结果接口
export interface DirectiveResult {
  directive: QueryDirective;
  applied: boolean;
  result?: any;
  error?: string;
}

// 处理后的匹配结果接口
export interface ProcessedMatchResult extends EnhancedMatchResult {
  processedBy: string[];
  transformations: Transformation[];
}

// 转换接口
export interface Transformation {
  type: 'strip' | 'select' | 'set';
  description: string;
  before?: string;
  after?: string;
}

// 过滤后的匹配结果接口
export interface FilteredMatchResult extends EnhancedMatchResult {
  filteredBy: QueryPredicate[];
  originalMatches: number;
}

// 高级解析请求接口
export interface AdvancedParseRequest {
  language: string;
  code: string;
  query?: string;
  queries?: string[];
  enableAdvancedFeatures?: boolean;
  processDirectives?: boolean;
  includeMetadata?: boolean;
  validatePredicates?: boolean;
  maxResults?: number;
  timeout?: number;
}

// 高级解析结果接口
export interface AdvancedParseResult {
  success: boolean;
  matches: EnhancedMatchResult[];
  processedMatches?: ProcessedMatchResult[];
  errors: string[];
  queryFeatures?: QueryFeatures;
  directives?: QueryDirective[];
  predicates?: QueryPredicate[];
  validationResults?: ValidationResult;
  performance?: PerformanceMetrics;
}

// 查询分析接口
export interface QueryAnalysis {
  query: string;
  language: string;
  features: QueryFeatures;
  predicates: QueryPredicate[];
  directives: QueryDirective[];
  validation: ValidationResult;
  estimatedPerformance?: PerformanceEstimate;
}

// 性能指标接口
export interface PerformanceMetrics {
  parseTime: number;
  queryTime: number;
  totalTime: number;
  memoryUsage: number;
  matchCount: number;
  predicatesProcessed: number;
  directivesApplied: number;
}

// 性能估算接口
export interface PerformanceEstimate {
  complexity: 'low' | 'medium' | 'high';
  estimatedTime: number;
  memoryImpact: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// 查询配置接口
export interface QueryConfig {
  enablePredicates: boolean;
  enableDirectives: boolean;
  enableAdvancedValidation: boolean;
  maxPredicatesPerQuery: number;
  maxDirectivesPerQuery: number;
  allowedDirectives: DirectiveType[];
  allowedPredicates: PredicateType[];
  enablePerformanceOptimization: boolean;
  enableCaching: boolean;
  cacheSize: number;
  cacheTimeout: number;
}

// 查询缓存接口
export interface QueryCache {
  get(key: string): ParsedQuery | null;
  set(key: string, value: ParsedQuery): void;
  clear(): void;
  size(): number;
  cleanup(): void;
}

// 查询优化器接口
export interface QueryOptimizer {
  optimizeQuery(query: ParsedQuery): ParsedQuery;
  suggestOptimizations(query: ParsedQuery): OptimizationSuggestion[];
}

// 优化建议接口
export interface OptimizationSuggestion {
  type: 'predicate' | 'directive' | 'structure';
  description: string;
  impact: 'low' | 'medium' | 'high';
  example?: string;
}

// 查询统计接口
export interface QueryStatistics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  averageMatchesPerQuery: number;
  mostUsedPredicates: Record<PredicateType, number>;
  mostUsedDirectives: Record<DirectiveType, number>;
  queryComplexityDistribution: Record<string, number>;
}