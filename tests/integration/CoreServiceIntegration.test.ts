/**
 * 核心服务集成测试
 */

import { TreeSitterService } from '@/core/TreeSitterService';
import { SupportedLanguage } from '@/types/treeSitter';
import { CleanupStrategy } from '@/config/memory';

describe('核心服务集成测试', () => {
  let service: TreeSitterService;

  beforeEach(() => {
    service = new TreeSitterService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('服务生命周期', () => {
    test('应该能够完整地创建和销毁服务', () => {
      const health1 = service.getHealthStatus();
      expect(health1.status).toBe('healthy');
      
      service.destroy();
      
      // 服务销毁后应该能够重新创建
      const service2 = new TreeSitterService();
      const health2 = service2.getHealthStatus();
      expect(health2.status).toBe('healthy');
      
      service2.destroy();
    });
  });

  describe('多语言支持', () => {
    const testCases: Array<{
      language: SupportedLanguage;
      code: string;
      query: string;
      expectedType: string;
    }> = [
      {
        language: 'javascript',
        code: 'function test() { return 42; }',
        query: '(function_declaration) @func',
        expectedType: 'function_declaration',
      },
      {
        language: 'python',
        code: 'def test():\n    return 42',
        query: '(function_definition) @func',
        expectedType: 'function_definition',
      },
    ];

    test.each(testCases)('应该能够解析 $language 代码', async ({ language, code, query, expectedType }) => {
      const request = {
        language,
        code,
        query,
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0]?.type).toBe(expectedType);
    });
  });

  describe('并发处理', () => {
    test('应该能够处理多个并发请求', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        language: 'javascript' as SupportedLanguage,
        code: `function test${i}() { return ${i}; }`,
        query: '(function_declaration) @func',
      }));

      const promises = requests.map(request => service.processRequest(request));
      const results = await Promise.all(promises);

      results.forEach((result: any, index: number) => {
        expect(result.success).toBe(true);
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.matches[0].text).toContain(`test${index}`);
      });

      const health = service.getHealthStatus();
      expect(health.service.requestCount).toBe(5);
      expect(health.service.errorCount).toBe(0);
    });
  });

  describe('内存管理集成', () => {
    test('应该能够在内存压力下正常工作', async () => {
      // 执行多个请求以增加内存使用
      const requests = Array.from({ length: 10 }, (_, i) => ({
        language: 'javascript' as SupportedLanguage,
        code: `
          function test${i}() {
            const data = new Array(1000).fill(${i});
            return data.reduce((sum, val) => sum + val, 0);
          }
        `,
        query: '(function_declaration) @func',
      }));

      // 处理请求
      for (const request of requests) {
        await service.processRequest(request);
      }

      // 检查健康状态
      const health = service.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.service.requestCount).toBe(10);

      // 执行清理
      const cleanupResult = await service.performCleanup(CleanupStrategy.AGGRESSIVE);
      expect(cleanupResult.success).toBe(true);
    });

    test('应该能够监控内存使用趋势', async () => {
      // 执行一系列请求
      for (let i = 0; i < 5; i++) {
        await service.processRequest({
          language: 'javascript',
          code: `function test${i}() { return ${i}; }`,
          query: '(function_declaration) @func',
        });
      }

      const stats = service.getDetailedStats();
      expect(stats.memory).toHaveProperty('status');
      expect(stats.memory).toHaveProperty('trend');
      expect(stats.memory).toHaveProperty('stats');
      expect(stats.memory.stats.historyLength).toBeGreaterThan(0);
    });
  });

  describe('错误恢复', () => {
    test('应该能够从解析错误中恢复', async () => {
      // 先发送一个无效请求
      const invalidRequest = {
        language: 'javascript' as SupportedLanguage,
        code: 'function test(',
        query: '(function_declaration) @func',
      };

      const invalidResult = await service.processRequest(invalidRequest);
      expect(invalidResult.success).toBe(true); // 解析错误不应该导致请求失败

      // 再发送一个有效请求
      const validRequest = {
        language: 'javascript' as SupportedLanguage,
        code: 'function test() { return 42; }',
        query: '(function_declaration) @func',
      };

      const validResult = await service.processRequest(validRequest);
      expect(validResult.success).toBe(true);
      expect(validResult.matches.length).toBeGreaterThan(0);

      // 检查统计信息
      const health = service.getHealthStatus();
      expect(health.service.requestCount).toBe(2);
    });
  });

  describe('资源清理集成', () => {
    test('应该能够正确清理所有资源', async () => {
      // 执行一些请求
      await service.processRequest({
        language: 'javascript',
        code: 'function test() { return 42; }',
        query: '(function_declaration) @func',
      });

      await service.processRequest({
        language: 'python',
        code: 'def test():\n    return 42',
        query: '(function_definition) @func',
      });

      // 检查资源使用
      const healthBefore = service.getHealthStatus();
      expect(healthBefore.service.activeResources.trees).toBe(0); // 应该已经自动清理
      expect(healthBefore.service.activeResources.queries).toBe(0);

      // 执行紧急清理
      await service.emergencyCleanup();

      // 检查清理后的状态
      const healthAfter = service.getHealthStatus();
      expect(healthAfter.service.activeResources.trees).toBe(0);
      expect(healthAfter.service.activeResources.queries).toBe(0);
    });
  });

  describe('性能测试', () => {
    test('应该在合理时间内处理请求', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: `
          function complexFunction() {
            const data = new Array(100).fill(0).map((_, i) => i * 2);
            return data.filter(x => x % 4 === 0).reduce((sum, x) => sum + x, 0);
          }
        `,
        query: '(function_declaration) @func',
      };

      const startTime = Date.now();
      const result = await service.processRequest(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('配置验证', () => {
    test('应该能够处理不同配置的请求', async () => {
      // 测试单个查询
      const singleQueryResult = await service.processRequest({
        language: 'javascript',
        code: 'function test() { return 42; }',
        query: '(function_declaration) @func',
      });
      expect(singleQueryResult.success).toBe(true);

      // 测试多个查询
      const multipleQueriesResult = await service.processRequest({
        language: 'javascript',
        code: 'const x = 42; function test() { return x; }',
        queries: ['(variable_declaration) @var', '(function_declaration) @func'],
      });
      expect(multipleQueriesResult.success).toBe(true);

      // 测试无查询
      const noQueryResult = await service.processRequest({
        language: 'javascript',
        code: 'function test() { return 42; }',
      });
      expect(noQueryResult.success).toBe(true);
      expect(noQueryResult.matches).toHaveLength(0);
    });
  });
});