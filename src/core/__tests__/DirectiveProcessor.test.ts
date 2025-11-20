/**
 * DirectiveProcessor 单元测试
 */

import { DirectiveProcessor } from '../DirectiveProcessor';
import { QueryDirective, EnhancedMatchResult } from '../../types/advancedQuery';

describe('DirectiveProcessor', () => {
  let processor: DirectiveProcessor;
  let sampleMatch: EnhancedMatchResult;

  beforeEach(() => {
    processor = new DirectiveProcessor();
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

  describe('processSetDirective', () => {
    it('should set metadata property', async () => {
      const directive: QueryDirective = {
        type: 'set',
        capture: 'test',
        parameters: ['category', 'variable'],
      };

      const result = await processor.applySingleDirective([sampleMatch], directive);

      expect(result.applied).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.matches[0].metadata).toEqual({
        category: 'variable',
      });
    });

    it('should update existing metadata', async () => {
      const matchWithMetadata: EnhancedMatchResult = {
        ...sampleMatch,
        metadata: { existing: 'value' },
      };

      const directive: QueryDirective = {
        type: 'set',
        capture: 'test',
        parameters: ['newKey', 'newValue'],
      };

      const result = await processor.applySingleDirective([matchWithMetadata], directive);

      expect(result.applied).toBe(true);
      expect(result.result?.matches[0].metadata).toEqual({
        existing: 'value',
        newKey: 'newValue',
      });
    });

    it('should throw error for insufficient parameters', async () => {
      const directive: QueryDirective = {
        type: 'set',
        capture: 'test',
        parameters: ['onlyKey'],
      };

      await expect(processor.applySingleDirective([sampleMatch], directive))
        .rejects.toThrow('Set directive requires at least 2 parameters');
    });
  });

  describe('processStripDirective', () => {
    it('should strip pattern from text', async () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['^test'],
      };

      const result = await processor.applySingleDirective([sampleMatch], directive);

      expect(result.applied).toBe(true);
      expect(result.result?.matches[0].processedText).toBe('Variable');
    });

    it('should strip multiple occurrences', async () => {
      const matchWithMultiple: EnhancedMatchResult = {
        ...sampleMatch,
        text: 'test_test_test',
        processedText: 'test_test_test',
      };

      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['test'],
      };

      const result = await processor.applySingleDirective([matchWithMultiple], directive);

      expect(result.applied).toBe(true);
      expect(result.result?.matches[0].processedText).toBe('___');
    });

    it('should handle complex regex patterns', async () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['[a-z]+'],
      };

      const result = await processor.applySingleDirective([sampleMatch], directive);

      expect(result.applied).toBe(true);
      expect(result.result?.matches[0].processedText).toBe('VV');
    });

    it('should throw error for invalid regex pattern', async () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['[invalid regex'],
      };

      await expect(processor.applySingleDirective([sampleMatch], directive))
        .rejects.toThrow('Invalid regex pattern for strip directive');
    });

    it('should throw error for missing parameters', async () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: [],
      };

      await expect(processor.applySingleDirective([sampleMatch], directive))
        .rejects.toThrow('Strip directive requires a regex pattern parameter');
    });
  });

  describe('processSelectAdjacentDirective', () => {
    it('should select adjacent nodes', async () => {
      const directive: QueryDirective = {
        type: 'select-adjacent',
        capture: 'test',
        parameters: ['test', 'adjacent'],
      };

      const result = await processor.applySingleDirective([sampleMatch], directive);

      expect(result.applied).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should throw error for insufficient parameters', async () => {
      const directive: QueryDirective = {
        type: 'select-adjacent',
        capture: 'test',
        parameters: ['onlyOne'],
      };

      await expect(processor.applySingleDirective([sampleMatch], directive))
        .rejects.toThrow('Select-adjacent directive requires 2 capture names');
    });

    it('should throw error for non-string parameters', async () => {
      const directive: QueryDirective = {
        type: 'select-adjacent',
        capture: 'test',
        parameters: [123, 'adjacent'],
      };

      await expect(processor.applySingleDirective([sampleMatch], directive))
        .rejects.toThrow('Select-adjacent directive parameters must be capture names');
    });
 });

  describe('applyDirectives', () => {
    it('should apply multiple directives', async () => {
      const matches = [sampleMatch];
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['category', 'variable'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['^test'],
        },
      ];

      const result = await processor.applyDirectives(matches, directives);

      expect(result.processedMatches).toHaveLength(1);
      expect(result.processedMatches[0]?.metadata).toEqual({
        category: 'variable',
      });
      expect(result.processedMatches[0]?.processedText).toBe('Variable');
      expect(result.directiveResults).toHaveLength(2);
    });

    it('should handle directives with different captures', async () => {
      const matches = [
        sampleMatch,
        { ...sampleMatch, captureName: 'other', text: 'otherVariable' },
      ];
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['category', 'variable'],
        },
        {
          type: 'set',
          capture: 'other',
          parameters: ['category', 'other'],
        },
      ];
      const result = await processor.applyDirectives(matches, directives);

      expect(result.processedMatches).toHaveLength(2);
      expect(result.processedMatches[0]?.metadata).toEqual({
        category: 'variable',
      });
      expect(result.processedMatches[1]?.metadata).toEqual({
        category: 'other',
      });
    });

    it('should handle empty directives array', async () => {
      const matches = [sampleMatch];
      const directives: QueryDirective[] = [];

      const result = await processor.applyDirectives(matches, directives);

      expect(result.processedMatches).toHaveLength(1);
      expect(result.processedMatches[0]?.processedBy).toEqual([]);
      expect(result.processedMatches[0]?.transformations).toEqual([]);
    });

    it('should handle directive errors gracefully', async () => {
      const matches = [sampleMatch];
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['category', 'variable'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: [], // Invalid - will cause error
        },
      ];

      const result = await processor.applyDirectives(matches, directives);

      expect(result.processedMatches).toHaveLength(1);
      expect(result.processedMatches[0]?.metadata).toEqual({
        category: 'variable',
      });
      expect(result.directiveResults).toHaveLength(2);
      expect(result.directiveResults[0]?.applied).toBe(true);
      expect(result.directiveResults[1]?.applied).toBe(false);
      expect(result.directiveResults[1]?.error).toBeDefined();
    });
  });

  describe('validateDirective', () => {
    it('should validate correct set directive', () => {
      const directive: QueryDirective = {
        type: 'set',
        capture: 'test',
        parameters: ['key', 'value'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct strip directive', () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['pattern'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct select-adjacent directive', () => {
      const directive: QueryDirective = {
        type: 'select-adjacent',
        capture: 'test',
        parameters: ['capture1', 'capture2'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid directive type', () => {
      const directive: QueryDirective = {
        type: 'invalid' as any,
        capture: 'test',
        parameters: [],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid directive type: invalid');
    });

    it('should reject set directive with insufficient parameters', () => {
      const directive: QueryDirective = {
        type: 'set',
        capture: 'test',
        parameters: ['onlyKey'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Set directive requires at least 2 parameters');
    });

    it('should reject strip directive with invalid regex', () => {
      const directive: QueryDirective = {
        type: 'strip',
        capture: 'test',
        parameters: ['[invalid regex'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid regex pattern'))).toBe(true);
    });

    it('should reject select-adjacent directive with insufficient parameters', () => {
      const directive: QueryDirective = {
        type: 'select-adjacent',
        capture: 'test',
        parameters: ['onlyOne'],
      };

      const result = processor.validateDirective(directive);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Select-adjacent directive requires 2 capture names');
    });
 });

  describe('validateDirectives', () => {
    it('should validate multiple correct directives', () => {
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['key', 'value'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern'],
        },
      ];

      const result = processor.validateDirectives(directives);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from multiple directives', () => {
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['onlyKey'], // Invalid
        },
        {
          type: 'invalid' as any,
          capture: 'test',
          parameters: [],
        },
      ];

      const result = processor.validateDirectives(directives);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

 describe('checkDirectiveConflicts', () => {
    it('should detect multiple strip directives for same capture', () => {
      const directives: QueryDirective[] = [
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern1'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern2'],
        },
      ];

      const result = processor.checkDirectiveConflicts(directives);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toContain('Multiple strip directives');
    });

    it('should not detect conflicts for different directive types', () => {
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['key', 'value'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern'],
        },
      ];

      const result = processor.checkDirectiveConflicts(directives);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should not detect conflicts for strip directives on different captures', () => {
      const directives: QueryDirective[] = [
        {
          type: 'strip',
          capture: 'test1',
          parameters: ['pattern1'],
        },
        {
          type: 'strip',
          capture: 'test2',
          parameters: ['pattern2'],
        },
      ];

      const result = processor.checkDirectiveConflicts(directives);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('optimizeDirectives', () => {
    it('should merge set directives with same capture and key', () => {
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['key', 'value1'],
        },
        {
          type: 'set',
          capture: 'test',
          parameters: ['key', 'value2'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern'],
        },
      ];

      const optimized = processor.optimizeDirectives(directives);

      expect(optimized).toHaveLength(2);
      expect(optimized[0]).toBeDefined();
      expect(optimized[0]!.type).toBe('set');
      expect(optimized[0]!.parameters).toEqual(['key', 'value2']); // Last value wins
      expect(optimized[1]).toBeDefined();
      expect(optimized[1]!.type).toBe('strip');
    });

    it('should preserve directives of different types', () => {
      const directives: QueryDirective[] = [
        {
          type: 'set',
          capture: 'test',
          parameters: ['key1', 'value1'],
        },
        {
          type: 'strip',
          capture: 'test',
          parameters: ['pattern'],
        },
        {
          type: 'set',
          capture: 'test',
          parameters: ['key2', 'value2'],
        },
      ];

      const optimized = processor.optimizeDirectives(directives);

      expect(optimized).toHaveLength(3);
      expect(optimized.some(d => d.type === 'set' && d.parameters[0] === 'key1')).toBe(true);
      expect(optimized.some(d => d.type === 'set' && d.parameters[0] === 'key2')).toBe(true);
      expect(optimized.some(d => d.type === 'strip')).toBe(true);
    });
  });
});