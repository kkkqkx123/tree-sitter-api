/**
 * Logger模块测试
 */

import { Logger, LogLevel, log } from '../src/utils/Logger';

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
    
    // 清除控制台输出
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('日志级别控制', () => {
    it('应该根据LOG_LEVEL环境变量控制日志输出', () => {
      process.env['LOG_LEVEL'] = 'error';
      
      const logger = Logger.getInstance();
      
      logger.debug('TestModule', 'Debug message');
      logger.info('TestModule', 'Info message');
      logger.warn('TestModule', 'Warning message');
      logger.error('TestModule', 'Error message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('应该正确解析不同的日志级别', () => {
      const testCases = [
        { env: 'debug', expected: LogLevel.DEBUG },
        { env: 'INFO', expected: LogLevel.INFO },
        { env: 'Warn', expected: LogLevel.WARN },
        { env: 'ERROR', expected: LogLevel.ERROR },
        { env: 'fatal', expected: LogLevel.FATAL },
        { env: 'invalid', expected: LogLevel.INFO }, // 默认值
      ];

      testCases.forEach(({ env, expected }) => {
        process.env['LOG_LEVEL'] = env;
        const logger = Logger.getInstance();
        
        const shouldLogDebug = (logger as any)._shouldLog(LogLevel.DEBUG);
        const shouldLogInfo = (logger as any)._shouldLog(LogLevel.INFO);
        
        if (expected === LogLevel.DEBUG) {
          expect(shouldLogDebug).toBe(true);
          expect(shouldLogInfo).toBe(true);
        } else if (expected === LogLevel.INFO) {
          expect(shouldLogDebug).toBe(false);
          expect(shouldLogInfo).toBe(true);
        }
      });
    });
  });

  describe('消息格式化', () => {
    it('应该正确格式化包含时间戳和模块名的消息', () => {
      process.env['LOG_LEVEL'] = 'debug';
      process.env['ENABLE_LOG_TIMESTAMP'] = 'true';
      process.env['ENABLE_LOG_MODULE'] = 'true';
      
      const logger = Logger.getInstance();
      logger.info('TestModule', 'Test message');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestModule\] Test message$/)
      );
    });

    it('应该支持禁用时间戳', () => {
      process.env['LOG_LEVEL'] = 'info';
      process.env['ENABLE_LOG_TIMESTAMP'] = 'false';
      process.env['ENABLE_LOG_MODULE'] = 'true';
      
      const logger = Logger.getInstance();
      logger.info('TestModule', 'Test message');
      
      expect(console.log).toHaveBeenCalledWith(
        '[INFO] [TestModule] Test message'
      );
    });

    it('应该支持禁用模块名', () => {
      process.env['LOG_LEVEL'] = 'info';
      process.env['ENABLE_LOG_TIMESTAMP'] = 'true';
      process.env['ENABLE_LOG_MODULE'] = 'false';
      
      const logger = Logger.getInstance();
      logger.info('TestModule', 'Test message');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message$/)
      );
    });
  });

  describe('便捷接口', () => {
    it('应该通过便捷导出对象正确调用日志方法', () => {
      process.env['LOG_LEVEL'] = 'debug';
      
      log.debug('TestModule', 'Debug message');
      log.info('TestModule', 'Info message');
      log.warn('TestModule', 'Warning message');
      log.error('TestModule', 'Error message');
      log.fatal('TestModule', 'Fatal message');
      log.log('TestModule', 'Log message');
      
      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledTimes(2); // info + log
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(2); // error + fatal
    });

    it('应该正确传递额外的参数', () => {
      process.env['LOG_LEVEL'] = 'info';
      
      const error = new Error('Test error');
      const metadata = { userId: 123, action: 'test' };
      
      log.error('TestModule', 'Error occurred', error, metadata);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [TestModule] Error occurred'),
        error,
        metadata
      );
    });
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});