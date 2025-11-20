/**
 * 增强的日志模块
 * 支持console和文件输出、日志轮转
 */

import { FileWriter } from './FileWriter';
import { LogRotator } from './LogRotator';
import { LoggerConfig, getLoggerConfig } from '../config/logging';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private fileWriter: FileWriter | null = null;
  private logRotator: LogRotator | null = null;
  private currentFileSize: number = 0;
  private isInitialized: boolean = false;

  private constructor(config?: LoggerConfig) {
    this.config = config || getLoggerConfig();
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 延迟初始化文件写入器（在应用完全启动后调用）
   */
  public initializeFileWriter(): void {
    if (this.isInitialized || !this.config.file.enabled) {
      return;
    }

    try {
      this.fileWriter = new FileWriter({
        directory: this.config.file.directory,
        filename: this.config.file.filename,
        bufferSize: this.config.performance.bufferSize,
        flushInterval: this.config.performance.flushInterval,
      });

      this.logRotator = new LogRotator(
        this.config.file.directory,
        this.config.file.filename,
        this.config.rotation
      );

      this.currentFileSize = this.fileWriter.getFileSize();
      this.isInitialized = true;
      
      // 记录日志系统初始化完成
      this.info('Logger', `File logging initialized: ${this.fileWriter.getFilepath()}`);
    } catch (error) {
      console.error('Failed to initialize file logger:', error);
      this.fileWriter = null;
      this.logRotator = null;
      this.isInitialized = false;
    }
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'fatal':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
    }
  }

  private getCurrentLevel(): LogLevel {
    return this.parseLogLevel(this.config.level);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.getCurrentLevel();
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(
    level: string,
    module: string,
    message: string
  ): string {
    const parts: string[] = [];

    // 时间戳
    if (this.config.timestamps.enabled) {
      const timezone = this.config.timestamps.timezone || process.env.TZ || 'Asia/Shanghai';
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      parts.push(`[${timestamp}]`);
    }

    // 日志级别
    parts.push(`[${level}]`);

    // 模块名
    if (this.config.module.enabled && module) {
      parts.push(`[${module}]`);
    }

    // 消息
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * 执行日志写入
   */
  private performLog(
    level: string,
    module: string,
    message: string,
    logFn: (msg: string, ...args: any[]) => void,
    args: any[]
  ): void {
    if (!this.shouldLog(this.parseLogLevel(level))) {
      return;
    }

    const formatted = this.formatMessage(level, module, message);

    // 输出到console
    if (this.config.console.enabled) {
      logFn(formatted, ...args);
    }

    // 输出到文件 - only if file logging is enabled, writer exists, and initialized
    if (this.config.file.enabled && this.fileWriter && this.isInitialized) {
      this.writeToFile(formatted);
    }
  }

  /**
   * 写入文件并检查轮转
   */
  private writeToFile(message: string): void {
    if (!this.config.file.enabled || !this.fileWriter || !this.logRotator || !this.isInitialized) {
      return;
    }

    const messageLength = message.length + 1; // +1 for newline
    this.currentFileSize += messageLength;

    // 检查是否需要轮转
    if (this.logRotator.shouldRotate(this.currentFileSize)) {
      this.logRotator
        .rotate(this.fileWriter.getFilepath())
        .then(() => {
          // 轮转后重置大小和创建新的FileWriter
          this.currentFileSize = 0;
          this.fileWriter = new FileWriter({
            directory: this.config.file.directory,
            filename: this.config.file.filename,
            bufferSize: this.config.performance.bufferSize,
            flushInterval: this.config.performance.flushInterval,
          });
          this.fileWriter.write(message);
        })
        .catch((err) => {
          console.error('Failed to rotate logs:', err);
        });
    } else {
      this.fileWriter.write(message);
    }
  }

  // 公共日志方法
  debug(module: string, message: string, ...args: any[]): void {
    this.performLog('DEBUG', module, message, console.debug, args);
  }

  info(module: string, message: string, ...args: any[]): void {
    this.performLog('INFO', module, message, console.log, args);
  }

  warn(module: string, message: string, ...args: any[]): void {
    this.performLog('WARN', module, message, console.warn, args);
  }

  error(module: string, message: string, ...args: any[]): void {
    this.performLog('ERROR', module, message, console.error, args);
  }

  fatal(module: string, message: string, ...args: any[]): void {
    this.performLog('FATAL', module, message, console.error, args);
  }

  log(module: string, message: string, ...args: any[]): void {
    this.info(module, message, ...args);
  }

  /**
   * 获取日志配置
   */
  getConfig(): LoggerConfig {
    return this.config;
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string | null {
    return this.fileWriter?.getFilepath() || null;
  }

  /**
   * 检查文件日志是否已初始化
   */
  isFileLoggingInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 关闭logger（应用关闭时调用）
   */
  async shutdown(): Promise<void> {
    if (this.fileWriter) {
      await this.fileWriter.close();
    }
  }

  // 测试辅助
  _shouldLog(level: LogLevel): boolean {
    return this.shouldLog(level);
  }
}

// 全局实例
export const logger = Logger.getInstance();

// 便捷导出
export const log = {
  debug: (module: string, message: string, ...args: any[]) =>
    logger.debug(module, message, ...args),
  info: (module: string, message: string, ...args: any[]) =>
    logger.info(module, message, ...args),
  warn: (module: string, message: string, ...args: any[]) =>
    logger.warn(module, message, ...args),
  error: (module: string, message: string, ...args: any[]) =>
    logger.error(module, message, ...args),
  fatal: (module: string, message: string, ...args: any[]) =>
    logger.fatal(module, message, ...args),
  log: (module: string, message: string, ...args: any[]) =>
    logger.log(module, message, ...args),
};