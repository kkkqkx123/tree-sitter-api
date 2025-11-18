# Tree-sitter API MCP 服务设计方案

## 概述

本文档详细描述了如何在现有的 Tree-sitter API 服务器中集成 Model Context Protocol (MCP) 服务。MCP 服务将提供与代码解析和分析相关的工具和资源，供 AI 模型使用。

## 设计目标

1. 提供可选的 MCP 服务，通过环境变量控制启用/禁用
2. 与现有的 Tree-sitter API 服务集成，共享核心功能
3. 提供代码分析相关的工具和资源
4. 遵循 MCP 协议标准
5. 保持与现有系统的兼容性

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────┐
│                    Tree-sitter API Server               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │   HTTP API      │  │        MCP Service         │ │
│  │   (Express)     │  │                              │  │
│  │                 │  │  ┌─────────────────┐ │  │
│  │  • /api/parse   │  │  │   MCP Tools             │ │  │
│  │  • /api/health │  │  │ • parse_code            │ │  │
│  │  • /api/languages│ │  │ • analyze_syntax        │ │  │
│  │                 │  │  │ • find_patterns         │ │  │
│  │                 │  │  └─────────────────┘ │  │
│  │                 │  │  ┌─────────────────────────┐ │  │
│  │                 │  │  │   MCP Resources         │ │  │
│  │                 │  │  │ • supported_languages   │ │  │
│  │                 │  │  │ • language_examples     │ │  │
│  │                 │  │  └─────────────────────────┘ │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                │
                ▼
        ┌─────────────────────┐
        │   Core Services     │
        │ • TreeSitterService │
        │ • LanguageManager   │
        │ • ParserPool        │
        │ • MemoryMonitor     │
        └─────────────────────┘
```

### MCP 服务组件

#### 1. MCP Server
- 实现 MCP 协议标准
- 处理来自客户端的工具调用和资源访问请求
- 管理会话和认证（如需要）

#### 2. MCP Tools
- `parse_code`: 解析代码并返回语法树信息
- `analyze_syntax`: 分析代码语法结构
- `find_patterns`: 在代码中查找特定模式
- `validate_code`: 验证代码语法

#### 3. MCP Resources
- `supported_languages`: 返回支持的语言列表
- `language_examples`: 返回语言查询示例
- `parsing_statistics`: 返回解析统计信息

## 实现细节

### 1. 项目结构

```
src/
├── mcp/
│   ├── server.ts                 # MCP 服务器入口
│   ├── tools/                    # MCP 工具实现
│   │   ├── parseCode.ts
│   │   ├── analyzeSyntax.ts
│   │   ├── findPatterns.ts
│   │   └── validateCode.ts
│   ├── resources/                # MCP 资源实现
│   │   ├── supportedLanguages.ts
│   │   ├── languageExamples.ts
│   │   └── parsingStatistics.ts
│   ├── types.ts                  # MCP 类型定义
│   └── config.ts                 # MCP 配置
├── core/
│   └── TreeSitterService.ts      # 现有核心服务
└── server.ts                     # 主服务器
```

### 2. MCP 工具实现

#### `parse_code` 工具
- 参数: `language`, `code`, `query` (可选)
- 功能: 解析代码并返回匹配结果
- 返回: 解析结果和语法树信息

#### `analyze_syntax` 工具
- 参数: `language`, `code`
- 功能: 分析代码语法结构
- 返回: 语法结构分析结果

#### `find_patterns` 工具
- 参数: `language`, `code`, `pattern`
- 功能: 在代码中查找特定模式
- 返回: 匹配位置和上下文信息

#### `validate_code` 工具
- 参数: `language`, `code`
- 功能: 验证代码语法
- 返回: 验证结果和错误信息

### 3. MCP 资源实现

#### `supported_languages` 资源
- 返回: 支持的语言列表及其元数据

#### `language_examples` 资源
- 参数: `language`
- 返回: 特定语言的查询示例

#### `parsing_statistics` 资源
- 返回: 解析统计信息和性能指标

## 环境变量控制

### 环境变量定义

```bash
# MCP 服务启用标志
MCP_ENABLED=false

# MCP 服务配置
MCP_PORT=3001
MCP_HOST=localhost
MCP_PROTOCOL=stdio  # stdio 或 http

# 安全相关
MCP_AUTH_TOKEN=     # 可选的认证令牌
MCP_RATE_LIMIT=100  # 每分钟最大请求数
```

### 配置实现

```typescript
// src/config/mcp.ts
export interface MCPConfig {
  enabled: boolean;
  port: number;
  host: string;
  protocol: 'stdio' | 'http';
  authToken?: string;
  rateLimit: number;
}

