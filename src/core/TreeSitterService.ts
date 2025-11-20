/**
 * 核心Tree-sitter服务 - 重构版本（作为协调器）
 */

import { LanguageManager } from './LanguageManager';
import { ParserPool } from './ParserPool';
import { MemoryMonitor } from './MemoryMonitor';
import { ResourceCleaner } from './ResourceCleaner';
import { QueryExecutor } from './QueryExecutor';
import { QueryParser } from './QueryParser';
import { QueryValidator } from './QueryValidator';
import { QueryOptimizer } from './QueryOptimizer';
import { RequestProcessor, IRequestProcessor } from './RequestProcessor';
import { ResourceManager, IResourceManager } from './ResourceManager';
import { QueryProcessor as QueryProcessorService, IQueryProcessor } from './QueryProcessor';
import { ServiceStatistics, IServiceStatistics } from './ServiceStatistics';
import { PerformanceMonitor, IPerformanceMonitor } from './PerformanceMonitor';
import { AdvancedQueryService, IAdvancedQueryService } from './AdvancedQueryService';

import { ParseRequest, ParseResult } from '../types/api';
import { AdvancedParseRequest, AdvancedParseResult, QueryAnalysis, ValidationResult, OptimizationSuggestion, QueryStatistics } from '../types/advancedQuery';
import { SupportedLanguage, TreeSitterTree } from '../types/treeSitter';
import { CleanupStrategy } from '../config/memory';
import { log } from '../utils/Logger';

export interface ITreeSitterService {
    processRequest(request: ParseRequest): Promise<ParseResult>;
    processAdvancedRequest(request: AdvancedParseRequest): Promise<AdvancedParseResult>;
    analyzeQuery(language: string, query: string): Promise<QueryAnalysis>;
    validateAdvancedQuery(language: string, query: string): Promise<ValidationResult>;
    getQueryOptimizations(language: string, query: string): Promise<OptimizationSuggestion[]>;
    getQueryStatistics(): Promise<QueryStatistics>;
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
        parsers: number;
    };
}

export interface CleanupResult {
    memoryFreed: number;
    duration: number;
    success: boolean;
}

export interface DetailedStats {
    health: HealthStatus;
    memory: any;
    cleanup: any;
    performance: any;
    statistics: any;
}

export class TreeSitterService implements ITreeSitterService {
    // 核心组件
    private languageManager!: LanguageManager;
    private parserPool!: ParserPool;
    private memoryMonitor!: MemoryMonitor;
    private resourceCleaner!: ResourceCleaner;
    private queryExecutor!: QueryExecutor;

    // 重构后的服务组件
    private requestProcessor!: IRequestProcessor;
    private resourceManager!: IResourceManager;
    private queryProcessorService!: IQueryProcessor;
    private serviceStatistics!: IServiceStatistics;
    private performanceMonitor!: IPerformanceMonitor;
    private advancedQueryService!: IAdvancedQueryService;

    // 查询组件
    private queryParser!: QueryParser;
    private queryValidator!: QueryValidator;
    private queryOptimizer!: QueryOptimizer;

    constructor() {
        this.initializeCoreComponents();
        this.initializeServiceComponents();
        this.initializeQueryComponents();
        this.setupDependencies();
        this.startMonitoring();
    }

    /**
     * 初始化核心组件
     */
    private initializeCoreComponents(): void {
        this.languageManager = new LanguageManager();
        this.parserPool = new ParserPool();
        this.memoryMonitor = new MemoryMonitor();
        this.resourceCleaner = new ResourceCleaner();
        this.queryExecutor = new QueryExecutor();
    }

    /**
     * 初始化服务组件
     */
    private initializeServiceComponents(): void {
        this.requestProcessor = new RequestProcessor(this.languageManager, this.memoryMonitor);
        this.resourceManager = new ResourceManager(this.parserPool, this.languageManager);
        this.queryProcessorService = new QueryProcessorService(this.queryExecutor);
        this.serviceStatistics = new ServiceStatistics();
        this.performanceMonitor = new PerformanceMonitor();
    }

