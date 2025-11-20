/**
 * PredicateProcessor 单元测试
 */

import { PredicateProcessor } from '../PredicateProcessor';
import { QueryPredicate, EnhancedMatchResult } from '../../types/advancedQuery';

describe('PredicateProcessor', () => {
  let processor: PredicateProcessor;
  let sampleMatch: EnhancedMatchResult;

  beforeEach(() => {
    processor = new PredicateProcessor();
    sampleMatch = {
      captureName: 'test',
      type: 'identifier',
      text: 'testVariable',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: 12 },
      metadata: {},
      processedText: 'testVariable',
      adjacentNodes: [],
      predicateResults: [],
      directiveResults: [],
    };
  });

  describe('processEqualityPredicate', () => {
    it('should return true when text matches exactly', async () => {
      const predicate: QueryPredicate = {
        type: 'eq',
        capture: 'test',
        value: 'testVariable',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('equals');
    });

    it('should return false when text does not match', async () => {
      const predicate: QueryPredicate = {
        type: 'eq',
        capture: 'test',
        value: 'otherVariable',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(false);
      expect(result.details).toContain('does not equal');
    });

    it('should throw error for non-string value', async () => {
      const predicate: QueryPredicate = {
        type: 'eq',
        capture: 'test',
        value: ['not', 'a', 'string'],
      };

      await expect(processor.evaluatePredicate(sampleMatch, predicate))
        .rejects.toThrow('Equality predicate requires a string value');
    });
  });

  describe('processMatchPredicate', () => {
    it('should return true when text matches regex pattern', async () => {
      const predicate: QueryPredicate = {
        type: 'match',
        capture: 'test',
        value: 'test.*',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('matches');
    });

    it('should return false when text does not match regex pattern', async () => {
      const predicate: QueryPredicate = {
        type: 'match',
        capture: 'test',
        value: 'other.*',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(false);
      expect(result.details).toContain('does not match');
    });

    it('should throw error for invalid regex pattern', async () => {
      const predicate: QueryPredicate = {
        type: 'match',
        capture: 'test',
        value: '[invalid regex',
      };

      await expect(processor.evaluatePredicate(sampleMatch, predicate))
        .rejects.toThrow('Invalid regex pattern');
    });
  });

  describe('processAnyOfPredicate', () => {
    it('should return true when text is in the list', async () => {
      const predicate: QueryPredicate = {
        type: 'any-of',
        capture: 'test',
        value: ['testVariable', 'otherVariable', 'anotherVariable'],
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('is in');
    });

    it('should return false when text is not in the list', async () => {
      const predicate: QueryPredicate = {
        type: 'any-of',
        capture: 'test',
        value: ['otherVariable', 'anotherVariable'],
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(false);
      expect(result.details).toContain('is not in');
    });

    it('should throw error for non-array value', async () => {
      const predicate: QueryPredicate = {
        type: 'any-of',
        capture: 'test',
        value: 'not an array',
      };

      await expect(processor.evaluatePredicate(sampleMatch, predicate))
        .rejects.toThrow('Any-of predicate requires an array of values');
    });
  });

  describe('processIsPredicate', () => {
    it('should return true for identifier type', async () => {
      const predicate: QueryPredicate = {
        type: 'is',
        capture: 'test',
        value: 'identifier',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('identifier');
    });

    it('should return true for function type', async () => {
      const functionMatch: EnhancedMatchResult = {
        ...sampleMatch,
        type: 'function',
        text: 'testFunction',
      };

      const predicate: QueryPredicate = {
        type: 'is',
        capture: 'test',
        value: 'function',
      };

      const result = await processor.evaluatePredicate(functionMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('function');
    });

    it('should return true for keyword text', async () => {
      const keywordMatch: EnhancedMatchResult = {
        ...sampleMatch,
        text: 'if',
      };

      const predicate: QueryPredicate = {
        type: 'is',
        capture: 'test',
        value: 'keyword',
      };

      const result = await processor.evaluatePredicate(keywordMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('keyword');
    });
  });

  describe('processNotEqualityPredicate', () => {
    it('should return true when text does not match', async () => {
      const predicate: QueryPredicate = {
        type: 'not-eq',
        capture: 'test',
        value: 'otherVariable',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('does not equal');
    });

    it('should return false when text matches', async () => {
      const predicate: QueryPredicate = {
        type: 'not-eq',
        capture: 'test',
        value: 'testVariable',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(false);
      expect(result.details).toContain('equals');
    });
  });

  describe('processNotMatchPredicate', () => {
    it('should return true when text does not match regex pattern', async () => {
      const predicate: QueryPredicate = {
        type: 'not-match',
        capture: 'test',
        value: 'other.*',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(true);
      expect(result.details).toContain('does not match');
    });

    it('should return false when text matches regex pattern', async () => {
      const predicate: QueryPredicate = {
        type: 'not-match',
        capture: 'test',
        value: 'test.*',
      };

      const result = await processor.evaluatePredicate(sampleMatch, predicate);

      expect(result.passed).toBe(false);
      expect(result.details).toContain('matches');
    });
  });

  describe('applyPredicates', () => {
    it('should filter matches based on predicates', async () => {
      const matches = [
        sampleMatch,
        { ...sampleMatch, text: 'otherVariable', captureName: 'other' },
        { ...sampleMatch, text: 'testFunction', captureName: 'function' },
      ];

      const predicates: QueryPredicate[] = [
        {
          type: 'eq',
          capture: 'test',
          value: 'testVariable',
        },
      ];

      const result = await processor.applyPredicates(matches, predicates);

      expect(result.filteredMatches).toHaveLength(1);
      expect(result.filteredMatches[0]?.text).toBe('testVariable');
      expect(result.predicateResults).toHaveLength(3);
    });

    it('should handle multiple predicates', async () => {
      const matches = [
        sampleMatch,
        { ...sampleMatch, text: 'testFunction', captureName: 'function' },
      ];

      const predicates: QueryPredicate[] = [
        {
          type: 'match',
          capture: 'test',
          value: 'test.*',
        },
        {
          type: 'is',
          capture: 'test',
          value: 'identifier',
        },
      ];

      const result = await processor.applyPredicates(matches, predicates);

      expect(result.filteredMatches).toHaveLength(1);
      expect(result.filteredMatches[0]?.text).toBe('testVariable');
      });

      it('should handle negated predicates', async () => {
      const matches = [
        sampleMatch,
        { ...sampleMatch, text: 'otherVariable', captureName: 'other' },
      ];

      const predicates: QueryPredicate[] = [
        {
          type: 'not-eq',
          capture: 'test',
          value: 'otherVariable',
        },
      ];

      const result = await processor.applyPredicates(matches, predicates);

      expect(result.filteredMatches).toHaveLength(1);
      expect(result.filteredMatches[0]?.text).toBe('testVariable');
      });
      });

      describe('validatePredicate', () => {
    it('should validate correct predicate', () => {
      const predicate: QueryPredicate = {
        type: 'eq',
        capture: 'test',
        value: 'testValue',
      };

      const result = processor.validatePredicate(predicate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid predicate type', () => {
      const predicate: QueryPredicate = {
        type: 'invalid' as any,
        capture: 'test',
        value: 'testValue',
      };

      const result = processor.validatePredicate(predicate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid predicate type: invalid');
    });

    it('should reject match predicate with invalid regex', () => {
      const predicate: QueryPredicate = {
        type: 'match',
        capture: 'test',
        value: '[invalid regex',
      };

      const result = processor.validatePredicate(predicate);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid regex pattern'))).toBe(true);
    });

    it('should reject any-of predicate with non-array value', () => {
      const predicate: QueryPredicate = {
        type: 'any-of',
        capture: 'test',
        value: 'not an array',
      };

      const result = processor.validatePredicate(predicate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Any-of predicate requires an array value');
    });
  });

  describe('validatePredicates', () => {
    it('should validate multiple correct predicates', () => {
      const predicates: QueryPredicate[] = [
        {
          type: 'eq',
          capture: 'test',
          value: 'testValue',
        },
        {
          type: 'match',
          capture: 'test',
          value: 'test.*',
        },
      ];

      const result = processor.validatePredicates(predicates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from multiple predicates', () => {
      const predicates: QueryPredicate[] = [
        {
          type: 'eq',
          capture: 'test',
          value: 'test123', // Changed from 123 to a valid string value
        },
        {
          type: 'invalid' as any,
          capture: 'test',
          value: 'testValue',
        },
      ];

      const result = processor.validatePredicates(predicates);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    });
    });