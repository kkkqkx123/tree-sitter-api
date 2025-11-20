/**
 * 谓词功能集成测试
 */

import { QueryExecutor } from '../../src/core/QueryExecutor';
import { TreeSitterTree } from '../../src/types/treeSitter';
import { AdvancedParseResult } from '../../src/types/advancedQuery';

// Mock tree-sitter language module
const mockLanguageModule = {
  query: () => {
    // 创建一个模拟的查询对象
    return {
      matches: () => {
        // 模拟匹配结果
        return [
          {
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
              {
                name: 'keyword',
                node: {
                  type: 'keyword',
                  text: 'if',
                  startPosition: { row: 2, column: 0 },
                  endPosition: { row: 2, column: 2 },
                  isNamed: true,
                  childCount: 0,
                  children: [],
                },
              },
            ],
          },
        ];
      },
      delete: () => {},
    };
  },
};

// Mock tree
const mockTree: TreeSitterTree = {
  rootNode: {
    type: 'program',
    text: 'program',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 2, column: 2 },
    isNamed: true,
    childCount: 3,
    children: [],
  },
  getLanguage: () => mockLanguageModule,
  delete: () => {},
};

describe('Predicate Integration Tests', () => {
  let executor: QueryExecutor;

  beforeEach(() => {
    executor = new QueryExecutor();
  });

  describe('Basic Predicate Queries', () => {
    it('should execute query with equality predicate', async () => {
      const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('eq');
    });

    it('should execute query with match predicate', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "test.*")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('match');
    });

    it('should execute query with any-of predicate', async () => {
      const query = `
        (identifier) @identifier
        (#any-of? @identifier ["testVariable", "otherVariable"])
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('any-of');
    });

    it('should execute query with is predicate', async () => {
      const query = `
        (identifier) @identifier
        (#is? @identifier "identifier")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.type).toBe('identifier');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('is');
    });
  });

  describe('Negated Predicate Queries', () => {
    it('should execute query with not-eq predicate', async () => {
      const query = `
        (identifier) @identifier
        (#not-eq? @identifier "otherVariable")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('not-eq');
    });

    it('should execute query with not-match predicate', async () => {
      const query = `
        (identifier) @identifier
        (#not-match? @identifier "other.*")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(1);
      expect(result.predicates![0]!.type).toBe('not-match');
    });
  });

  describe('Multiple Predicate Queries', () => {
    it('should execute query with multiple predicates', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "test.*")
        (#is? @identifier "identifier")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
      expect(result.predicates!).toHaveLength(2);
      expect(result.predicates![0]!.type).toBe('match');
      expect(result.predicates![1]!.type).toBe('is');
    });

    it('should filter out matches that do not satisfy all predicates', async () => {
      const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
        (#eq? @identifier "otherVariable")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(0); // No match satisfies both predicates
      expect(result.predicates!).toHaveLength(2);
    });
  });

  describe('Complex Predicate Scenarios', () => {
    it('should handle regex patterns in match predicates', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "^[a-z][a-zA-Z0-9]*$")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
    });

    it('should handle multiple values in any-of predicate', async () => {
      const query = `
        (identifier) @identifier
        (#any-of? @identifier ["testVariable", "testFunction", "testClass"])
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
    });

    it('should handle mixed positive and negative predicates', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "test.*")
        (#not-eq? @identifier "testFunction")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]!.text).toBe('testVariable');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid regex pattern in match predicate', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "[invalid regex")
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

    it('should handle invalid predicate type', async () => {
      const query = `
        (identifier) @identifier
        (#invalid? @identifier "testVariable")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing parameters in any-of predicate', async () => {
      const query = `
        (identifier) @identifier
        (#any-of? @identifier)
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
    it('should include performance metrics in result', async () => {
      const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
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
      expect(result.performance!.predicatesProcessed).toBe(1);
    });

    it('should track predicate processing time', async () => {
      const query = `
        (identifier) @identifier
        (#match? @identifier "test.*")
        (#is? @identifier "identifier")
        (#not-eq? @identifier "otherVariable")
      `;

      const result: AdvancedParseResult = await executor.executeQueryWithAdvancedFeatures(
        mockTree,
        query,
        mockLanguageModule
      );

      expect(result.success).toBe(true);
      expect(result.performance!.predicatesProcessed).toBe(3);
    });
  });
});