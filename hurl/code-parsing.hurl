# 代码解析相关测试用例

# 1. JavaScript函数声明解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "javascript",
  "code": "function hello() { console.log(\"Hello\"); }",
  "query": "(function_declaration) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].captureName" == "func"
jsonpath "$.data[0].type" == "function_declaration"
jsonpath "$.data[0].text" contains "function hello"

# 2. JavaScript变量声明解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "javascript",
  "code": "const x = 10; let y = 'hello'; var z = true;",
  "query": "(variable_declaration) @var"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "variable_declaration"

# 3. JavaScript多查询解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "javascript",
  "code": "function add(a, b) { return a + b; } const result = add(1, 2);",
  "queries": [
    "(function_declaration) @func",
    "(identifier) @id",
    "(string_literal) @str"
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data" exists

# 4. Python函数定义解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "python",
  "code": "def hello():\n    print('Hello')",
  "query": "(function_definition) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].captureName" == "func"
jsonpath "$.data[0].type" == "function_definition"

# 5. Python类定义解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "python",
  "code": "class MyClass:\n    def __init__(self):\n        self.value = 10",
  "query": "(class_definition) @class"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "class_definition"

# 6. TypeScript接口解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "typescript",
  "code": "interface User {\n  name: string;\n  age: number;\n}",
  "query": "(interface_declaration) @interface"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "interface_declaration"

# 7. Java类解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "java",
  "code": "public class HelloWorld {\n  public static void main(String[] args) {\n    System.out.println(\"Hello\");\n  }\n}",
  "query": "(class_declaration) @class"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "class_declaration"

# 8. Go函数解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "go",
  "code": "func hello() {\n    fmt.Println(\"Hello\")\n}",
  "query": "(function_declaration) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "function_declaration"

# 9. Rust函数解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "rust",
  "code": "fn hello() {\n    println!(\"Hello\");\n}",
  "query": "(function_item) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "function_item"

# 10. C++函数解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "cpp",
  "code": "int main() {\n    std::cout << \"Hello\" << std::endl;\n    return 0;\n}",
  "query": "(function_definition) @func"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "function_definition"

# 11. C#类解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "csharp",
  "code": "public class Program {\n    public static void Main() {\n        Console.WriteLine(\"Hello\");\n    }\n}",
  "query": "(class_declaration) @class"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "class_declaration"

# 12. Ruby方法解析
POST http://localhost:4001/api/parse
Content-Type: application/json
{
  "language": "ruby",
  "code": "def hello\n  puts \"Hello\"\nend",
  "query": "(method) @method"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.data[0].type" == "method"