export const MCPConfig: MCPConfig = {
  enabled: process.env.MCP_ENABLED === 'true',
  port: parseInt(process.env.MCP_PORT || '3001', 10),
  host: process.env.MCP_HOST || 'localhost',
  protocol: (process.env.MCP_PROTOCOL || 'stdio') as 'stdio' | 'http',
  authToken: process.env.MCP_AUTH_TOKEN,
  rateLimit: parseInt(process.env.MCP_RATE_LIMIT || '100', 10),
};
```

## 集成实现

### 主服务器集成

在主服务器启动时，根据环境变量决定是否启动 MCP 服务：

```typescript
// src/server.ts
import { MCPConfig } from '@/config/mcp';
import { createMCPServer } from '@/mcp/server';

class TreeSitterServer {
  // ... 现有代码 ...

  public start(): void {
    // 启动 HTTP API 服务器
    this.server = this.app.listen(port, host, () => {
      log.info('Server', `Tree-sitter API server running on ${host}:${port}`);
    });

    // 根据配置决定是否启动 MCP 服务
    if (MCPConfig.enabled) {
      const mcpServer = createMCPServer(this.service);
      if (MCPConfig.protocol === 'stdio') {
        mcpServer.listenStdio();
      } else {
        mcpServer.listenHttp(MCPConfig.port);
      }
      log.info('MCP', `MCP server running on ${MCPConfig.protocol} protocol`);
    }
  }
}
```

### 依赖注入

MCP 服务将使用现有的 TreeSitterService 实例，避免重复创建资源：

```typescript
// src/mcp/server.ts
export const createMCPServer = (treeSitterService: TreeSitterService) => {
  // 创建工具和资源，使用共享的 TreeSitterService
  const parseCodeTool = createParseCodeTool(treeSitterService);
  const supportedLanguagesResource = createSupportedLanguagesResource(treeSitterService);
  
  // 返回 MCP 服务器实例
  return new MCPServer({
    tools: [parseCodeTool],
    resources: [supportedLanguagesResource],
  });
};
```

## 安全考虑

1. **认证**: 可选的认证令牌验证
2. **速率限制**: 防止滥用
3. **资源限制**: 控制内存和CPU使用
4. **输入验证**: 验证所有输入参数

## 部署配置

### Docker 配置

```dockerfile
# 在 Dockerfile 中添加 MCP 支持
ENV MCP_ENABLED=${MCP_ENABLED:-false}
ENV MCP_PORT=${MCP_PORT:-3001}
```

### Kubernetes 配置

```yaml
# 在 Kubernetes 配置中使用环境变量控制 MCP 服务
env:
- name: MCP_ENABLED
  value: "true"
- name: MCP_PORT
  value: "3001"
```

## 监控和日志

### 日志记录

MCP 服务将使用现有的日志系统：

```typescript
// src/mcp/tools/parseCode.ts
import { log } from '@/utils/Logger';

export const createParseCodeTool = (service: TreeSitterService) => {
  return {
    name: 'parse_code',
    handler: async (params: any) => {
      log.info('MCP', `Parse code tool called for language: ${params.language}`);
      // ... 工具实现
    }
  };
};
```

### 性能监控

MCP 服务将集成现有的性能监控：

```typescript
// 监控 MCP 工具调用性能
const startTime = Date.now();
try {
  const result = await toolHandler(params);
  const duration = Date.now() - startTime;
  log.info('MCP', `Tool ${toolName} executed in ${duration}ms`);
  return result;
} catch (error) {
  log.error('MCP', `Tool ${toolName} failed: ${error}`);
  throw error;
}
```

## 向后兼容性

1. MCP 服务完全可选，默认情况下不启用
2. 现有的 HTTP API 不受影响
3. 所有现有功能保持不变
4. 环境变量默认值确保向后兼容

## 扩展性

1. 易于添加新的 MCP 工具和资源
2. 模块化设计便于维护
3. 支持多种 MCP 协议（stdio、HTTP）
4. 可配置的认证和安全选项

## 总结

该设计方案提供了一个完整的 MCP 服务集成方案，具有以下特点：

- **可选性**: 通过环境变量完全控制启用/禁用
- **集成性**: 与现有 Tree-sitter 服务共享核心功能
- **安全性**: 包含认证和速率限制
- **可扩展性**: 易于添加新工具和资源
- **兼容性**: 不影响现有功能
- **监控性**: 集成现有日志和监控系统

此方案允许 AI 模型通过 MCP 协议访问代码分析功能，同时保持系统的稳定性和可维护性。