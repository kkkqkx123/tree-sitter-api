# Tree-sitter API 规范文档

## 概述

本文档详细描述了基于原生Tree-sitter的轻量级API服务器的接口规范、数据格式和使用方法。

## 基础信息

- **基础URL**: `http://localhost:3000/api`
- **内容类型**: `application/json`
- **字符编码**: UTF-8
- **HTTP方法**: GET, POST

## 通用响应格式

所有API响应都遵循统一的JSON格式：

```typescript
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    errors?: string[];
    timestamp: string;
}
```

## 错误响应格式

```typescript
interface ErrorResponse {
    success: false;
    errors: string[];
    timestamp: string;
}
```

## API端点详情

### 1. 代码解析接口

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

**请求参数说明**:
- `language` (string, 必需): 编程语言标识符
  - 支持的值: `javascript`, `typescript`, `python`, `java`, `go`, `rust`, `cpp`, `c`, `csharp`, `ruby`
- `code` (string, 必需): 要解析的代码文本
- `query` (string, 可选): 单个Tree-sitter查询
- `queries` (string[], 可选): 多个Tree-sitter查询数组

**成功响应**:
```json
{
    "success": true,
    "data": {
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
                    "column": 39
                }
            },
            {
                "captureName": "id",
                "type": "identifier",
                "text": "hello",
                "startPosition": {
                    "row": 0,
                    "column": 9
                },
                "endPosition": {
                    "row": 0,
                    "column": 14
                }
            }
        ]
    },
    "timestamp": "2023-12-01T10:30:00.000Z"
}
```

**错误响应**:
```json
{
    "success": false,
    "errors": [
        "Unsupported language: invalid_lang"
    ],
    "timestamp": "2023-12-01T10:30:00.000Z"
}
```

**数据类型定义**:
```typescript
interface ParseRequest {
    language: string;
    code: string;
    query?: string;
    queries?: string[];
}

interface ParseResponse {
    matches: MatchResult[];
}

interface MatchResult {
    captureName: string;
    type: string;
    text: string;
    startPosition: Position;
    endPosition: Position;
}

interface Position {
    row: number;    // 行号，从0开始
    column: number; // 列号，从0开始
}
```

### 2. 健康检查接口

#### GET /api/health

获取API服务器的健康状态和资源使用情况。

**请求参数**: 无

**成功响应**:
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

**数据类型定义**:
```typescript
interface HealthResponse {
    status: 'healthy' | 'warning' | 'error';
    memory: MemoryInfo;
    supportedLanguages: string[];
    timestamp: string;
}

interface MemoryInfo {
    rss: number;        // 常驻内存集大小 (MB)
    heapTotal: number;  // 堆总大小 (MB)
    heapUsed: number;   // 已使用堆大小 (MB)
    external: number;   // 外部内存 (MB)
}
```

**状态说明**:
- `healthy`: 系统正常运行，内存使用在安全范围内
- `warning`: 内存使用较高，但系统仍可正常运行
- `error`: 内存使用过高，系统可能出现问题

### 3. 语言支持接口

#### GET /api/languages

获取API服务器支持的所有编程语言列表。

**请求参数**: 无

**成功响应**:
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

**数据类型定义**:
```typescript
interface LanguagesResponse {
    languages: string[];
}
```

## 查询语法示例

### JavaScript查询示例

```typescript
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

// 查询所有类声明
const classQuery = `
    (class_declaration
        name: (identifier) @class.name
        body: (class_body) @class.body) @class.declaration
`;
```

### Python查询示例

```typescript
// 查询所有函数定义
const functionQuery = `
    (function_definition
        name: (identifier) @function.name
        parameters: (parameters) @function.params
        body: (block) @function.body) @function.definition
`;

// 查询所有类定义
const classQuery = `
    (class_definition
        name: (identifier) @class.name
        body: (block) @class.body) @class.definition
`;

// 查询所有导入语句
const importQuery = `
    (import_statement
        name: (dotted_name) @import.name) @import.statement
`;
```

## 使用示例

### JavaScript/TypeScript客户端

```typescript
async function parseCode() {
    const response = await fetch('http://localhost:3000/api/parse', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            language: 'javascript',
            code: 'function add(a, b) { return a + b; }',
            query: '(function_declaration) @func'
        })
    });

    const result = await response.json();
    
    if (result.success) {
        console.log('解析结果:', result.data.matches);
    } else {
        console.error('解析错误:', result.errors);
    }
}
```

### Python客户端

```python
import requests
import json

def parse_code():
    url = 'http://localhost:3000/api/parse'
    data = {
        'language': 'python',
        'code': 'def hello():\n    print("Hello, World!")',
        'query': '(function_definition) @func'
    }
    
    response = requests.post(url, json=data)
    result = response.json()
    
    if result['success']:
        print('解析结果:', result['data']['matches'])
    else:
        print('解析错误:', result['errors'])

if __name__ == '__main__':
    parse_code()
```

### cURL示例

```bash
# 解析JavaScript代码
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "const x = 42;",
    "queries": ["(variable_declaration) @var"]
  }'

# 获取健康状态
curl http://localhost:3000/api/health

# 获取支持的语言列表
curl http://localhost:3000/api/languages
```

## 错误代码说明

| 错误类型 | HTTP状态码 | 描述 | 示例 |
|---------|-----------|------|------|
| 输入验证错误 | 400 | 请求参数格式错误或缺少必需参数 | `Missing required field: language` |
| 不支持的语言 | 404 | 请求的语言不在支持列表中 | `Unsupported language: php` |
| 解析错误 | 422 | 代码解析失败或查询语法错误 | `Invalid query syntax` |
| 服务器错误 | 500 | 内部服务器错误 | `Internal server error` |
| 内存不足 | 503 | 服务器内存不足，暂时无法处理请求 | `Service unavailable: out of memory` |

## 性能考虑

### 请求限制

- **请求体大小**: 最大5MB
- **代码长度**: 建议不超过100KB
- **查询数量**: 建议不超过10个
- **并发请求**: 建议不超过10个

### 最佳实践

1. **批量查询**: 使用`queries`数组而不是多次请求
2. **代码分割**: 对于大文件，考虑分段处理
3. **查询优化**: 使用具体的查询模式，避免过于宽泛的匹配
4. **错误处理**: 始终检查响应中的`success`字段
5. **资源监控**: 定期检查`/api/health`端点监控服务器状态

## 版本控制

当前API版本为v1，未来版本将通过URL路径进行版本控制：

- v1: `/api/v1/parse`
- v2: `/api/v2/parse` (未来版本)

向后兼容性保证：
- 不会删除现有字段
- 新增字段将是可选的
- 错误响应格式保持一致