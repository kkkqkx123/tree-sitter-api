/**
 * API服务器测试 - 使用Node.js内置http模块
 */

import http from 'http';
import TreeSitterServer from '@/server';

describe('API Server', () => {
  let server: TreeSitterServer;
  let app: any;
  let httpServer: http.Server;
  const baseUrl = 'http://localhost:3001';

  beforeAll(async () => {
    server = new TreeSitterServer();
    app = server.getApp();

    // 创建HTTP服务器用于测试
    httpServer = http.createServer(app);

    // 使用不同的端口避免冲突
    await new Promise<void>((resolve) => {
      httpServer.listen(baseUrl, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // 关闭HTTP服务器
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    }

    // 清理资源
    if (server) {
      server.getService().destroy();
    }
  });

  // 辅助函数：发送HTTP请求
  async function makeRequest(path: string, options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}) {
    const { method = 'GET', body, headers = {} } = options;

    return new Promise<{
      statusCode: number;
      data: any;
      headers: http.IncomingHttpHeaders;
    }>((resolve, reject) => {
      const requestOptions: http.RequestOptions = {
        hostname: 'localhost',
        port: baseUrl,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode || 500, // 提供默认值
              data: parsedData,
              headers: res.headers
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  describe('GET /', () => {
    it('should return server information', async () => {
      const response = await makeRequest('/');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('name', 'Tree-sitter API');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('status', 'running');
      expect(response.data).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await makeRequest('/api/health');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('memory');
      expect(response.data.data).toHaveProperty('supportedLanguages');
      expect(response.data.data).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/languages', () => {
    it('should return supported languages', async () => {
      const response = await makeRequest('/api/languages');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('languages');
      expect(Array.isArray(response.data.data.languages)).toBe(true);
      expect(response.data.data.languages.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/parse', () => {
    it('should parse JavaScript code', async () => {
      const response = await makeRequest('/api/parse', {
        method: 'POST',
        body: {
          language: 'javascript',
          code: 'function hello() { console.log("Hello"); }',
          query: '(function_declaration) @func'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should return error for invalid language', async () => {
      const response = await makeRequest('/api/parse', {
        method: 'POST',
        body: {
          language: 'invalid_lang',
          code: 'test code',
          query: '(function_declaration) @func'
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
      expect(response.data.errors.length).toBeGreaterThan(0);
    });

    it('should return error for missing required fields', async () => {
      const response = await makeRequest('/api/parse', {
        method: 'POST',
        body: {
          code: 'test code'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
      expect(response.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/parse/validate', () => {
    it('should validate query syntax', async () => {
      const response = await makeRequest('/api/parse/validate', {
        method: 'POST',
        body: {
          language: 'javascript',
          query: '(function_declaration) @func'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('valid');
    });

    it('should return error for invalid query', async () => {
      const response = await makeRequest('/api/parse/validate', {
        method: 'POST',
        body: {
          language: 'javascript',
          query: 'invalid query syntax'
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('valid', false);
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await makeRequest('/api/health/detailed');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('health');
      expect(response.data.data).toHaveProperty('memory');
      expect(response.data.data).toHaveProperty('cleanup');
      expect(response.data.data).toHaveProperty('uptime');
    });
  });

  describe('GET /api/health/memory', () => {
    it('should return memory usage information', async () => {
      const response = await makeRequest('/api/health/memory');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('current');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('gc');
    });
  });

  describe('GET /api/languages/:language', () => {
    it('should return language information for JavaScript', async () => {
      const response = await makeRequest('/api/languages/javascript');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('name', 'JavaScript');
      expect(response.data.data).toHaveProperty('extensions');
      expect(response.data.data).toHaveProperty('mimeType');
    });

    it('should return 404 for unsupported language', async () => {
      const response = await makeRequest('/api/languages/unsupported_lang');

      expect(response.statusCode).toBe(404);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
    });
  });

  describe('GET /api/languages/:language/examples', () => {
    it('should return query examples for JavaScript', async () => {
      const response = await makeRequest('/api/languages/javascript/examples');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('language', 'javascript');
      expect(response.data.data).toHaveProperty('examples');
      expect(Array.isArray(response.data.data.examples)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await makeRequest('/unknown-route');

      expect(response.statusCode).toBe(404);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
    });

    it('should handle large requests', async () => {
      const largeCode = 'x'.repeat(200 * 1024); // 200KB

      const response = await makeRequest('/api/parse', {
        method: 'POST',
        body: {
          language: 'javascript',
          code: largeCode,
          query: '(identifier) @id'
        }
      });

      expect(response.statusCode).toBe(413);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('errors');
    });
  });
});