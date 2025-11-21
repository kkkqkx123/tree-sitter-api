# Tree-sitter Query API 文档

## 概述

Tree-sitter Query REST API 提供了一个基于HTTP的接口，用于批量处理代码语法分析和Tree-sitter查询。该API支持多种编程语言，能够高效地处理多个代码片段和查询规则。

## 基础信息

- **基础URL**: `http://localhost:3000/api` (可通过环境变量配置)
- **内容类型**: `application/json`
- **字符编码**: UTF-8
- **HTTP方法**: GET, POST

## API端点

### 1. 解析端点

#### `POST /api/parse`

解析单个代码片段并执行Tree-sitter查询。

**请求体格式**:
```json
{
  "language": "javascript",
  "code": "const x = 1;",
  "queries": ["(variable_declarator) @var", "(identifier) @id"]
}
```

**参数说明**:
- `language` (string, 必需): 编程语言标识符，如 "javascript", "python", "java" 等
- `code` (string, 必需): 要解析的代码内容，最大长度由 `MAX_CODE_LENGTH` 环境变量配置（默认100KB）
- `queries` (string[], 必需): Tree-sitter查询字符串数组，至少需要一个查询，最多10个查询

**请求验证规则**:
- `language` 必须是字符串，格式为字母数字字符、连字符和下划线
- `code` 必须是字符串，且长度不超过配置的最大值
- `queries` 数组必须包含至少一个查询，最多10个查询
- 查询语法必须有效（平衡的括号，包含@符号）

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "captureName": "var",
      "type": "variable_declarator",
      "text": "x = 1",
      "startPosition": {
        "row": 0,
        "column": 0
      },
      "endPosition": {
        "row": 0,
        "column": 9
      }
    }
  ],
  "errors": [],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**HTTP状态码**:
- `200`: 解析成功
- `400`: 请求格式错误
- `422`: 解析或查询错误

---

#### `POST /api/parse/batch`

批量解析多个代码片段。

**请求体格式**:
```json
{
  "requests": [
    {
      "language": "javascript",
      "code": "const x = 1;",
      "queries": ["(variable_declarator) @var"]
    },
    {
      "language": "python",
      "code": "def hello(): pass",
      "queries": ["(function_definition) @func"]
    }
 ]
}
```

**参数说明**:
- `requests` (ParseRequest[], 必需): 解析请求数组，最多10个请求

