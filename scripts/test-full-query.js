const regex = /#([a-z-]+)\?([^)]*)/g;
const query = `
        (identifier) @identifier
        (#eq? @identifier "testVariable")
        (#set! @identifier "category" "variable")
      `;
console.log('Query:', JSON.stringify(query));
console.log('Regex test:', regex.test(query));
regex.lastIndex = 0;
let match;
while ((match = regex.exec(query)) !== null) {
  console.log('Match:', JSON.stringify(match));
}