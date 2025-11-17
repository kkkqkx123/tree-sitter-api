# Tree-sitter API Server

基于原生Tree-sitter的轻量级API服务器，专为小规模使用场景设计，注重资源节约和稳定性。

## 项目特点

- **完全弃用WASM**：使用原生Tree-sitter Node.js绑定
- **资源节约**：针对小规模使用场景优化内存和CPU使用
- **简化部署**：最少的依赖和简单的配置
- **稳定性优先**：健壮的错误处理和资源管理

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
  "query": "(function_declaration) @func"
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

## 实现状态

### ✅ 已完成 (第一阶段)

- [x] 项目初始化和配置
- [x] TypeScript和构建工具配置
- [x] 核心类型定义
- [x] 基础配置文件
- [x] 测试环境设置

### 🚧 进行中 (第二阶段)

- [ ] 核心服务实现
- [ ] 语言管理器
- [ ] 轻量级解析器池
- [ ] 内存监控器
- [ ] 资源清理器

### 📋 计划中

- [ ] 错误处理系统
- [ ] API服务器实现
- [ ] 测试和优化

## 文档

- [架构设计](docs/NEW_ARCHITECTURE.md)
- [API规范](docs/API_SPECIFICATION.md)
- [内存管理](docs/NEW_MEMORY_MANAGEMENT.md)
- [实现路线图](docs/IMPLEMENTATION_ROADMAP.md)

## 许可证

MIT