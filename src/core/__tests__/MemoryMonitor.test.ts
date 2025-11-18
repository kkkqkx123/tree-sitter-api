import { MemoryMonitor } from '../MemoryMonitor';
import { MemoryTrend } from '@/config/memory';

// Mock the memory utilities
jest.mock('@/utils/memoryUtils', () => ({
  getMemoryUsage: jest.fn(() => ({
    rss: 50 * 1024 * 1024, // 50 MB
    heapTotal: 30 * 1024 * 1024, // 30 MB
    heapUsed: 20 * 1024 * 1024, // 20 MB
    external: 5 * 1024 * 1024, // 5 MB
  })),
  forceGarbageCollection: jest.fn(() => true),
}));

describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;

  beforeEach(() => {
    memoryMonitor = new MemoryMonitor();
  });

  afterEach(() => {
    memoryMonitor.destroy();
  });

  describe('constructor', () => {
    it('should initialize correctly', () => {
      // 简化的监控器不再有复杂的历史记录设置
      expect(memoryMonitor).toBeDefined();
    });
  });

  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring correctly', () => {
      // 验证初始状态
      const initialStatus = memoryMonitor.getMonitoringStatus();
      expect(initialStatus.isMonitoring).toBe(false);

      // 启动监控
      memoryMonitor.startMonitoring(100); // 使用较小的间隔以便测试
      const startedStatus = memoryMonitor.getMonitoringStatus();
      expect(startedStatus.isMonitoring).toBe(true);

      // 停止监控
      memoryMonitor.stopMonitoring();
      const stoppedStatus = memoryMonitor.getMonitoringStatus();
      expect(stoppedStatus.isMonitoring).toBe(false);
    });

    it('should not start monitoring if already started', () => {
      memoryMonitor.startMonitoring(100);

      // 尝试再次启动（应该没有效果）
      memoryMonitor.startMonitoring(100);

      // 简单验证监控仍在运行
      const status = memoryMonitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);

      memoryMonitor.stopMonitoring();
    });
  });

  describe('checkMemory', () => {
    it('should return correct memory status', () => {
      const status = memoryMonitor.checkMemory();

      expect(status).toHaveProperty('level');
      expect(status).toHaveProperty('heapUsed');
      expect(status).toHaveProperty('heapTotal');
      expect(status).toHaveProperty('rss');
      expect(status).toHaveProperty('external');
      expect(status).toHaveProperty('trend');

      expect(['normal', 'warning', 'critical']).toContain(status.level);
      expect(typeof status.heapUsed).toBe('number');
      expect(typeof status.heapTotal).toBe('number');
      expect(typeof status.rss).toBe('number');
      expect(typeof status.external).toBe('number');
      expect(Object.values(MemoryTrend)).toContain(status.trend);
    });
  });

  describe('cleanup related methods', () => {
    it('should return correct cleanup status', () => {
      // 检查是否需要清理
      const shouldCleanup = memoryMonitor.shouldCleanup();
      expect(typeof shouldCleanup).toBe('boolean');

      // 检查是否需要强制GC
      const shouldForceGC = memoryMonitor.shouldForceGC();
      expect(typeof shouldForceGC).toBe('boolean');

      // 标记清理时间
      memoryMonitor.markCleanup();
      expect(memoryMonitor.shouldCleanup()).toBe(false);

      // 标记强制GC时间
      memoryMonitor.markForceGC();
      expect(memoryMonitor.shouldForceGC()).toBe(false);
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct memory statistics', () => {
      const stats = memoryMonitor.getMemoryStats();

      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('peak');
      expect(stats).toHaveProperty('trend');
      expect(stats).toHaveProperty('historyLength');

      expect(typeof stats.current).toBe('number');
      expect(typeof stats.peak).toBe('number');
      expect(Object.values(MemoryTrend)).toContain(stats.trend);
      expect(typeof stats.historyLength).toBe('number');

      // 由于简化了历史记录，现在只返回当前值作为峰值，历史长度为0
      expect(stats.historyLength).toBe(0);
      expect(stats.peak).toBe(stats.current);
    });
  });

  describe('getDetailedMemoryReport', () => {
    it('should return simplified memory report', () => {
      const report = memoryMonitor.getDetailedMemoryReport();

      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('process');

      expect(report.status).toHaveProperty('level');
      expect(report.stats).toHaveProperty('current');
    });
  });

  describe('performCleanup', () => {
    it('should perform memory cleanup', async () => {
      const result = await memoryMonitor.performCleanup();

      expect(result).toHaveProperty('beforeMemory');
      expect(result).toHaveProperty('afterMemory');
      expect(result).toHaveProperty('freedMemory');
      expect(result).toHaveProperty('gcPerformed');

      expect(typeof result.beforeMemory).toBe('number');
      expect(typeof result.afterMemory).toBe('number');
      expect(typeof result.freedMemory).toBe('number');
      expect(typeof result.gcPerformed).toBe('boolean');
    });
  });

  describe('resetHistory', () => {
    it('should reset monitoring history', () => {
      // 重置历史记录
      memoryMonitor.resetHistory();

      // 验证历史记录被清除
      const stats = memoryMonitor.getMemoryStats();
      expect(stats.historyLength).toBe(0);
    });
  });

  describe('getMonitoringStatus', () => {
    it('should return monitoring status', () => {
      const status = memoryMonitor.getMonitoringStatus();

      expect(status).toHaveProperty('isMonitoring');
      expect(status).toHaveProperty('uptime');

      expect(typeof status.isMonitoring).toBe('boolean');
      expect(typeof status.uptime).toBe('number');
    });
  });

  describe('destroy', () => {
    it('should properly destroy the memory monitor', () => {
      // 启动监控
      memoryMonitor.startMonitoring(100);

      // 验证初始状态
      const initialStatus = memoryMonitor.getMonitoringStatus();
      expect(initialStatus.isMonitoring).toBe(true);

      // 销毁监控器
      memoryMonitor.destroy();

      // 验证最终状态
      const finalStatus = memoryMonitor.getMonitoringStatus();
      expect(finalStatus.isMonitoring).toBe(false);
    });
  });

  describe('memory thresholds', () => {
    it('should handle different memory levels', () => {
      // 由于我们mock了内存使用，这里主要测试函数可以正常执行
      const status = memoryMonitor.checkMemory();
      expect(status.level).toBeDefined();
    });
  });
});
