# API 端点详情

## 解析端点

### `POST /api/parse`

解析单个代码片段并执行Tree-sitter查询。

#### 请求格式
```json
{
  "language": "javascript",
  "code": "const x = 1;",
  "queries": ["(variable_declarator) @var", "(identifier) @id"]
}
```

#### 请求参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| language | string | 是 | 编程语言标识符 |
| code | string | 是 | 要解析的代码内容 |
| queries | string[] | 是 | 多个Tree-sitter查询字符串数组，至少一个查询，最多10个查询 |

#### 验证规则
- `language` 必须是有效的语言标识符（字母数字字符、连字符和下划线）
- `code` 必须是字符串，且长度不超过配置的最大值
- `queries` 必须提供且至少包含一个查询，最多10个查询
- 查询语法必须有效（平衡的括号，包含@符号）

#### 响应格式
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

#### 响应参数
| 参数 | 类型 | 说明 |
|------|------|------|
| success | boolean | 请求是否成功 |
| data | MatchResult[] | 匹配结果数组 |
| errors | string[] | 错误信息数组 |
| timestamp | string | 响应时间戳 |

#### MatchResult 参数
| 参数 | 类型 | 说明 |
|------|------|
| captureName | string | 捕获名称 |
| type | string | 节点类型 |
| text | string | 匹配的文本内容 |
| startPosition | Position | 开始位置 |
| endPosition | Position | 结束位置 |

#### Position 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| row | number | 行号（从0开始） |
| column | number | 列号（从0开始） |

---

### `POST /api/parse/batch`

批量解析多个代码片段。

#### 请求格式
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

#### 请求参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| requests | ParseRequest[] | 是 | 解析请求数组，最多10个请求 |

#### ParseRequest 参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| language | string | 是 | 编程语言标识符 |
| code | string | 是 | 要解析的代码内容 |
| queries | string[] | 是 | 多个Tree-sitter查询字符串数组，至少一个查询，最多10个查询 |

#### 响应格式
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

#### Summary 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| total | number | 总请求数 |
| successful | number | 成功请求数 |
| failed | number | 失败请求数 |
| totalMatches | number | 总匹配数 |

---

### `POST /api/parse/validate`

验证Tree-sitter查询语法。

#### 请求格式
```json
{
  "language": "javascript",
  "query": "(function_declaration) @func"
}
```

#### 请求参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|
| language | string | 是 | 编程语言标识符 |
| query | string | 是 | 要验证的查询字符串 |

#### 响应格式
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

#### ValidationData 参数
| 参数 | 类型 | 说明 |
|------|------|
| valid | boolean | 查询是否有效 |
| language | string | 语言标识符 |
| query | string | 查询字符串 |
| message | string | 验证消息 |

---

## 健康检查端点

### `GET /api/health`

检查API服务基本状态。

#### 响应格式
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

#### HealthResponse 参数
| 参数 | 类型 | 说明 |
|------|------|
| status | "healthy" \| "warning" \| "error" | 服务状态 |
| memory | MemoryInfo | 内存信息 |
| supportedLanguages | string[] | 支持的语言列表 |
| timestamp | string | 响应时间戳 |

#### MemoryInfo 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| rss | number | 常驻内存集大小 (MB) |
| heapTotal | number | 堆总大小 (MB) |
| heapUsed | number | 已使用堆大小 (MB) |
| external | number | 外部内存 (MB) |

---

### `GET /api/health/detailed`

获取详细健康检查信息。

#### 响应格式
```json
{
  "status": "healthy",
  "memory": {...},
  "errors": {...},
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### DetailedHealthResponse 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| status | "healthy" \| "warning" \| "error" | 服务状态 |
| memory | MemoryStatus | 内存状态 |
| errors | ErrorStatistics | 错误统计 |
| uptime | number | 服务运行时间（秒） |
| timestamp | string | 响应时间戳 |

---

### `GET /api/health/memory`

获取内存使用情况。

#### 响应格式
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

### `GET /api/health/stats`

获取服务统计信息。

#### 响应格式
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

### `POST /api/health/cleanup`

触发内存清理。

#### 响应格式
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

### `POST /api/health/reset`

重置统计信息。

#### 响应格式
```json
{
  "success": true,
  "message": "Statistics reset successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 语言端点

### `GET /api/languages`

获取支持的语言列表。

#### 响应格式
```json
{
  "languages": ["javascript", "python", "java", "go", "rust", "cpp", "csharp", "ruby"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### LanguagesResponse 参数
| 参数 | 类型 | 说明 |
|------|------|
| languages | string[] | 支持的语言列表 |
| timestamp | string | 响应时间戳 |

---

### `GET /api/languages/:language`

获取特定语言的详细信息。

#### 路径参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| language | string | 是 | 语言标识符 |

#### 响应格式
```json
{
  "language": "javascript",
  "supported": true,
  "version": "0.20.0",
  "features": ["function", "class", "variable"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### LanguageInfo 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| language | string | 语言标识符 |
| supported | boolean | 是否支持该语言 |
| version | string | 语言解析器版本 |
| features | string[] | 语言特性列表 |
| timestamp | string | 响应时间戳 |

---

### `GET /api/languages/:language/examples`

获取特定语言的查询示例。

#### 路径参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|
| language | string | 是 | 语言标识符 |

#### 响应格式
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

#### QueryExample 参数
| 参数 | 类型 | 说明 |
|------|------|
| name | string | 示例名称 |
| query | string | 查询字符串 |
| description | string | 示例描述 |
| timestamp | string | 响应时间戳 |

---

### `POST /api/languages/preload`

预加载指定语言。

#### 请求格式
```json
{
  "languages": ["javascript", "python"]
}
```

#### 请求参数
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|
| languages | string[] | 否 | 要预加载的语言数组 |

#### 响应格式
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

#### PreloadResult 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| loaded | string[] | 成功预加载的语言列表 |
| failed | string[] | 预加载失败的语言列表 |
| message | string | 预加载消息 |