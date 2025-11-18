/**
 * 语言管理器 - 负责管理和加载各种编程语言的Tree-sitter解析器
 */

import { SupportedLanguage, LanguageModule } from '../types/treeSitter';
import { TreeSitterError, ErrorType, ErrorSeverity } from '../types/errors';
import { log } from '../utils/Logger';

export class LanguageManager {
  private languageModules: Map<SupportedLanguage, LanguageModule> = new Map();
  private supportedLanguages: Set<SupportedLanguage> = new Set();
  private loadingPromises: Map<SupportedLanguage, Promise<LanguageModule>> =
    new Map();

  constructor() {
    this.initializeSupportedLanguages();
  }

  /**
   * 初始化支持的语言列表
   */
  private initializeSupportedLanguages(): void {
    const languages: SupportedLanguage[] = [
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c',
      'csharp',
      'ruby',
    ];

    languages.forEach(lang => this.supportedLanguages.add(lang));
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.supportedLanguages);
  }

  /**
   * 检查是否支持指定语言
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.supportedLanguages.has(language as SupportedLanguage);
  }

  /**
   * 获取语言模块（懒加载）
   */
  async getLanguage(language: SupportedLanguage): Promise<LanguageModule> {
    if (!this.isLanguageSupported(language)) {
      throw new TreeSitterError(
        ErrorType.UNSUPPORTED_LANGUAGE,
        ErrorSeverity.MEDIUM,
        `Unsupported language: ${language}`,
      );
    }

    // 如果已经加载，直接返回
    if (this.languageModules.has(language)) {
      return this.languageModules.get(language)!;
    }

    // 如果正在加载，返回加载Promise
    if (this.loadingPromises.has(language)) {
      return this.loadingPromises.get(language)!;
    }

    // 开始加载语言模块
    const loadingPromise = this.loadLanguageModule(language);
    this.loadingPromises.set(language, loadingPromise);

    try {
      const module = await loadingPromise;
      this.languageModules.set(language, module);
      return module;
    } finally {
      this.loadingPromises.delete(language);
    }
  }

  /**
   * 加载语言模块
   */
  private async loadLanguageModule(
    language: SupportedLanguage,
  ): Promise<LanguageModule> {
    try {
      let module: LanguageModule;

      switch (language) {
        case 'javascript':
          module = require('tree-sitter-javascript');
          break;
        case 'typescript':
          // TypeScript需要特殊处理
          const ts = require('tree-sitter-typescript');
          module = ts.typescript;
          break;
        case 'python':
          module = require('tree-sitter-python');
          break;
        case 'java':
          module = require('tree-sitter-java');
          break;
        case 'go':
          module = require('tree-sitter-go');
          break;
        case 'rust':
          module = require('tree-sitter-rust');
          break;
        case 'cpp':
          module = require('tree-sitter-cpp');
          break;
        case 'c':
          module = require('tree-sitter-c');
          break;
        case 'csharp':
          module = require('tree-sitter-c-sharp');
          break;
        case 'ruby':
          module = require('tree-sitter-ruby');
          break;
        default:
          throw new TreeSitterError(
            ErrorType.UNSUPPORTED_LANGUAGE,
            ErrorSeverity.MEDIUM,
            `No parser available for ${language}`,
          );
      }

      // 验证模块是否有效
      if (!module || typeof module !== 'object') {
        throw new TreeSitterError(
          ErrorType.INTERNAL_ERROR,
          ErrorSeverity.HIGH,
          `Invalid language module for ${language}`,
        );
      }

      return module;
    } catch (error) {
      if (error instanceof TreeSitterError) {
        throw error;
      }

      throw new TreeSitterError(
        ErrorType.INTERNAL_ERROR,
        ErrorSeverity.HIGH,
        `Failed to load ${language} parser: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
      );
    }
  }

  /**
   * 预加载指定语言模块
   */
  async preloadLanguage(language: SupportedLanguage): Promise<void> {
    await this.getLanguage(language);
  }

  /**
   * 预加载所有支持的语言模块
   */
  async preloadAllLanguages(): Promise<void> {
    const promises = Array.from(this.supportedLanguages).map(lang =>
      this.preloadLanguage(lang).catch(error => {
        log.warn('LanguageManager', `Failed to preload ${lang}:`, error);
      }),
    );

    await Promise.allSettled(promises);
  }

  /**
   * 清理语言模块缓存
   */
  clearCache(): void {
    this.languageModules.clear();
    this.loadingPromises.clear();
  }

  /**
   * 获取已加载的语言模块数量
   */
  getLoadedLanguagesCount(): number {
    return this.languageModules.size;
  }

  /**
   * 获取正在加载的语言数量
   */
  getLoadingLanguagesCount(): number {
    return this.loadingPromises.size;
  }

  /**
   * 获取语言管理器状态
   */
  getStatus(): {
    supportedLanguages: SupportedLanguage[];
    loadedLanguages: SupportedLanguage[];
    loadingLanguages: SupportedLanguage[];
    totalSupported: number;
    totalLoaded: number;
    totalLoading: number;
  } {
    return {
      supportedLanguages: this.getSupportedLanguages(),
      loadedLanguages: Array.from(this.languageModules.keys()),
      loadingLanguages: Array.from(this.loadingPromises.keys()),
      totalSupported: this.supportedLanguages.size,
      totalLoaded: this.languageModules.size,
      totalLoading: this.loadingPromises.size,
    };
  }

  /**
   * 检查语言模块是否已加载
   */
  isLanguageLoaded(language: SupportedLanguage): boolean {
    return this.languageModules.has(language);
  }

  /**
   * 检查语言模块是否正在加载
   */
  isLanguageLoading(language: SupportedLanguage): boolean {
    return this.loadingPromises.has(language);
  }

  /**
   * 卸载指定语言模块
   */
  unloadLanguage(language: SupportedLanguage): boolean {
    if (this.languageModules.has(language)) {
      this.languageModules.delete(language);
      return true;
    }
    return false;
  }

  /**
   * 获取语言模块的内存使用情况（估算）
   */
  getMemoryUsage(): {
    loadedLanguages: number;
    estimatedMemoryUsage: number;
  } {
    // 这是一个粗略的估算，实际内存使用可能有所不同
    const avgModuleSize = 2 * 1024 * 1024; // 假设每个模块2MB
    return {
      loadedLanguages: this.languageModules.size,
      estimatedMemoryUsage: this.languageModules.size * avgModuleSize,
    };
  }
}
