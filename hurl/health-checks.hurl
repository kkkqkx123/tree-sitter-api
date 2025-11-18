# 健康检查相关测试用例

# 1. 基本健康状态检查
GET http://localhost:4001/api/health
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.status" == "healthy"
jsonpath "$.data.supportedLanguages" contains "javascript"
jsonpath "$.data.supportedLanguages" contains "python"
jsonpath "$.data.supportedLanguages" contains "typescript"

# 2. 详细健康状态检查
GET http://localhost:4001/api/health/detailed
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.health.status" == "healthy"
jsonpath "$.data.health.memory" exists
jsonpath "$.data.memory" exists

# 3. 内存使用情况检查
GET http://localhost:4001/api/health/memory
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.current.rss" exists
jsonpath "$.data.current.heapTotal" exists
jsonpath "$.data.current.heapUsed" exists
jsonpath "$.data.current.external" exists

# 4. 服务统计信息检查
GET http://localhost:4001/api/health/stats
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data.service" exists
jsonpath "$.data.parserPool" exists
jsonpath "$.data.languageManager" exists

# 5. 内存清理 - 基本策略
POST http://localhost:4001/api/health/cleanup
Content-Type: application/json
{
  "strategy": "basic"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 6. 内存清理 - 激进策略
POST http://localhost:4001/api/health/cleanup
Content-Type: application/json
{
  "strategy": "aggressive"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 7. 重置统计信息
POST http://localhost:4001/api/health/reset
HTTP 200
[Asserts]
jsonpath "$.success" == true