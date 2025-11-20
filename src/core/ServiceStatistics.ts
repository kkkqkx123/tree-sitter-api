/**
 * 服务统计 - 收集和管理服务统计信息
 */

export interface IServiceStatistics {
  incrementRequestCount(): void;
  incrementErrorCount(): void;
  recordQueryTime(time: number): void;
  recordMatchCount(count: number): void;
  recordLanguageUsage(language: string): void;
  getStatistics(): ServiceStats;
  resetStatistics(): void;
  getLanguageStats(): Record<string, number>;
  getPerformanceStats(): PerformanceStats;
}

export interface ServiceStats {
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageQueryTime: number;
  totalQueryTime: number;
  totalMatches: number;
  averageMatchesPerQuery: number;
  languageUsage: Record<string, number>;
  mostUsedLanguage: string;
  uptime: number;
  timestamp: string;
}

export interface PerformanceStats {
  averageQueryTime: number;
  minQueryTime: number;
  maxQueryTime: number;
  totalQueries: number;
  slowQueries: number;
  fastQueries: number;
  queryTimeDistribution: Record<string, number>;
}

export class ServiceStatistics implements IServiceStatistics {
  private requestCount = 0;
  private errorCount = 0;
  private totalQueryTime = 0;
  private totalMatches = 0;
  private languageUsage: Record<string, number> = {};
  private queryTimes: number[] = [];
  private errorHistory: number[] = [];
  private startTime = Date.now();

  /**
   * 增加请求计数
   */
  public incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * 增加错误计数
   */
  public incrementErrorCount(): void {
    this.errorCount++;
    this.errorHistory.push(1);
    
    // 保持最近1000次错误记录
    if (this.errorHistory.length > 1000) {
      this.errorHistory.shift();
    }
  }

