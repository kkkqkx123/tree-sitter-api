/**
 * 指令功能集成测试
 * 测试Tree-sitter查询中的指令处理、转换和性能
 */

import { QueryExecutor } from '../../src/core/QueryExecutor';
import { TreeSitterTree } from '../../src/types/treeSitter';
import { AdvancedParseResult } from '../../src/types/advancedQuery';

const mockLanguageModule = {
    query: (query: string) => {
        return {
            matches: () => {
                // 根据查询字符串过滤结果
                const results = [];
                
                // 检查查询中是否包含特定的捕获模式
                if (query.includes('(identifier) @identifier')) {
                    results.push({
                        captures: [
                            {
                                name: 'identifier',
                                node: {
                                    type: 'identifier',
                                    text: 'testVariable',
                                    startPosition: { row: 0, column: 0 },
                                    endPosition: { row: 0, column: 12 },
                                    isNamed: true,
                                    childCount: 0,
                                    children: [],
                                },
                            },
                        ],
                    });
                } else if (query.includes('(comment) @comment')) {
                    results.push({
                        captures: [
                            {
                                name: 'comment',
                                node: {
                                    type: 'comment',
                                    text: '// TODO: implement this',
                                    startPosition: { row: 2, column: 0 },
                                    endPosition: { row: 2, column: 24 },
                                    isNamed: true,
                                    childCount: 0,
                                    children: [],
                                },
                            },
                        ],
                    });
                } else if (query.includes('(function) @function')) {
                    results.push({
                        captures: [
                            {
                                name: 'function',
                                node: {
                                    type: 'function',
                                    text: 'testFunction',
                                    startPosition: { row: 1, column: 0 },
                                    endPosition: { row: 1, column: 12 },
                                    isNamed: true,
                                    childCount: 0,
                                    children: [],
                                },
                            },
                        ],
                    });
                } else {
                    // 如果查询包含多个模式，返回所有匹配的捕获
                    const captures = [];
                    
                    if (query.includes('identifier')) {
                        captures.push({
                            name: 'identifier',
                            node: {
                                type: 'identifier',
                                text: 'testVariable',
                                startPosition: { row: 0, column: 0 },
                                endPosition: { row: 0, column: 12 },
                                isNamed: true,
                                childCount: 0,
                                children: [],
                            },
                        });
                    }
                    
                    if (query.includes('function')) {
                        captures.push({
                            name: 'function',
                            node: {
                                type: 'function',
                                text: 'testFunction',
                                startPosition: { row: 1, column: 0 },
                                endPosition: { row: 1, column: 12 },
                                isNamed: true,
                                childCount: 0,
                                children: [],
                            },
                        });
                    }
                    
                    if (query.includes('comment')) {
                        captures.push({
                            name: 'comment',
                            node: {
                                type: 'comment',
                                text: '// TODO: implement this',
                                startPosition: { row: 2, column: 0 },
                                endPosition: { row: 2, column: 24 },
                                isNamed: true,
                                childCount: 0,
                                children: [],
                            },
                        });
                    }
                    
                    if (captures.length > 0) {
                        results.push({ captures });
                    }
                }
                
                return results;
            },
            delete: (): void => { },
        };
    },
};

const mockTree: TreeSitterTree = {
    rootNode: {
        type: 'program',
        text: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 2, column: 24 },
        isNamed: true,
        childCount: 3,
        children: [],
    },
    getLanguage: () => mockLanguageModule,
    delete: (): void => { },
};

