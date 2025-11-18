# 语言管理相关测试用例

# 1. 获取支持的语言列表
GET http://localhost:4001/api/languages
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.languages" contains "javascript"
jsonpath "$.data.languages" contains "typescript"
jsonpath "$.data.languages" contains "python"
jsonpath "$.data.languages" contains "java"
jsonpath "$.data.languages" contains "go"
jsonpath "$.data.languages" contains "rust"
jsonpath "$.data.languages" contains "cpp"
jsonpath "$.data.languages" contains "c"
jsonpath "$.data.languages" contains "csharp"
jsonpath "$.data.languages" contains "ruby"

# 2. 获取JavaScript语言详细信息
GET http://localhost:4001/api/languages/javascript
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "JavaScript"
jsonpath "$.data.extensions" exists

# 3. 获取Python语言详细信息
GET http://localhost:4001/api/languages/python
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "Python"
jsonpath "$.data.extensions" exists

# 4. 获取TypeScript语言详细信息
GET http://localhost:4001/api/languages/typescript
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "TypeScript"
jsonpath "$.data.extensions" exists

# 5. 获取Java语言详细信息
GET http://localhost:4001/api/languages/java
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "Java"
jsonpath "$.data.extensions" exists

# 6. 获取Go语言详细信息
GET http://localhost:4001/api/languages/go
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "Go"
jsonpath "$.data.extensions" exists

# 7. 获取Rust语言详细信息
GET http://localhost:4001/api/languages/rust
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "Rust"
jsonpath "$.data.extensions" exists

# 8. 获取C++语言详细信息
GET http://localhost:4001/api/languages/cpp
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "C++"
jsonpath "$.data.extensions" exists

# 9. 获取C语言详细信息
GET http://localhost:4001/api/languages/c
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "C"
jsonpath "$.data.extensions" exists

# 10. 获取C#语言详细信息
GET http://localhost:4001/api/languages/csharp
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "C#"
jsonpath "$.data.extensions" exists

# 11. 获取Ruby语言详细信息
GET http://localhost:4001/api/languages/ruby
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.name" == "Ruby"
jsonpath "$.data.extensions" exists

# 12. 获取不支持的语言信息
GET http://localhost:4001/api/languages/unsupported
HTTP 404
[Asserts]
jsonpath "$.success" == false

# 13. 获取JavaScript查询示例
GET http://localhost:4001/api/languages/javascript/examples
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists

# 14. 获取Python查询示例
GET http://localhost:4001/api/languages/python/examples
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists

# 15. 获取TypeScript查询示例
GET http://localhost:4001/api/languages/typescript/examples
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists

# 16. 预加载特定语言
POST http://localhost:4001/api/languages/preload
Content-Type: application/json
{
  "languages": ["javascript", "python"]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.languages" exists

# 17. 预加载所有语言
POST http://localhost:4001/api/languages/preload
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.languages" exists

# 18. 预加载不存在的语言
POST http://localhost:4001/api/languages/preload
Content-Type: application/json
{
  "languages": ["nonexistent_language"]
}
HTTP 400
[Asserts]
jsonpath "$.success" == false

# 19. 获取Java查询示例
GET http://localhost:4001/api/languages/java/examples
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists

# 20. 获取Go查询示例
GET http://localhost:4001/api/languages/go/examples
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists