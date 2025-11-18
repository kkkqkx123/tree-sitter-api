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