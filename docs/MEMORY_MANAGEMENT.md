# 轻量级内存管理和错误处理策略

## 设计目标

针对小规模使用场景的Tree-sitter API服务器，设计一套轻量级但有效的内存管理和错误处理策略，确保在资源受限环境下的稳定运行。

## 内存管理策略

### 1. 内存使用限制

```typescript
// src/config/MemoryConfig.ts
export const MemoryConfig = {
    // 内存阈值 (MB)
    THRESHOLDS: {
        WARNING: 200,   // 警告阈值
        CRITICAL: 300,  // 严重阈值
        MAXIMUM: 400    // 最大阈值
    },
    
    // 清理策略
    CLEANUP: {
        INTERVAL: 60000,        // 清理间隔 (ms)
        FORCE_GC_INTERVAL: 300000, // 强制GC间隔 (ms)
        IDLE_TIMEOUT: 300000    // 空闲超时 (ms)
    },
    
    // 资源限制
    LIMITS: {
        MAX_REQUEST_SIZE: 5 * 1024 * 1024,  // 5MB
        MAX_CODE_LENGTH: 100 * 1024,        // 100KB
        MAX_CONCURRENT_REQUESTS: 10,         // 最大并发请求数
        PARSER_POOL_SIZE: 3                  // 解析器池大小
    }
};
```

### 2. 轻量级内存监控器

```typescript
// src/core/MemoryMonitor.ts
export class MemoryMonitor {
    private lastCleanup = 0;
    private lastForceGC = 0;
    private memoryHistory: number[] = [];
    private maxHistorySize = 10;

    constructor(private config: typeof MemoryConfig) {}

    checkMemory(): MemoryStatus {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        
        // 记录内存历史
        this.recordMemoryUsage(heapUsedMB);
        
        // 确定内存状态
        let status: MemoryStatus['level'];
        if (heapUsedMB >= this.config.THRESHOLDS.MAXIMUM) {
            status = 'critical';
        } else if (heapUsedMB >= this.config.THRESHOLDS.CRITICAL) {
            status = 'warning';
        } else {
            status = 'normal';
        }

        return {
            level: status,
            heapUsed: heapUsedMB,
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            trend: this.calculateTrend()
        };
    }

    private recordMemoryUsage(heapUsed: number) {
        this.memoryHistory.push(heapUsed);
        if (this.memoryHistory.length > this.maxHistorySize) {
            this.memoryHistory.shift();
        }
    }

    private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
        if (this.memoryHistory.length < 3) return 'stable';
        
        const recent = this.memoryHistory.slice(-3);
        const diff = recent[2] - recent[0];
        
        if (diff > 10) return 'increasing';
        if (diff < -10) return 'decreasing';
        return 'stable';
    }

    shouldCleanup(): boolean {
        const now = Date.now();
        return now - this.lastCleanup > this.config.CLEANUP.INTERVAL;
    }

    shouldForceGC(): boolean {
        const now = Date.now();
        return now - this.lastForceGC > this.config.CLEANUP.FORCE_GC_INTERVAL;
    }

    markCleanup() {
        this.lastCleanup = Date.now();
    }

    markForceGC() {
        this.lastForceGC = Date.now();
    }

    getMemoryStats() {
        return {
            history: [...this.memoryHistory],
            average: this.memoryHistory.length > 0 
                ? Math.round(this.memoryHistory.reduce((a, b) => a + b, 0) / this.memoryHistory.length)
                : 0,
            peak: this.memoryHistory.length > 0 ? Math.max(...this.memoryHistory) : 0
        };
    }
}

interface MemoryStatus {
    level: 'normal' | 'warning' | 'critical';
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    trend: 'increasing' | 'decreasing' | 'stable';
}
```

### 3. 智能资源清理器

