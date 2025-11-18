# Tree-sitter API 项目的日志系统分析

通过分析项目代码，我发现该项目采用了一种**基于 console 的简单日志记录机制**，而不是使用专门的日志库（如 Winston 或 Pino）。以下是项目的日志系统实现分析：

## 1. 日志记录方式

项目使用原生的 `console.log`、`console.warn` 和 `console.error` 进行日志记录：

- `console.log` - 用于一般信息和请求开始/结束记录
- `console.warn` - 用于警告信息，如内存使用过高、清理失败等
- `console.error` - 用于错误信息，特别是严重错误和恢复失败

## 2. 日志记录位置

### 请求日志
- 在 `src/middleware/globalErrorHandler.ts` 中的 `errorLogger` 中间件
  - 记录请求开始：`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`
  - 记录请求完成：`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
  - 记录错误响应：`[ERROR] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`

### 服务日志
- 在 `src/core/TreeSitterService.ts` 中：
  - 服务初始化：`console.log('TreeSitterService initialized')`
  - 请求处理时间：`console.log('Request processed in ${duration}ms')`
  - 服务销毁：`console.log('Destroying TreeSitterService...')`

### 内存监控日志
- 在 `src/core/MemoryMonitor.ts` 中：
  - 内存监控开始/停止：`console.log('Memory monitoring started/stopped')`
  - 内存告警：`console.warn('Critical memory usage detected, attempting cleanup')`

### 资源清理日志
- 在 `src/core/ResourceCleaner.ts` 中：
  - 清理过程：`console.log('Performing ${strategy} cleanup...')`
  - 清理结果：`console.log('${strategy} cleanup completed: ${result.memoryFreed}MB freed in ${result.duration}ms')`

### 错误处理日志
- 在 `src/errors/ErrorHandler.ts` 中根据错误严重程度记录：
  - CRITICAL: `console.error('[CRITICAL]${contextStr}', error)`
  - HIGH: `console.error('[HIGH]${contextStr}', error)`
  - MEDIUM: `console.warn('[MEDIUM]${contextStr}', error)`
  - LOW: `console.info('[LOW]${contextStr}', error)`

## 3. 日志配置

在 `src/config/server.ts` 中定义了日志配置：
```typescript
LOGGING: {
  LEVEL: process.env["LOG_LEVEL"] || 'info',
  FORMAT: process.env["LOG_FORMAT"] || 'combined',
  ENABLE_REQUEST_LOGGING: process.env["ENABLE_REQUEST_LOGGING"] !== 'false',
}
```

## 4. 特殊日志功能

- **内存使用日志**：在 `src/utils/memoryUtils.ts` 中的 `logMemoryUsage` 函数可记录详细的内存使用情况
- **错误统计**：`ErrorHandler` 类会记录错误历史和统计信息
- **性能监控**：记录请求处理时间、清理耗时等性能指标

## 5. 缺点与限制

- 没有使用专业的日志库，缺乏结构化日志、日志级别控制、日志文件输出等功能
- 没有日志轮转机制
- 生产环境中可能需要更完善的日志管理方案

## 6. 日志级别控制

项目定义了 `LogLevel` 枚举：
```typescript
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

总的来说，这是一个轻量级的日志系统，主要依赖于 Node.js 的原生 console 方法进行日志记录，适用于轻量级的 Tree-sitter API 服务。