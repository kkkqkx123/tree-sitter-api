/**
 * 错误处理相关类型定义
 */

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  PARSE_ERROR = 'PARSE_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorDetails {
  [key: string]: unknown;
}

export class TreeSitterError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly details: ErrorDetails | undefined;
  public readonly timestamp: number;

  constructor(
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'TreeSitterError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = Date.now();
  }

  toJSON(): ErrorRecord {
    const record: ErrorRecord = {
      name: this.name,
      type: this.type,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp,
    };
    if (this.details) {
      record.details = this.details;
    }
    if (this.stack) {
      record.stack = this.stack;
    }
    return record;
  }
}

export interface ErrorRecord {
  name: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: ErrorDetails;
  timestamp: number;
  stack?: string;
}

export interface ErrorStatistics {
  totalErrors: number;
  recentErrors: number;
  errorCounts: Record<ErrorType, number>;
  mostCommonError: ErrorType | null;
  errorHistory: ErrorRecord[];
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  message: string;
  details?: ErrorDetails;
}

export interface MemoryStatus {
  level: 'normal' | 'warning' | 'critical';
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface CleanupResult {
  strategy: string;
  memoryFreed: number;
  success: boolean;
  duration: number;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  memory: MemoryStatus;
  errors: ErrorStatistics;
  uptime: number;
  timestamp: string;
}
