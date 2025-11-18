import { ErrorType, TreeSitterError, RecoveryResult } from '@/types/errors';
import { ResourceCleaner } from '@/core/ResourceCleaner';
import { MemoryMonitor } from '@/core/MemoryMonitor';
import { CleanupStrategy } from '@/config/memory';

/**
 * 简化的错误恢复策略类
 * 负责针对不同类型的错误实施相应的恢复策略
 */
export class RecoveryStrategy {
  constructor(
    private resourceCleaner: ResourceCleaner,
    private memoryMonitor: MemoryMonitor
  ) { }

  /**
   * 尝试从错误中恢复
   * @param error TreeSitterError对象
   * @returns 恢复结果
   */
  async attemptRecovery(error: TreeSitterError): Promise<RecoveryResult> {
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
        return await this.recoverFromMemoryError();
      case ErrorType.RESOURCE_ERROR:
        return await this.recoverFromResourceError();
      default:
        // 对于其他类型的错误，提供基本的恢复建议
        return {
          success: false,
          action: 'none',
          message: 'Error does not require resource recovery',
          details: {
            errorType: error.type,
            severity: error.severity
          }
        };
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
}