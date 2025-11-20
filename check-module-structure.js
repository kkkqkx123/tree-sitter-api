// 检查 tree-sitter-typescript 模块的导出结构
try {
  console.log('Checking tree-sitter-typescript module structure...');
  const tsModule = require('tree-sitter-typescript');
  console.log('tree-sitter-typescript module:', tsModule);
  console.log('Type of module:', typeof tsModule);
  console.log('Keys of module:', Object.keys(tsModule));
  console.log('Has typescript property?', 'typescript' in tsModule);
  console.log('Has tsx property?', 'tsx' in tsModule);
  
  if (tsModule.typescript) {
    console.log('typescript property:', tsModule.typescript);
  }
  
  if (tsModule.tsx) {
    console.log('tsx property:', tsModule.tsx);
  }
} catch (error) {
  console.error('Error loading tree-sitter-typescript:', error.message);
}

// 同样检查其他模块以进行对比
try {
  console.log('\nChecking tree-sitter-javascript module structure...');
  const jsModule = require('tree-sitter-javascript');
  console.log('tree-sitter-javascript module:', jsModule);
  console.log('Type of module:', typeof jsModule);
  console.log('Keys of module:', Object.keys(jsModule));
} catch (error) {
  console.error('Error loading tree-sitter-javascript:', error.message);
}

try {
  console.log('\nChecking tree-sitter-python module structure...');
  const pyModule = require('tree-sitter-python');
  console.log('tree-sitter-python module:', pyModule);
  console.log('Type of module:', typeof pyModule);
  console.log('Keys of module:', Object.keys(pyModule));
} catch (error) {
  console.error('Error loading tree-sitter-python:', error.message);
}