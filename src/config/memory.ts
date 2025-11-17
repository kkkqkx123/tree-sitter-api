/**
 * 内存管理配置
 */

export const MemoryConfig = {
  // 内存阈值 (MB)
  THRESHOLDS: {
    WARNING: 200,   // 警告阈值
    CRITICAL: 300,  // 严重阈值
    MAXIMUM: 400    // 最大阈值
  },
  
  // 清理策略
  CLEANUP: {
    INTERVAL: 60000,        // 清理间隔 (ms)
    FORCE_GC_INTERVAL: 300000, // 强制GC间隔 (ms)
    IDLE_TIMEOUT: 300000    // 空闲超时 (ms)
  },
  
  // 资源限制
  LIMITS: {
    MAX_REQUEST_SIZE: 5 * 1024 * 1024,  // 5MB
    MAX_CODE_LENGTH: 100 * 1024,        // 100KB
    MAX_CONCURRENT_REQUESTS: 10,         // 最大并发请求数
    PARSER_POOL_SIZE: 3,                 // 解析器池大小
    QUERY_TIMEOUT: 30000,                // 查询超时 (ms)
    MEMORY_HISTORY_SIZE: 10              // 内存历史记录大小
  },
  
  // 监控配置
  MONITORING: {
    ENABLED: true,
    LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    METRICS_INTERVAL: 30000, // 指标收集间隔 (ms)
    ALERT_THRESHOLD: 0.8      // 告警阈值 (80%)
  }
};

// 内存状态枚举
export enum MemoryLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

// 清理策略枚举
export enum CleanupStrategy {
  BASIC = 'basic',
  AGGRESSIVE = 'aggressive',
  EMERGENCY = 'emergency'
}

// 内存趋势枚举
export enum MemoryTrend {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable'
}