```typescript
// src/core/ResourceCleaner.ts
export class ResourceCleaner {
    private cleanupStrategies: CleanupStrategy[] = [];

    constructor(private memoryMonitor: MemoryMonitor) {
        this.initializeStrategies();
    }

    private initializeStrategies() {
        this.cleanupStrategies = [
            new BasicCleanupStrategy(),
            new AggressiveCleanupStrategy(),
            new EmergencyCleanupStrategy()
        ];
    }

    async performCleanup(level: MemoryStatus['level']): Promise<CleanupResult> {
        const strategy = this.getStrategy(level);
        const result = await strategy.execute();
        
        this.memoryMonitor.markCleanup();
        
        return result;
    }

    private getStrategy(level: MemoryStatus['level']): CleanupStrategy {
        switch (level) {
            case 'critical':
                return this.cleanupStrategies[2]; // Emergency
            case 'warning':
                return this.cleanupStrategies[1]; // Aggressive
            default:
                return this.cleanupStrategies[0]; // Basic
        }
    }

    async forceGarbageCollection(): Promise<boolean> {
        if (global.gc) {
            global.gc();
            this.memoryMonitor.markForceGC();
            return true;
        }
        return false;
    }
}

abstract class CleanupStrategy {
    abstract execute(): Promise<CleanupResult>;
}

class BasicCleanupStrategy extends CleanupStrategy {
    async execute(): Promise<CleanupResult> {
        const beforeMemory = process.memoryUsage();
        
        // 基本清理：强制GC
        if (global.gc) {
            global.gc();
        }
        
        const afterMemory = process.memoryUsage();
        const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
        
        return {
            strategy: 'basic',
            memoryFreed: freed,
            success: true
        };
    }
}

class AggressiveCleanupStrategy extends CleanupStrategy {
    constructor(private parserPool: any, private treeManager: any) {
        super();
    }

    async execute(): Promise<CleanupResult> {
        const beforeMemory = process.memoryUsage();
        
        // 激进清理：清理解析器池和树管理器
        if (this.parserPool) {
            this.parserPool.cleanup();
        }
        
        if (this.treeManager) {
            this.treeManager.emergencyCleanup();
        }
        
        // 多次GC
        for (let i = 0; i < 3; i++) {
            if (global.gc) {
                global.gc();
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const afterMemory = process.memoryUsage();
        const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
        
        return {
            strategy: 'aggressive',
            memoryFreed: freed,
            success: true
        };
    }
}

class EmergencyCleanupStrategy extends CleanupStrategy {
    async execute(): Promise<CleanupResult> {
        const beforeMemory = process.memoryUsage();
        
        // 紧急清理：重置所有资源
        try {
            // 清理所有缓存
            if (global.gc) {
                global.gc();
            }
            
            // 等待一段时间让GC完成
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 再次GC
            if (global.gc) {
                global.gc();
            }
            
        } catch (error) {
            console.error('Emergency cleanup failed:', error);
        }
        
        const afterMemory = process.memoryUsage();
        const freed = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
        
        return {
            strategy: 'emergency',
            memoryFreed: freed,
            success: true
        };
    }
}

interface CleanupResult {
    strategy: string;
    memoryFreed: number;
    success: boolean;
}
```

### 4. 请求级别的资源管理

```typescript
// src/middleware/ResourceGuard.ts
export const resourceGuard = (memoryMonitor: MemoryMonitor, resourceCleaner: ResourceCleaner) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // 检查内存状态
        const memoryStatus = memoryMonitor.checkMemory();
        
        // 如果内存状态严重，拒绝请求
        if (memoryStatus.level === 'critical') {
            await resourceCleaner.performCleanup('critical');
            
            // 再次检查
            const statusAfterCleanup = memoryMonitor.checkMemory();
            if (statusAfterCleanup.level === 'critical') {
                return res.status(503).json({
                    success: false,
                    errors: ['Service temporarily unavailable: out of memory'],
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // 记录请求开始时的内存
        const startMemory = process.memoryUsage();
        
        // 设置请求超时
        req.setTimeout(30000, () => {
            console.warn(`Request timeout: ${req.method} ${req.path}`);
        });
        
        // 继续处理请求
        res.on('finish', () => {
            // 检查内存增长
            const endMemory = process.memoryUsage();
            const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
            
            if (memoryGrowth > 10 * 1024 * 1024) { // 10MB增长
                console.warn(`High memory growth detected: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
                
                // 如果需要，触发清理
                if (memoryMonitor.shouldCleanup()) {
                    resourceCleaner.performCleanup(memoryStatus.level);
                }
            }
        });
        
        next();
    };
};
```

## 错误处理策略

### 1. 错误分类和处理

```typescript
// src/errors/ErrorTypes.ts
export enum ErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
    PARSE_ERROR = 'PARSE_ERROR',
    QUERY_ERROR = 'QUERY_ERROR',
    MEMORY_ERROR = 'MEMORY_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export class TreeSitterError extends Error {
    constructor(
        public type: ErrorType,
        public severity: ErrorSeverity,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'TreeSitterError';
    }
}
```

### 2. 错误处理器

```typescript
// src/errors/ErrorHandler.ts
export class ErrorHandler {
    private errorCounts: Map<ErrorType, number> = new Map();
    private lastErrors: Array<{ error: TreeSitterError; timestamp: number }> = [];
    private maxErrorHistory = 100;

