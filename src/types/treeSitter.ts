/**
 * Tree-sitter相关类型定义
 */

import { MatchResult } from './api';

// 支持的编程语言
export type SupportedLanguage = 
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'ruby';

// Tree-sitter解析器接口
export interface TreeSitterParser {
  setLanguage(language: any): void;
  parse(code: string): TreeSitterTree;
  delete(): void;
}

// Tree-sitter树接口
export interface TreeSitterTree {
  rootNode: TreeSitterNode;
  getLanguage(): TreeSitterLanguage;
  delete(): void;
}

// Tree-sitter节点接口
export interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: Position;
  endPosition: Position;
  isNamed: boolean;
  childCount: number;
  children: TreeSitterNode[];
}

// Tree-sitter语言接口
export interface TreeSitterLanguage {
  query(queryString: string): TreeSitterQuery;
}

// Tree-sitter查询接口
export interface TreeSitterQuery {
  matches(rootNode: TreeSitterNode): QueryMatch[];
  delete(): void;
}

// 查询匹配结果
export interface QueryMatch {
  captures: QueryCapture[];
}

// 查询捕获
export interface QueryCapture {
  name: string;
  node: TreeSitterNode;
}

// 位置信息
export interface Position {
  row: number;
  column: number;
}

// 解析结果
export interface ParseResult {
  success: boolean;
  matches: MatchResult[];
  errors: string[];
}

// 语言模块接口
export interface LanguageModule {
  [key: string]: any;
}

// 解析器配置
export interface ParserConfig {
  maxPoolSize: number;
  timeout: number;
  maxCodeLength: number;
}

// 查询配置
export interface QueryConfig {
  maxQueries: number;
  timeout: number;
}