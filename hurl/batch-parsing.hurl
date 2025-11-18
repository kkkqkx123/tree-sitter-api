# 批量解析测试用例

# 1. 批量解析JavaScript和Python代码
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": [
    {
      "language": "javascript",
      "code": "function hello() { console.log('Hello'); }",
      "query": "(function_declaration) @func"
    },
    {
      "language": "python",
      "code": "def hello():\n    print('Hello')",
      "query": "(function_definition) @func"
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.results" exists
jsonpath "$.data.results[0].success" == true
jsonpath "$.data.results[1].success" == true

# 2. 批量解析多种语言
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": [
    {
      "language": "javascript",
      "code": "const x = 10;",
      "query": "(variable_declaration) @var"
    },
    {
      "language": "typescript",
      "code": "interface User { name: string; }",
      "query": "(interface_declaration) @interface"
    },
    {
      "language": "java",
      "code": "public class Test {}",
      "query": "(class_declaration) @class"
    },
    {
      "language": "go",
      "code": "package main",
      "query": "(package_clause) @package"
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.results" exists
jsonpath "$.data.results[0].success" == true
jsonpath "$.data.results[1].success" == true
jsonpath "$.data.results[2].success" == true
jsonpath "$.data.results[3].success" == true

# 3. 批量解析包含错误的情况
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": [
    {
      "language": "javascript",
      "code": "function valid() { return true; }",
      "query": "(function_declaration) @func"
    },
    {
      "language": "unsupported_language",
      "code": "some code",
      "query": "(some_node) @node"
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.results" exists
jsonpath "$.data.results[0].success" == true
jsonpath "$.data.results[1].success" == false

# 4. 批量解析使用多查询
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": [
    {
      "language": "javascript",
      "code": "function add(a, b) { return a + b; } const result = add(1, 2);",
      "queries": [
        "(function_declaration) @func",
        "(identifier) @id"
      ]
    },
    {
      "language": "python",
      "code": "def multiply(x, y):\n    return x * y\n\nproduct = multiply(3, 4)",
      "queries": [
        "(function_definition) @func",
        "(identifier) @id"
      ]
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.results" exists
jsonpath "$.data.results[0].success" == true
jsonpath "$.data.results[1].success" == true
jsonpath "$.data.results[0].matches" exists
jsonpath "$.data.results[1].matches" exists

# 5. 批量解析空请求
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": []
}
HTTP 400
[Asserts]
jsonpath "$.success" == false

# 6. 批量解析超过限制的请求
POST http://localhost:4001/api/parse/batch
Content-Type: application/json
{
  "requests": [
    {"language": "javascript", "code": "function test1() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test2() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test3() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test4() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test5() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test6() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test7() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test8() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test9() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test10() {}", "query": "(function_declaration) @func"},
    {"language": "javascript", "code": "function test11() {}", "query": "(function_declaration) @func"}
  ]
}
HTTP 400
[Asserts]
jsonpath "$.success" == false