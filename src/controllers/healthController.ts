/**
 * 健康检查控制器 - 提供服务器健康状态信息
 */

import { Request, Response } from 'express';
import { TreeSitterService } from '@/core/TreeSitterService';
import { ApiResponse, HealthResponse } from '@/types/api';
import { log } from '@/utils/Logger';

/**
 * 创建健康检查控制器
 */
export const createHealthController = (service: TreeSitterService) => {
  /**
   * 基本健康检查
   */
  const basicHealthCheck = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      log.debug('HealthController', `Basic health check - RequestID: ${requestId}`);

      // 获取基本健康状态
      const healthStatus = service.getHealthStatus();
      
      // 构建响应
      const response: ApiResponse<HealthResponse> = {
        success: true,
        data: {
          status: healthStatus.status,
          memory: {
            rss: healthStatus.memory.rss,
            heapTotal: healthStatus.memory.heapTotal,
            heapUsed: healthStatus.memory.heapUsed,
            external: healthStatus.memory.external,
          },
          supportedLanguages: service.getSupportedLanguages(),
          timestamp: healthStatus.timestamp,
        },
        timestamp: new Date().toISOString(),
      };

      // 根据健康状态设置HTTP状态码
      const statusCode = healthStatus.status === 'error' ? 503 : 
                        healthStatus.status === 'warning' ? 200 : 200;

      res.status(statusCode).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Basic health check failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response: ApiResponse<null> = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 详细健康检查
   */
  const detailedHealthCheck = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      log.debug('HealthController', `Detailed health check - RequestID: ${requestId}`);

      // 获取详细统计信息
      const detailedStats = service.getDetailedStats();
      
      // 构建响应
      const response = {
        success: true,
        data: {
          ...detailedStats,
          uptime: process.uptime(),
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        timestamp: new Date().toISOString(),
      };

      // 根据健康状态设置HTTP状态码
      const statusCode = detailedStats.health.status === 'error' ? 503 : 
                        detailedStats.health.status === 'warning' ? 200 : 200;

      res.status(statusCode).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Detailed health check failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 内存使用情况
   */
  const memoryUsage = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      log.debug('HealthController', `Memory usage check - RequestID: ${requestId}`);

      // 获取内存使用情况
      const memoryUsage = process.memoryUsage();
      const healthStatus = service.getHealthStatus();
      
      // 构建响应
      const response = {
        success: true,
        data: {
          current: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
          },
          status: healthStatus.memory,
          history: healthStatus.memory,
          gc: {
            available: typeof global.gc === 'function',
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Memory usage check failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 服务统计信息
   */
  const serviceStats = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      log.debug('HealthController', `Service stats check - RequestID: ${requestId}`);

      // 获取服务统计信息
      const healthStatus = service.getHealthStatus();
      
      // 构建响应
      const response = {
        success: true,
        data: {
          service: healthStatus.service,
          parserPool: healthStatus.parserPool,
          languageManager: healthStatus.languageManager,
          uptime: process.uptime(),
          process: {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Service stats check failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 触发内存清理
   */
  const triggerCleanup = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    const strategy = req.body.strategy || 'basic';
    
    try {
      log.info('HealthController', `Triggering cleanup - RequestID: ${requestId}, Strategy: ${strategy}`);

      // 执行清理
      const cleanupResult = await service.performCleanup(strategy as any);
      
      // 构建响应
      const response = {
        success: true,
        data: {
          strategy,
          memoryFreed: cleanupResult.memoryFreed,
          duration: cleanupResult.duration,
          success: cleanupResult.success,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Cleanup trigger failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  /**
   * 重置统计信息
   */
  const resetStats = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      log.info('HealthController', `Resetting stats - RequestID: ${requestId}`);

      // 重置统计信息
      service.resetStats();
      
      // 构建响应
      const response = {
        success: true,
        data: {
          message: 'Statistics reset successfully',
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('HealthController', `Stats reset failed - RequestID: ${requestId}, Error: ${errorMessage}`);
      
      const response = {
        success: false,
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  };

  return {
    basicHealthCheck,
    detailedHealthCheck,
    memoryUsage,
    serviceStats,
    triggerCleanup,
    resetStats,
  };
};

/**
 * 健康检查控制器类型定义
 */
export type HealthController = ReturnType<typeof createHealthController>;