/**
 * 环境变量配置和验证
 */

import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 环境变量接口定义
export interface EnvironmentConfig {
  // 服务器配置
  PORT: number;
  HOST: string;
  NODE_ENV: string;

  // 内存配置
  MAX_MEMORY_MB: number;
  MEMORY_WARNING_THRESHOLD: number;
  MEMORY_CRITICAL_THRESHOLD: number;

  // 请求配置
  REQUEST_TIMEOUT: number;
  MAX_REQUEST_SIZE: string;
  MAX_CONCURRENT_REQUESTS: number;

  // 日志配置
  LOG_LEVEL: string;
  ENABLE_REQUEST_LOGGING: boolean;

  // 安全配置
  ENABLE_RATE_LIMITING: boolean;
  CORS_ORIGIN: string;

  // Tree-sitter配置
  PARSER_POOL_SIZE: number;
  MAX_CODE_LENGTH: number;
  QUERY_TIMEOUT: number;
  PARSER_TIMEOUT: number;
}

// 默认配置
const DEFAULT_CONFIG: Partial<EnvironmentConfig> = {
  PORT: 3000,
  HOST: 'localhost',
  NODE_ENV: 'development',

  MAX_MEMORY_MB: 512,
  MEMORY_WARNING_THRESHOLD: 200,
  MEMORY_CRITICAL_THRESHOLD: 300,

  REQUEST_TIMEOUT: 30000,
  MAX_REQUEST_SIZE: '5mb',
  MAX_CONCURRENT_REQUESTS: 10,

  LOG_LEVEL: 'info',
  ENABLE_REQUEST_LOGGING: true,

  ENABLE_RATE_LIMITING: true,
  CORS_ORIGIN: '*',

  PARSER_POOL_SIZE: 3,
  MAX_CODE_LENGTH: 100 * 1024, // 100KB
  QUERY_TIMEOUT: 30000,
  PARSER_TIMEOUT: 300000, // 5分钟
};

