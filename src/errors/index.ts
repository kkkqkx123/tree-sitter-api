/**
 * 错误处理模块导出
 */

// 类型定义
export {
  ErrorType,
  ErrorSeverity,
  TreeSitterError,
  ErrorDetails,
  ErrorRecord,
  ErrorStatistics,
  RecoveryResult,
  MemoryStatus,
  CleanupResult,
  HealthStatus
} from '@/types/errors';

// 错误处理器
export { ErrorHandler } from './ErrorHandler';

// 恢复策略
export { RecoveryStrategy } from './RecoveryStrategy';