    /**
     * 初始化查询组件
     */
    private initializeQueryComponents(): void {
        this.queryParser = new QueryParser();
        this.queryValidator = new QueryValidator();
        this.queryOptimizer = new QueryOptimizer();
        this.advancedQueryService = new AdvancedQueryService(
            this.languageManager,
            this.queryParser,
            this.queryValidator,
            this.queryOptimizer
        );
    }

    /**
     * 设置依赖关系
     */
    private setupDependencies(): void {
        this.resourceCleaner.setParserPool(this.parserPool);
        this.resourceCleaner.setLanguageManager(this.languageManager);
    }

    /**
     * 启动监控
     */
    private startMonitoring(): void {
        this.memoryMonitor.startMonitoring();
        log.info('TreeSitterService', 'TreeSitterService initialized (refactored version)');
    }

    /**
     * 处理解析请求
     */
    public async processRequest(request: ParseRequest): Promise<ParseResult> {
        const timerId = this.performanceMonitor.startTiming('processRequest');

        try {
            // 更新统计信息
            this.serviceStatistics.incrementRequestCount();
            this.serviceStatistics.recordLanguageUsage(request.language);

            // 使用请求处理器验证请求
            await this.requestProcessor.processRequest(request);

            // 执行实际的解析和查询
            const result = await this.executeParsingRequest(request);

            // 记录性能指标
            const executionTime = this.performanceMonitor.endTiming(timerId);
            this.performanceMonitor.recordMetrics('processRequest', {
                executionTime,
                matchCount: result.matches.length,
            });

            this.serviceStatistics.recordQueryTime(executionTime);
            this.serviceStatistics.recordMatchCount(result.matches.length);

            return result;
        } catch (error) {
            this.serviceStatistics.incrementErrorCount();
            this.performanceMonitor.recordError('processRequest');
            this.performanceMonitor.endTiming(timerId);
            throw error;
        }
    }

    /**
     * 处理高级解析请求
     */
    public async processAdvancedRequest(request: AdvancedParseRequest): Promise<AdvancedParseResult> {
        const timerId = this.performanceMonitor.startTiming('processAdvancedRequest');

        try {
            // 更新统计信息
            this.serviceStatistics.incrementRequestCount();
            this.serviceStatistics.recordLanguageUsage(request.language);

            // 使用请求处理器验证请求
            await this.requestProcessor.processAdvancedRequest(request);

            // 执行实际的高级解析和查询
            const result = await this.executeAdvancedParsingRequest(request);

            // 记录性能指标
            const executionTime = this.performanceMonitor.endTiming(timerId);
            this.performanceMonitor.recordMetrics('processAdvancedRequest', {
                executionTime,
                matchCount: result.matches.length,
                predicateCount: result.predicates?.length || 0,
                directiveCount: result.directives?.length || 0,
            });

            this.serviceStatistics.recordQueryTime(executionTime);
            this.serviceStatistics.recordMatchCount(result.matches.length);

            return result;
        } catch (error) {
            this.serviceStatistics.incrementErrorCount();
            this.performanceMonitor.recordError('processAdvancedRequest');
            this.performanceMonitor.endTiming(timerId);
            throw error;
        }
    }

    /**
     * 分析查询
     */
    public async analyzeQuery(language: string, query: string): Promise<QueryAnalysis> {
        const timerId = this.performanceMonitor.startTiming('analyzeQuery');

        try {
            const result = await this.advancedQueryService.analyzeQuery(language, query);

            const executionTime = this.performanceMonitor.endTiming(timerId);
            this.performanceMonitor.recordMetrics('analyzeQuery', { executionTime });

            return result;
        } catch (error) {
            this.performanceMonitor.recordError('analyzeQuery');
            this.performanceMonitor.endTiming(timerId);
            throw error;
        }
    }

