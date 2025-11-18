# 错误处理系统

本目录包含了Tree-sitter API服务器的完整错误处理系统，提供错误分类、处理和恢复功能。

## 组件概览

### 1. 错误类型定义 (`src/types/errors.ts`)

定义了错误处理系统所需的所有类型和接口：

- `ErrorType`: 错误类型枚举
- `ErrorSeverity`: 错误严重程度枚举
- `TreeSitterError`: 自定义错误类
- `ErrorStatistics`: 错误统计信息接口
- `RecoveryResult`: 恢复结果接口

### 2. 错误处理器 (`src/errors/ErrorHandler.ts`)

负责分类、记录和处理各种错误：

```typescript
import { ErrorHandler } from '@/errors/ErrorHandler';

const errorHandler = new ErrorHandler();

// 处理错误
const treeSitterError = errorHandler.handleError(error, 'context');

// 获取错误统计
const stats = errorHandler.getErrorStats();

// 检查错误率
const isHighRate = errorHandler.isErrorRateHigh(10);
```

### 3. 恢复策略 (`src/errors/RecoveryStrategy.ts`)

针对不同类型的错误实施相应的恢复策略：

```typescript
import { RecoveryStrategy } from '@/errors/RecoveryStrategy';

const recoveryStrategy = new RecoveryStrategy(resourceCleaner, memoryMonitor);

// 尝试恢复
const result = await recoveryStrategy.attemptRecovery(error);

// 检查是否可以恢复
const canRecover = recoveryStrategy.canRecover(error);

// 获取恢复优先级
const priority = recoveryStrategy.getRecoveryPriority(error);
```

### 4. 全局错误处理中间件 (`src/middleware/globalErrorHandler.ts`)

Express中间件，捕获所有错误并尝试恢复：

```typescript
import { globalErrorHandler } from '@/middleware';

app.use(globalErrorHandler(errorHandler, recoveryStrategy));
```

### 5. 资源保护中间件 (`src/middleware/resourceGuard.ts`)

监控内存使用情况，限制请求大小，防止资源耗尽：

```typescript
import { resourceGuard } from '@/middleware';

app.use(resourceGuard(memoryMonitor, resourceCleaner));
```

## 错误类型

系统支持以下错误类型：

- `VALIDATION_ERROR`: 验证错误（低严重性）
- `UNSUPPORTED_LANGUAGE`: 不支持的语言（中等严重性）
- `PARSE_ERROR`: 解析错误（中等严重性）
- `QUERY_ERROR`: 查询错误（中等严重性）
- `MEMORY_ERROR`: 内存错误（高严重性）
- `TIMEOUT_ERROR`: 超时错误（中等严重性）
- `INTERNAL_ERROR`: 内部错误（高严重性）
- `RESOURCE_ERROR`: 资源错误（高严重性）

## 错误严重程度

- `LOW`: 低严重性，仅记录信息
- `MEDIUM`: 中等严重性，记录警告
- `HIGH`: 高严重性，记录错误并可能触发清理
- `CRITICAL`: 严重错误，记录错误并可能触发紧急恢复

## 恢复策略

### 内存错误恢复
1. 执行紧急清理
2. 强制垃圾回收
3. 检查内存状态

### 资源错误恢复
1. 执行激进清理
2. 释放资源

### 解析/查询错误
- 通常不需要恢复，返回错误信息和建议

### 通用错误恢复
1. 根据严重程度决定是否执行清理
2. 记录错误信息

## 使用示例

### 基本使用

```typescript
import express from 'express';
import { ErrorHandler } from '@/errors/ErrorHandler';
import { RecoveryStrategy } from '@/errors/RecoveryStrategy';
import { globalErrorHandler, resourceGuard } from '@/middleware';

const app = express();
const errorHandler = new ErrorHandler();
const recoveryStrategy = new RecoveryStrategy(resourceCleaner, memoryMonitor);

// 配置中间件
app.use(resourceGuard(memoryMonitor, resourceCleaner));
app.use(globalErrorHandler(errorHandler, recoveryStrategy));
```

### 自定义错误处理

```typescript
import { TreeSitterError, ErrorType, ErrorSeverity } from '@/types/errors';

// 创建自定义错误
const error = new TreeSitterError(
  ErrorType.VALIDATION_ERROR,
  ErrorSeverity.LOW,
  'Invalid input parameter',
  { parameter: 'language', value: 'invalid' }
);

// 处理错误
const handledError = errorHandler.handleError(error, 'validation');
```

### 错误统计

```typescript
// 获取错误统计
const stats = errorHandler.getErrorStats();
console.log('Total errors:', stats.totalErrors);
console.log('Recent errors:', stats.recentErrors);
console.log('Most common error:', stats.mostCommonError);

// 检查错误率
if (errorHandler.isErrorRateHigh()) {
  console.warn('High error rate detected!');
}
```

## 配置选项

### 资源保护配置

```typescript
const config = {
  maxRequestSize: 5 * 1024 * 1024,  // 5MB
  maxCodeLength: 100 * 1024,        // 100KB
  requestTimeout: 30000,            // 30秒
  memoryCheckInterval: 5000,        // 5秒
  maxConcurrentRequests: 10         // 10个并发请求
};

app.use(resourceGuard(memoryMonitor, resourceCleaner, config));
```

## 最佳实践

1. **始终使用错误处理器**: 使用`ErrorHandler`类处理所有错误，确保错误被正确分类和记录。

2. **配置适当的恢复策略**: 根据系统资源和使用场景配置恢复策略。

3. **监控错误率**: 定期检查错误率，及时发现系统问题。

4. **合理设置资源限制**: 根据系统资源设置合理的请求大小和并发限制。

5. **记录错误上下文**: 在处理错误时提供尽可能多的上下文信息。

## 测试

运行示例代码测试错误处理系统：

```bash
npx ts-node src/examples/errorHandlingExample.ts
```

## 相关文档

- [内存管理文档](../core/README.md)
- [API规范](../../docs/API_SPECIFICATION.md)
- [实现路线图](../../docs/IMPLEMENTATION_ROADMAP.md)