# Tree-sitter Query REST API 文档

## 概述

Tree-sitter Query REST API 提供了一个基于HTTP的接口，用于批量处理代码语法分析和Tree-sitter查询。该API支持多种编程语言，能够高效地处理多个代码片段和查询规则。

## 基础信息

- **基础URL**: `http://localhost:3000/api`
- **内容类型**: `application/json`
- **响应格式**: JSON

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

## API端点

### 1. 健康检查端点

**GET /api/health**

检查API服务状态。

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### 2. 语法分析和查询端点

**POST /api/parse**

批量处理代码语法分析和Tree-sitter查询。

**请求体:**
```json
{
  "requests": [
    {
      "language": "cpp",
      "code": "int main() { return 0; }",
      "query": "(function_definition) @func"
    },
    {
      "language": "python",
      "code": "def hello():\n    print('Hello')",
      "queries": [
        "(function_definition) @func",
        "(call function: (identifier) @func_name)"
      ]
    }
  ]
}
```

**字段说明:**
- `requests`: 请求数组，每个元素包含:
  - `language`: 编程语言标识符（必需）
  - `code`: 要分析的代码字符串（必需）
  - `query`: 单个Tree-sitter查询规则（可选）
  - `queries`: 多个Tree-sitter查询规则数组（可选）

**响应:**
```json
{
  "results": [
    {
      "success": true,
      "matches": [
        {
          "captureName": "func",
          "type": "function_definition",
          "text": "int main() { return 0; }",
          "startPosition": {
            "row": 0,
            "column": 0
          },
          "endPosition": {
            "row": 0,
            "column": 20
          }
        }
      ],
      "errors": []
    },
    {
      "success": true,
      "matches": [
        {
          "captureName": "func",
          "type": "function_definition",
          "text": "def hello():\n    print('Hello')",
          "startPosition": {
            "row": 0,
            "column": 0
          },
          "endPosition": {
            "row": 1,
            "column": 19
          }
        },
        {
          "captureName": "func_name",
          "type": "identifier",
          "text": "print",
          "startPosition": {
            "row": 1,
            "column": 8
          },
          "endPosition": {
            "row": 1,
            "column": 13
          }
        }
      ],
      "errors": []
    }
  ]
}
```

**错误响应:**
```json
{
  "error": "Invalid language specified",
  "details": "Language 'invalid_lang' is not supported"
}
```

## 使用示例

### 示例1: 单个查询
```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "language": "javascript",
        "code": "function test() { return 42; }",
        "query": "(function_declaration) @func"
      }
    ]
  }'
```

### 示例2: 多个查询
```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "language": "python",
        "code": "def calculate():\n    result = 10 + 20\n    return result",
        "queries": [
          "(function_definition) @func",
          "(assignment target: (identifier) @var)",
          "(return_statement value: (identifier) @return_var)"
        ]
      }
    ]
  }'
```

## 错误代码

| HTTP状态码 | 错误描述 |
|------------|----------|
| 400 | 请求格式错误或参数缺失 |
| 404 | 不支持的编程语言 |
| 500 | 服务器内部错误 |

## 性能考虑

- API设计为批量处理，建议一次性发送多个请求
- 支持并发处理，但建议合理控制请求数量
- 大文件处理可能会有性能限制

## 版本历史

- v1.0.0 (2024-01-15): 初始版本发布