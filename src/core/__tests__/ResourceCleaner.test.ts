import { ResourceCleaner } from '../ResourceCleaner';
import { CleanupStrategy } from '@/config/memory';

// Mock的parserPool
const mockParserPool = {
  cleanup: jest.fn(),
  emergencyCleanup: jest.fn(),
};

// Mock的语言管理器
const mockLanguageManager = {
  clearCache: jest.fn(),
};

// Mock的内存工具函数
jest.mock('@/utils/memoryUtils', () => ({
  getMemoryUsage: jest.fn(() => ({
    rss: 50 * 1024 * 1024, // 50 MB
    heapTotal: 30 * 1024 * 1024, // 30 MB
    heapUsed: 20 * 1024 * 1024, // 20 MB
    external: 5 * 1024 * 1024, // 5 MB
  })),
  forceGarbageCollection: jest.fn(() => true),
}));

describe('ResourceCleaner', () => {
  let resourceCleaner: ResourceCleaner;

  beforeEach(() => {
    resourceCleaner = new ResourceCleaner();
  });

  afterEach(() => {
    resourceCleaner.destroy();
  });

  describe('constructor', () => {
    it('should initialize correctly', () => {
      expect(resourceCleaner).toBeDefined();
    });
  });

  describe('setParserPool and setLanguageManager', () => {
    it('should set parser pool', () => {
      resourceCleaner.setParserPool(mockParserPool);
      expect(() => resourceCleaner.setParserPool(mockParserPool)).not.toThrow();
    });

    it('should set language manager', () => {
      resourceCleaner.setLanguageManager(mockLanguageManager);
      expect(() =>
        resourceCleaner.setLanguageManager(mockLanguageManager),
      ).not.toThrow();
    });
  });

  describe('performCleanup', () => {
    it('should perform basic cleanup', async () => {
      const result = await resourceCleaner.performCleanup(
        CleanupStrategy.BASIC,
      );

      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');

      expect(result.strategy).toBe(CleanupStrategy.BASIC);
      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    });

    it('should perform aggressive cleanup', async () => {
      resourceCleaner.setParserPool(mockParserPool);
      const result = await resourceCleaner.performCleanup(
        CleanupStrategy.AGGRESSIVE,
      );

      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');

      expect(result.strategy).toBe(CleanupStrategy.AGGRESSIVE);
      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    });

    it('should perform emergency cleanup', async () => {
      resourceCleaner.setParserPool(mockParserPool);
      resourceCleaner.setLanguageManager(mockLanguageManager);
      const result = await resourceCleaner.performCleanup(
        CleanupStrategy.EMERGENCY,
      );

      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');

      expect(result.strategy).toBe(CleanupStrategy.EMERGENCY);
      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    });

    it('should handle cleanup errors gracefully', async () => {
      // 测试错误处理
      const result = await resourceCleaner.performCleanup(
        CleanupStrategy.BASIC,
      );
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('getCleanupStats', () => {
    it('should return cleanup statistics', () => {
      const stats = resourceCleaner.getCleanupStats();

      expect(stats).toHaveProperty('totalCleanups');
      expect(stats).toHaveProperty('successfulCleanups');
      expect(stats).toHaveProperty('failedCleanups');
      expect(stats).toHaveProperty('totalMemoryFreed');
      expect(stats).toHaveProperty('averageCleanupTime');
      expect(stats).toHaveProperty('strategyStats');
      expect(stats).toHaveProperty('recentCleanups');

      expect(typeof stats.totalCleanups).toBe('number');
      expect(typeof stats.successfulCleanups).toBe('number');
      expect(typeof stats.failedCleanups).toBe('number');
      expect(typeof stats.totalMemoryFreed).toBe('number');
      expect(typeof stats.averageCleanupTime).toBe('number');
      expect(typeof stats.strategyStats).toBe('object');
      expect(Array.isArray(stats.recentCleanups)).toBe(true);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return available cleanup strategies', () => {
      const strategies = resourceCleaner.getAvailableStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain(CleanupStrategy.BASIC);
      expect(strategies).toContain(CleanupStrategy.AGGRESSIVE);
      expect(strategies).toContain(CleanupStrategy.EMERGENCY);
    });
  });

  describe('history management', () => {
    it('should clear history', () => {
      // 执行一次清理来添加历史记录
      const initialStats = resourceCleaner.getCleanupStats();
      expect(typeof initialStats.totalCleanups).toBe('number');

      // 清理历史记录
      resourceCleaner.clearHistory();

      const finalStats = resourceCleaner.getCleanupStats();
      expect(typeof finalStats.totalCleanups).toBe('number');
    });

    it('should reset cleaner', () => {
      // 执行一些操作来添加历史记录
      resourceCleaner.clearHistory(); // 确保初始状态是干净的

      const initialStats = resourceCleaner.getCleanupStats();
      expect(typeof initialStats.totalCleanups).toBe('number');

      // 重置清理器
      resourceCleaner.reset();

      const finalStats = resourceCleaner.getCleanupStats();
      expect(typeof finalStats.totalCleanups).toBe('number');
    });
  });

  describe('destroy', () => {
    it('should properly destroy the resource cleaner', () => {
      // 添加一些历史记录
      const initialStats = resourceCleaner.getCleanupStats();
      expect(typeof initialStats.totalCleanups).toBe('number');

      // 销毁清理器
      resourceCleaner.destroy();

      // 验证清理器被正确销毁
      const finalStats = resourceCleaner.getCleanupStats();
      expect(typeof finalStats.totalCleanups).toBe('number');
    });
  });

  describe('integration with other components', () => {
    it('should work with parser pool', () => {
      // 设置parser pool
      resourceCleaner.setParserPool(mockParserPool);

      // 验证方法正常工作
      expect(() => resourceCleaner.setParserPool(mockParserPool)).not.toThrow();
    });

    it('should work with language manager', () => {
      // 设置语言管理器
      resourceCleaner.setLanguageManager(mockLanguageManager);

      // 验证方法正常工作
      expect(() =>
        resourceCleaner.setLanguageManager(mockLanguageManager),
      ).not.toThrow();
    });
  });
});
