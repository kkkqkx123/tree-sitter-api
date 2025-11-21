/**
 * 核心Tree-sitter服务 - 简化版本
 * 作为主要接口层，协调各个核心组件
 */

import Parser from 'tree-sitter';
import { LanguageManager } from './LanguageManager';
import { QueryProcessor } from './QueryProcessor';
import { ResourceService } from './ResourceService';
import { MonitoringService } from './MonitoringService';
import { PredicateProcessor } from './PredicateProcessor';
import { DirectiveProcessor } from './DirectiveProcessor';

import { ParseRequest, ParseResult } from '../types/api';
import { SupportedLanguage } from '../types/treeSitter';
import {
    AdvancedParseRequest,
    AdvancedParseResult,
    EnhancedMatchResult,
    QueryPredicate,
    QueryDirective,
    PerformanceMetrics,
    QueryFeatures,
    ValidationResult,
    ProcessedMatchResult
} from '../types/advancedQuery';
import { CleanupStrategy } from '../config/memory';
import { CleanupResult } from '../types/errors';
import { log } from '../utils/Logger';
import { getMemoryUsage } from '../utils/memoryUtils';

export interface ITreeSitterService {
    processRequest(request: ParseRequest): Promise<ParseResult>;
    processAdvancedRequest(request: AdvancedParseRequest): Promise<AdvancedParseResult>;
    analyzeQuery(language: string, query: string): Promise<any>;
    validateAdvancedQuery(language: string, query: string): Promise<any>;
    getQueryOptimizations(language: string, query: string): Promise<any[]>;
    getQueryStatistics(): Promise<any>;
    getHealthStatus(): HealthStatus;
    getSupportedLanguages(): SupportedLanguage[];
    preloadLanguages(languages?: SupportedLanguage[]): Promise<void>;
    performCleanup(strategy?: CleanupStrategy): Promise<CleanupResult>;
    getDetailedStats(): DetailedStats;
    resetStats(): void;
    emergencyCleanup(): Promise<void>;
    destroy(): void;
}

export interface HealthStatus {
    status: 'healthy' | 'warning' | 'error';
    memory: any;
    parserPool: any;
    languageManager: any;
    service: ServiceHealthInfo;
    timestamp: string;
}

export interface ServiceHealthInfo {
    requestCount: number;
    errorCount: number;
    errorRate: number;
    activeResources: {
        trees: number;
        queries: number;
        parsers: number;
    };
}

export interface DetailedStats {
    health: HealthStatus;
    memory: any;
    performance: any;
    statistics: any;
    cleanup?: any;
}

export class TreeSitterService implements ITreeSitterService {
    // 核心组件
    private languageManager!: LanguageManager;
    private queryProcessor!: QueryProcessor;
    private resourceService!: ResourceService;
    private monitoringService!: MonitoringService;
    private predicateProcessor!: PredicateProcessor;
    private directiveProcessor!: DirectiveProcessor;

    constructor() {
        this.initializeComponents();
        this.startMonitoring();
    }

    /**
     * 初始化所有组件
     */
    private initializeComponents(): void {
        this.languageManager = new LanguageManager();
        this.queryProcessor = new QueryProcessor();
        this.resourceService = new ResourceService();
        this.monitoringService = new MonitoringService();
        this.predicateProcessor = new PredicateProcessor();
        this.directiveProcessor = new DirectiveProcessor();
    }

    /**
     * 启动监控服务
     */
    private startMonitoring(): void {
        this.monitoringService.startMonitoring();
        log.info('TreeSitterService', 'TreeSitterService initialized with advanced features');
    }

    /**
     * 处理解析请求
     */
    public async processRequest(request: ParseRequest): Promise<ParseResult> {
        const startTime = Date.now();

        try {
            // 更新统计信息
            this.monitoringService.incrementRequestCount();

            // 验证请求
            this.validateRequest(request);

            // 执行实际的解析和查询
            const result = await this.executeParsingRequest(request);

            // 更新性能统计
            const duration = Date.now() - startTime;
            this.monitoringService.recordQueryTime(duration);

            return result;
        } catch (error) {
            this.monitoringService.incrementErrorCount();
            log.error('TreeSitterService', `Error processing request: ${error}`);
            throw error;
        }
    }

    /**
     * 处理高级解析请求
     */
    public async processAdvancedRequest(request: AdvancedParseRequest): Promise<AdvancedParseResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let matches: EnhancedMatchResult[] = [];
        let processedMatches: ProcessedMatchResult[] = [];
        let queryFeatures: QueryFeatures | undefined;
        let validationResults: ValidationResult | undefined;
        let performance: PerformanceMetrics | undefined;

