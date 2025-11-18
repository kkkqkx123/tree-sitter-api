/**
 * 解析路由 - 处理解析相关的HTTP请求
 */

import { Router, Request, Response } from 'express';
import { TreeSitterService } from '../core/TreeSitterService';
import { createParseController } from '../controllers/parseController';
import {
  validateParseRequest,
  requestSizeLimit,
  defaultConcurrencyLimiter,
} from '../middleware/validation';
import { log } from '../utils/Logger';

/**
 * 创建解析路由
 */
export default function createParseRoutes(service: TreeSitterService): Router {
  const router = Router();
  const controller = createParseController(service);

  /**
   * POST /api/parse
   * 解析代码并执行Tree-sitter查询
   */
  router.post(
    '/',
    requestSizeLimit(),
    defaultConcurrencyLimiter.middleware(),
    validateParseRequest,
    async (req: Request, res: Response) => {
      await controller.parseCode(req, res);
    },
  );

  /**
   * POST /api/parse/batch
   * 批量解析代码
   */
  router.post(
    '/batch',
    requestSizeLimit(10 * 1024 * 1024), // 10MB for batch requests
    defaultConcurrencyLimiter.middleware(),
    async (req: Request, res: Response) => {
      await controller.parseBatch(req, res);
    },
  );

  /**
   * POST /api/parse/validate
   * 验证查询语法
   */
  router.post(
    '/validate',
    requestSizeLimit(1024 * 1024), // 1MB for validation requests
    async (req: Request, res: Response) => {
      await controller.validateQuery(req, res);
    },
  );

  // 路由级别的中间件 - 记录路由访问
  router.use((req: Request, _res: Response, next: any) => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    log.debug(
      'ParseRoutes',
      `Parse route accessed - RequestID: ${requestId}, Path: ${req.path}, Method: ${req.method}`,
    );
    next();
  });

  return router;
}

// 导出默认路由创建函数
export { createParseRoutes };
