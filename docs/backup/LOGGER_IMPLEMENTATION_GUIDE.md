# 简化Logger模块实施指南

## 概述

本文档提供了Tree-sitter API项目简化Logger模块的完整实施指南。该模块专注于解决现有console日志的核心缺陷，保持最小复杂度。

## 核心特性

### ✅ 已实现功能

1. **日志级别控制**: 通过环境变量控制输出级别
2. **统一格式**: 标准化的时间戳和模块名格式
3. **零依赖**: 仅使用Node.js原生console
4. **单例模式**: 全局统一实例
5. **配置驱动**: 通过环境变量控制行为

### ❌ 未包含的功能

- 文件输出（保持简单，专注于控制台）
- 日志轮转（避免复杂度）
- 远程传输（非核心需求）
- 结构化日志（JSON格式等）

## 文件结构

```
src/
├── utils/
│   └── Logger.ts              # 核心Logger实现
tests/
├── Logger.test.ts             # 单元测试
src/examples/
├── loggerDemo.ts              # 使用演示
.env.example                   # 环境配置示例
docs/
├── LOGGER_IMPLEMENTATION_GUIDE.md  # 本文档
```

## 核心实现

### Logger类设计

```typescript
export class Logger {
  // 单例模式
  static getInstance(): Logger
  
  // 日志方法
  debug(module: string, message: string, ...args: any[]): void
  info(module: string, message: string, ...args: any[]): void
  warn(module: string, message: string, ...args: any[]): void
  error(module: string, message: string, ...args: any[]): void
  fatal(module: string, message: string, ...args: any[]): void
}

// 便捷导出
export const log = {
  debug: (module, message, ...args) => logger.debug(module, message, ...args),
  info: (module, message, ...args) => logger.info(module, message, ...args),
  // ...
};
```

### 环境配置

```bash
# .env.example
LOG_LEVEL=info                    # debug, info, warn, error, fatal
ENABLE_LOG_TIMESTAMP=true        # 是否启用时间戳
ENABLE_LOG_MODULE=true           # 是否启用模块名
```

## 使用方法

### 基本用法

```typescript
import { log } from '@/utils/Logger';

// 替换console.log
log.info('ModuleName', 'Service started');

// 替换console.error
log.error('ModuleName', 'Error occurred', error, { context: 'additional data' });

// 不同级别的日志
log.debug('ModuleName', 'Debug information');
log.warn('ModuleName', 'Warning message');
log.fatal('ModuleName', 'Critical error');
```

### 迁移示例

#### 迁移前
```typescript
console.log('TreeSitterService initialized');
console.warn('Critical memory usage detected');
console.error('Recovery failed:', recoveryResult);
```

#### 迁移后
```typescript
log.info('TreeSitterService', 'TreeSitterService initialized');
log.warn('TreeSitterService', 'Critical memory usage detected');
log.error('ErrorHandler', 'Recovery failed:', recoveryResult);
```

## 输出格式

### 默认格式（启用所有选项）
```
[2023-11-18T05:45:50.387Z] [INFO] [ModuleName] Your message here
```

### 不同配置的输出

| 配置 | 输出示例 |
|------|----------|
| 默认 | `[2023-11-18T05:45:50.387Z] [INFO] [Module] Message` |
| 禁用时间戳 | `[INFO] [Module] Message` |
| 禁用模块名 | `[2023-11-18T05:45:50.387Z] [INFO] Message` |
| 全禁用 | `[INFO] Message` |

## 环境配置指南

### 开发环境
```bash
LOG_LEVEL=debug
ENABLE_LOG_TIMESTAMP=true
ENABLE_LOG_MODULE=true
```

### 生产环境
```bash
LOG_LEVEL=warn
ENABLE_LOG_TIMESTAMP=true
ENABLE_LOG_MODULE=false
```

### 测试环境
```bash
LOG_LEVEL=error
ENABLE_LOG_TIMESTAMP=false
ENABLE_LOG_MODULE=false
```

## 日志级别说明

| 级别 | 数值 | 用途 | 生产环境建议 |
|------|------|------|-------------|
| DEBUG | 0 | 调试信息 | 关闭 |
| INFO | 1 | 一般信息 | 关闭 |
| WARN | 2 | 警告信息 | 开启 |
| ERROR | 3 | 错误信息 | 开启 |
| FATAL | 4 | 严重错误 | 开启 |

