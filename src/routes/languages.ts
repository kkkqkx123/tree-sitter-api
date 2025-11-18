/**
 * 语言列表路由 - 处理语言列表相关的HTTP请求
 */

import { Router, Request, Response } from 'express';
import { TreeSitterService } from '@/core/TreeSitterService';
import { createLanguagesController } from '@/controllers/languagesController';
import { validateRequest } from '@/middleware/validation';
import { log } from '@/utils/Logger';

/**
 * 创建语言列表路由
 */
export default function createLanguagesRoutes(service: TreeSitterService): Router {
  const router = Router();
  const controller = createLanguagesController(service);

  /**
   * GET /api/languages
   * 获取支持的语言列表
   */
  router.get('/', async (req: Request, res: Response) => {
    await controller.getSupportedLanguages(req, res);
  });

  /**
   * GET /api/languages/:language
   * 获取语言详细信息
   */
  router.get('/:language', async (req: Request, res: Response) => {
    await controller.getLanguageInfo(req, res);
  });

  /**
   * GET /api/languages/:language/examples
   * 获取语言查询示例
   */
  router.get('/:language/examples', async (req: Request, res: Response) => {
    await controller.getLanguageExamples(req, res);
  });

  /**
   * POST /api/languages/preload
   * 预加载语言
   */
  router.post(
    '/preload',
    validateRequest((req: Request) => {
      // 验证请求体中的语言数组（如果提供）
      if (req.body.languages) {
        if (!Array.isArray(req.body.languages)) {
          throw new Error('Languages must be an array');
        }

        // 验证每个语言是否为字符串
        for (const lang of req.body.languages) {
          if (typeof lang !== 'string') {
            throw new Error('Each language must be a string');
          }
        }
      }
    }),
    async (req: Request, res: Response) => {
      await controller.preloadLanguage(req, res);
    }
  );

  // 路由级别的中间件 - 记录路由访问
  router.use((req: Request, _res: Response, next: any) => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    log.debug('LanguagesRoutes', `Languages route accessed - RequestID: ${requestId}, Path: ${req.path}, Method: ${req.method}`);
    next();
  });

  return router;
}

// 导出默认路由创建函数
export { createLanguagesRoutes };