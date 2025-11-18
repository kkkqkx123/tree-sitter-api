/**
 * 简化的日志模块
 * 解决现有console日志的核心缺陷：无级别控制、无统一格式
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      case 'fatal': return LogLevel.FATAL;
      default: return LogLevel.INFO;
    }
  }

  private getCurrentLevel(): LogLevel {
    return this.parseLogLevel(process.env["LOG_LEVEL"] || 'info');
  }

  private isTimestampEnabled(): boolean {
    return process.env["ENABLE_LOG_TIMESTAMP"] !== 'false';
  }

  private isModuleEnabled(): boolean {
    return process.env["ENABLE_LOG_MODULE"] !== 'false';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.getCurrentLevel();
  }

  private formatMessage(level: string, module: string, message: string): string {
    const parts: string[] = [];

    if (this.isTimestampEnabled()) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${level}]`);

    if (this.isModuleEnabled() && module) {
      parts.push(`[${module}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  debug(module: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', module, message), ...args);
    }
  }

  info(module: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', module, message), ...args);
    }
  }

  warn(module: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', module, message), ...args);
    }
  }

  error(module: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', module, message), ...args);
    }
  }

  fatal(module: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      console.error(this.formatMessage('FATAL', module, message), ...args);
    }
  }

  // 兼容性方法：保持与console.log相同的接口
  log(module: string, message: string, ...args: any[]): void {
    this.info(module, message, ...args);
  }

  // 测试辅助方法
  _shouldLog(level: LogLevel): boolean {
    return this.shouldLog(level);
  }
}

// 全局实例
export const logger = Logger.getInstance();

// 便捷的导出对象，保持简洁的调用方式
export const log = {
  debug: (module: string, message: string, ...args: any[]) => logger.debug(module, message, ...args),
  info: (module: string, message: string, ...args: any[]) => logger.info(module, message, ...args),
  warn: (module: string, message: string, ...args: any[]) => logger.warn(module, message, ...args),
  error: (module: string, message: string, ...args: any[]) => logger.error(module, message, ...args),
  fatal: (module: string, message: string, ...args: any[]) => logger.fatal(module, message, ...args),
  log: (module: string, message: string, ...args: any[]) => logger.log(module, message, ...args)
};