import { ErrorType, ErrorSeverity, TreeSitterError, RecoveryResult } from '@/types/errors';
import { ResourceCleaner } from '@/core/ResourceCleaner';
import { MemoryMonitor } from '@/core/MemoryMonitor';
import { CleanupStrategy } from '@/config/memory';

/**
 * 错误恢复策略类
 * 负责针对不同类型的错误实施相应的恢复策略
 */
export class RecoveryStrategy {
  constructor(
    private resourceCleaner: ResourceCleaner,
    private memoryMonitor: MemoryMonitor
  ) {}

  /**
   * 尝试从错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  async attemptRecovery(error: TreeSitterError): Promise<RecoveryResult> {
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
        return await this.recoverFromMemoryError();
      case ErrorType.PARSE_ERROR:
        return this.recoverFromParseError(error);
      case ErrorType.QUERY_ERROR:
        return this.recoverFromQueryError(error);
      case ErrorType.RESOURCE_ERROR:
        return await this.recoverFromResourceError();
      case ErrorType.TIMEOUT_ERROR:
        return this.recoverFromTimeoutError(error);
      case ErrorType.UNSUPPORTED_LANGUAGE:
        return this.recoverFromUnsupportedLanguageError(error);
      case ErrorType.VALIDATION_ERROR:
        return this.recoverFromValidationError(error);
      default:
        return this.recoverFromGenericError(error);
    }
  }

  /**
   * 从内存错误中恢复
   * @returns 恢复结果
   */
  private async recoverFromMemoryError(): Promise<RecoveryResult> {
    try {
      // 执行紧急清理
      const cleanupResult = await this.resourceCleaner.performCleanup(CleanupStrategy.EMERGENCY);
      
      // 强制垃圾回收
      const gcSuccess = await this.resourceCleaner.forceGarbageCollection();
      
      // 检查内存状态
      const memoryStatus = this.memoryMonitor.checkMemory();
      
      return {
        success: memoryStatus.level !== 'critical',
        action: 'emergency_cleanup',
        message: memoryStatus.level === 'critical' 
          ? 'Memory still critical after cleanup'
          : 'Memory recovered successfully',
        details: {
          cleanupResult,
          gcSuccess,
          memoryStatus
        }
      };
    } catch (recoveryError: any) {
      return {
        success: false,
        action: 'emergency_cleanup',
        message: `Recovery failed: ${recoveryError.message}`,
        details: { recoveryError: recoveryError.message }
      };
    }
  }

  /**
   * 从解析错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromParseError(error: TreeSitterError): RecoveryResult {
    // 解析错误通常不需要恢复，只是返回错误信息
    return {
      success: false,
      action: 'none',
      message: 'Parse error cannot be recovered, check input code',
      details: {
        suggestion: 'Verify the input code syntax and ensure it matches the expected language format',
        errorType: error.type
      }
    };
  }

  /**
   * 从查询错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromQueryError(error: TreeSitterError): RecoveryResult {
    // 查询错误通常不需要恢复，只是返回错误信息
    return {
      success: false,
      action: 'none',
      message: 'Query error cannot be recovered, check query syntax',
      details: {
        suggestion: 'Verify the query syntax and ensure it matches the Tree-sitter query format',
        errorType: error.type
      }
    };
  }

  /**
   * 从资源错误中恢复
   * @returns 恢复结果
   */
  private async recoverFromResourceError(): Promise<RecoveryResult> {
    try {
      // 执行激进清理
      const cleanupResult = await this.resourceCleaner.performCleanup(CleanupStrategy.AGGRESSIVE);
      
      return {
        success: true,
        action: 'resource_cleanup',
        message: 'Resource constraints resolved through cleanup',
        details: { cleanupResult }
      };
    } catch (recoveryError: any) {
      return {
        success: false,
        action: 'resource_cleanup',
        message: `Resource recovery failed: ${recoveryError.message}`,
        details: { recoveryError: recoveryError.message }
      };
    }
  }

  /**
   * 从超时错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromTimeoutError(error: TreeSitterError): RecoveryResult {
    // 超时错误通常不需要恢复，但可以提供建议
    return {
      success: false,
      action: 'none',
      message: 'Timeout error occurred',
      details: {
        suggestion: 'Consider reducing the input size or optimizing the query complexity',
        errorType: error.type
      }
    };
  }

  /**
   * 从不支持的语言错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromUnsupportedLanguageError(error: TreeSitterError): RecoveryResult {
    return {
      success: false,
      action: 'none',
      message: 'Unsupported language error',
      details: {
        suggestion: 'Use a supported language or check the language spelling',
        supportedLanguages: [
          'javascript', 'typescript', 'python', 'java', 'go',
          'rust', 'cpp', 'c', 'csharp', 'ruby'
        ],
        errorType: error.type
      }
    };
  }

  /**
   * 从验证错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromValidationError(error: TreeSitterError): RecoveryResult {
    return {
      success: false,
      action: 'none',
      message: 'Validation error occurred',
      details: {
        suggestion: 'Check the request parameters and ensure all required fields are provided',
        errorType: error.type
      }
    };
  }

  /**
   * 从通用错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  private recoverFromGenericError(error: TreeSitterError): RecoveryResult {
    // 通用错误恢复策略
    if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
      // 对于严重错误，尝试基本清理
      try {
        this.resourceCleaner.performCleanup(CleanupStrategy.AGGRESSIVE);
        
        return {
          success: true,
          action: 'basic_cleanup',
          message: 'Generic error handled with basic cleanup',
          details: { errorType: error.type, severity: error.severity }
        };
      } catch (cleanupError: any) {
        return {
          success: false,
          action: 'basic_cleanup',
          message: `Basic cleanup failed: ${cleanupError.message}`,
          details: { errorType: error.type, cleanupError: cleanupError.message }
        };
      }
    }
    
    return {
      success: false,
      action: 'none',
      message: 'Generic error handled, service should continue',
      details: { errorType: error.type, severity: error.severity }
    };
  }

  /**
   * 检查是否可以尝试恢复
   * @param error TreeSitterError对象
   * @returns 是否可以尝试恢复
   */
  canRecover(error: TreeSitterError): boolean {
    // 某些错误类型无法恢复
    const nonRecoverableErrors = [
      ErrorType.PARSE_ERROR,
      ErrorType.QUERY_ERROR,
      ErrorType.UNSUPPORTED_LANGUAGE,
      ErrorType.VALIDATION_ERROR
    ];
    
    return !nonRecoverableErrors.includes(error.type);
  }

  /**
   * 获取恢复策略的优先级
   * @param error TreeSitterError对象
   * @returns 恢复优先级（数字越大优先级越高）
   */
  getRecoveryPriority(error: TreeSitterError): number {
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
        return 10; // 最高优先级
      case ErrorType.RESOURCE_ERROR:
        return 8;
      case ErrorType.INTERNAL_ERROR:
        return 6;
      case ErrorType.TIMEOUT_ERROR:
        return 4;
      case ErrorType.PARSE_ERROR:
      case ErrorType.QUERY_ERROR:
        return 2; // 最低优先级，通常不恢复
      default:
        return 5;
    }
  }
}