/**
 * 健康检查路由 - 处理健康检查相关的HTTP请求
 */

import { Router, Request, Response } from 'express';
import { TreeSitterService } from '../core/TreeSitterService';
import { createHealthController } from '../controllers/healthController';
import { log } from '../utils/Logger';

/**
 * 创建健康检查路由
 */
export default function createHealthRoutes(service: TreeSitterService): Router {
  const router = Router();
  const controller = createHealthController(service);

  /**
   * GET /api/health
   * 基本健康检查
   */
  router.get('/', async (req: Request, res: Response) => {
    await controller.basicHealthCheck(req, res);
  });

  /**
   * GET /api/health/detailed
   * 详细健康检查
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    await controller.detailedHealthCheck(req, res);
  });

  /**
   * GET /api/health/memory
   * 内存使用情况
   */
  router.get('/memory', async (req: Request, res: Response) => {
    await controller.memoryUsage(req, res);
  });

  /**
   * GET /api/health/stats
   * 服务统计信息
   */
  router.get('/stats', async (req: Request, res: Response) => {
    await controller.serviceStats(req, res);
  });

  /**
   * POST /api/health/cleanup
   * 触发内存清理
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    await controller.triggerCleanup(req, res);
  });

  /**
   * POST /api/health/reset
   * 重置统计信息
   */
  router.post('/reset', async (req: Request, res: Response) => {
    await controller.resetStats(req, res);
  });

  // 路由级别的中间件 - 记录路由访问
  router.use((req: Request, _res: Response, next: any) => {
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    log.debug(
      'HealthRoutes',
      `Health route accessed - RequestID: ${requestId}, Path: ${req.path}, Method: ${req.method}`,
    );
    next();
  });

  return router;
}

// 导出默认路由创建函数
export { createHealthRoutes };
