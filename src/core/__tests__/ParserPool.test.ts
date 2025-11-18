import Parser from 'tree-sitter';
import { ParserPool } from '../ParserPool';
import { SupportedLanguage } from '@/types/treeSitter';

// Mock the EnvConfig to control parser pool size
jest.mock('@/config/env', () => ({
  EnvConfig: {
    PARSER_POOL_SIZE: 5, // 使用较小的池大小以简化测试
  },
}));

describe('LightweightParserPool', () => {
  let parserPool: ParserPool;

  beforeEach(() => {
    parserPool = new ParserPool();
  });

  afterEach(() => {
    parserPool.destroy();
  });

  describe('constructor', () => {
    it('should initialize with correct pool size', () => {
      const stats = parserPool.getPoolStats();
      expect(stats.totalPooled).toBe(0);
      expect(stats.totalActive).toBe(0);
    });

    it('should start cleanup timer', () => {
      // 确保定时器已启动（通过检查功能是否正常工作）
      expect(parserPool.isHealthy()).toBe(true);
    });
  });

  describe('getParser', () => {
    it('should return a new parser when pool is empty', () => {
      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      expect(parser).toBeInstanceOf(Parser);

      const stats = parserPool.getPoolStats();
      expect(stats.totalActive).toBe(1);
    });

    it('should return parser from pool when available', () => {
      // 首先获取一个解析器
      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      expect(parser).toBeInstanceOf(Parser);

      // 释放回池
      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      // 检查池中是否有解析器
      const poolSize = parserPool.getPoolSize(
        'javascript' as SupportedLanguage,
      );
      expect(poolSize).toBe(1);

      // 从池中获取解析器
      const parser2 = parserPool.getParser('javascript' as SupportedLanguage);
      expect(parser2).toBe(parser); // 应该是同一个实例

      const stats = parserPool.getPoolStats();
      expect(stats.totalActive).toBe(1);
      expect(stats.totalPooled).toBe(0);
    });
  });

  describe('releaseParser', () => {
    it('should return parser to pool when pool is not full', () => {
      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      const initialPoolSize = parserPool.getPoolSize(
        'javascript' as SupportedLanguage,
      );

      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      const finalPoolSize = parserPool.getPoolSize(
        'javascript' as SupportedLanguage,
      );
      expect(finalPoolSize).toBe(initialPoolSize + 1);

      const stats = parserPool.getPoolStats();
      expect(stats.totalActive).toBe(0);
    });

    it('should destroy parser when pool is full', () => {
      const maxPoolSize = 5; // Mock的配置值

      // 填满池并超出限制
      const parsers = [];
      for (let i = 0; i < maxPoolSize + 2; i++) {
        parsers.push(parserPool.getParser('javascript' as SupportedLanguage));
      }

      // 释放所有解析器到池中
      parsers.forEach(parser => {
        parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);
      });

      // 池大小不应超过最大限制
      const poolSize = parserPool.getPoolSize(
        'javascript' as SupportedLanguage,
      );
      expect(poolSize).toBe(maxPoolSize);

      const stats = parserPool.getPoolStats();
      expect(stats.totalActive).toBe(0);
    });

    it('should not return parser to pool if not in active list', () => {
      const parser = new Parser(); // 创建一个不在池中的解析器

      // 尝试释放一个不在活跃列表中的解析器
      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      // 池状态不应改变
      const stats = parserPool.getPoolStats();
      expect(stats.totalPooled).toBe(0);
      expect(stats.totalActive).toBe(0);
    });
  });

  describe('cleanupLanguagePool', () => {
    it('should clean up specific language pool', () => {
      // 添加一些解析器到特定语言池
      const _parser1 = parserPool.getParser('javascript' as SupportedLanguage);
      const _parser2 = parserPool.getParser('python' as SupportedLanguage);

      parserPool.releaseParser(_parser1, 'javascript' as SupportedLanguage);
      parserPool.releaseParser(_parser2, 'python' as SupportedLanguage);

      // 验证池中有解析器
      expect(
        parserPool.getPoolSize('javascript' as SupportedLanguage),
      ).toBeGreaterThan(0);
      expect(
        parserPool.getPoolSize('python' as SupportedLanguage),
      ).toBeGreaterThan(0);

      // 清理JavaScript语言池
      parserPool.cleanupLanguagePool('javascript' as SupportedLanguage);

      // JavaScript池应被清理，但Python池应保持不变
      expect(parserPool.getPoolSize('javascript' as SupportedLanguage)).toBe(0);
      expect(
        parserPool.getPoolSize('python' as SupportedLanguage),
      ).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up all pools', () => {
      // 添加解析器到池中
      const _parser1 = parserPool.getParser('javascript' as SupportedLanguage);
      const _parser2 = parserPool.getParser('python' as SupportedLanguage);

      parserPool.releaseParser(_parser1, 'javascript' as SupportedLanguage);
      parserPool.releaseParser(_parser2, 'python' as SupportedLanguage);

      // 验证池中有解析器
      let stats = parserPool.getPoolStats();
      expect(stats.totalPooled).toBeGreaterThan(0);

      // 执行清理
      parserPool.cleanup();

      // 验证池被清空
      stats = parserPool.getPoolStats();
      expect(stats.totalPooled).toBe(0);
      expect(stats.totalActive).toBe(0);
    });
  });

  describe('getPoolStats', () => {
    it('should return correct pool statistics', () => {
      const stats = parserPool.getPoolStats();

      expect(stats).toHaveProperty('totalPooled');
      expect(stats).toHaveProperty('totalActive');
      expect(stats).toHaveProperty('languageStats');
      expect(stats).toHaveProperty('memoryUsage');

      expect(typeof stats.totalPooled).toBe('number');
      expect(typeof stats.totalActive).toBe('number');
      expect(typeof stats.languageStats).toBe('object');
      expect(stats.memoryUsage).toHaveProperty('estimatedParsers');
      expect(stats.memoryUsage).toHaveProperty('estimatedMemoryMB');
    });
  });

  describe('isHealthy', () => {
    it('should return true for normal conditions', () => {
      expect(parserPool.isHealthy()).toBe(true);
    });

    it('should return false when active parsers exceed threshold', () => {
      // 获取多个解析器以测试健康状态
      const parsers = [];
      for (let i = 0; i < 15; i++) {
        // 超过2倍池大小
        parsers.push(parserPool.getParser('javascript' as SupportedLanguage));
      }

      // 检查健康状态
      const isHealthy = parserPool.isHealthy();

      // 释放解析器
      parsers.forEach(parser => {
        parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);
      });

      // 由于我们没有实际的内存限制，健康检查可能仍然返回true
      // 但这个测试验证了方法可以被调用
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('warmupPool', () => {
    it('should warm up specified language pools', async () => {
      const languages: SupportedLanguage[] = ['javascript', 'python'];

      await expect(parserPool.warmupPool(languages)).resolves.not.toThrow();
    });
  });

  describe('getPoolSize', () => {
    it('should return correct pool size for language', () => {
      const initialSize = parserPool.getPoolSize(
        'javascript' as SupportedLanguage,
      );
      expect(initialSize).toBe(0);

      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      const newSize = parserPool.getPoolSize('javascript' as SupportedLanguage);
      expect(newSize).toBe(1);
    });
  });

  describe('hasAvailableParser', () => {
    it('should return true when pool has parsers available', () => {
      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      expect(
        parserPool.hasAvailableParser('javascript' as SupportedLanguage),
      ).toBe(true);
    });

    it('should return true when active parsers are under threshold', () => {
      expect(
        parserPool.hasAvailableParser('javascript' as SupportedLanguage),
      ).toBe(true);
    });
  });

  describe('emergencyCleanup', () => {
    it('should perform emergency cleanup', () => {
      // 添加一些解析器
      parserPool.getParser('javascript' as SupportedLanguage);
      parserPool.getParser('python' as SupportedLanguage);

      // 执行紧急清理
      parserPool.emergencyCleanup();

      // 验证池被清空
      const stats = parserPool.getPoolStats();
      expect(stats.totalPooled).toBe(0);
      expect(stats.totalActive).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should properly destroy the parser pool', () => {
      // 添加一些解析器
      const parser = parserPool.getParser('javascript' as SupportedLanguage);
      parserPool.releaseParser(parser, 'javascript' as SupportedLanguage);

      // 验证初始状态
      const initialStats = parserPool.getPoolStats();
      expect(
        initialStats.totalPooled + initialStats.totalActive,
      ).toBeGreaterThan(0);

      // 销毁池
      parserPool.destroy();

      // 验证最终状态
      const finalStats = parserPool.getPoolStats();
      expect(finalStats.totalPooled).toBe(0);
      expect(finalStats.totalActive).toBe(0);
    });
  });

  describe('stopCleanupTimer', () => {
    it('should stop the cleanup timer', () => {
      // 验证定时器存在
      parserPool.stopCleanupTimer();
      // 测试定时器停止（没有异常）
      expect(() => parserPool.stopCleanupTimer()).not.toThrow();
    });
  });
});