    /**
     * 验证高级查询
     */
    public async validateAdvancedQuery(language: string, query: string): Promise<ValidationResult> {
        const timerId = this.performanceMonitor.startTiming('validateAdvancedQuery');

        try {
            const result = await this.advancedQueryService.validateAdvancedQuery(language, query);

            const executionTime = this.performanceMonitor.endTiming(timerId);
            this.performanceMonitor.recordMetrics('validateAdvancedQuery', { executionTime });

            return result;
        } catch (error) {
            this.performanceMonitor.recordError('validateAdvancedQuery');
            this.performanceMonitor.endTiming(timerId);
            throw error;
        }
    }

    /**
     * 获取查询优化建议
     */
    public async getQueryOptimizations(language: string, query: string): Promise<OptimizationSuggestion[]> {
        const timerId = this.performanceMonitor.startTiming('getQueryOptimizations');

        try {
            const result = await this.advancedQueryService.getQueryOptimizations(language, query);

            const executionTime = this.performanceMonitor.endTiming(timerId);
            this.performanceMonitor.recordMetrics('getQueryOptimizations', { executionTime });

            return result;
        } catch (error) {
            this.performanceMonitor.recordError('getQueryOptimizations');
            this.performanceMonitor.endTiming(timerId);
            throw error;
        }
    }

    /**
     * 获取查询统计信息
     */
    public async getQueryStatistics(): Promise<QueryStatistics> {
        return await this.advancedQueryService.getQueryStatistics();
    }