    handleError(error: Error, context?: string): TreeSitterError {
        const treeSitterError = this.classifyError(error);
        
        // 记录错误
        this.recordError(treeSitterError);
        
        // 根据严重程度采取不同措施
        this.handleBySeverity(treeSitterError, context);
        
        return treeSitterError;
    }

    private classifyError(error: Error): TreeSitterError {
        if (error instanceof TreeSitterError) {
            return error;
        }

        const message = error.message.toLowerCase();
        
        if (message.includes('unsupported language')) {
            return new TreeSitterError(
                ErrorType.UNSUPPORTED_LANGUAGE,
                ErrorSeverity.MEDIUM,
                error.message
            );
        }
        
        if (message.includes('invalid query') || message.includes('query syntax')) {
            return new TreeSitterError(
                ErrorType.QUERY_ERROR,
                ErrorSeverity.MEDIUM,
                error.message
            );
        }
        
        if (message.includes('parse') || message.includes('syntax')) {
            return new TreeSitterError(
                ErrorType.PARSE_ERROR,
                ErrorSeverity.MEDIUM,
                error.message
            );
        }
        
        if (message.includes('memory') || message.includes('out of memory')) {
            return new TreeSitterError(
                ErrorType.MEMORY_ERROR,
                ErrorSeverity.HIGH,
                error.message
            );
        }
        
        if (message.includes('timeout')) {
            return new TreeSitterError(
                ErrorType.TIMEOUT_ERROR,
                ErrorSeverity.MEDIUM,
                error.message
            );
        }
        
        // 默认为内部错误
        return new TreeSitterError(
            ErrorType.INTERNAL_ERROR,
            ErrorSeverity.HIGH,
            error.message,
            { stack: error.stack }
        );
    }

    private recordError(error: TreeSitterError) {
        // 更新错误计数
        const count = this.errorCounts.get(error.type) || 0;
        this.errorCounts.set(error.type, count + 1);
        
        // 记录错误历史
        this.lastErrors.push({ error, timestamp: Date.now() });
        
        // 限制历史记录大小
        if (this.lastErrors.length > this.maxErrorHistory) {
            this.lastErrors.shift();
        }
    }

    private handleBySeverity(error: TreeSitterError, context?: string) {
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                console.error(`[CRITICAL] ${context}:`, error);
                // 可能需要触发紧急清理或重启
                break;
            case ErrorSeverity.HIGH:
                console.error(`[HIGH] ${context}:`, error);
                // 可能需要记录告警
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(`[MEDIUM] ${context}:`, error);
                break;
            case ErrorSeverity.LOW:
                console.info(`[LOW] ${context}:`, error);
                break;
        }
    }

    getErrorStats() {
        const recentErrors = this.lastErrors.filter(
            e => Date.now() - e.timestamp < 300000 // 最近5分钟
        );

        return {
            totalErrors: this.lastErrors.length,
            recentErrors: recentErrors.length,
            errorCounts: Object.fromEntries(this.errorCounts),
            mostCommonError: this.getMostCommonError()
        };
    }

    private getMostCommonError(): ErrorType | null {
        let maxCount = 0;
        let mostCommon: ErrorType | null = null;

        for (const [type, count] of this.errorCounts) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = type;
            }
        }

        return mostCommon;
    }
}
```

### 3. 错误恢复策略

```typescript
// src/errors/RecoveryStrategy.ts
export class RecoveryStrategy {
    constructor(
        private resourceCleaner: ResourceCleaner,
        private memoryMonitor: MemoryMonitor
    ) {}

    async attemptRecovery(error: TreeSitterError): Promise<RecoveryResult> {
        switch (error.type) {
            case ErrorType.MEMORY_ERROR:
                return await this.recoverFromMemoryError();
            case ErrorType.PARSE_ERROR:
                return this.recoverFromParseError(error);
            case ErrorType.QUERY_ERROR:
                return this.recoverFromQueryError(error);
            default:
                return this.recoverFromGenericError(error);
        }
    }

