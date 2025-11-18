# Logger 文件输出实现方案

## 方案概述

本方案为Logger系统增加**文件输出**、**智能日志轮转**功能，支持同时输出到console和文件。

### 核心特性

- ✅ 异步缓冲文件写入，高性能
- ✅ **自动轮转** - 文件>5MB或每天0点自动轮转
- ✅ **自动清理** - 删除超过7天的日志，保持总量<10MB
- ✅ 智能空间管理 - 日志溢出时从旧到新依次删除
- ✅ 支持console和file输出切换
- ✅ 向后兼容现有Logger接口

---

## 架构设计

### 1. 文件结构

```
src/utils/
├── Logger.ts              // 现有Logger（增强）
├── FileWriter.ts          // 新增：文件写入管理器
├── LogRotator.ts          // 新增：日志轮转管理器
└── LoggerFactory.ts       // 新增：Logger工厂（可选）

src/config/
├── logging.ts             // 新增：日志配置
└── server.ts              // 现有（补充日志配置）

.env.example               // 新增环境变量说明
```

### 2. 数据流

```
Log Message
    ↓
Logger.debug/info/warn/error/fatal
    ↓
formatMessage()
    ↓
┌─────────────────────────┐
│   shouldLog(level)?     │ ← 级别检查
└──────────┬──────────────┘
           ↓
    ┌──────────────┐
    │  输出路由    │
    └──────────────┘
    /              \
   /                \
console output    file output
   ↓                ↓
stdout/stderr   FileWriter
               (高性能缓冲)
                   ↓
               LogRotator
               (轮转检查)
```

---

## 实现细节

### 1. 日志配置（src/config/logging.ts）

```typescript
/**
 * 日志系统配置（简化版）
 * 
 * 硬编码策略：
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
  };

  module: {
    enabled: boolean;
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
  },

  module: {
    enabled: process.env['ENABLE_LOG_MODULE'] !== 'false',
  },
};

export function getLoggerConfig(overrides?: Partial<LoggerConfig>): LoggerConfig {
  return { ...defaultLoggerConfig, ...overrides };
}
```

### 2. 文件写入器（src/utils/FileWriter.ts）

```typescript
/**
 * 高性能文件写入器
 * 支持缓冲和周期性刷新
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FileWriterOptions {
  directory: string;
  filename: string;
  bufferSize?: number;
  flushInterval?: number;
}

export class FileWriter {
  private directory: string;
  private filename: string;
  private filepath: string;
  private buffer: string[] = [];
  private bufferSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isWriting: boolean = false;
  private queue: string[] = [];

  constructor(options: FileWriterOptions) {
    this.directory = options.directory;
    this.filename = options.filename;
    this.bufferSize = options.bufferSize || 65536; // 64KB
    this.flushInterval = options.flushInterval || 1000; // 1s

    this.filepath = path.join(this.directory, this.filename);
    this.ensureDirectory();
    this.startFlushTimer();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('Failed to flush logs:', err);
      });
    }, this.flushInterval);

    // 防止计时器阻止进程退出
    this.flushTimer.unref();
  }

  /**
   * 写入日志行
   */
  write(message: string): void {
    this.queue.push(message);

    // 缓冲区达到阈值时立即刷新
    const totalSize = this.queue.reduce((sum, msg) => sum + msg.length, 0);
    if (totalSize >= this.bufferSize) {
      this.flush().catch((err) => {
        console.error('Failed to flush logs:', err);
      });
    }
  }

  /**
   * 刷新缓冲区到文件
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isWriting) {
      return;
    }

    this.isWriting = true;
    const messages = this.queue.splice(0);

    try {
      const content = messages.join('\n') + '\n';
      await fs.promises.appendFile(this.filepath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to write log file:', error);
      // 将失败的消息重新入队（简单重试）
      this.queue.unshift(...messages);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * 获取当前文件路径
   */
  getFilepath(): string {
    return this.filepath;
  }

  /**
   * 获取文件大小（字节）
   */
  getFileSize(): number {
    try {
      const stats = fs.statSync(this.filepath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * 关闭写入器（应用关闭时调用）
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}
```