    /**
     * 获取健康状态
     */
    public getHealthStatus(): HealthStatus {
        const memory = this.memoryMonitor.checkMemory();
        const parserPool = this.parserPool.getPoolStats();
        const languageManager = this.languageManager.getStatus();
        const serviceStats = this.serviceStatistics.getStatistics();
        const resourceStats = this.resourceManager.getActiveResourcesCount();

        // 确定整体状态
        let status: 'healthy' | 'warning' | 'error' = 'healthy';

        if (memory.level === 'critical' || serviceStats.errorRate > 50) {
            status = 'error';
        } else if (
            memory.level === 'warning' ||
            serviceStats.errorRate > 20 ||
            !this.parserPool.isHealthy()
        ) {
            status = 'warning';
        }

        return {
            status,
            memory,
            parserPool,
            languageManager,
            service: {
                requestCount: serviceStats.requestCount,
                errorCount: serviceStats.errorCount,
                errorRate: serviceStats.errorRate,
                activeResources: resourceStats,
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
     * 预加载语言模块
     */
    public async preloadLanguages(): Promise<void> {
        await this.languageManager.preloadAllLanguages();
    }

    /**
     * 执行内存清理
     */
    public async performCleanup(strategy: CleanupStrategy = CleanupStrategy.BASIC): Promise<CleanupResult> {
        const result = await this.resourceCleaner.performCleanup(strategy);

        return {
            memoryFreed: result.memoryFreed,
            duration: result.duration,
            success: result.success,
        };
    }

    /**
     * 获取详细统计信息
     */
    public getDetailedStats(): DetailedStats {
        return {
            health: this.getHealthStatus(),
            memory: this.memoryMonitor.getDetailedMemoryReport(),
            cleanup: this.resourceCleaner.getCleanupStats(),
            performance: this.performanceMonitor.getPerformanceReport(),
            statistics: this.serviceStatistics.getStatistics(),
        };
    }

    /**
     * 重置统计信息
     */
    public resetStats(): void {
        this.serviceStatistics.resetStatistics();
        this.performanceMonitor.resetMetrics();
        // resetQueryStatistics is only available on the implementation, not the interface
        // The interface only provides getQueryStatistics()
    }

    /**
     * 紧急清理
     */
    public async emergencyCleanup(): Promise<void> {
        log.warn('TreeSitterService', 'Performing emergency cleanup');

        // 使用资源管理器清理资源
        this.resourceManager.cleanup();

        // 执行紧急清理
        await this.resourceCleaner.performCleanup(CleanupStrategy.EMERGENCY);
    }

    /**
     * 销毁服务
     */
    public destroy(): void {
        log.info('TreeSitterService', 'Destroying TreeSitterService...');

        // 清理资源
        this.resourceManager.cleanup();

        // 销毁组件
        this.parserPool.destroy();
        this.memoryMonitor.destroy();
        this.resourceCleaner.destroy();

        // 重置监控
        this.performanceMonitor.resetMetrics();

        log.info('TreeSitterService', 'TreeSitterService destroyed');
    }

    /**
     * 执行基础解析请求
     */
    private async executeParsingRequest(request: ParseRequest): Promise<ParseResult> {
        const { language, code, query, queries = [] } = request;

        // 特殊处理空代码情况
        if (code === '') {
            return { success: true, matches: [], errors: [] };
        }

        let parser: any = null;
        let tree: TreeSitterTree | null = null;

        try {
            // 获取解析器
            parser = await this.resourceManager.acquireParser(language as SupportedLanguage);

            // 创建语法树
            tree = await this.resourceManager.createTree(parser, code);

            // 获取语言模块
            const languageModule = await this.languageManager.getLanguage(language as SupportedLanguage);

            // 执行查询
            const allQueries = query ? [query, ...queries] : queries;

            if (allQueries.length === 0) {
                return { success: true, matches: [], errors: [] };
            }

            // 使用查询处理器执行查询
            const matches = await this.queryProcessorService.executeQueries(
                tree,
                allQueries,
                languageModule
            );

            return { success: true, matches, errors: [] };
        } finally {
            // 清理资源
            if (tree) {
                this.resourceManager.destroyTree(tree);
            }
            if (parser) {
                this.resourceManager.releaseParser(parser, language as SupportedLanguage);
            }
        }
    }

    /**
     * 执行高级解析请求
     */
    private async executeAdvancedParsingRequest(request: AdvancedParseRequest): Promise<AdvancedParseResult> {
        const { language, code, query, queries = [] } = request;

        // 特殊处理空代码情况
        if (code === '') {
            return {
                success: true,
                matches: [],
                errors: [],
                performance: {
                    parseTime: 0,
                    queryTime: 0,
                    totalTime: 0,
                    memoryUsage: process.memoryUsage().heapUsed,
                    matchCount: 0,
                    predicatesProcessed: 0,
                    directivesApplied: 0,
                },
            };
        }

        let parser: any = null;
        let tree: TreeSitterTree | null = null;

        try {
            // 获取解析器
            parser = await this.resourceManager.acquireParser(language as SupportedLanguage);

            // 创建语法树
            tree = await this.resourceManager.createTree(parser, code);

            // 获取语言模块
            const languageModule = await this.languageManager.getLanguage(language as SupportedLanguage);

            // 执行查询
            const allQueries = query ? [query, ...queries] : queries;

            if (allQueries.length === 0) {
                return {
                    success: true,
                    matches: [],
                    errors: [],
                    performance: {
                        parseTime: 0,
                        queryTime: 0,
                        totalTime: 0,
                        memoryUsage: process.memoryUsage().heapUsed,
                        matchCount: 0,
                        predicatesProcessed: 0,
                        directivesApplied: 0,
                    },
                };
            }

            // 使用查询处理器执行高级查询
            const matches = await this.queryProcessorService.executeAdvancedQueries(
                tree,
                allQueries,
                languageModule
            );

            // 应用结果限制
            const limitedMatches = request.maxResults
                ? matches.slice(0, request.maxResults)
                : matches;

            return {
                success: true,
                matches: limitedMatches,
                errors: [],
                performance: {
                    parseTime: 0,
                    queryTime: 0,
                    totalTime: 0,
                    memoryUsage: process.memoryUsage().heapUsed,
                    matchCount: limitedMatches.length,
                    predicatesProcessed: 0,
                    directivesApplied: 0,
                },
            };
        } finally {
            // 清理资源
            if (tree) {
                this.resourceManager.destroyTree(tree);
            }
            if (parser) {
                this.resourceManager.releaseParser(parser, language as SupportedLanguage);
            }
        }
    }
}