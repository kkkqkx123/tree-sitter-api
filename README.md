# Tree-sitter API Server

基于原生Tree-sitter的轻量级API服务器，专为小规模使用场景设计，注重资源节约和稳定性。

## 项目特点

- **完全弃用WASM**：使用原生Tree-sitter Node.js绑定
- **资源节约**：针对小规模使用场景优化内存和CPU使用
- **简化部署**：最少的依赖和简单的配置；提供docker支持
- **健壮性**：健壮的错误处理和资源管理

## 支持的编程语言

- JavaScript
- TypeScript
- Python
- Java
- Go
- Rust
- C/C++
- C#
- Ruby

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量示例文件并根据需要修改：

```bash
cp .env.example .env
```

### 构建项目

```bash
npm run build
```

### 启动服务器

```bash
npm start
```

### 开发模式

```bash
npm run dev
```

## API接口

### 解析代码

```bash
POST /api/parse
Content-Type: application/json

{
  "language": "javascript",
  "code": "function hello() { console.log('Hello'); }",
  "queries": ["(function_declaration) @func"]
}
```

### 健康检查

```bash
GET /api/health
```

### 支持的语言列表

```bash
GET /api/languages
```

## 项目结构

```
tree-sitter-api/
├── src/
│   ├── config/          # 配置文件
│   ├── core/            # 核心服务
│   ├── errors/          # 错误处理
│   ├── middleware/      # 中间件
│   ├── routes/          # 路由
│   ├── controllers/     # 控制器
│   ├── types/           # 类型定义
│   ├── utils/           # 工具函数
│   └── server.ts        # 服务器入口
├── tests/               # 测试文件
├── docs/                # 文档
└── dist/                # 构建输出
```

## 开发脚本

- `npm run build` - 构建项目
- `npm start` - 启动生产服务器
- `npm run dev` - 启动开发服务器
- `npm test` - 运行测试
- `npm run lint` - 代码检查
- `npm run format` - 代码格式化

## 配置说明

### 内存配置

- `MAX_MEMORY_MB` - 最大内存使用量 (默认: 512MB)
- `MEMORY_WARNING_THRESHOLD` - 内存警告阈值 (默认: 200MB)
- `MEMORY_CRITICAL_THRESHOLD` - 内存严重阈值 (默认: 300MB)

### 请求配置

- `REQUEST_TIMEOUT` - 请求超时时间 (默认: 30秒)
- `MAX_REQUEST_SIZE` - 最大请求大小 (默认: 5mb)
- `MAX_CONCURRENT_REQUESTS` - 最大并发请求数 (默认: 10)

### Tree-sitter配置

- `PARSER_POOL_SIZE` - 解析器池大小 (默认: 3)
- `MAX_CODE_LENGTH` - 最大代码长度 (默认: 100KB)
- `QUERY_TIMEOUT` - 查询超时时间 (默认: 30秒)

## 核心组件

### LanguageManager
- 管理所有支持的编程语言
- 懒加载语言模块以减少启动时间
- 提供语言模块缓存和状态监控

### LightweightParserPool
- 轻量级解析器池，适合小规模使用
- 自动资源管理和清理
- 支持池大小限制和超时处理

### MemoryMonitor
- 实时内存使用监控
- 内存趋势分析和泄漏检测
- 智能清理触发机制

### ResourceCleaner
- 分层清理策略（基础、激进、紧急）
- 自动垃圾回收和资源释放
- 清理历史记录和统计

### TreeSitterService
- 统一的请求处理接口
- 完整的资源生命周期管理
- 健康检查和性能监控

## 文档

- [架构设计](docs/ARCHITECTURE.md)
- [API规范](docs/API_SPECIFICATION.md)
- [内存管理](docs/MEMORY_MANAGEMENT.md)

## 性能特点

- **内存使用**：优化的小规模内存使用，默认限制512MB
- **响应时间**：单个请求通常在100ms内完成
- **并发处理**：支持10个并发请求，适合小规模应用
- **资源管理**：自动清理和垃圾回收，防止内存泄漏

## 许可证
MIT