### 3. 日志轮转器（src/utils/LogRotator.ts）

```typescript
/**
 * 日志轮转管理器
 * 硬编码策略：
 * - 单个文件超过5MB时轮转
 * - 每天0点时轮转
 * - 清理超过7天的文件
 * - 总体积超过10MB时，从旧到新删除，直到<5MB或仅剩最新文件
 */

import * as fs from 'fs';
import * as path from 'path';

const ROTATION_SIZE = 5242880; // 5MB
const MAX_TOTAL_SIZE = 10485760; // 10MB
const CLEANUP_THRESHOLD = 5242880; // 5MB
const MAX_AGE_DAYS = 7; // 7天

export class LogRotator {
  private directory: string;
  private filename: string;
  private baseFilename: string;
  private lastRotationDate: Date = new Date();

  constructor(directory: string, filename: string) {
    this.directory = directory;
    this.filename = filename;
    this.baseFilename = filename.replace(/\.[^.]+$/, ''); // 移除扩展名
  }

  /**
   * 检查是否需要轮转（大小或日期）
   */
  shouldRotate(currentSize: number): boolean {
    // 按大小轮转：>5MB
    if (currentSize >= ROTATION_SIZE) {
      return true;
    }

    // 按日期轮转：跨天
    const now = new Date();
    const lastDate = this.lastRotationDate;
    if (
      now.getDate() !== lastDate.getDate() ||
      now.getMonth() !== lastDate.getMonth() ||
      now.getFullYear() !== lastDate.getFullYear()
    ) {
      return true;
    }

    return false;
  }

  /**
   * 执行日志轮转
   */
  async rotate(currentFilepath: string): Promise<void> {
    try {
      // 生成归档文件名：app-2024-01-15-14-30-45.log
      const timestamp = this.getTimestamp();
      const ext = path.extname(this.filename);
      const archivedName = `${this.baseFilename}-${timestamp}${ext}`;
      const archivedPath = path.join(this.directory, archivedName);

      // 重命名当前日志为归档文件
      fs.renameSync(currentFilepath, archivedPath);

      // 执行清理
      await this.cleanupOldFiles();

      this.lastRotationDate = new Date();
    } catch (error) {
      console.error('Failed to rotate log:', error);
    }
  }

  /**
   * 清理旧文件
   * 规则：
   * 1. 删除超过7天的文件
   * 2. 如果总体积>10MB，从旧到新删除，直到<5MB或仅剩最新文件
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.directory);
      const logFiles = files.filter(
        (f) =>
          f.startsWith(this.baseFilename) && f !== this.filename
      );

      if (logFiles.length === 0) {
        return;
      }

      // 获取文件统计信息
      const fileStats = logFiles.map((f) => {
        const filepath = path.join(this.directory, f);
        const stat = fs.statSync(filepath);
        return {
          name: f,
          path: filepath,
          size: stat.size,
          mtime: stat.mtime.getTime(),
        };
      });

      // 按修改时间升序排列（最旧的在前）
      fileStats.sort((a, b) => a.mtime - b.mtime);

      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // 步骤1：删除超过7天的文件
      for (const file of fileStats) {
        if (now - file.mtime > sevenDaysMs) {
          fs.unlinkSync(file.path);
        }
      }

      // 步骤2：检查总体积，如果>10MB则从旧到新删除
      let totalSize = this.getTotalLogSize();

      if (totalSize > MAX_TOTAL_SIZE) {
        // 重新读取当前文件列表
        const remainingFiles = fs.readdirSync(this.directory)
          .filter((f) => f.startsWith(this.baseFilename) && f !== this.filename)
          .map((f) => {
            const filepath = path.join(this.directory, f);
            const stat = fs.statSync(filepath);
            return {
              name: f,
              path: filepath,
              size: stat.size,
              mtime: stat.mtime.getTime(),
            };
          })
          .sort((a, b) => a.mtime - b.mtime);

        // 从旧到新删除，直到总体积<5MB或仅剩一个文件
        for (const file of remainingFiles) {
          if (remainingFiles.length <= 1) {
            break; // 至少保留最新的一个文件
          }

          fs.unlinkSync(file.path);
          totalSize -= file.size;

          if (totalSize < CLEANUP_THRESHOLD) {
            break;
          }

          // 移除已删除的文件
          remainingFiles.shift();
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * 计算日志目录总大小
   */
  private getTotalLogSize(): number {
    try {
      const files = fs.readdirSync(this.directory);
      const logFiles = files.filter(
        (f) =>
          f.startsWith(this.baseFilename) && f !== this.filename
      );

      return logFiles.reduce((total, f) => {
        const filepath = path.join(this.directory, f);
        try {
          const stat = fs.statSync(filepath);
          return total + stat.size;
        } catch {
          return total;
        }
      }, 0);
    } catch {
      return 0;
    }
  }

  /**
   * 生成时间戳（格式: YYYY-MM-DD-HH-mm-ss）
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  }
}
```

