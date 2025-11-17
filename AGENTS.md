# AGENTS.md - Tree-sitter API Server

## Build/Test Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Check code with ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

## Architecture & Structure

**Project**: Lightweight Tree-sitter API server for code parsing and analysis.

**Main Dirs**:
- `src/config/` - Configuration (memory, env, server settings)
- `src/types/` - TypeScript type definitions (API, errors, Tree-sitter)
- `src/utils/` - Utility functions (memory utilities)
- `tests/` - Test files (Jest with ts-jest preset)
- `dist/` - Compiled output

**Entry Point**: `src/server.ts` compiles to `dist/server.js`

**Supported Languages**: JavaScript, TypeScript, Python, Java, Go, Rust, C/C++, C#, Ruby

## Code Style & Conventions

- **Language**: TypeScript with strict mode enabled (`strict: true`)
- **Imports**: Use path aliases (@/config, @/core, @/errors, @/middleware, @/routes, @/controllers, @/types, @/utils)
- **Formatting**: 2-space indentation, single quotes, semicolons required
- **Line Length**: 80 characters (Prettier)
- **Return Types**: Explicit function return types required
- **Variables**: Use `const` (enforce via eslint), no `var`
- **Exports**: Named exports preferred
- **Files**: Use `.ts` extension, match camelCase for files/functions, PascalCase for classes/types
- **Error Handling**: Structured error types in `src/types/errors.ts`
- **Comments**: JSDoc style for functions and exports
