# 最简API实现方案（无WASM）

## 当前架构可复用模块分析

### 可直接复用的模块：

1. **语言映射逻辑** ([`src/treeSitter.ts`](src/treeSitter.ts:4-30))
   - `getWasmLanguage()` 函数中的语言标识符映射
   - 支持的语言类型定义

2. **查询处理逻辑** ([`src/controller.ts`](src/controller.ts:70-90))
   - Tree-sitter查询执行和结果处理
   - 匹配结果的数据结构

3. **类型定义** ([`src/nodeTypes.ts`](src/nodeTypes.ts))
   - AST节点类型定义
   - 位置信息结构

### 需要弃用的WASM相关模块：

1. **WASM语言加载器** ([`src/treeSitter.ts`](src/treeSitter.ts:45-71))
2. **WASM文件构建** ([`src/buildWasm.ts`](src/buildWasm.ts))
3. **WASM编译** ([`src/compileWasm.ts`](src/compileWasm.ts))

## 最简实现方案

### 替代WASM的方案

由于要求彻底弃用WASM，我们需要使用原生的Tree-sitter Node.js绑定：

```bash
# 使用原生Tree-sitter而不是web-tree-sitter
npm install tree-sitter
npm install tree-sitter-javascript tree-sitter-python # 等各语言parser
```

### 核心服务实现

```typescript
// src/api/services/treeSitterService.ts
import * as Parser from 'tree-sitter';
import * as JavaScript from 'tree-sitter-javascript';
import * as Python from 'tree-sitter-python';
// 导入其他语言parser

export class TreeSitterService {
    private parsers: Map<string, any> = new Map();

    constructor() {
        // 初始化各语言parser
        this.parsers.set('javascript', JavaScript);
        this.parsers.set('python', Python);
        // 设置其他语言...
    }

    async parseCode(language: string, code: string) {
        const parser = new Parser();
        const languageModule = this.parsers.get(language);
        
        if (!languageModule) {
            throw new Error(`Unsupported language: ${language}`);
        }

        parser.setLanguage(languageModule);
        return parser.parse(code);
    }

    async executeQuery(tree: any, queryString: string) {
        const query = tree.getLanguage().query(queryString);
        return query.matches(tree.rootNode);
    }
}
```

### 简化后的API控制器

```typescript
// src/api/controllers/parseController.ts
import { TreeSitterService } from '../services/treeSitterService';

const service = new TreeSitterService();

export const parseCode = async (req, res) => {
    const { language, code, query, queries = [] } = req.body;
    
    try {
        const tree = await service.parseCode(language, code);
        const allQueries = query ? [query, ...queries] : queries;
        
        const results = [];
        for (const q of allQueries) {
            const matches = await service.executeQuery(tree, q);
            results.push(...matches.flatMap(match => 
                match.captures.map(capture => ({
                    captureName: capture.name,
                    type: capture.node.type,
                    text: capture.node.text,
                    startPosition: capture.node.startPosition,
                    endPosition: capture.node.endPosition
                }))
            ));
        }

        res.json({ success: true, matches: results, errors: [] });
    } catch (error) {
        res.json({ success: false, matches: [], errors: [error.message] });
    }
};
```

## 依赖变化

### 移除的依赖：
```json
{
  "devDependencies": {
    "web-tree-sitter": "^0.25.10",  // 移除
    "tree-sitter-cli": "^0.25.10", // 移除
    // 各语言WASM构建依赖移除
  }
}
```

### 新增的依赖：
```json
{
  "dependencies": {
    "tree-sitter": "^0.20.0",
    "tree-sitter-javascript": "^0.20.0",
    "tree-sitter-python": "^0.20.0",
    "tree-sitter-java": "^0.20.0",
    "tree-sitter-go": "^0.20.0",
    "tree-sitter-cpp": "^0.20.0",
    "tree-sitter-rust": "^0.20.0",
    "tree-sitter-ruby": "^0.20.0",
    "tree-sitter-c-sharp": "^0.20.0"
  }
}
```

## 优势分析

### 性能提升
- 原生绑定比WASM性能更好
- 不需要WASM加载和初始化开销
- 内存使用更高效

### 简化部署
- 不需要WASM文件分发
- 不需要复杂的WASM构建流程
- 依赖管理更简单

### 开发体验
- 更好的调试支持
- 更简单的错误追踪
- 更好的TypeScript支持

## 注意事项

### 版本兼容性
- 确保所有tree-sitter parser版本兼容
- 注意API差异处理

### 内存管理
- 原生绑定可能需要手动内存管理
- 注意parser实例的重用

### 错误处理
- 不同的错误类型需要统一处理
- 添加适当的错误日志

这种最简实现方案完全弃用了WASM，使用原生的Tree-sitter Node.js绑定，提供了更好的性能和更简单的部署体验。