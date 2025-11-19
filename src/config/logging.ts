/**
 * 日志系统配置（简化版）
 * 
 * 支持环境变量配置：
 * - 文件大小轮转：5MB
 * - 日期轮转：每天0点
 * - 保留期限：7天
 * - 最大总量：10MB
 * - 缓冲大小：64KB
 */

export enum LogFormat {
  COMBINED = 'combined', // [timestamp] [level] [module] message
}

export interface LoggerConfig {
  // 基础配置
  level: string; // debug, info, warn, error, fatal

  // Console输出
  console: {
    enabled: boolean;
  };

  // 文件输出
  file: {
    enabled: boolean;
    directory: string; // 日志目录，默认: ./logs
    filename: string;  // 日志文件名，默认: app.log
  };

  // 元数据
  timestamps: {
    enabled: boolean;
    timezone: string; // 时区，默认为 'Asia/Shanghai'
  };

  module: {
    enabled: boolean;
  };

  // 性能配置
  performance: {
    bufferSize: number; // 缓冲大小，默认64KB
    flushInterval: number; // 刷新间隔，默认1秒
  };

  // 轮转配置
  rotation: {
    maxSize: number; // 单个文件最大大小，默认5MB
    maxTotalSize: number; // 日志总大小上限，默认10MB
    cleanupThreshold: number; // 清理阈值，默认5MB
    maxAgeDays: number; // 最大保留天数，默认7天
  };
}

export const defaultLoggerConfig: LoggerConfig = {
  level: process.env['LOG_LEVEL'] || 'info',

  console: {
    enabled: process.env['LOG_CONSOLE'] !== 'false',
  },

  file: {
    enabled: process.env['LOG_FILE'] === 'true',
    directory: process.env['LOG_DIR'] || './logs',
    filename: process.env['LOG_FILENAME'] || 'app.log',
  },

  timestamps: {
    enabled: process.env['ENABLE_LOG_TIMESTAMP'] !== 'false',
    timezone: process.env['TZ'] || 'Asia/Shanghai',
  },

  module: {
    enabled: process.env['ENABLE_LOG_MODULE'] !== 'false',
  },

  performance: {
    bufferSize: parseInt(process.env['LOG_BUFFER_SIZE'] || '65536', 10), // 64KB
    flushInterval: parseInt(process.env['LOG_FLUSH_INTERVAL'] || '1000', 10), // 1秒
  },

  rotation: {
    maxSize: parseInt(process.env['LOG_ROTATION_MAX_SIZE'] || '5242880', 10), // 5MB
    maxTotalSize: parseInt(process.env['LOG_ROTATION_MAX_TOTAL_SIZE'] || '10485760', 10), // 10MB
    cleanupThreshold: parseInt(process.env['LOG_ROTATION_CLEANUP_THRESHOLD'] || '5242880', 10), // 5MB
    maxAgeDays: parseInt(process.env['LOG_ROTATION_MAX_AGE_DAYS'] || '7', 10), // 7天
  },
};

export function getLoggerConfig(overrides?: Partial<LoggerConfig>): LoggerConfig {
  return { ...defaultLoggerConfig, ...overrides };
}