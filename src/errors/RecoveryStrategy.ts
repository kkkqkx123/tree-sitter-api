import { ErrorType, TreeSitterError, RecoveryResult } from '../types/errors';
import { ResourceService } from '../core/ResourceService';
import { MonitoringService } from '../core/MonitoringService';
import { CleanupStrategy } from '../config/memory';

/**
 * 简化的错误恢复策略类
 * 负责针对不同类型的错误实施相应的恢复策略
 */
export class RecoveryStrategy {
  constructor(
    private resourceService: ResourceService,
    private monitoringService: MonitoringService,
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
      case ErrorType.RESOURCE_ERROR:
        return await this.recoverFromResourceError();
      default:
        // 对于其他类型的错误，提供基本的恢复建议
        return {
          success: false,
          strategy: 'none',
          duration: 0,
          error: `Error does not require resource recovery: ${error.type}`,
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
      const cleanupResult = await this.monitoringService.performCleanup(
        CleanupStrategy.EMERGENCY,
      );

      // 检查内存状态
      const memoryStatus = this.monitoringService.checkMemory();

      const result: RecoveryResult = {
        success: memoryStatus.level !== 'critical',
        strategy: 'emergency_cleanup',
        duration: cleanupResult.duration,
        memoryFreed: cleanupResult.memoryFreed,
      };
      
      if (memoryStatus.level === 'critical') {
        result.error = 'Memory still critical after cleanup';
      }
      
      return result;
    } catch (recoveryError: any) {
      return {
        success: false,
        strategy: 'emergency_cleanup',
        duration: 0,
        error: `Recovery failed: ${recoveryError.message}`,
      };
    }
  }

  /**
   * 从资源错误中恢复
   * @returns 恢复结果
   */
  private async recoverFromResourceError(): Promise<RecoveryResult> {
    try {
      // 清理资源
      this.resourceService.cleanup();
      
      // 执行激进清理
      const cleanupResult = await this.monitoringService.performCleanup(
        CleanupStrategy.AGGRESSIVE,
      );

      return {
        success: true,
        strategy: 'resource_cleanup',
        duration: cleanupResult.duration,
        memoryFreed: cleanupResult.memoryFreed,
      };
    } catch (recoveryError: any) {
      return {
        success: false,
        strategy: 'resource_cleanup',
        duration: 0,
        error: `Resource recovery failed: ${recoveryError.message}`,
      };
    }
  }

  /**
   * 检查是否可以从指定错误中恢复
   * @param error TreeSitterError对象
   * @returns 是否可以恢复
   */
  canRecover(error: TreeSitterError): boolean {
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
      case ErrorType.RESOURCE_ERROR:
        return true;
      default:
        return false;
    }
  }

  /**
   * 获取错误的恢复优先级
   * @param error TreeSitterError对象
   * @returns 恢复优先级（数字越大优先级越高）
   */
  getRecoveryPriority(error: TreeSitterError): number {
    switch (error.type) {
      case ErrorType.MEMORY_ERROR:
        return 10; // 最高优先级
      case ErrorType.RESOURCE_ERROR:
        return 8; // 高优先级
      case ErrorType.PARSE_ERROR:
        return 5; // 中等优先级
      case ErrorType.VALIDATION_ERROR:
        return 3; // 低优先级
      default:
        return 1; // 最低优先级
    }
  }
}