/**
 * API接口相关类型定义
 */

export interface Position {
  row: number; // 行号，从0开始
  column: number; // 列号，从0开始
}

export interface MatchResult {
  captureName: string;
  type: string;
  text: string;
  startPosition: Position;
  endPosition: Position;
}

export interface ParseRequest {
  language: string;
  code: string;
  query?: string;
  queries?: string[];
}

export interface ParseResult {
  success: boolean;
  matches: MatchResult[];
  errors: string[];
}

export interface ParseResponse {
  matches: MatchResult[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  errors: string[];
  timestamp: string;
}

export interface MemoryInfo {
  rss: number; // 常驻内存集大小 (MB)
  heapTotal: number; // 堆总大小 (MB)
  heapUsed: number; // 已使用堆大小 (MB)
  external: number; // 外部内存 (MB)
}

export interface HealthResponse {
  status: 'healthy' | 'warning' | 'error';
  memory: MemoryInfo;
  supportedLanguages: string[];
  timestamp: string;
}

export interface LanguagesResponse {
  languages: string[];
}

export interface RequestMetadata {
  requestId: string;
  startTime: number;
  language: string;
  codeLength: number;
  queryCount: number;
}