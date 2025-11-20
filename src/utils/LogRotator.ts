/**
 * 日志轮转管理器
 * 支持环境变量配置：
 * - 单个文件超过配置大小时轮转
 * - 每天0点时轮转
 * - 清理超过配置天数的文件
 * - 总体积超过配置大小时，从旧到新删除，直到<配置阈值或仅剩最新文件
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LogRotatorOptions {
  maxSize: number; // 单个文件最大大小
  maxTotalSize: number; // 日志总大小上限
  cleanupThreshold: number; // 清理阈值
  maxAgeDays: number; // 最大保留天数
}

export class LogRotator {
  private directory: string;
  private filename: string;
  private baseFilename: string;
  private lastRotationDate: Date = new Date();
  private options: LogRotatorOptions;

  constructor(directory: string, filename: string, options: LogRotatorOptions) {
    this.directory = directory;
    this.filename = filename;
    this.baseFilename = filename.replace(/\.[^.]+$/, ''); // 移除扩展名
    this.options = options;
  }

  /**
   * 检查是否需要轮转（大小或日期）
   */
  shouldRotate(currentSize: number): boolean {
    // 按大小轮转
    if (currentSize >= this.options.maxSize) {
      return true;
    }

    // 按日期轮转：跨天
    try {
      const now = new Date();
      const lastDate = this.lastRotationDate;
      if (
        now.getDate() !== lastDate.getDate() ||
        now.getMonth() !== lastDate.getMonth() ||
        now.getFullYear() !== lastDate.getFullYear()
      ) {
        return true;
      }
    } catch (error) {
      console.error('Error checking date rotation:', error);
      // 如果日期检查失败，仍然按大小轮转
      return currentSize >= this.options.maxSize;
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
   * 1. 删除超过配置天数的文件
   * 2. 如果总体积>配置大小，从旧到新删除，直到<配置阈值或仅剩最新文件
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
      const maxAgeMs = this.options.maxAgeDays * 24 * 60 * 60 * 1000;

      // 步骤1：删除超过配置天数的文件
      for (const file of fileStats) {
        if (now - file.mtime > maxAgeMs) {
          fs.unlinkSync(file.path);
        }
      }

      // 步骤2：检查总体积，如果>配置大小则从旧到新删除
      let totalSize = this.getTotalLogSize();

      if (totalSize > this.options.maxTotalSize) {
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

        // 从旧到新删除，直到总体积<配置阈值或仅剩一个文件
        for (const file of remainingFiles) {
          if (remainingFiles.length <= 1) {
            break; // 至少保留最新的一个文件
          }

          fs.unlinkSync(file.path);
          totalSize -= file.size;

          if (totalSize < this.options.cleanupThreshold) {
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