// 验证和转换环境变量
function getEnvVar(key: string, defaultValue?: any): any {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = getEnvVar(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be a valid number, got: ${value}`,
    );
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = getEnvVar(key, defaultValue?.toString());
  return value.toLowerCase() === 'true';
}

// 导出配置
export const EnvConfig: EnvironmentConfig = {
  // 服务器配置
  PORT: getEnvNumber('PORT', DEFAULT_CONFIG.PORT),
  HOST: getEnvVar('HOST', DEFAULT_CONFIG.HOST),
  NODE_ENV: getEnvVar('NODE_ENV', DEFAULT_CONFIG.NODE_ENV),

  // 内存配置
  MAX_MEMORY_MB: getEnvNumber('MAX_MEMORY_MB', DEFAULT_CONFIG.MAX_MEMORY_MB),
  MEMORY_WARNING_THRESHOLD: getEnvNumber(
    'MEMORY_WARNING_THRESHOLD',
    DEFAULT_CONFIG.MEMORY_WARNING_THRESHOLD,
  ),
  MEMORY_CRITICAL_THRESHOLD: getEnvNumber(
    'MEMORY_CRITICAL_THRESHOLD',
    DEFAULT_CONFIG.MEMORY_CRITICAL_THRESHOLD,
  ),

  // 请求配置
  REQUEST_TIMEOUT: getEnvNumber(
    'REQUEST_TIMEOUT',
    DEFAULT_CONFIG.REQUEST_TIMEOUT,
  ),
  MAX_REQUEST_SIZE: getEnvVar(
    'MAX_REQUEST_SIZE',
    DEFAULT_CONFIG.MAX_REQUEST_SIZE,
  ),
  MAX_CONCURRENT_REQUESTS: getEnvNumber(
    'MAX_CONCURRENT_REQUESTS',
    DEFAULT_CONFIG.MAX_CONCURRENT_REQUESTS,
  ),

  // 日志配置
  LOG_LEVEL: getEnvVar('LOG_LEVEL', DEFAULT_CONFIG.LOG_LEVEL),
  ENABLE_REQUEST_LOGGING: getEnvBoolean(
    'ENABLE_REQUEST_LOGGING',
    DEFAULT_CONFIG.ENABLE_REQUEST_LOGGING,
  ),

  // 安全配置
  ENABLE_RATE_LIMITING: getEnvBoolean(
    'ENABLE_RATE_LIMITING',
    DEFAULT_CONFIG.ENABLE_RATE_LIMITING,
  ),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', DEFAULT_CONFIG.CORS_ORIGIN),

  // Tree-sitter配置
  PARSER_POOL_SIZE: getEnvNumber(
    'PARSER_POOL_SIZE',
    DEFAULT_CONFIG.PARSER_POOL_SIZE,
  ),
  MAX_CODE_LENGTH: getEnvNumber(
    'MAX_CODE_LENGTH',
    DEFAULT_CONFIG.MAX_CODE_LENGTH,
  ),
  QUERY_TIMEOUT: getEnvNumber('QUERY_TIMEOUT', DEFAULT_CONFIG.QUERY_TIMEOUT),
  PARSER_TIMEOUT: getEnvNumber('PARSER_TIMEOUT', DEFAULT_CONFIG.PARSER_TIMEOUT),
};

// 验证配置
export function validateConfig(): void {
  const errors: string[] = [];

  // 验证端口
  if (EnvConfig.PORT < 1 || EnvConfig.PORT > 65535) {
    errors.push(`PORT must be between 1 and 65535, got: ${EnvConfig.PORT}`);
  }

  // 验证内存阈值
  if (
    EnvConfig.MEMORY_WARNING_THRESHOLD >= EnvConfig.MEMORY_CRITICAL_THRESHOLD
  ) {
    errors.push(
      'MEMORY_WARNING_THRESHOLD must be less than MEMORY_CRITICAL_THRESHOLD',
    );
  }

  // 验证请求超时
  if (EnvConfig.REQUEST_TIMEOUT < 1000) {
    errors.push('REQUEST_TIMEOUT must be at least 1000ms');
  }

  // 验证并发请求数
  if (EnvConfig.MAX_CONCURRENT_REQUESTS < 1) {
    errors.push('MAX_CONCURRENT_REQUESTS must be at least 1');
  }

  // 验证解析器池大小
  if (EnvConfig.PARSER_POOL_SIZE < 1) {
    errors.push('PARSER_POOL_SIZE must be at least 1');
  }

  // 验证代码长度限制
  if (EnvConfig.MAX_CODE_LENGTH < 1024) {
    errors.push('MAX_CODE_LENGTH must be at least 1024 bytes');
  }

  // 验证解析器超时
  if (EnvConfig.PARSER_TIMEOUT < 60000) {
    errors.push('PARSER_TIMEOUT must be at least 60000ms (1 minute)');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// 获取配置摘要（用于日志）
export function getConfigSummary(): Record<string, any> {
  return {
    server: {
      port: EnvConfig.PORT,
      host: EnvConfig.HOST,
      env: EnvConfig.NODE_ENV,
    },
    memory: {
      maxMemoryMB: EnvConfig.MAX_MEMORY_MB,
      warningThreshold: EnvConfig.MEMORY_WARNING_THRESHOLD,
      criticalThreshold: EnvConfig.MEMORY_CRITICAL_THRESHOLD,
    },
    requests: {
      timeout: EnvConfig.REQUEST_TIMEOUT,
      maxSize: EnvConfig.MAX_REQUEST_SIZE,
      maxConcurrent: EnvConfig.MAX_CONCURRENT_REQUESTS,
    },
    treeSitter: {
      parserPoolSize: EnvConfig.PARSER_POOL_SIZE,
      maxCodeLength: EnvConfig.MAX_CODE_LENGTH,
      queryTimeout: EnvConfig.QUERY_TIMEOUT,
      parserTimeout: EnvConfig.PARSER_TIMEOUT,
    },
  };
}
