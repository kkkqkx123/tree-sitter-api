/**
 * 内存管理配置
 */

import { EnvConfig } from './env';

// 内存状态枚举
export enum MemoryLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// 清理策略枚举
export enum CleanupStrategy {
  BASIC = 'basic',
  AGGRESSIVE = 'aggressive',
  EMERGENCY = 'emergency',
}

// 内存趋势枚举
export enum MemoryTrend {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
}

// 内存配置接口
export interface MemoryConfiguration {
  // 内存阈值 (MB)
  THRESHOLDS: {
    WARNING: number; // 警告阈值
    CRITICAL: number; // 严重阈值
    MAXIMUM: number; // 最大阈值
  };

  // 清理策略
  CLEANUP: {
    INTERVAL: number; // 清理间隔 (ms)
    FORCE_GC_INTERVAL: number; // 强制GC间隔 (ms)
    IDLE_TIMEOUT: number; // 空闲超时 (ms)
  };

  // 资源限制
  LIMITS: {
    MAX_REQUEST_SIZE: number; // 最大请求大小
    MAX_CODE_LENGTH: number; // 最大代码长度
    MAX_CONCURRENT_REQUESTS: number; // 最大并发请求数
    PARSER_POOL_SIZE: number; // 解析器池大小
    QUERY_TIMEOUT: number; // 查询超时 (ms)
    MEMORY_HISTORY_SIZE: number; // 内存历史记录大小
  };

  // 监控配置
  MONITORING: {
    ENABLED: boolean;
    LOG_LEVEL: string; // 'debug', 'info', 'warn', 'error'
    METRICS_INTERVAL: number; // 指标收集间隔 (ms)
    ALERT_THRESHOLD: number; // 告警阈值 (80%)
  };
}

/**
 * 创建内存配置对象
 * @returns 基于环境变量的内存配置
 */
export function createMemoryConfig(): MemoryConfiguration {
  // 从环境变量获取内存阈值，如果没有则使用默认值
  const warningThreshold = EnvConfig.MEMORY_WARNING_THRESHOLD;
  const criticalThreshold = EnvConfig.MEMORY_CRITICAL_THRESHOLD;
  const maxMemory = EnvConfig.MAX_MEMORY_MB;

  // 确保阈值逻辑正确
  const maximumThreshold = Math.max(criticalThreshold + 50, maxMemory * 0.9);

  return {
    // 内存阈值 (MB)
    THRESHOLDS: {
      WARNING: warningThreshold,
      CRITICAL: criticalThreshold,
      MAXIMUM: maximumThreshold,
    },

    // 清理策略
    CLEANUP: {
      INTERVAL: 60000, // 清理间隔 (ms)
      FORCE_GC_INTERVAL: 300000, // 强制GC间隔 (ms)
      IDLE_TIMEOUT: 300000, // 空闲超时 (ms)
    },

    // 资源限制
    LIMITS: {
      MAX_REQUEST_SIZE: parseSizeToBytes(EnvConfig.MAX_REQUEST_SIZE), // 5MB
      MAX_CODE_LENGTH: EnvConfig.MAX_CODE_LENGTH, // 100KB
      MAX_CONCURRENT_REQUESTS: EnvConfig.MAX_CONCURRENT_REQUESTS, // 最大并发请求数
      PARSER_POOL_SIZE: EnvConfig.PARSER_POOL_SIZE, // 解析器池大小
      QUERY_TIMEOUT: EnvConfig.QUERY_TIMEOUT, // 查询超时 (ms)
      MEMORY_HISTORY_SIZE: 10, // 内存历史记录大小
    },

    // 监控配置
    MONITORING: {
      ENABLED: true,
      LOG_LEVEL: EnvConfig.LOG_LEVEL, // 'debug', 'info', 'warn', 'error'
      METRICS_INTERVAL: 30000, // 指标收集间隔 (ms)
      ALERT_THRESHOLD: 0.8, // 告警阈值 (80%)
    },
  };
}

/**
 * 将大小字符串转换为字节数
 * @param sizeStr 大小字符串，如 '5mb', '1gb'
 * @returns 字节数
 */
function parseSizeToBytes(sizeStr: string): number {
  const trimmed = sizeStr.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);

  if (!match) {
    // 默认返回 5MB
    return 5 * 1024 * 1024;
  }

  const value = parseFloat(match[1] || '0');
  const unit = match[2] || 'b';

  switch (unit) {
    case 'b':
      return Math.floor(value);
    case 'kb':
      return Math.floor(value * 1024);
    case 'mb':
      return Math.floor(value * 1024 * 1024);
    case 'gb':
      return Math.floor(value * 1024 * 1024 * 1024);
    default:
      return Math.floor(value);
  }
}

// 使用变量而不是常量，以便可以刷新配置
let _MemoryConfig = createMemoryConfig();

// 导出内存配置对象（向后兼容）
export const MemoryConfig = _MemoryConfig;

// 导出配置刷新函数
export function refreshMemoryConfig(): void {
  // 重新创建配置对象
  _MemoryConfig = createMemoryConfig();
}

// 导出一个获取当前配置的函数
export function getMemoryConfig(): MemoryConfiguration {
  return _MemoryConfig;
}
