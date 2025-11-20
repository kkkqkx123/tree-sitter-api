/**
 * 错误类型定义 - 扩展以支持高级查询功能
 */

import { Position } from './api';

// 基础错误类型
export enum ErrorType {
  // 通用错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // 高级查询相关错误
  QUERY_SYNTAX_ERROR = 'QUERY_SYNTAX_ERROR',
  PREDICATE_ERROR = 'PREDICATE_ERROR',
  DIRECTIVE_ERROR = 'DIRECTIVE_ERROR',
  QUERY_OPTIMIZATION_ERROR = 'QUERY_OPTIMIZATION_ERROR',
  QUERY_CACHE_ERROR = 'QUERY_CACHE_ERROR',
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// 清理结果类型
export interface CleanupResult {
  memoryFreed: number;
  duration: number;
  success: boolean;
}

// 基础Tree-sitter错误类
export class TreeSitterError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.severity = severity;
    this.timestamp = new Date();
    this.context = context || undefined;

    // 确保错误堆栈正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): {
    name: string;
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    timestamp: string;
    context?: Record<string, any>;
    stack?: string;
  } {
    return {
      name: this.name,
      type: this.type,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    switch (this.type) {
      case ErrorType.QUERY_SYNTAX_ERROR:
        return '查询语法错误，请检查查询格式是否正确';
      case ErrorType.PREDICATE_ERROR:
        return '谓词使用错误，请检查谓词参数是否正确';
      case ErrorType.DIRECTIVE_ERROR:
        return '指令使用错误，请检查指令参数是否正确';
      case ErrorType.QUERY_OPTIMIZATION_ERROR:
        return '查询优化失败，请尝试简化查询';
      case ErrorType.QUERY_CACHE_ERROR:
        return '查询缓存错误，请稍后重试';
      case ErrorType.VALIDATION_ERROR:
        return '请求参数验证失败，请检查输入参数';
      case ErrorType.PARSE_ERROR:
        return '代码解析失败，请检查代码语法是否正确';
      case ErrorType.MEMORY_ERROR:
        return '内存不足，请稍后重试或减少查询复杂度';
      case ErrorType.UNSUPPORTED_LANGUAGE:
        return '不支持的编程语言，请检查语言参数';
      case ErrorType.INTERNAL_ERROR:
        return '内部服务器错误，请稍后重试';
      default:
        return this.message;
    }
  }

  /**
   * 获取错误代码
   */
  getErrorCode(): string {
    return `${this.type}_${this.severity}`;
  }
}

// 查询语法错误
export class QuerySyntaxError extends TreeSitterError {
  public readonly position?: Position;
  public readonly query?: string;

  constructor(
    message: string,
    position?: Position,
    query?: string,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.QUERY_SYNTAX_ERROR,
      ErrorSeverity.MEDIUM,
      message,
      context
    );
    if (position) this.position = position;
    if (query) this.query = query;
  }

  /**
   * 获取详细的错误位置信息
   */
  getPositionDetails(): string {
    if (!this.position) {
      return '未知位置';
    }
    return `行 ${this.position.row + 1}, 列 ${this.position.column + 1}`;
  }

  /**
   * 获取错误上下文
   */
  getErrorContext(): string {
    if (!this.query || !this.position) {
      return '';
    }

    const lines = this.query.split('\n');
    const errorLine = lines[this.position.row];
    
    if (!errorLine) {
      return '';
    }

    const start = Math.max(0, this.position.column - 20);
    const end = Math.min(errorLine.length, this.position.column + 20);
    
    return `...${errorLine.substring(start, end)}...`;
  }
}

// 谓词错误
export class PredicateError extends TreeSitterError {
  public readonly predicate: string;
  public readonly capture?: string;
  public readonly position?: Position;

  constructor(
    predicate: string,
    message: string,
    capture?: string,
    position?: Position,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.PREDICATE_ERROR,
      ErrorSeverity.MEDIUM,
      `Predicate ${predicate}: ${message}`,
      context
    );
    this.predicate = predicate;
    if (capture) this.capture = capture;
    if (position) this.position = position;
  }

  /**
   * 获取谓词错误详情
   */
  getPredicateDetails(): string {
    let details = `谓词类型: ${this.predicate}`;
    if (this.capture) {
      details += `, 捕获: @${this.capture}`;
    }
    if (this.position) {
      details += `, 位置: 行 ${this.position.row + 1}, 列 ${this.position.column + 1}`;
    }
    return details;
  }
}

// 指令错误
export class DirectiveError extends TreeSitterError {
  public readonly directive: string;
  public readonly capture?: string;
  public readonly position?: Position;

