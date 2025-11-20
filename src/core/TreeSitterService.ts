/**
 * 核心Tree-sitter服务 - 简化版本
 * 作为主要接口层，协调各个核心组件
 */

import { LanguageManager } from './LanguageManager';
import { QueryProcessor } from './QueryProcessor';
import { ResourceService } from './ResourceService';
import { MonitoringService } from './MonitoringService';
// import { QueryCache } from './QueryCache';
// import { PredicateProcessor } from './PredicateProcessor';
// import { DirectiveProcessor } from './DirectiveProcessor';

import { ParseRequest, ParseResult } from '../types/api';
import { SupportedLanguage, TreeSitterTree } from '../types/treeSitter';
import { CleanupStrategy } from '../config/memory';
import { log } from '../utils/Logger';

export interface ITreeSitterService {
    processRequest(request: ParseRequest): Promise<ParseResult>;
    processAdvancedRequest(request: any): Promise<any>;
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
    // 这些组件暂时未使用，但保留以备将来扩展
    // private queryCache!: QueryCache;
    // private predicateProcessor!: PredicateProcessor;
    // private directiveProcessor!: DirectiveProcessor;

    constructor() {
        this.initializeComponents();
        this.startMonitoring();
    }

    /**
     * 初始化所有组件
     */
    private initializeComponents(): void {
        this.languageManager = new LanguageManager();
        // this.queryCache = new QueryCache();
        this.queryProcessor = new QueryProcessor();
        this.resourceService = new ResourceService();
        this.monitoringService = new MonitoringService();
        // this.predicateProcessor = new PredicateProcessor();
        // this.directiveProcessor = new DirectiveProcessor();
    }

    /**
     * 启动监控服务
     */
    private startMonitoring(): void {
        this.monitoringService.startMonitoring();
        log.info('TreeSitterService', 'TreeSitterService initialized (simplified version)');
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

            // 记录性能指标
            const executionTime = Date.now() - startTime;
            this.monitoringService.recordQueryTime(executionTime);

            return result;
        } catch (error) {
            this.monitoringService.incrementErrorCount();
            throw error;
        }
    }

    /**
     * 验证请求参数
     */
    private validateRequest(request: ParseRequest): void {
        if (!request.language) {
            throw new Error('Language is required');
        }
        
        if (!this.languageManager.isLanguageSupported(request.language as SupportedLanguage)) {
            throw new Error(`Language '${request.language}' is not supported`);
        }
        
        if (!request.query && (!request.queries || request.queries.length === 0)) {
            throw new Error('At least one query is required');
        }
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
            parser = await this.resourceService.acquireParser(language as SupportedLanguage);

            // 创建语法树
            tree = await this.resourceService.createTree(parser, code);

            // 获取语言模块
            const languageModule = await this.languageManager.getLanguage(language as SupportedLanguage);

            // 执行查询
            const allQueries = query ? [query, ...queries] : queries;

            if (allQueries.length === 0) {
                return { success: true, matches: [], errors: [] };
            }

            // 简化的查询执行 - 直接使用语言模块执行查询
            const matches: any[] = [];
            
            for (const queryStr of allQueries) {
                try {
                    // 验证查询语法
                    const validationResult = this.queryProcessor.validateQuerySyntax(queryStr);
                    if (!validationResult.isValid) {
                        log.warn('TreeSitterService', `Invalid query syntax: ${validationResult.errors.map(e => e.message).join(', ')}`);
                        continue;
                    }

                    // 解析查询
                    // const parsedQuery = this.queryProcessor.parseQuery(queryStr);
                    
                    // 执行查询（简化版本）
                    const queryMatches = this.executeQuery(tree, queryStr, languageModule);
                    matches.push(...queryMatches);
                } catch (error) {
                    log.error('TreeSitterService', `Failed to execute query: ${queryStr}`, error);
                }
            }

            return { success: true, matches, errors: [] };
        } finally {
            // 清理资源
            if (tree) {
                this.resourceService.destroyTree(tree);
            }
            if (parser) {
                this.resourceService.releaseParser(parser, language as SupportedLanguage);
            }
        }
    }

    /**
     * 简化的查询执行方法
     */
    private executeQuery(tree: TreeSitterTree, queryStr: string, languageModule: any): any[] {
        try {
            // 创建查询对象
            const query = languageModule.query(queryStr);
            
            // 执行查询
            const captures = query.captures(tree.rootNode);
            
            // 转换结果格式
            const matches = captures.map((capture: any) => ({
                name: capture.name,
                text: capture.node.text,
                start: {
                    row: capture.node.startPosition.row,
                    column: capture.node.startPosition.column,
                },
                end: {
                    row: capture.node.endPosition.row,
                    column: capture.node.endPosition.column,
                },
            }));
            
            return matches;
        } catch (error) {
            log.error('TreeSitterService', `Query execution failed: ${queryStr}`, error);
            return [];
        }
    }

    /**
     * 获取健康状态
     */
    public getHealthStatus(): HealthStatus {
        const memory = this.monitoringService.checkMemory();
        const parserPool = this.resourceService.getPoolStats();
        const languageManager = this.languageManager.getStatus();
        const serviceStats = this.monitoringService.getStatistics();
        const resourceStats = this.resourceService.getActiveResourcesCount();

        // 确定整体状态
        let status: 'healthy' | 'warning' | 'error' = 'healthy';

        if (memory.level === 'critical' || serviceStats.errorRate > 50) {
            status = 'error';
        } else if (
            memory.level === 'warning' ||
            serviceStats.errorRate > 20 ||
            !this.resourceService.isHealthy()
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
        const result = await this.monitoringService.performCleanup(strategy);

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
            memory: this.monitoringService.checkMemory(),
            performance: this.monitoringService.getStatistics(),
            statistics: this.monitoringService.getStatistics(),
        };
    }

    /**
     * 处理高级解析请求
     */
    public async processAdvancedRequest(request: any): Promise<any> {
        // 简化实现，调用基础请求处理
        return this.processRequest(request);
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
    public async validateAdvancedQuery(language: string, query: string): Promise<any> {
        const validationResult = this.queryProcessor.validateQuerySyntax(query);
        return {
            language,
            query,
            validationResult,
        };
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
     * 重置统计信息
     */
    public resetStats(): void {
        this.monitoringService.resetStatistics();
    }

    /**
     * 紧急清理
     */
    public async emergencyCleanup(): Promise<void> {
        log.warn('TreeSitterService', 'Performing emergency cleanup');

        // 使用资源服务清理资源
        this.resourceService.cleanup();

        // 执行紧急清理
        await this.monitoringService.performCleanup(CleanupStrategy.EMERGENCY);
    }

    /**
     * 销毁服务
     */
    public destroy(): void {
        log.info('TreeSitterService', 'Destroying TreeSitterService...');

        // 清理资源
        this.resourceService.cleanup();

        // 销毁组件
        this.resourceService.destroy();
        this.monitoringService.destroy();

        log.info('TreeSitterService', 'TreeSitterService destroyed');
    }
}