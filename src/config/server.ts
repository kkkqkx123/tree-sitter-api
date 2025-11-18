/**
 * API服务器配置
 */

export const ServerConfig = {
  // 服务器基础配置
  SERVER: {
    PORT: parseInt(process.env["PORT"] || '3000', 10),
    HOST: process.env["HOST"] || 'localhost',
    ENVIRONMENT: process.env["NODE_ENV"] || 'development',
  },

  // 请求配置
  REQUEST: {
    TIMEOUT: parseInt(process.env["REQUEST_TIMEOUT"] || '30000', 10), // 30秒
    MAX_SIZE: process.env["MAX_REQUEST_SIZE"] || '5mb',
    RATE_LIMIT: {
      WINDOW_MS: 60000, // 1分钟
      MAX_REQUESTS: parseInt(process.env["MAX_REQUESTS_PER_MINUTE"] || '100', 10),
    }
  },

  // CORS配置
  CORS: {
    ORIGIN: process.env["CORS_ORIGIN"] || '*',
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    CREDENTIALS: false,
  },

  // 日志配置
  LOGGING: {
    LEVEL: process.env["LOG_LEVEL"] || 'info',
    FORMAT: process.env["LOG_FORMAT"] || 'combined',
    ENABLE_REQUEST_LOGGING: process.env["ENABLE_REQUEST_LOGGING"] !== 'false',
  },

  // 健康检查配置
  HEALTH: {
    ENABLED: process.env["ENABLE_HEALTH_CHECK"] !== 'false',
    PATH: '/api/health',
    INTERVAL: parseInt(process.env["HEALTH_CHECK_INTERVAL"] || '30000', 10), // 30秒
  },

  // API配置
  API: {
    VERSION: 'v1',
    BASE_PATH: '/api',
    PREFIX: process.env["API_PREFIX"] || '/api',
  },

  // 安全配置
  SECURITY: {
    ENABLE_RATE_LIMITING: process.env["ENABLE_RATE_LIMITING"] !== 'false',
    ENABLE_HELMET: process.env["ENABLE_HELMET"] !== 'false',
    TRUST_PROXY: process.env["TRUST_PROXY"] === 'true',
  }
};

// 服务器状态枚举
export enum ServerStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// 日志级别枚举
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 环境类型
export type Environment = 'development' | 'production' | 'test';

// 获取当前环境
export function getEnvironment(): Environment {
  const env = ServerConfig.SERVER.ENVIRONMENT.toLowerCase();
  switch (env) {
    case 'production':
      return 'production';
    case 'test':
      return 'test';
    default:
      return 'development';
  }
}

// 是否为开发环境
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

// 是否为生产环境
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

// 是否为测试环境
export function isTest(): boolean {
  return getEnvironment() === 'test';
}