  constructor(
    directive: string,
    message: string,
    capture?: string,
    position?: Position,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.DIRECTIVE_ERROR,
      ErrorSeverity.MEDIUM,
      `Directive ${directive}: ${message}`,
      context
    );
    this.directive = directive;
    if (capture) this.capture = capture;
    if (position) this.position = position;
  }

  /**
   * 获取指令错误详情
   */
  getDirectiveDetails(): string {
    let details = `指令类型: ${this.directive}`;
    if (this.capture) {
      details += `, 捕获: @${this.capture}`;
    }
    if (this.position) {
      details += `, 位置: 行 ${this.position.row + 1}, 列 ${this.position.column + 1}`;
    }
    return details;
  }
}

// 查询优化错误
export class QueryOptimizationError extends TreeSitterError {
  public readonly query?: string;
  public readonly optimization?: string;

  constructor(
    message: string,
    query?: string,
    optimization?: string,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.QUERY_OPTIMIZATION_ERROR,
      ErrorSeverity.LOW,
      message,
      context
    );
    if (query) this.query = query;
    if (optimization) this.optimization = optimization;
  }

  /**
   * 获取优化错误详情
   */
  getOptimizationDetails(): string {
    let details = '';
    if (this.optimization) {
      details += `优化类型: ${this.optimization}`;
    }
    if (this.query) {
      details += details ? `, 查询: ${this.query.substring(0, 100)}...` : `查询: ${this.query.substring(0, 100)}...`;
    }
    return details;
  }
}

// 查询缓存错误
export class QueryCacheError extends TreeSitterError {
  public readonly operation?: string;
  public readonly key?: string;

  constructor(
    message: string,
    operation?: string,
    key?: string,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.QUERY_CACHE_ERROR,
      ErrorSeverity.LOW,
      message,
      context
    );
    if (operation) this.operation = operation;
    if (key) this.key = key;
  }

  /**
   * 获取缓存错误详情
   */
  getCacheDetails(): string {
    let details = '';
    if (this.operation) {
      details += `操作: ${this.operation}`;
    }
    if (this.key) {
      details += details ? `, 键: ${this.key}` : `键: ${this.key}`;
    }
    return details;
  }
}

// 验证错误
export class ValidationError extends TreeSitterError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.VALIDATION_ERROR,
      ErrorSeverity.MEDIUM,
      message,
      context
    );
    if (field) this.field = field;
    if (value !== undefined) this.value = value;
  }

  /**
   * 获取验证错误详情
   */
  getValidationDetails(): string {
    let details = '';
    if (this.field) {
      details += `字段: ${this.field}`;
    }
    if (this.value !== undefined) {
      details += details ? `, 值: ${JSON.stringify(this.value)}` : `值: ${JSON.stringify(this.value)}`;
    }
    return details;
  }
}

// 解析错误
export class ParseError extends TreeSitterError {
  public readonly language?: string;
  public readonly code?: string;

  constructor(
    message: string,
    language?: string,
    code?: string,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.PARSE_ERROR,
      ErrorSeverity.MEDIUM,
      message,
      context
    );
    if (language) this.language = language;
    if (code) this.code = code;
  }

  /**
   * 获取解析错误详情
   */
  getParseDetails(): string {
    let details = '';
    if (this.language) {
      details += `语言: ${this.language}`;
    }
    if (this.code) {
      const codePreview = this.code.length > 100 ? this.code.substring(0, 100) + '...' : this.code;
      details += details ? `, 代码: ${codePreview}` : `代码: ${codePreview}`;
    }
    return details;
  }
}

// 内存错误
export class MemoryError extends TreeSitterError {
  public readonly memoryUsage?: number;
  public readonly threshold?: number;

  constructor(
    message: string,
    memoryUsage?: number,
    threshold?: number,
    context?: Record<string, any>
  ) {
    super(
      ErrorType.MEMORY_ERROR,
      ErrorSeverity.HIGH,
      message,
      context
    );
    if (memoryUsage !== undefined) this.memoryUsage = memoryUsage;
    if (threshold !== undefined) this.threshold = threshold;
  }

  /**
   * 获取内存错误详情
   */
  getMemoryDetails(): string {
    let details = '';
    if (this.memoryUsage !== undefined) {
      details += `当前内存使用: ${this.memoryUsage}MB`;
    }
    if (this.threshold !== undefined) {
      details += details ? `, 阈值: ${this.threshold}MB` : `阈值: ${this.threshold}MB`;
    }
    return details;
  }
}

// 不支持的语言错误
export class UnsupportedLanguageError extends TreeSitterError {
  public readonly language?: string;
  public readonly supportedLanguages?: string[];

  constructor(
    message: string,
    language?: string,
    supportedLanguages?: string[],
    context?: Record<string, any>
  ) {
    super(
      ErrorType.UNSUPPORTED_LANGUAGE,
      ErrorSeverity.MEDIUM,
      message,
      context
    );
    if (language) this.language = language;
    if (supportedLanguages) this.supportedLanguages = supportedLanguages;
  }

