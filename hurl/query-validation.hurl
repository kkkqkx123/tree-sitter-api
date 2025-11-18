# 查询验证测试用例

# 1. 验证有效的JavaScript查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "javascript",
  "query": "(function_declaration) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 2. 验证有效的Python查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "python",
  "query": "(function_definition) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 3. 验证有效的TypeScript查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "typescript",
  "query": "(interface_declaration) @interface"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 4. 验证语法有效的查询（即使节点类型不存在）
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "javascript",
  "query": "(function_declaration @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 5. 验证不存在的节点类型（语法有效）
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "javascript",
  "query": "(nonexistent_node_type) @node"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 6. 验证复杂的查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "javascript",
  "query": "(function_declaration name: (identifier) @name parameters: (formal_parameters) @params) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 7. 验证空查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "javascript",
  "query": ""
}
HTTP 400
[Asserts]
jsonpath "$.success" == false

# 8. 验证缺少语言参数
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "query": "(function_declaration) @func"
}
HTTP 400
[Asserts]
jsonpath "$.success" == false

# 9. 验证不支持的语言
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "unsupported_language",
  "query": "(function_declaration) @func"
}
HTTP 422
[Asserts]
jsonpath "$.success" == false

# 10. 验证Java查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "java",
  "query": "(class_declaration name: (identifier) @name) @class"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 11. 验证Go查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "go",
  "query": "(function_declaration name: (identifier) @name) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 12. 验证Rust查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "rust",
  "query": "(function_item name: (identifier) @name) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 13. 验证C++查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "cpp",
  "query": "(function_definition declarator: (function_declarator declarator: (identifier) @name)) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 14. 验证C#查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "csharp",
  "query": "(class_declaration name: (identifier) @name) @class"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true

# 15. 验证Ruby查询
POST http://localhost:4001/api/parse/validate
Content-Type: application/json
{
  "language": "ruby",
  "query": "(method name: (identifier) @name) @method"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.valid" == true