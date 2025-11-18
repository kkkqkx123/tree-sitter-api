# E2E测试说明

本目录包含Tree-sitter API的端到端测试，这些测试会实际启动应用服务器并发送真实的HTTP请求。

## 测试结构

```
tests/
├── e2e/
│   ├── api.test.ts          # 主要的E2E测试文件
│   └── README.md            # 本说明文件
├── data/                    # 测试数据目录
│   ├── javascript_test.json # JavaScript测试数据
│   ├── python_test.json     # Python测试数据
│   ├── java_test.json       # Java测试数据
│   └── error_test.json      # 错误测试数据
├── result/                  # 测试结果目录
│   ├── latest-e2e-results.json # 最新测试结果
│   └── e2e-test-results-*.json  # 带时间戳的历史结果
└── setup.ts                 # Jest测试设置文件
```

## 测试数据格式

每个测试数据文件包含以下字段：

```json
{
  "language": "javascript",  // 编程语言标识符
  "code": "function hello() { ... }",  // 要解析的代码
  "query": "(function_declaration) @func",  // 单个查询（可选）
  "queries": [  // 多个查询数组（可选）
    "(class_declaration) @class",
    "(call_expression) @call"
  ]
}
```

## 运行测试

### 运行所有E2E测试

```bash
npm run test:e2e
```

### 运行特定测试

```bash
npx jest tests/e2e/api.test.ts
```

### 运行测试并查看详细输出

```bash
npx jest tests/e2e --verbose
```

## 测试结果保存

### 自动保存功能

E2E测试会自动将所有API响应保存到JSON文件中，包括：

- **请求数据**：发送给API的原始请求
- **响应数据**：API返回的完整响应
- **状态码**：HTTP状态码
- **响应时间**：每个请求的耗时
- **时间戳**：测试执行的时间

### 结果文件位置

- **最新结果**：`tests/result/latest-e2e-results.json`
- **历史结果**：`tests/result/e2e-test-results-YYYY-MM-DDTHH-MM-SS-SSSZ.json`

### 结果文件格式

```json
{
  "testSuite": "Tree-sitter API E2E Tests",
  "timestamp": "2025-11-18T13:26:16.741Z",
  "totalTests": 7,
  "results": [
    {
      "testName": "JavaScript代码解析测试",
      "requestData": {
        "language": "javascript",
        "code": "function hello() { ... }",
        "query": "(function_declaration) @func",
        "queries": ["(class_declaration) @class"]
      },
      "responseData": {
        "success": true,
        "data": [
          {
            "captureName": "func",
            "type": "function_declaration",
            "text": "function hello() { ... }",
            "startPosition": {"row": 0, "column": 0},
            "endPosition": {"row": 0, "column": 50}
          }
        ],
        "errors": [],
        "timestamp": "2025-11-18T13:26:14.478Z"
      },
      "statusCode": 200,
      "duration": 108,
      "timestamp": "2025-11-18T13:26:14.489Z"
    }
  ]
}
```

## 测试用例

当前E2E测试包含以下测试用例：

1. **JavaScript代码解析测试** - 验证JavaScript代码的解析和查询功能
2. **Python代码解析测试** - 验证Python代码的解析和查询功能
3. **Java代码解析测试** - 验证Java代码的解析和查询功能
4. **错误处理测试** - 验证不支持的语言的错误处理
5. **健康检查测试** - 验证`/api/health`端点
6. **语言列表测试** - 验证`/api/languages`端点
7. **根路径测试** - 验证`/`根端点

## 测试流程

1. **启动服务器** - 测试开始前会启动一个真实的Tree-sitter API服务器实例
2. **加载测试数据** - 从`tests/data/`目录加载JSON测试数据
3. **发送请求** - 使用axios发送HTTP请求到运行中的服务器
4. **记录结果** - 将所有请求和响应数据保存到JSON文件
5. **验证响应** - 检查响应状态码、数据格式和内容
6. **关闭服务器** - 测试完成后优雅关闭服务器

## 环境配置

测试使用以下环境变量：

- `NODE_ENV=test` - 设置为测试环境
- `PORT=3001` - 使用3001端口避免与开发服务器冲突

## 注意事项

1. **端口冲突** - 确保端口3001未被其他进程占用
2. **内存限制** - 测试设置了较高的内存限制以处理Tree-sitter解析
3. **超时设置** - 每个测试的超时时间为60秒
4. **依赖安装** - 确保已安装axios依赖：`npm install --save-dev axios @types/axios`

## 故障排除

### 测试失败

如果测试失败，请检查：

1. 服务器是否正常启动（查看控制台输出）
2. 端口是否被占用
3. 依赖是否正确安装
4. 测试数据格式是否正确

### 调试技巧

1. 使用`--verbose`标志查看详细输出
2. 检查测试日志中的错误信息
3. 手动运行服务器并使用curl测试API端点
4. 查看`tests/result/`目录中的JSON结果文件分析响应

## 结果分析

### 查看最新结果

```bash
cat tests/result/latest-e2e-results.json
```

### 分析响应时间

结果文件中的`duration`字段显示每个请求的响应时间（毫秒），可用于性能分析。

### 验证数据完整性

通过检查`responseData`字段可以验证API返回的数据结构和内容是否符合预期。

## 添加新测试

要添加新的E2E测试：

1. 在`tests/data/`目录创建新的JSON测试数据文件
2. 在`tests/e2e/api.test.ts`中添加新的测试用例
3. 使用`executeTestRequest`函数包装请求以自动记录结果
4. 编写相应的断言验证响应

示例：

```typescript
test('should parse new language', async () => {
  const testData = loadTestData('new_language_test.json');
  
  const response = await executeTestRequest(
    '新语言解析测试',
    testData,
    async () => axios.post(`${baseURL}/api/parse`, testData)
  );
  
  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  // 添加更多断言...
});
```

## 结果文件管理

- **自动清理**：建议定期清理旧的结果文件以节省磁盘空间
- **版本控制**：建议将`tests/result/`目录添加到`.gitignore`中
- **备份重要结果**：对于重要的测试结果，可以手动备份到其他位置