### 4. 增强的Logger（src/utils/Logger.ts - 修改）

```typescript
/**
 * 增强的日志模块
 * 支持console和文件输出、日志轮转
 */

import * as path from 'path';
import { FileWriter } from './FileWriter';
import { LogRotator } from './LogRotator';
import { LogFormat, LoggerConfig, getLoggerConfig } from '@/config/logging';

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

  private constructor(config?: LoggerConfig) {
    this.config = config || getLoggerConfig();
    this.initializeFileWriter();
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 初始化文件写入器
   */
  private initializeFileWriter(): void {
    if (!this.config.file.enabled) {
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
        this.config.file.filename
      );

      this.currentFileSize = this.fileWriter.getFileSize();
    } catch (error) {
      console.error('Failed to initialize file logger:', error);
      this.fileWriter = null;
      this.logRotator = null;
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
    message: string,
    format: LogFormat = this.config.format
  ): string {
    const parts: string[] = [];

    // 时间戳
    if (this.config.timestamps.enabled) {
      const timestamp =
        this.config.timestamps.format === 'iso'
          ? new Date().toISOString()
          : new Date().toLocaleString();
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

    if (format === LogFormat.JSON) {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
      });
    }

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

    // 输出到文件
    if (this.fileWriter) {
      this.writeToFile(formatted, level);
    }
  }

  /**
   * 写入文件并检查轮转
   */
  private writeToFile(message: string, level: string): void {
    if (!this.fileWriter || !this.logRotator) {
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
```

---

## 配置指南

### 硬编码策略（无需配置）

| 项目 | 值 | 说明 |
|------|-----|------|
| 轮转触发 | 5MB | 单个文件超过5MB时 |
| 日期轮转 | 每天0点 | 自动按日期轮转 |
| 清理期限 | 7天 | 删除超过7天的文件 |
| 总量限制 | 10MB | 超过则从旧到新删除 |
| 清理阈值 | 5MB | 清理时删除至此值以下 |
| 缓冲大小 | 64KB | 写入缓冲 |
| 刷新间隔 | 1秒 | 周期性刷新 |

### .env 环境变量（仅3个）

```bash
# 日志级别（可选）
LOG_LEVEL=info  # debug, info, warn, error, fatal

# Console输出（可选）
LOG_CONSOLE=true

# 文件输出
LOG_FILE=true                # 启用文件输出
LOG_DIR=./logs              # 日志目录（可选）
LOG_FILENAME=app.log        # 日志文件名（可选）

# 元数据
ENABLE_LOG_TIMESTAMP=true    # 输出时间戳（可选）
ENABLE_LOG_MODULE=true       # 输出模块名（可选）
```

### 使用示例

**基础使用**（兼容现有代码）：
```typescript
import { log } from '@/utils/Logger';

log.info('MyModule', 'Server started on port 4001');
log.error('MyModule', 'Failed to parse request', error);
```

**获取日志文件路径**：
```typescript
import { logger } from '@/utils/Logger';

const logFilePath = logger.getLogFilePath();
console.log(`Logs are written to: ${logFilePath}`);
```

