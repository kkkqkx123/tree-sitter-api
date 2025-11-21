const regex = /#([a-z-]+)\?([^)]*)/g;
const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
        (#set! @identifier "category" "variable")
      `;

console.log('Query:', JSON.stringify(query));
console.log('Query includes #eq?:', query.includes('#eq?'));

// 测试正则表达式
regex.lastIndex = 0;
console.log('Regex test before exec:', regex.test(query));

// 重置正则表达式
regex.lastIndex = 0;
let match;
while ((match = regex.exec(query)) !== null) {
  console.log('Match:', JSON.stringify(match));
}

// 再次测试
regex.lastIndex = 0;
console.log('Regex test after exec:', regex.test(query));