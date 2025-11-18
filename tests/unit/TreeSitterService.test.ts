/**
 * TreeSitterService 单元测试
 */

import { TreeSitterService } from '@/core/TreeSitterService';
import { SupportedLanguage } from '@/types/treeSitter';

describe('TreeSitterService', () => {
  let service: TreeSitterService;

  beforeEach(() => {
    service = new TreeSitterService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('基本功能', () => {
    test('应该正确初始化服务', () => {
      expect(service).toBeInstanceOf(TreeSitterService);
      
      const health = service.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.service.requestCount).toBe(0);
      expect(health.service.errorCount).toBe(0);
    });

    test('应该返回支持的语言列表', () => {
      const languages = service.getSupportedLanguages();
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('typescript');
    });
  });

  describe('请求处理', () => {
    test('应该正确处理简单的JavaScript解析请求', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]?.captureName).toBe('func');
      expect(result.matches[0]?.type).toBe('function_declaration');
      expect(result.errors).toHaveLength(0);
    });

    test('应该正确处理多个查询', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: 'const x = 42; function test() { return x; }',
        queries: [
          '(variable_declaration) @var',
          '(function_declaration) @func',
        ],
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('应该正确处理不支持的语言', async () => {
      const request = {
        language: 'unsupported' as SupportedLanguage,
        code: 'some code',
        query: '(test) @test',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unsupported language');
    });

    test('应该正确处理无效的查询语法', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: 'function test() {}',
        query: 'invalid query syntax',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(true); // 查询失败不应该影响整体请求
      expect(result.matches).toHaveLength(0);
    });

    test('应该正确处理空代码', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: '',
        query: '(function_declaration) @func',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理缺少必需字段的请求', async () => {
      const request: any = {
        language: 'javascript' as SupportedLanguage,
        // 缺少 code 字段
        query: '(function_declaration) @func',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Missing required fields');
    });

    test('应该正确处理过大的代码', async () => {
      const largeCode = 'x'.repeat(200000); // 超过默认限制
      
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: largeCode,
        query: '(identifier) @id',
      };

      const result = await service.processRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum allowed size');
    });
  });

  describe('健康检查', () => {
    test('应该返回正确的健康状态', () => {
      const health = service.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('parserPool');
      expect(health).toHaveProperty('languageManager');
      expect(health).toHaveProperty('service');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.service.requestCount).toBe(0);
      expect(health.service.errorCount).toBe(0);
      expect(health.service.errorRate).toBe(0);
    });

    test('应该正确更新统计信息', async () => {
      const request = {
        language: 'javascript' as SupportedLanguage,
        code: 'function test() { return "hello"; }',
        query: '(function_declaration) @func',
      };

      await service.processRequest(request);
      
      const health = service.getHealthStatus();
      expect(health.service.requestCount).toBe(1);
      expect(health.service.errorCount).toBe(0);
    });
  });

  describe('内存管理', () => {
    test('应该能够执行内存清理', async () => {
      const cleanupResult = await service.performCleanup();
      
      expect(cleanupResult).toHaveProperty('memoryFreed');
      expect(cleanupResult).toHaveProperty('duration');
      expect(cleanupResult).toHaveProperty('success');
      expect(typeof cleanupResult.memoryFreed).toBe('number');
      expect(typeof cleanupResult.duration).toBe('number');
      expect(typeof cleanupResult.success).toBe('boolean');
    });

    test('应该能够获取详细统计信息', () => {
      const stats = service.getDetailedStats();
      
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('cleanup');
      
      expect(stats.health).toHaveProperty('status');
      expect(stats.memory).toHaveProperty('status');
      expect(stats.cleanup).toHaveProperty('totalCleanups');
    });
  });

  describe('资源管理', () => {
    test('应该能够重置统计信息', () => {
      service.resetStats();
      
      const health = service.getHealthStatus();
      expect(health.service.requestCount).toBe(0);
      expect(health.service.errorCount).toBe(0);
    });

    test('应该能够预加载语言', async () => {
      await service.preloadLanguages(['javascript', 'python']);
      
      const health = service.getHealthStatus();
      expect(health.languageManager.loadedLanguages).toContain('javascript');
      expect(health.languageManager.loadedLanguages).toContain('python');
    });
  });
});