        try {
            // 更新统计信息
            this.monitoringService.incrementRequestCount();

            // 验证高级请求
            this.validateAdvancedRequest(request);

            // 获取语言模块
            const languageModule = await this.languageManager.getLanguage(request.language as SupportedLanguage);

            // 创建Parser实例并设置语言
            const parser = new Parser();
            parser.setLanguage(languageModule as any);

            // 解析代码
            const tree = parser.parse(request.code);
            const rootNode = tree.rootNode;

            // 处理查询
            if (request.query || request.queries) {
                const queries = request.queries || [request.query!];

                for (const queryStr of queries) {
                    try {
                        // 解析查询
                        const parsedQuery = this.queryProcessor.parseQuery(queryStr);

                        // 执行查询 - 简化实现，实际应该使用 tree-sitter 的查询 API
                        const queryMatches = this.executeQuery(parsedQuery, rootNode);

                        // 转换为增强匹配结果
                        const enhancedMatches: EnhancedMatchResult[] = queryMatches.map((match: any) => ({
                            ...match,
                            metadata: request.includeMetadata ? {} : undefined,
                            processedText: match.text,
                            adjacentNodes: [],
                            predicateResults: [],
                            directiveResults: [],
                        }));

                        matches.push(...enhancedMatches);

                        // 提取谓词和指令
                        const predicates = parsedQuery.predicates;
                        const directives = parsedQuery.directives;

                        // 应用谓词
                        if (predicates.length > 0 && request.validatePredicates !== false) {
                            const predicateResult = await this.predicateProcessor.applyPredicates(enhancedMatches, predicates);
                            matches = predicateResult.filteredMatches;
                        }

                        // 应用指令
                        if (directives.length > 0 && request.processDirectives) {
                            const directiveResult = await this.directiveProcessor.applyDirectives(matches, directives);
                            processedMatches = directiveResult.processedMatches;
                        }

                        // 分析查询特性
                        if (request.enableAdvancedFeatures) {
                            queryFeatures = this.analyzeQueryFeatures(queryStr, predicates, directives);
                        }

                        // 验证查询
                        if (request.enableAdvancedFeatures) {
                            validationResults = this.validateQuery(queryStr, predicates, directives);
                        }

                    } catch (error) {
                        errors.push(`Error processing query "${queryStr}": ${error}`);
                    }
                }
            }

            // 限制结果数量
            if (request.maxResults && request.maxResults > 0) {
                matches = matches.slice(0, request.maxResults);
                if (processedMatches.length > 0) {
                    processedMatches = processedMatches.slice(0, request.maxResults);
                }
            }

            // 计算性能指标
            const duration = Date.now() - startTime;
            performance = {
                parseTime: duration,
                queryTime: 0, // 在实际实现中应该分别计算
                totalTime: duration,
                memoryUsage: this.getMemoryUsage(),
                matchCount: matches.length,
                predicatesProcessed: this.extractPredicates(request.query || '').length,
                directivesApplied: this.extractDirectives(request.query || '').length,
            };

            // 更新性能统计
            this.monitoringService.recordQueryTime(duration);

            // 构建结果对象，确保所有必需字段都有值
            const result: AdvancedParseResult = {
                success: errors.length === 0,
                matches,
                errors,
                performance,
            };

            // 只有在有值时才添加可选字段
            if (processedMatches.length > 0) {
                result.processedMatches = processedMatches;
            }
            if (queryFeatures) {
                result.queryFeatures = queryFeatures;
            }
            if (this.extractDirectives(request.query || '').length > 0) {
                result.directives = this.extractDirectives(request.query || '');
            }
            if (this.extractPredicates(request.query || '').length > 0) {
                result.predicates = this.extractPredicates(request.query || '');
            }
            if (validationResults) {
                result.validationResults = validationResults;
            }

            return result;

        } catch (error) {
            this.monitoringService.incrementErrorCount();
            log.error('TreeSitterService', `Error processing advanced request: ${error}`);

            return {
                success: false,
                matches: [],
                errors: [error instanceof Error ? error.message : String(error)],
                performance: {
                    parseTime: Date.now() - startTime,
                    queryTime: 0,
                    totalTime: Date.now() - startTime,
                    memoryUsage: this.getMemoryUsage(),
                    matchCount: 0,
                    predicatesProcessed: 0,
                    directivesApplied: 0,
                },
            };
        }
    }

    /**
     * 验证基础请求
     */
    private validateRequest(request: ParseRequest): void {
        if (!request.language) {
            throw new Error('Language is required');
        }
        if (!request.code) {
            throw new Error('Code is required');
        }
        if (!request.query) {
            throw new Error('Query is required');
        }
    }

    /**
     * 验证高级请求
     */
    private validateAdvancedRequest(request: AdvancedParseRequest): void {
        if (!request.language) {
            throw new Error('Language is required');
        }
        if (!request.code) {
            throw new Error('Code is required');
        }
        if (!request.query && !request.queries) {
            throw new Error('Either query or queries is required');
        }
    }

    /**
     * 执行基础解析请求
     */
    private async executeParsingRequest(request: ParseRequest): Promise<ParseResult> {
        const languageModule = await this.languageManager.getLanguage(request.language as SupportedLanguage);

        // 创建Parser实例
        const parser = new Parser();
        parser.setLanguage(languageModule as any);

        const tree = parser.parse(request.code);
        
        // 统一处理所有查询 - 合并主查询和额外查询
        const allQueries: string[] = [
            ...(request.query ? [request.query] : []),
            ...(request.queries || [])
        ];

        // 执行所有查询并收集结果
        const allMatches: any[] = [];
        const errors: string[] = [];

        for (const queryString of allQueries) {
            try {
                const query = this.queryProcessor.parseQuery(queryString);
                const matches = this.executeQuery(query, tree.rootNode);
                allMatches.push(...matches);
            } catch (error) {
                errors.push(`Error executing query "${queryString}": ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return {
            success: errors.length === 0,
            matches: allMatches,
            errors,
        };
    }

    /**
     * 正式的查询执行实现
     */
    private executeQuery(parsedQuery: any, rootNode: any): any[] {
        try {
            // 如果 parsedQuery 包含原始查询字符串，使用 tree-sitter 的查询 API
            if (parsedQuery.originalQuery) {
                const queryText = parsedQuery.originalQuery;

                // 获取语言对象
                const language = rootNode.tree.language;

                // 创建查询对象
                const Query = (Parser as any).Query;
                const query = new Query(language, queryText);

                // 执行查询
                const queryMatches = query.matches(rootNode);

                // 转换为标准格式
                const matches: any[] = [];
                for (const match of queryMatches) {
                    if (match.captures && Array.isArray(match.captures)) {
                        for (const capture of match.captures) {
                            matches.push({
                                captureName: capture.name || 'match',
                                type: capture.node.type,
                                text: capture.node.text,
                                startPosition: {
                                    row: capture.node.startPosition.row,
                                    column: capture.node.startPosition.column,
                                },
                                endPosition: {
                                    row: capture.node.endPosition.row,
                                    column: capture.node.endPosition.column,
                                },
                            });
                        }
                    }
                }

                // 清理查询对象（如果delete方法存在）
                if (typeof query.delete === 'function') {
                    query.delete();
                }

                return matches;
            }

            // 如果没有原始查询，返回空数组
            return [];
        } catch (error) {
            log.error('TreeSitterService', `Error executing query: ${error}`);
            return [];
        }
    }


    /**
     * 从查询字符串中提取谓词
     */
    private extractPredicates(query: string): QueryPredicate[] {
        if (!query || typeof query !== 'string') {
            return [];
        }

        try {
            // 使用 QueryProcessor 的 extractPredicates 方法
            return this.queryProcessor.extractPredicates(query);
        } catch (error) {
            log.error('TreeSitterService', `Error extracting predicates: ${error}`);
            return [];
        }
    }

    /**
     * 从查询字符串中提取指令
     */
    private extractDirectives(query: string): QueryDirective[] {
        if (!query || typeof query !== 'string') {
            return [];
        }

        try {
            // 使用 QueryProcessor 的 extractDirectives 方法
            return this.queryProcessor.extractDirectives(query);
        } catch (error) {
            log.error('TreeSitterService', `Error extracting directives: ${error}`);
            return [];
        }
    }

    /**
     * 获取内存使用情况
     */
    private getMemoryUsage(): number {
        try {
            // 使用 memoryUtils 中的 getMemoryUsage 函数
            const usage = getMemoryUsage();
            // 返回以 MB 为单位的堆内存使用量
            return Math.round(usage.heapUsed / 1024 / 1024);
        } catch (error) {
            log.error('TreeSitterService', `Error getting memory usage: ${error}`);
            return 0;
        }
    }

    /**
     * 分析查询特性
     */
    private analyzeQueryFeatures(query: string, predicates: QueryPredicate[], directives: QueryDirective[]): QueryFeatures {
        return {
            hasPredicates: predicates.length > 0,
            hasDirectives: directives.length > 0,
            hasAnchors: query.includes('.'),
            hasAlternations: query.includes('[') && query.includes(']'),
            hasQuantifiers: query.includes('*') || query.includes('+') || query.includes('?'),
            hasWildcards: query.includes('_'),
            predicateCount: predicates.length,
            directiveCount: directives.length,
            complexity: predicates.length > 2 || directives.length > 1 ? 'complex' :
                predicates.length > 0 || directives.length > 0 ? 'moderate' : 'simple',
        };
    }

    /**
     * 验证查询
     */
    private validateQuery(query: string, predicates: QueryPredicate[], directives: QueryDirective[]): ValidationResult {
        const errors: any[] = [];
        const warnings: any[] = [];

        // 验证查询语法
        try {
            this.queryProcessor.parseQuery(query);
        } catch (error) {
            errors.push({
                type: 'syntax',
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
        }

        // 验证谓词
        for (const predicate of predicates) {
            const validation = this.predicateProcessor.validatePredicate(predicate);
            if (!validation.isValid) {
                errors.push({
                    type: 'predicate',
                    message: validation.errors.join(', '),
                    severity: 'error',
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            features: this.analyzeQueryFeatures(query, predicates, directives),
        };
    }

    /**
     * 分析查询
     */
    public async analyzeQuery(language: string, query: string): Promise<any> {
        const validationResult = this.queryProcessor.validateQuerySyntax(query);
        const parsedQuery = this.queryProcessor.parseQuery(query);
        const optimizationSuggestions = this.queryProcessor.generateOptimizationSuggestions(parsedQuery);

        return {
            language,
            query,
            validationResult,
            parsedQuery,
            optimizationSuggestions,
        };
    }

    /**
     * 验证高级查询
     */
    public async validateAdvancedQuery(_language: string, query: string): Promise<any> {
        const predicates = this.extractPredicates(query);
        const directives = this.extractDirectives(query);

        return this.validateQuery(query, predicates, directives);
    }

    /**
     * 获取查询优化建议
     */
    public async getQueryOptimizations(_language: string, query: string): Promise<any[]> {
        const parsedQuery = this.queryProcessor.parseQuery(query);
        return this.queryProcessor.generateOptimizationSuggestions(parsedQuery);
    }

    /**
     * 获取查询统计信息
     */
    public async getQueryStatistics(): Promise<any> {
        return this.monitoringService.getStatistics();
    }

    /**
     * 获取健康状态
     */
    public getHealthStatus(): HealthStatus {
        const resourceCount = this.resourceService.getActiveResourcesCount();
        const treesCount = typeof resourceCount === 'number' ? resourceCount : (resourceCount as any).trees || 0;
        const queriesCount = typeof resourceCount === 'number' ? resourceCount : (resourceCount as any).queries || 0;

        return {
            status: 'healthy',
            memory: this.monitoringService.checkMemory(),
            parserPool: this.getParserPoolStatus(),
            languageManager: this.getLanguageManagerStatus(),
            service: {
                requestCount: this.getRequestCount(),
                errorCount: this.getErrorCount(),
                errorRate: this.getErrorRate(),
                activeResources: {
                    trees: treesCount,
                    queries: queriesCount,
                    parsers: this.languageManager.getLoadedLanguagesCount(),
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * 获取支持的语言列表
     */
    public getSupportedLanguages(): SupportedLanguage[] {
        return this.languageManager.getSupportedLanguages();
    }

    /**
     * 预加载语言
     */
    public async preloadLanguages(languages?: SupportedLanguage[]): Promise<void> {
        if (languages) {
            const promises = languages.map(lang => this.languageManager.preloadLanguage(lang));
            await Promise.all(promises);
        } else {
            await this.languageManager.preloadAllLanguages();
        }
    }

    /**
     * 执行清理
     */
    public async performCleanup(strategy?: CleanupStrategy): Promise<CleanupResult> {
        return this.monitoringService.performCleanup(strategy);
    }

    /**
     * 获取详细统计信息
     */
    public getDetailedStats(): DetailedStats {
        return {
            health: this.getHealthStatus(),
            memory: this.monitoringService.checkMemory(),
            performance: this.monitoringService.getStatistics(),
            statistics: this.monitoringService.getStatistics(),
        };
    }

    /**
     * 重置统计信息
     */
    public resetStats(): void {
        this.monitoringService.resetStatistics();
    }

    /**
     * 紧急清理
     */
    public async emergencyCleanup(): Promise<void> {
        await this.performCleanup(CleanupStrategy.EMERGENCY);
    }

    /**
     * 销毁服务
     */
    public destroy(): void {
        this.monitoringService.stopMonitoring();
        this.languageManager.clearCache();
    }

    // 辅助方法，用于获取各种状态信息
    private getParserPoolStatus(): any {
        return {
            active: 0,
            idle: 0,
            total: 0,
        };
    }

    private getLanguageManagerStatus(): any {
        return {
            loadedLanguages: this.languageManager.getLoadedLanguagesCount(),
            supportedLanguages: this.languageManager.getSupportedLanguages().length,
        };
    }

    private getRequestCount(): number {
        const stats = this.monitoringService.getStatistics();
        return stats.requestCount || 0;
    }

    private getErrorCount(): number {
        const stats = this.monitoringService.getStatistics();
        return stats.errorCount || 0;
    }

    private getErrorRate(): number {
        const stats = this.monitoringService.getStatistics();
        return stats.errorRate || 0;
    }
}