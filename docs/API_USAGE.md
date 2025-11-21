# Tree-sitter API 使用指南

本文档介绍如何使用基于原生Tree-sitter的轻量级API服务器。

## 快速开始

### 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务器默认在 `http://localhost:4001` 启动。

### 基本请求示例

```bash
# 解析JavaScript代码
curl -X POST http://localhost:4001/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "function hello() { console.log(\"Hello\"); }",
    "queries": ["(function_declaration) @func"]
  }'

# 获取健康状态
curl http://localhost:4001/api/health

# 获取支持的语言列表
curl http://localhost:4001/api/languages
```

## API 端点

### 1. 代码解析

#### POST /api/parse

解析代码并执行Tree-sitter查询。

**请求体**:
```json
{
  "language": "javascript",
  "code": "function hello() { console.log('Hello'); }",
  "queries": [
    "(function_declaration) @func",
    "(identifier) @id",
    "(string_literal) @str"
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "captureName": "func",
      "type": "function_declaration",
      "text": "function hello() { console.log('Hello'); }",
      "startPosition": {
        "row": 0,
        "column": 0
      },
      "endPosition": {
        "row": 0,
        "column": 39
      }
    }
  ],
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### POST /api/parse/batch

批量解析多个代码片段。

**请求体**:
```json
{
  "requests": [
    {
      "language": "javascript",
      "code": "function hello() { console.log('Hello'); }",
      "queries": ["(function_declaration) @func"]
    },
    {
      "language": "python",
      "code": "def hello():\n    print('Hello')",
      "queries": ["(function_definition) @func"]
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "matches": [
          {
            "captureName": "func",
            "type": "function_declaration",
            "text": "function hello() { console.log('Hello'); }",
            "startPosition": {
              "row": 0,
              "column": 0
            },
            "endPosition": {
              "row": 0,
              "column": 42
            }
          }
        ],
        "errors": []
      }
    ],
    "summary": {
      "total": 1,
      "successful": 1,
      "failed": 0,
      "totalMatches": 1
    }
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### POST /api/parse/validate

验证查询语法是否正确。

**请求体**:
```json
{
  "language": "javascript",
  "query": "(function_declaration) @func"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "language": "javascript",
    "query": "(function_declaration) @func",
    "message": "Query syntax is valid"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

### 2. 健康检查

#### GET /api/health

获取基本健康状态。

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "memory": {
      "rss": 45,
      "heapTotal": 30,
      "heapUsed": 25,
      "external": 2
    },
    "supportedLanguages": [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "rust",
      "cpp",
      "c",
      "csharp",
      "ruby"
    ],
    "timestamp": "2023-12-01T10:30:00.000Z"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET /api/health/detailed

获取详细的健康状态和统计信息。

**响应**:
```json
{
  "success": true,
  "data": {
    "health": {
      "status": "healthy",
      "memory": {
        "level": "normal",
        "heapUsed": 142,
        "heapTotal": 147,
        "rss": 135,
        "external": 7,
        "trend": "stable"
      },
      "parserPool": {
        "totalPooled": 0,
        "totalActive": 0,
        "languageStats": {},
        "memoryUsage": {
          "estimatedParsers": 0,
          "estimatedMemoryMB": 0
        }
      },
      "languageManager": {
        "supportedLanguages": ["javascript", "typescript", "python", "java", "go", "rust", "cpp", "c", "csharp", "ruby"],
        "loadedLanguages": [],
        "loadingLanguages": [],
        "totalSupported": 10,
        "totalLoaded": 0,
        "totalLoading": 0
      },
      "service": {
        "requestCount": 0,
        "errorCount": 0,
        "errorRate": 0,
        "activeResources": {
          "trees": 0,
          "queries": 0
        }
      }
    },
    "memory": {
      "status": {
        "level": "normal",
        "heapUsed": 142,
        "heapTotal": 147,
        "rss": 135,
        "external": 7,
        "trend": "stable"
      }
    },
    "stats": {
      "current": 142,
      "peak": 142,
      "trend": "stable",
      "historyLength": 0
    }
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET /api/health/memory

获取详细的内存使用情况。

**响应**:
```json
{
  "success": true,
  "data": {
    "current": {
      "rss": 138,
      "heapTotal": 148,
      "heapUsed": 142,
      "external": 7,
      "arrayBuffers": 5
    },
    "status": {
      "level": "normal",
      "heapUsed": 142,
      "heapTotal": 148,
      "rss": 138,
      "external": 7,
      "trend": "stable"
    },
    "history": {
      "level": "normal",
      "heapUsed": 142,
      "heapTotal": 148,
      "rss": 138,
      "external": 7,
      "trend": "stable"
    },
    "gc": {
      "available": false
    }
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET /api/health/stats

获取服务统计信息。

**响应**:
```json
{
  "success": true,
  "data": {
    "service": {
      "requestCount": 0,
      "errorCount": 0,
      "errorRate": 0,
      "activeResources": {
        "trees": 0,
        "queries": 0
      }
    },
    "parserPool": {
      "totalPooled": 0,
      "totalActive": 0,
      "languageStats": {},
      "memoryUsage": {
        "estimatedParsers": 0,
        "estimatedMemoryMB": 0
      }
    },
    "languageManager": {
      "supportedLanguages": ["javascript", "typescript", "python", "java", "go", "rust", "cpp", "c", "csharp", "ruby"],
      "loadedLanguages": [],
      "loadingLanguages": [],
      "totalSupported": 10,
      "totalLoaded": 0,
      "totalLoading": 0
    },
    "uptime": 589.2308413,
    "process": {
      "pid": 16404,
      "version": "v22.14.0",
      "platform": "win32",
      "arch": "x64"
    }
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### POST /api/health/cleanup

触发内存清理。

**请求体**:
```json
{
  "strategy": "basic" // "basic", "aggressive", "emergency"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Memory cleanup completed successfully"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### POST /api/health/reset

重置统计信息。

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Statistics reset successfully"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

### 3. 语言管理

#### GET /api/languages

获取支持的语言列表。

**响应**:
```json
{
  "success": true,
  "data": {
    "languages": [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "rust",
      "cpp",
      "c",
      "csharp",
      "ruby"
    ]
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET /api/languages/:language

获取特定语言的详细信息。

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "JavaScript",
    "extensions": [".js", ".jsx", ".mjs"],
    "mimeType": "text/javascript",
    "description": "JavaScript programming language",
    "popularity": "high"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET /api/languages/:language/examples

获取特定语言的查询示例。

**响应**:
```json
{
  "success": true,
  "data": {
    "language": "javascript",
    "examples": [
      {
        "name": "Function declarations",
        "description": "Find all function declarations",
        "query": "(function_declaration name: (identifier) @name) @function"
      },
      {
        "name": "Variable declarations",
        "description": "Find all variable declarations",
        "query": "(variable_declaration (variable_declarator name: (identifier) @name)) @variable"
      }
    ]
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### POST /api/languages/preload

预加载语言模块。

**请求体**:
```json
{
  "languages": ["javascript", "python"] // 可选，不提供则预加载所有语言
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "languages": ["javascript", "python"],
    "count": 2,
    "duration": 130,
    "message": "Successfully preloaded 2 languages in 130ms"
  },
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

## 支持的语言

- JavaScript (javascript)
- TypeScript (typescript)
- Python (python)
- Java (java)
- Go (go)
- Rust (rust)
- C++ (cpp)
- C (c)
- C# (csharp)
- Ruby (ruby)

## 查询语法示例

### JavaScript

```javascript
// 查询所有函数声明
const functionQuery = `
  (function_declaration
    name: (identifier) @function.name
    parameters: (formal_parameters) @function.params
    body: (statement_block) @function.body) @function.declaration
`;

// 查询所有变量声明
const variableQuery = `
  (variable_declaration
    (variable_declarator
      name: (identifier) @variable.name
      value: _ @variable.value)) @variable.declaration
`;
```

### Python

```python
# 查询所有函数定义
function_query = """
  (function_definition
    name: (identifier) @function.name
    parameters: (parameters) @function.params
    body: (block) @function.body) @function.definition
"""

# 查询所有类定义
class_query = """
  (class_definition
    name: (identifier) @class.name
    body: (block) @class.body) @class.definition
"""
```

## 错误处理

API使用统一的错误响应格式：

```json
{
  "success": false,
  "errors": ["错误描述"],
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

常见错误代码：

- 400: 请求参数错误
- 404: 不支持的语言或路由
- 413: 请求体过大
- 422: 解析或查询错误（包括查询验证中的不支持语言）
- 429: 请求过于频繁
- 500: 服务器内部错误
- 503: 服务不可用（内存不足等）

## 限制和配置

### 请求限制

- 请求体大小: 最大5MB
- 代码长度: 最大100KB
- 查询数量: 最多10个
- 并发请求: 最多10个
- 批量请求数量: 最多10个

### 内存配置

- 警告阈值: 200MB
- 严重阈值: 300MB
- 最大阈值: 400MB

### 环境变量

```bash
# 服务器配置
PORT=4001
HOST=localhost
NODE_ENV=development

# 内存配置
MAX_MEMORY_MB=512
MEMORY_WARNING_THRESHOLD=200
MEMORY_CRITICAL_THRESHOLD=300

# 请求配置
REQUEST_TIMEOUT=30000
MAX_REQUEST_SIZE=5mb
MAX_CONCURRENT_REQUESTS=10

# 日志配置
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

## 客户端示例

### JavaScript/TypeScript

```typescript
async function parseCode() {
  const response = await fetch('http://localhost:4001/api/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: 'javascript',
      code: 'function add(a, b) { return a + b; }',
      queries: ['(function_declaration) @func']
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('解析结果:', result.data);
  } else {
    console.error('解析错误:', result.errors);
  }
}
```

### Python

```python
import requests
import json

def parse_code():
    url = 'http://localhost:4001/api/parse'
    data = {
        'language': 'python',
        'code': 'def hello():\n    print("Hello, World!")',
        'queries': ['(function_definition) @func']
    }
    
    response = requests.post(url, json=data)
    result = response.json()
    
    if result['success']:
        print('解析结果:', result['data'])
    else:
        print('解析错误:', result['errors'])

if __name__ == '__main__':
    parse_code()
```

## 性能优化建议

1. **批量查询**: 使用 `queries` 数组而不是多次请求
2. **批量处理**: 使用 `/api/parse/batch` 端点处理多个代码片段
3. **代码分割**: 对于大文件，考虑分段处理
4. **查询优化**: 使用具体的查询模式，避免过于宽泛的匹配
5. **错误处理**: 始终检查响应中的 `success` 字段
6. **资源监控**: 定期检查 `/api/health` 端点监控服务器状态

## 故障排除

### 常见问题

1. **内存不足错误**
   - 减少并发请求数
   - 触发内存清理: `POST /api/health/cleanup`
   - 检查代码长度是否超过限制

2. **解析失败**
   - 检查语言是否支持
   - 验证代码语法是否正确
   - 使用查询验证端点检查查询语法

3. **性能问题**
   - 使用批量处理减少请求次数
   - 优化查询复杂度
   - 监控内存使用情况

4. **查询验证问题**
   - 查询验证只检查语法有效性，不验证节点类型是否存在
   - 不支持的语言在查询验证中返回 422 错误

### 日志和监控

服务器提供详细的日志记录和监控功能：

- 请求日志: 记录所有API请求和响应
- 内存监控: 实时监控内存使用情况
- 错误追踪: 记录和分析错误模式
- 性能指标: 请求处理时间和资源使用情况

可以通过 `/api/health/detailed` 端点获取详细的系统状态信息。

## 查询验证说明

查询验证端点 (`/api/parse/validate`) 仅验证查询语法的正确性，不会验证查询中使用的节点类型是否在特定语言中实际存在。这意味着语法正确但使用不存在节点类型的查询仍然会返回 `valid: true`。

要验证查询是否能实际匹配代码，建议使用 `/api/parse` 端点进行实际测试。