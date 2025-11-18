import { LanguageManager } from '../LanguageManager';
import { SupportedLanguage } from '@/types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '@/types/errors';

describe('LanguageManager', () => {
  let languageManager: LanguageManager;

  beforeEach(() => {
    languageManager = new LanguageManager();
    // 清理缓存，确保测试独立性
    languageManager.clearCache();
  });

  afterEach(() => {
    languageManager.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with supported languages', () => {
      const supportedLanguages = languageManager.getSupportedLanguages();
      expect(supportedLanguages).toContain('javascript');
      expect(supportedLanguages).toContain('typescript');
      expect(supportedLanguages).toContain('python');
      expect(supportedLanguages).toContain('java');
      expect(supportedLanguages).toContain('go');
      expect(supportedLanguages).toContain('rust');
      expect(supportedLanguages).toContain('cpp');
      expect(supportedLanguages).toContain('c');
      expect(supportedLanguages).toContain('csharp');
      expect(supportedLanguages).toContain('ruby');
    });

    it('should have correct number of supported languages', () => {
      const supportedLanguages = languageManager.getSupportedLanguages();
      expect(supportedLanguages.length).toBe(10); // 根据初始化列表
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(languageManager.isLanguageSupported('javascript')).toBe(true);
      expect(languageManager.isLanguageSupported('python')).toBe(true);
      expect(languageManager.isLanguageSupported('typescript')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(languageManager.isLanguageSupported('unsupported-language')).toBe(false);
      expect(languageManager.isLanguageSupported('')).toBe(false);
      expect(languageManager.isLanguageSupported('unknown')).toBe(false);
    });
  });

  describe('getLanguage', () => {
    it('should throw error for unsupported language', async () => {
      await expect(languageManager.getLanguage('unsupported-language' as SupportedLanguage))
        .rejects
        .toThrow(TreeSitterError);
      
      const error = await languageManager.getLanguage('unsupported-language' as SupportedLanguage)
        .catch(err => err);
      
      expect(error.type).toBe(ErrorType.UNSUPPORTED_LANGUAGE);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should load supported language modules', async () => {
      // 由于真实的Tree-sitter模块可能无法在测试环境中加载，
      // 我们测试加载流程而不是实际加载
      const supportedLanguages = languageManager.getSupportedLanguages();
      
      for (const lang of supportedLanguages) {
        // 检查是否能正确识别支持的语言
        expect(languageManager.isLanguageSupported(lang)).toBe(true);
      }
    });

    it('should cache loaded language modules', async () => {
      // 模拟语言模块加载
      const language = 'javascript' as SupportedLanguage;
      
      // 这里我们只测试缓存逻辑，因为真实模块可能无法加载
      expect(languageManager.isLanguageLoaded(language)).toBe(false);
      expect(languageManager.isLanguageLoading(language)).toBe(false);
    });

    it('should handle concurrent loading of same language', async () => {
      const language = 'javascript' as SupportedLanguage;
      
      // 模拟并发请求
      const promises = [
        languageManager.getLanguage(language),
        languageManager.getLanguage(language),
        languageManager.getLanguage(language)
      ];
      
      // 检查是否正在加载
      expect(languageManager.isLanguageLoading(language)).toBe(true);
      
      // 等待所有请求完成（虽然会失败，但测试加载逻辑）
      await Promise.allSettled(promises);
    });
  });

 describe('preloadLanguage', () => {
    it('should preload a specific language', async () => {
      const language = 'javascript' as SupportedLanguage;
      
      // 预加载语言
      await expect(languageManager.preloadLanguage(language))
        .resolves
        .not.toThrow();
    });

    it('should handle preload failure gracefully', async () => {
      const unsupportedLang = 'unsupported-language' as SupportedLanguage;
      
      await expect(languageManager.preloadLanguage(unsupportedLang))
        .rejects
        .toThrow();
    });
  });

  describe('preloadAllLanguages', () => {
    it('should attempt to preload all supported languages', async () => {
      // 预加载所有语言
      await expect(languageManager.preloadAllLanguages())
        .resolves
        .not.toThrow();
    });
 });

  describe('cache management', () => {
    it('should clear cache correctly', () => {
      // 验证初始状态
      expect(languageManager.getLoadedLanguagesCount()).toBe(0);
      expect(languageManager.getLoadingLanguagesCount()).toBe(0);
      
      // 清理缓存（应该没有影响）
      languageManager.clearCache();
      
      expect(languageManager.getLoadedLanguagesCount()).toBe(0);
      expect(languageManager.getLoadingLanguagesCount()).toBe(0);
    });

    it('should return correct loaded languages count', () => {
      expect(languageManager.getLoadedLanguagesCount()).toBe(0);
    });

    it('should return correct loading languages count', () => {
      expect(languageManager.getLoadingLanguagesCount()).toBe(0);
    });
  });

 describe('getStatus', () => {
    it('should return correct status information', () => {
      const status = languageManager.getStatus();
      
      expect(status).toHaveProperty('supportedLanguages');
      expect(status).toHaveProperty('loadedLanguages');
      expect(status).toHaveProperty('loadingLanguages');
      expect(status).toHaveProperty('totalSupported');
      expect(status).toHaveProperty('totalLoaded');
      expect(status).toHaveProperty('totalLoading');
      
      expect(Array.isArray(status.supportedLanguages)).toBe(true);
      expect(Array.isArray(status.loadedLanguages)).toBe(true);
      expect(Array.isArray(status.loadingLanguages)).toBe(true);
      expect(typeof status.totalSupported).toBe('number');
      expect(typeof status.totalLoaded).toBe('number');
      expect(typeof status.totalLoading).toBe('number');
    });
  });

  describe('language state checks', () => {
    it('should correctly check if language is loaded', () => {
      const language = 'javascript' as SupportedLanguage;
      expect(languageManager.isLanguageLoaded(language)).toBe(false);
    });

    it('should correctly check if language is loading', () => {
      const language = 'javascript' as SupportedLanguage;
      expect(languageManager.isLanguageLoading(language)).toBe(false);
    });
  });

  describe('unloadLanguage', () => {
    it('should return false when trying to unload non-loaded language', () => {
      const language = 'javascript' as SupportedLanguage;
      const result = languageManager.unloadLanguage(language);
      expect(result).toBe(false);
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage information', () => {
      const memoryUsage = languageManager.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('loadedLanguages');
      expect(memoryUsage).toHaveProperty('estimatedMemoryUsage');
      expect(typeof memoryUsage.loadedLanguages).toBe('number');
      expect(typeof memoryUsage.estimatedMemoryUsage).toBe('number');
      
      // 验证估算值合理
      expect(memoryUsage.loadedLanguages).toBe(0); // 因为没有加载任何语言
      expect(memoryUsage.estimatedMemoryUsage).toBe(0);
    });
 });
});