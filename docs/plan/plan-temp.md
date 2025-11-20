现在我将制定修改方案以支持缺失的高级功能。基于我的分析，我需要设计一个全面的方案来增强当前项目的tree-sitter查询功能。

## 修改方案

### 1. 增强查询验证功能

首先需要创建一个专门的查询验证器，能够识别和验证tree-sitter的高级查询语法：

```typescript
// src/core/QueryValidator.ts
export class QueryValidator {
  validateQuerySyntax(query: string): ValidationResult;
  validatePredicates(query: string): PredicateValidationResult;
  validateDirectives(query: string): DirectiveValidationResult;
  extractQueryFeatures(query: string): QueryFeatures;
}
```

### 2. 扩展查询执行引擎

增强当前的查询执行逻辑，以支持谓词和指令的处理：

```typescript
// src/core/QueryExecutor.ts
export class QueryExecutor {
  executeQueryWithPredicates(query: string, tree: TreeSitterTree): EnhancedMatchResult[];
  processDirectives(matches: QueryMatch[], directives: QueryDirective[]): ProcessedMatchResult[];
  applyPredicates(matches: QueryMatch[], predicates: QueryPredicate[]): FilteredMatchResult[];
}
```

### 3. 增强类型定义

扩展类型系统以支持高级查询功能：

```typescript
// src/types/advancedQuery.ts
export interface QueryPredicate {
  type: 'eq' | 'match' | 'any-of' | 'is' | 'not-eq' | 'not-match' | 'any-eq' | 'any-match';
  capture: string;
  value: string | string[];
  negate?: boolean;
  quantifier?: 'any' | 'all';
}

export interface QueryDirective {
  type: 'set' | 'strip' | 'select-adjacent';
  capture: string;
  parameters: any[];
}

export interface EnhancedMatchResult extends MatchResult {
  metadata?: Record<string, any>;
  processedText?: string;
  adjacentNodes?: MatchResult[];
}
```

### 4. 创建查询解析器

实现一个查询解析器，能够解析和提取查询中的谓词和指令：

```typescript
// src/core/QueryParser.ts
export class QueryParser {
  parseQuery(query: string): ParsedQuery;
  extractPredicates(query: string): QueryPredicate[];
  extractDirectives(query: string): QueryDirective[];
  validateQueryStructure(query: string): StructureValidationResult;
}
```

### 5. 增强API接口

扩展API接口以支持高级查询功能：

```typescript
// src/types/api.ts (扩展)
export interface AdvancedParseRequest extends ParseRequest {
  enableAdvancedFeatures?: boolean;
  processDirectives?: boolean;
  includeMetadata?: boolean;
}

export interface AdvancedParseResult extends ParseResult {
  queryFeatures?: QueryFeatures;
  processedMatches?: EnhancedMatchResult[];
  directives?: QueryDirective[];
  predicates?: QueryPredicate[];
}
```

### 6. 更新控制器和服务

修改控制器和服务以支持新的高级功能：

```typescript
// src/controllers/parseController.ts (修改)
const validateAdvancedQuery = async (req: Request, res: Response): Promise<void> => {
  // 验证高级查询语法
  // 返回详细的验证结果，包括谓词和指令信息
};

const parseWithAdvancedFeatures = async (req: Request, res: Response): Promise<void> => {
  // 使用增强的查询执行引擎
  // 返回包含元数据和处理结果的响应
};
```

### 7. 添加新的路由端点

添加专门处理高级查询的路由：

```typescript
// src/routes/parse.ts (添加)
router.post('/advanced', validateAdvancedParseRequest, async (req, res) => {
  // 处理高级查询请求
});

router.post('/analyze-query', async (req, res) => {
  // 分析查询语法，返回谓词和指令信息
});
```

### 8. 实现指令处理器

创建专门的指令处理器：

```typescript
// src/core/DirectiveProcessor.ts
export class DirectiveProcessor {
  processSetDirective(capture: string, key: string, value: string): void;
  processStripDirective(capture: string, pattern: string): string;
  processSelectAdjacentDirective(capture1: string, capture2: string): MatchResult[];
}
```

### 9. 增强错误处理

扩展错误处理以支持高级查询相关的错误：

```typescript
// src/types/errors.ts (添加)
export class QuerySyntaxError extends TreeSitterError {
  constructor(message: string, public position?: Position) {
    super(ErrorType.QUERY_SYNTAX_ERROR, ErrorSeverity.MEDIUM, message);
  }
}

export class PredicateError extends TreeSitterError {
  constructor(predicate: string, message: string) {
    super(ErrorType.PREDICATE_ERROR, ErrorSeverity.MEDIUM, `Predicate ${predicate}: ${message}`);
  }
}
```

### 10. 添加配置选项

添加配置选项以控制高级功能的启用：

```typescript
// src/config/query.ts
export interface QueryConfig {
  enablePredicates: boolean;
  enableDirectives: boolean;
  enableAdvancedValidation: boolean;
  maxPredicatesPerQuery: number;
  maxDirectivesPerQuery: number;
}
```

### 实施计划

1. **第一阶段**：实现基础的查询验证和解析功能
2. **第二阶段**：增强查询执行引擎以支持谓词
3. **第三阶段**：实现指令处理器
4. **第四阶段**：扩展API接口和控制器
5. **第五阶段**：添加测试和文档

这个方案将显著增强当前项目的tree-sitter查询功能，使其能够充分利用tree-sitter的高级查询语法，包括谓词、锚点、交替查询和指令等。