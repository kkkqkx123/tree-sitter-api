/**
 * Jest测试设置文件
 */

// 设置测试超时时间
jest.setTimeout(60000);

// 设置环境变量
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001'; // 使用不同的端口避免冲突

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// 在所有测试开始前运行
beforeAll(() => {
  console.log('Starting E2E tests...');
});

// 在所有测试结束后运行
afterAll(() => {
  console.log('E2E tests completed.');
});