  /**
   * 记录查询时间
   */
  public recordQueryTime(time: number): void {
    this.totalQueryTime += time;
    this.queryTimes.push(time);
    
    // 保持最近1000次查询的时间记录
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }
  }

  /**
   * 记录匹配数量
   */
  public recordMatchCount(count: number): void {
    this.totalMatches += count;
  }

  /**
   * 记录语言使用情况
   */
  public recordLanguageUsage(language: string): void {
    this.languageUsage[language] = (this.languageUsage[language] || 0) + 1;
  }

  /**
   * 获取完整统计信息
   */
  public getStatistics(): ServiceStats {
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const averageQueryTime = this.requestCount > 0 ? this.totalQueryTime / this.requestCount : 0;
    const averageMatchesPerQuery = this.requestCount > 0 ? this.totalMatches / this.requestCount : 0;
    const mostUsedLanguage = this.getMostUsedLanguage();
    const uptime = Date.now() - this.startTime;

    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      totalQueryTime: Math.round(this.totalQueryTime * 100) / 100,
      totalMatches: this.totalMatches,
      averageMatchesPerQuery: Math.round(averageMatchesPerQuery * 100) / 100,
      languageUsage: { ...this.languageUsage },
      mostUsedLanguage,
      uptime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重置统计信息
   */
  public resetStatistics(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalQueryTime = 0;
    this.totalMatches = 0;
    this.languageUsage = {};
    this.queryTimes = [];
    this.errorHistory = [];
    this.startTime = Date.now();
  }

  /**
   * 获取语言使用统计
   */
  public getLanguageStats(): Record<string, number> {
    return { ...this.languageUsage };
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): PerformanceStats {
    if (this.queryTimes.length === 0) {
      return {
        averageQueryTime: 0,
        minQueryTime: 0,
        maxQueryTime: 0,
        totalQueries: 0,
        slowQueries: 0,
        fastQueries: 0,
        queryTimeDistribution: {},
      };
    }

    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const minQueryTime = sortedTimes[0]!;
    const maxQueryTime = sortedTimes[sortedTimes.length - 1]!;
    const averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;

    // 定义慢查询和快查询的阈值（毫秒）
    const slowThreshold = 1000;
    const fastThreshold = 100;

    const slowQueries = this.queryTimes.filter(time => time > slowThreshold).length;
    const fastQueries = this.queryTimes.filter(time => time < fastThreshold).length;

    // 查询时间分布
    const queryTimeDistribution = this.getQueryTimeDistribution();

    return {
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      minQueryTime: Math.round(minQueryTime * 100) / 100,
      maxQueryTime: Math.round(maxQueryTime * 100) / 100,
      totalQueries: this.queryTimes.length,
      slowQueries,
      fastQueries,
      queryTimeDistribution,
    };
  }

  /**
   * 获取最常用的语言
   */
  private getMostUsedLanguage(): string {
    let maxCount = 0;
    let mostUsedLanguage = '';

    for (const [language, count] of Object.entries(this.languageUsage)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedLanguage = language;
      }
    }

    return mostUsedLanguage;
  }

  /**
   * 获取查询时间分布
   */
  private getQueryTimeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      '0-10ms': 0,
      '10-50ms': 0,
      '50-100ms': 0,
      '100-500ms': 0,
      '500ms-1s': 0,
      '1s+': 0,
    };

    for (const time of this.queryTimes) {
      if (time < 10) {
        distribution['0-10ms']! ++;
      } else if (time < 50) {
        distribution['10-50ms']! ++;
      } else if (time < 100) {
        distribution['50-100ms']! ++;
      } else if (time < 500) {
        distribution['100-500ms']! ++;
      } else if (time < 1000) {
        distribution['500ms-1s']! ++;
      } else {
        distribution['1s+']! ++;
      }
    }

    return distribution;
  }

  /**
   * 获取错误率趋势 - 使用滑动窗口计算
   */
  public getErrorRateTrend(windowSize: number = 100): number[] {
    if (this.queryTimes.length === 0) {
      return [];
    }

    const result: number[] = [];
    const startIndex = Math.max(0, this.queryTimes.length - windowSize);

    let cumulativeErrors = 0;
    let cumulativeTotal = 0;

    // 计算起始位置之前的错误数
    for (let i = 0; i < startIndex; i++) {
      cumulativeTotal++;
      if (i < this.errorHistory.length && this.errorHistory[i] === 1) {
        cumulativeErrors++;
      }
    }

    // 计算滑动窗口内的错误率
    for (let i = startIndex; i < this.queryTimes.length; i++) {
      cumulativeTotal++;
      if (i < this.errorHistory.length && this.errorHistory[i] === 1) {
        cumulativeErrors++;
      }

      const errorRate = cumulativeTotal > 0 ? (cumulativeErrors / cumulativeTotal) * 100 : 0;
      result.push(Math.round(errorRate * 100) / 100);
    }

    return result;
  }

  /**
   * 获取吞吐量统计
   */
  public getThroughputStats(): {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  } {
    const uptimeInSeconds = (Date.now() - this.startTime) / 1000;
    const uptimeInMinutes = uptimeInSeconds / 60;
    const uptimeInHours = uptimeInMinutes / 60;

    return {
      requestsPerSecond: uptimeInSeconds > 0 ? Math.round((this.requestCount / uptimeInSeconds) * 100) / 100 : 0,
      requestsPerMinute: uptimeInMinutes > 0 ? Math.round((this.requestCount / uptimeInMinutes) * 100) / 100 : 0,
      requestsPerHour: uptimeInHours > 0 ? Math.round((this.requestCount / uptimeInHours) * 100) / 100 : 0,
    };
  }

  /**
   * 获取健康评分
   */
  public getHealthScore(): {
    overall: number;
    performance: number;
    reliability: number;
    usage: number;
  } {
    // 性能评分 (0-100)
    const performanceStats = this.getPerformanceStats();
    let performanceScore = 100;
    
    // 根据平均查询时间调整性能评分
    if (performanceStats.averageQueryTime > 1000) {
      performanceScore -= 30;
    } else if (performanceStats.averageQueryTime > 500) {
      performanceScore -= 20;
    } else if (performanceStats.averageQueryTime > 100) {
      performanceScore -= 10;
    }

    // 根据慢查询比例调整性能评分
    const slowQueryRatio = this.queryTimes.length > 0 ? performanceStats.slowQueries / this.queryTimes.length : 0;
    performanceScore -= slowQueryRatio * 50;

    // 可靠性评分 (0-100)
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    let reliabilityScore = 100 - errorRate * 2; // 每1%错误率减2分

    // 使用评分 (0-100)
    const throughputStats = this.getThroughputStats();
    let usageScore = Math.min(100, throughputStats.requestsPerMinute / 10); // 每分钟10个请求为满分

    // 整体评分
    const overallScore = (performanceScore + reliabilityScore + usageScore) / 3;

    return {
      overall: Math.round(overallScore),
      performance: Math.round(Math.max(0, performanceScore)),
      reliability: Math.round(Math.max(0, reliabilityScore)),
      usage: Math.round(Math.max(0, usageScore)),
    };
  }
}