describe('Directive Integration Tests', () => {
    let executor: QueryExecutor;

    beforeEach(() => {
        executor = new QueryExecutor();
    });

    describe('Set Directive', () => {
        it('should add metadata to capture with set directive', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "category" "variable")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(1);
            expect(result.matches[0]?.metadata!).toEqual({ category: 'variable' });
            expect(result.directives!).toHaveLength(1);
            expect(result.directives?.[0]?.type).toBe('set');
        });

        it('should handle multiple set directives on same capture', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "category" "variable")
        (#set! @identifier "scope" "local")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.metadata!).toEqual({
              category: 'variable',
              scope: 'local',
            });
            expect(result.directives!).toHaveLength(2);
        });

        it('should error on insufficient parameters in set directive', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "onlyKey")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('requires at least 2 parameters');
        });
    });

    describe('Strip Directive', () => {
        it('should remove pattern from capture with strip directive', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "^// TODO: ")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(1);
            expect(result.matches[0]?.processedText).toBe('implement this');
            expect(result.directives!).toHaveLength(1);
            expect(result.directives?.[0]?.type).toBe('strip');
        });

        it('should handle complex regex patterns in strip directive', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "//\\s*TODO:\\s*")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.processedText).toBe('implement this');
        });

        it('should apply multiple strip directives sequentially', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "^// ")
        (#strip! @comment "TODO: ")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.processedText).toBe('implement this');
            expect(result.directives!).toHaveLength(2);
        });

        it('should error on invalid regex pattern in strip directive', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "[invalid regex")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid regex pattern');
        });

        it('should handle global replacement in strip directive', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "TODO")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.processedText).toBe('// : implement this');
        });
    });

    describe('Select-Adjacent Directive', () => {
        it('should select adjacent captures with select-adjacent directive', async () => {
            const query = `
        (identifier) @identifier
        (function) @function
        (#select-adjacent! @identifier @function)
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(2);
            expect(result.directives!).toHaveLength(1);
            expect(result.directives?.[0]?.type).toBe('select-adjacent');
        });

        it('should error on insufficient parameters in select-adjacent directive', async () => {
            const query = `
        (identifier) @identifier
        (#select-adjacent! @identifier "onlyOne")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('requires 2 capture names');
        });
    });

    describe('Multiple Directives', () => {
        it('should apply multiple directives in order', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "^// ")
        (#strip! @comment "TODO: ")
        (#set! @comment "type" "todo")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.processedText).toBe('implement this');
            expect(result.matches[0]?.metadata!).toEqual({ type: 'todo' });
            expect(result.directives!).toHaveLength(3);
        });

        it('should apply directives on different captures', async () => {
            const query = `
        (identifier) @identifier
        (comment) @comment
        (#set! @identifier "category" "variable")
        (#strip! @comment "^// ")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(2);

            const identifierMatch = result.matches.find(
                (m) => m.captureName === 'identifier'
            );
            const commentMatch = result.matches.find(
                (m) => m.captureName === 'comment'
            );

            expect(identifierMatch?.metadata).toEqual({ category: 'variable' });
            expect(commentMatch?.processedText).toBe('TODO: implement this');
        });

        it('should combine multiple set and strip directives', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "category" "variable")
        (#strip! @identifier "test")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.metadata!).toEqual({ category: 'variable' });
            expect(result.matches[0]?.processedText).toBe('Variable');
            expect(result.directives!).toHaveLength(2);
        });
    });

    describe('Directives with Predicates', () => {
        it('should apply directives after predicate filtering', async () => {
            const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
        (#set! @identifier "category" "variable")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.metadata!).toEqual({ category: 'variable' });
            expect(result.predicates).toHaveLength(1);
            expect(result.directives!).toHaveLength(1);
        });

        it('should combine match predicate with multiple directives', async () => {
            const query = `
        (identifier) @identifier
        (#match? @identifier "test.*")
        (#set! @identifier "category" "test")
        (#strip! @identifier "Variable")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.matches[0]?.text).toBe('testVariable');
            expect(result.matches[0]?.processedText).toBe('test');
            expect(result.matches[0]?.metadata!).toEqual({ category: 'test' });
            expect(result.predicates).toHaveLength(1);
            expect(result.directives!).toHaveLength(2);
        });
    });

    describe('Invalid Directives', () => {
        it('should error on unsupported directive type', async () => {
            const query = `
        (identifier) @identifier
        (#invalid! @identifier "parameter")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Unsupported directive type');
        });

        it('should error on directive without capture name', async () => {
            const query = `
        (identifier) @identifier
        (#set! "category" "variable")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Performance Metrics', () => {
        it('should track directive processing in performance metrics', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "category" "variable")
        (#strip! @identifier "test")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.performance).toBeDefined();
            expect(result.performance!.queryTime).toBeGreaterThan(0);
            expect(result.performance!.totalTime).toBeGreaterThan(0);
            expect(result.performance!.matchCount).toBe(1);
            expect(result.performance!.directivesApplied).toBe(2);
        });

        it('should report correct number of directives applied', async () => {
            const query = `
        (identifier) @identifier
        (#set! @identifier "category" "variable")
        (#strip! @identifier "test")
        (#set! @identifier "scope" "local")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.performance!.directivesApplied).toBe(3);
        });
    });

    describe('Transformation Tracking', () => {
        it('should track transformations in processed matches', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "^// TODO: ")
        (#set! @comment "type" "todo")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.processedMatches!).toBeDefined();
            expect(result.processedMatches!).toHaveLength(1);
            expect(result.processedMatches?.[0]?.transformations).toHaveLength(2);
            expect(result.processedMatches?.[0]?.processedBy).toContain('strip');
            expect(result.processedMatches?.[0]?.processedBy).toContain('set');
        });

        it('should include transformation details in processed matches', async () => {
            const query = `
        (comment) @comment
        (#strip! @comment "^// ")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.processedMatches!).toBeDefined();
            expect(result.processedMatches?.[0]?.transformations).toHaveLength(1);
            expect(result.processedMatches?.[0]?.transformations?.[0]?.type).toBe(
                'strip'
            );
            expect(
                result.processedMatches?.[0]?.transformations?.[0]?.description
            ).toContain('Stripped pattern');
        });

        it('should preserve original text in processed matches', async () => {
            const query = `
        (identifier) @identifier
        (#strip! @identifier "test")
      `;

            const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
                mockTree,
                query,
                mockLanguageModule
            );

            expect(result.success).toBe(true);
            expect(result.processedMatches?.[0]?.text).toBe('testVariable');
            expect(result.processedMatches?.[0]?.processedText).not.toBe(
                'testVariable'
            );
        });
    });
});