  /**
   * 获取语言错误详情
   */
  getLanguageDetails(): string {
    let details = '';
    if (this.language) {
      details += `请求的语言: ${this.language}`;
    }
    if (this.supportedLanguages && this.supportedLanguages.length > 0) {
      details += details ? `, 支持的语言: ${this.supportedLanguages.join(', ')}` : `支持的语言: ${this.supportedLanguages.join(', ')}`;
    }
    return details;
  }
}

// 错误工厂函数
export class ErrorFactory {
  /**
   * 创建查询语法错误
   */
  static createQuerySyntaxError(
    message: string,
    position?: Position,
    query?: string
  ): QuerySyntaxError {
    return new QuerySyntaxError(message, position, query);
  }

  /**
   * 创建谓词错误
   */
  static createPredicateError(
    predicate: string,
    message: string,
    capture?: string,
    position?: Position
  ): PredicateError {
    return new PredicateError(predicate, message, capture, position);
  }

  /**
   * 创建指令错误
   */
  static createDirectiveError(
    directive: string,
    message: string,
    capture?: string,
    position?: Position
  ): DirectiveError {
    return new DirectiveError(directive, message, capture, position);
  }

  /**
   * 创建验证错误
   */
  static createValidationError(
    message: string,
    field?: string,
    value?: any
  ): ValidationError {
    return new ValidationError(message, field, value);
  }

  /**
   * 创建解析错误
   */
  static createParseError(
    message: string,
    language?: string,
    code?: string
  ): ParseError {
    return new ParseError(message, language, code);
  }

  /**
   * 创建内存错误
   */
  static createMemoryError(
    message: string,
    memoryUsage?: number,
    threshold?: number
  ): MemoryError {
    return new MemoryError(message, memoryUsage, threshold);
  }

  /**
   * 创建不支持的语言错误
   */
  static createUnsupportedLanguageError(
    message: string,
    language?: string,
    supportedLanguages?: string[]
  ): UnsupportedLanguageError {
    return new UnsupportedLanguageError(message, language, supportedLanguages);
  }

  /**
   * 从通用错误创建Tree-sitter错误
   */
  static fromError(error: unknown): TreeSitterError {
    if (error instanceof TreeSitterError) {
      return error;
    }

    if (error instanceof Error) {
      return new TreeSitterError(
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        error.message,
        { originalError: error.name, stack: error.stack }
      );
    }

    return new TreeSitterError(
      ErrorType.VALIDATION_ERROR,
      ErrorSeverity.MEDIUM,
      String(error)
    );
  }
}

// 错误处理工具函数
export class ErrorUtils {
  /**
   * 检查错误是否可重试
   */
  static isRetryable(error: TreeSitterError): boolean {
    return error.type === ErrorType.MEMORY_ERROR ||
           error.type === ErrorType.QUERY_CACHE_ERROR;
  }

  /**
   * 检查错误是否为用户错误
   */
  static isUserError(error: TreeSitterError): boolean {
    return error.type === ErrorType.VALIDATION_ERROR ||
           error.type === ErrorType.QUERY_SYNTAX_ERROR ||
           error.type === ErrorType.PREDICATE_ERROR ||
           error.type === ErrorType.DIRECTIVE_ERROR ||
           error.type === ErrorType.UNSUPPORTED_LANGUAGE;
  }

  /**
   * 获取错误的重试延迟（毫秒）
   */
  static getRetryDelay(error: TreeSitterError, attempt: number): number {
    const baseDelay = 1000; // 1秒
    const maxDelay = 30000;  // 30秒
    
    let delay = baseDelay * Math.pow(2, attempt - 1); // 指数退避
    
    // 根据错误类型调整延迟
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
        delay *= 2; // 内存错误需要更长的等待时间
        break;
      case ErrorType.QUERY_CACHE_ERROR:
        delay *= 0.5; // 缓存错误可以快速重试
        break;
    }
    
    return Math.min(delay, maxDelay);
  }

  /**
   * 格式化错误消息
   */
  static formatErrorMessage(error: TreeSitterError): string {
    const userMessage = error.getUserFriendlyMessage();
    const details = this.getErrorDetails(error);
    
    return details ? `${userMessage}: ${details}` : userMessage;
  }

  /**
   * 获取错误详情
   */
  private static getErrorDetails(error: TreeSitterError): string {
    if (error instanceof QuerySyntaxError) {
      return error.getPositionDetails();
    }
    if (error instanceof PredicateError) {
      return error.getPredicateDetails();
    }
    if (error instanceof DirectiveError) {
      return error.getDirectiveDetails();
    }
    if (error instanceof ValidationError) {
      return error.getValidationDetails();
    }
    if (error instanceof ParseError) {
      return error.getParseDetails();
    }
    if (error instanceof MemoryError) {
      return error.getMemoryDetails();
    }
    if (error instanceof UnsupportedLanguageError) {
      return error.getLanguageDetails();
    }
    
    return '';
  }
}