**应用关闭时**（server.ts）：
```typescript
import { logger } from '@/utils/Logger';

process.on('SIGTERM', async () => {
  log.info('Server', 'Shutting down gracefully...');
  await logger.shutdown();
  process.exit(0);
});
```

---

## 迁移步骤

### 第一步：添加新文件

1. 创建 `src/config/logging.ts`
2. 创建 `src/utils/FileWriter.ts`
3. 创建 `src/utils/LogRotator.ts`

### 第二步：更新现有文件

1. 替换 `src/utils/Logger.ts`（保持向后兼容）
2. 更新 `.env.example` 添加新的环境变量

### 第三步：验证

```bash
# 1. 编译
npm run build

# 2. 启动应用
npm run dev

# 3. 检查日志文件是否生成
ls -la ./logs

# 4. 验证日志内容
cat ./logs/app.log
```

---

## 性能考虑

### 缓冲机制
- 消息先进入内存缓冲区
- 达到缓冲大小（默认64KB）或定时器触发时刷新
- 减少系统调用，提升吞吐量

### 异步写入
- 文件写入不阻塞日志调用
- 通过Promise处理写入错误

### 日志轮转
- 后台检查文件大小和日期
- 轮转时异步压缩和清理
- 不影响应用性能

### 内存占用
- 单个消息缓冲（避免大字符串连接）
- 定期刷新释放内存
- 超时保证最大延迟不超过1秒

---

## 故障排除

### 日志文件未生成

```bash
# 1. 检查目录权限
ls -la ./logs
chmod 755 ./logs

# 2. 检查配置
cat .env | grep LOG_FILE

# 3. 查看应用日志
npm run dev  # 查看控制台输出
```

### 文件写入缓慢或消息丢失

这通常不会发生，因为：
- 缓冲大小64KB，多数日志远小于此
- 刷新间隔1秒，保证最大延迟不超过1秒
- 应用关闭时自动刷新所有缓冲

如需更频繁的刷新，修改 `FileWriter.ts` 中的 `flushInterval` 值。

### 日志文件过大

系统会自动处理：
1. 单个文件>5MB时自动轮转
2. 总体积>10MB时自动删除旧文件
3. 超过7天的文件自动删除

检查 `./logs` 目录中是否有旧文件被清理。

---

## 完整示例

完整可运行示例（使用新Logger）：

```typescript
// src/server.ts
import express from 'express';
import { log, logger } from '@/utils/Logger';

const app = express();

// 在错误处理中间件中使用
app.use((err: any, req: any, res: any, next: any) => {
  log.error('ErrorHandler', `${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 应用启动
const PORT = process.env['PORT'] || 4001;
const server = app.listen(PORT, () => {
  log.info('Server', `Server running on port ${PORT}`);
  log.info('Server', `Logs directory: ${logger.getLogFilePath()}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  log.info('Server', 'Shutting down...');
  server.close(async () => {
    await logger.shutdown();
    process.exit(0);
  });
});
```

---

## 总结

本方案提供的特性：

| 特性 | 实现 |
|------|------|
| **文件输出** | 异步缓冲写入，高性能 |
| **大小轮转** | 5MB自动轮转 |
| **日期轮转** | 每天0点自动轮转 |
| **自动清理** | 删除超过7天的文件 |
| **空间管理** | 总量>10MB时智能删除 |
| **简化配置** | 仅需启用/禁用，无需细调 |
| **向后兼容** | 现有代码零改动 |
| **高性能** | 缓冲、异步、非阻塞 |

### 文件示例

启用文件输出后，日志目录结构：

```
logs/
├── app.log                      # 当前日志文件
├── app-2024-01-15-14-30-45.log  # 轮转的历史文件
├── app-2024-01-15-12-15-30.log  # 轮转的历史文件
└── app-2024-01-14-23-59-59.log  # 轮转的历史文件
```

清理规则自动执行：
- 删除所有7天前的文件
- 如总大小>10MB，从最旧的文件开始删除，直到<5MB或仅剩一个
