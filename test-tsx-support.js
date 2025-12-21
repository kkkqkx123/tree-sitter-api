// 测试 TSX 支持的简单脚本
const { TreeSitterService } = require('./dist/core/TreeSitterService');
const Parser = require('tree-sitter');
const tsx = require('tree-sitter-typescript');

async function testTsxSupport() {
  console.log('Testing TSX support...');
  
  try {
    // 检查 tree-sitter-typescript 模块是否正确导出 tsx
    console.log('tree-sitter-typescript module:', Object.keys(tsx));
    console.log('Has tsx property:', 'tsx' in tsx);
    
    if (!tsx.tsx) {
      console.error('ERROR: tsx property not found in tree-sitter-typescript module');
      return;
    }
    
    // 创建解析器并设置语言
    const parser = new Parser();
    parser.setLanguage(tsx.tsx);
    
    // 测试代码
    const code = `
      import React from 'react';
      
      interface Props {
        name: string;
      }
      
      const MyComponent: React.FC<Props> = ({ name }) => {
        return <div>Hello, {name}!</div>;
      };
      
      export default MyComponent;
    `;
    
    // 解析代码
    const tree = parser.parse(code);
    console.log('Parse successful!');
    console.log('Root node type:', tree.rootNode.type);
    
    // 验证解析结果
    if (tree.rootNode.type === 'program') {
      console.log('✓ TSX parsing works correctly');
    } else {
      console.error('✗ Unexpected root node type:', tree.rootNode.type);
    }
    
    
  } catch (error) {
    console.error('Error testing TSX support:', error.message);
  }
}

testTsxSupport();