**响应格式**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "matches": [...],
        "errors": []
      }
    ],
    "summary": {
      "total": 2,
      "successful": 2,
      "failed": 0,
      "totalMatches": 5
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**HTTP状态码**:
- `200`: 批量处理成功
- `400`: 请求格式错误

---

#### `POST /api/parse/validate`

验证Tree-sitter查询语法。

**请求体格式**:
```json
{
  "language": "javascript",
  "query": "(function_declaration) @func"
}
```

**参数说明**:
- `language` (string, 必需): 编程语言标识符
- `query` (string, 必需): 要验证的查询字符串

**响应格式**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "language": "javascript",
    "query": "(function_declaration) @func",
    "message": "Query syntax is valid"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**HTTP状态码**:
- `200`: 验证成功
- `40`: 请求格式错误
- `422`: 查询语法错误

---

### 2. 健康检查端点

#### `GET /api/health`

检查API服务基本状态。

**响应格式**:
```json
{
  "status": "healthy",
  "memory": {
    "rss": 45,
    "heapTotal": 32,
    "heapUsed": 28,
    "external": 1
  },
  "supportedLanguages": ["javascript", "python", "java"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**HTTP状态码**:
- `200`: 服务健康

---

#### `GET /api/health/detailed`

获取详细健康检查信息。

**响应格式**:
```json
{
  "status": "healthy",
  "memory": {...},
  "errors": {...},
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `GET /api/health/memory`

获取内存使用情况。

**响应格式**:
```json
{
  "memory": {
    "rss": 45,
    "heapTotal": 32,
    "heapUsed": 28,
    "external": 1
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `GET /api/health/stats`

获取服务统计信息。

**响应格式**:
```json
{
  "stats": {
    "requests": 10,
    "successful": 95,
    "failed": 5,
    "avgProcessingTime": 15.5
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `POST /api/health/cleanup`

触发内存清理。

**响应格式**:
```json
{
  "success": true,
  "data": {
    "strategy": "gc",
    "memoryFreed": 5.2,
    "success": true,
    "duration": 100
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `POST /api/health/reset`

重置统计信息。

**响应格式**:
```json
{
  "success": true,
  "message": "Statistics reset successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 3. 语言端点

#### `GET /api/languages`

获取支持的语言列表。

**响应格式**:
```json
{
  "languages": ["javascript", "python", "java", "go", "rust", "cpp", "csharp", "ruby"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**HTTP状态码**:
- `200`: 获取成功

---

#### `GET /api/languages/:language`

获取特定语言的详细信息。

**参数说明**:
- `language` (string, 必需): 语言标识符

**响应格式**:
```json
{
  "language": "javascript",
  "supported": true,
  "version": "0.20.0",
  "features": ["function", "class", "variable"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `GET /api/languages/:language/examples`

获取特定语言的查询示例。

**参数说明**:
- `language` (string, 必需): 语言标识符

**响应格式**:
```json
{
  "examples": [
    {
      "name": "Find functions",
      "query": "(function_declaration) @func",
      "description": "Find all function declarations"
    }
 ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### `POST /api/languages/preload`

预加载指定语言。

**请求体格式**:
```json
{
  "languages": ["javascript", "python"]
}
```

**参数说明**:
- `languages` (string[], 可选): 要预加载的语言数组，如果未提供则预加载所有支持的语言

**响应格式**:
```json
{
  "success": true,
  "data": {
    "loaded": ["javascript", "python"],
    "failed": [],
    "message": "Languages preloaded successfully"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 响应格式规范

### 成功响应
```json
{
  "success": true,
  "data": {...},  // 可选的数据字段
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 错误响应
```json
{
  "success": false,
  "errors": ["错误描述"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

在某些错误响应中，还可能包含以下额外字段：
- `errorType`: 错误类型枚举值
- `severity`: 错误严重程度
- `recovery`: 恢复操作信息

---

## 错误类型

| 错误类型 | HTTP状态码 | 说明 |
|----------|------------|------|
| VALIDATION_ERROR | 400 | 请求验证错误 |
| UNSUPPORTED_LANGUAGE | 404 | 不支持的编程语言 |
| PARSE_ERROR | 422 | 代码解析错误 |
| QUERY_ERROR | 422 | 查询语法错误 |
| MEMORY_ERROR | 503 | 内存不足错误 |
| TIMEOUT_ERROR | 503 | 超时错误 |
| INTERNAL_ERROR | 500 | 内部服务器错误 |
| RESOURCE_ERROR | 503 | 资源错误 |

---

## 请求限制

- **请求大小限制**: 默认5MB (可通过 `MAX_REQUEST_SIZE` 环境变量配置)
- **代码长度限制**: 默认100KB (可通过 `MAX_CODE_LENGTH` 环境变量配置)
- **并发请求限制**: 默认10个 (可通过 `MAX_CONCURRENT_REQUESTS` 环境变量配置)
- **查询数量限制**: 单个请求最多10个查询
- **请求超时**: 默认30秒 (可通过 `REQUEST_TIMEOUT` 环境变量配置)

---

## 请求头

- `X-Request-ID`: 请求唯一标识符 (自动添加，如果客户端未提供)
- `X-Processing-Time`: 处理时间 (响应头)
- `X-Match-Count`: 匹配数量 (响应头，仅用于单个解析请求)
- `X-Batch-Size`: 批处理大小 (响应头，仅用于批量请求)
- `X-Success-Count`: 成功处理数量 (响应头，仅用于批量请求)

---

## 支持的语言

| 语言 | 标识符 |
|------|--------|
| JavaScript | `javascript` |
| TypeScript | `typescript` |
| Python | `python` |
| Java | `java` |
| Go | `go` |
| C# | `csharp` |
| C++ | `cpp` |
| Rust | `rust` |
| Ruby | `ruby` |

---

## 版本控制

当前API版本为v1，未来版本将通过URL路径进行版本控制：

- v1: `/api/v1/parse` (当前)
- v2: `/api/v2/parse` (未来版本)

向后兼容性保证：
- 不会删除现有字段
- 新增字段将是可选的
- 错误响应格式保持一致