    private async recoverFromMemoryError(): Promise<RecoveryResult> {
        try {
            // 执行紧急清理
            const cleanupResult = await this.resourceCleaner.performCleanup('critical');
            
            // 强制垃圾回收
            await this.resourceCleaner.forceGarbageCollection();
            
            // 检查内存状态
            const memoryStatus = this.memoryMonitor.checkMemory();
            
            return {
                success: memoryStatus.level !== 'critical',
                action: 'emergency_cleanup',
                message: memoryStatus.level === 'critical' 
                    ? 'Memory still critical after cleanup'
                    : 'Memory recovered successfully'
            };
        } catch (recoveryError) {
            return {
                success: false,
                action: 'emergency_cleanup',
                message: `Recovery failed: ${recoveryError.message}`
            };
        }
    }

    private recoverFromParseError(error: TreeSitterError): RecoveryResult {
        // 解析错误通常不需要恢复，只是返回错误信息
        return {
            success: false,
            action: 'none',
            message: 'Parse error cannot be recovered, check input code'
        };
    }

    private recoverFromQueryError(error: TreeSitterError): RecoveryResult {
        // 查询错误通常不需要恢复，只是返回错误信息
        return {
            success: false,
            action: 'none',
            message: 'Query error cannot be recovered, check query syntax'
        };
    }

    private recoverFromGenericError(error: TreeSitterError): RecoveryResult {
        // 通用错误恢复策略
        if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
            // 对于严重错误，尝试基本清理
            this.resourceCleaner.performCleanup('warning');
        }
        
        return {
            success: false,
            action: 'basic_cleanup',
            message: 'Generic error handled, service should continue'
        };
    }
}

interface RecoveryResult {
    success: boolean;
    action: string;
    message: string;
}
```

### 4. 全局错误处理中间件

```typescript
// src/middleware/globalErrorHandler.ts
export const globalErrorHandler = (
    errorHandler: ErrorHandler,
    recoveryStrategy: RecoveryStrategy
) => {
    return async (error: Error, req: Request, res: Response, next: NextFunction) => {
        // 处理错误
        const treeSitterError = errorHandler.handleError(error, `${req.method} ${req.path}`);
        
        // 尝试恢复
        const recoveryResult = await recoveryStrategy.attemptRecovery(treeSitterError);
        
        // 记录恢复结果
        if (!recoveryResult.success) {
            console.error('Recovery failed:', recoveryResult);
        }
        
        // 返回错误响应
        const statusCode = getStatusCode(treeSitterError.type);
        
        res.status(statusCode).json({
            success: false,
            errors: [treeSitterError.message],
            timestamp: new Date().toISOString()
        });
    };
};

function getStatusCode(errorType: ErrorType): number {
    switch (errorType) {
        case ErrorType.VALIDATION_ERROR:
            return 400;
        case ErrorType.UNSUPPORTED_LANGUAGE:
            return 404;
        case ErrorType.PARSE_ERROR:
        case ErrorType.QUERY_ERROR:
            return 422;
        case ErrorType.MEMORY_ERROR:
        case ErrorType.TIMEOUT_ERROR:
            return 503;
        default:
            return 500;
    }
}
```

## 监控和告警

### 1. 健康检查增强

```typescript
// src/api/controllers/healthController.ts
export const enhancedHealthCheck = (
    memoryMonitor: MemoryMonitor,
    errorHandler: ErrorHandler
) => {
    return async (req: Request, res: Response) => {
        const memoryStatus = memoryMonitor.checkMemory();
        const errorStats = errorHandler.getErrorStats();
        
        // 确定整体健康状态
        let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
        
        if (memoryStatus.level === 'critical' || errorStats.recentErrors > 10) {
            overallStatus = 'error';
        } else if (memoryStatus.level === 'warning' || errorStats.recentErrors > 5) {
            overallStatus = 'warning';
        }
        
        const response = {
            status: overallStatus,
            memory: memoryStatus,
            errors: errorStats,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
        
        res.status(overallStatus === 'error' ? 503 : 200).json(response);
    };
};
```

## 总结

这套轻量级内存管理和错误处理策略提供了：

1. **智能内存监控**：实时监控内存使用趋势和历史
2. **分层清理策略**：根据内存状态选择不同的清理强度
3. **全面错误处理**：分类处理不同类型的错误
4. **自动恢复机制**：针对可恢复错误的自动处理
5. **健康状态监控**：全面的系统健康检查

通过这套策略，即使在资源受限的环境中，API服务器也能保持稳定运行，并在出现问题时及时恢复。