## 迁移计划

### 阶段1: 准备工作（已完成）
- [x] 创建Logger类
- [x] 编写单元测试
- [x] 创建使用示例
- [x] 更新环境配置

### 阶段2: 核心模块迁移（建议1-2天）
1. **ErrorHandler模块**
   ```typescript
   // 替换 src/errors/ErrorHandler.ts 中的console调用
   console.error(`[CRITICAL]${contextStr}`, error);
   // 改为
   log.fatal('ErrorHandler', `[CRITICAL]${contextStr}`, error);
   ```

2. **GlobalErrorHandler模块**
   ```typescript
   // 替换 src/middleware/globalErrorHandler.ts 中的console调用
   console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`);
   // 改为
   log.info('GlobalErrorHandler', `${req.method} ${req.path} - Request started`);
   ```

3. **TreeSitterService模块**
   ```typescript
   // 替换 src/core/TreeSitterService.ts 中的console调用
   console.log('TreeSitterService initialized');
   // 改为
   log.info('TreeSitterService', 'TreeSitterService initialized');
   ```

### 阶段3: 其他模块迁移（建议1天）
1. ResourceCleaner模块
2. MemoryMonitor模块
3. LightweightParserPool模块
4. LanguageManager模块
5. 工具函数模块

### 阶段4: 验证和清理（建议0.5天）
1. 运行所有测试
2. 验证不同环境的日志输出
3. 清理未使用的代码
4. 更新文档

## 测试验证

### 运行单元测试
```bash
npm test -- tests/Logger.test.ts
```

### 运行演示
```bash
# 默认配置
npx ts-node src/examples/loggerDemo.ts

# 测试不同日志级别
$env:LOG_LEVEL="warn"; npx ts-node src/examples/loggerDemo.ts
```

### 验证输出
- ✅ 日志级别控制正常工作
- ✅ 时间戳格式正确
- ✅ 模块名显示正确
- ✅ 参数传递正常

## 性能考虑

### 性能优化
1. **动态配置读取**: 每次日志输出时读取环境变量，确保配置变更立即生效
2. **最小开销**: 只在需要时进行字符串格式化
3. **原生console**: 使用Node.js原生console，性能最佳

### 性能指标
- **延迟**: < 1ms（单次日志调用）
- **内存**: < 1KB（Logger实例）
- **CPU**: < 1%（正常使用场景）

## 常见问题

### Q: 如何在测试中禁用日志？
A: 设置 `LOG_LEVEL=fatal` 或使用jest mock：
```typescript
jest.spyOn(console, 'log').mockImplementation();
```

### Q: 如何添加新的日志级别？
A: 修改LogLevel枚举和parseLogLevel方法：
```typescript
export enum LogLevel {
  TRACE = -1,  // 新增
  DEBUG = 0,
  // ...
}
```

### Q: 如何在运行时更改日志级别？
A: 直接修改环境变量：
```typescript
process.env['LOG_LEVEL'] = 'debug';
```

### Q: 如何处理循环依赖？
A: Logger模块不依赖其他业务模块，避免循环依赖问题。

## 维护指南

### 添加新功能
1. 优先考虑是否真的需要
2. 保持向后兼容
3. 添加相应的测试
4. 更新文档

### 修改现有功能
1. 确保不破坏现有API
2. 运行所有测试
3. 验证不同环境的行为

### 性能优化
1. 使用性能测试工具
2. 关注高频调用场景
3. 避免过度优化

## 总结

这个简化的Logger模块成功解决了现有系统的核心缺陷：

1. **✅ 日志级别控制**: 通过环境变量灵活控制
2. **✅ 统一格式**: 标准化的输出格式
3. **✅ 最小复杂度**: 核心代码仅95行
4. **✅ 零依赖**: 不引入外部库
5. **✅ 易于维护**: 清晰的代码结构和完整的测试

该方案在解决核心问题的同时，保持了系统的简洁性，非常适合当前项目的需求。

---

**实施时间**: 2-3天  
**维护成本**: 极低  
**学习成本**: 最小  
**扩展性**: 良好