import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PROJECT_ROOT = __dirname;

export interface ITreeSitterGrammar {
	name: string;
	/**
	 * A custom .wasm filename if the grammar node module doesn't follow the standard naming convention
	 */
	filename?: string;
	/**
	 * The path where we should spawn `tree-sitter build-wasm`
	 */
	projectPath?: string;
}

export async function ensureWasm(grammar: ITreeSitterGrammar, outputPath: string): Promise<void> {
	console.log(`Building ${grammar.name}!`);
	const folderPath = path.join(path.resolve(PROJECT_ROOT, '..'), 'node_modules', grammar.projectPath || grammar.name);

	// Create .build folder if it doesn't exist
	await fs.promises.mkdir(outputPath, { recursive: true });

	// Determine the correct path for tree-sitter binary based on OS
	// On Windows, npm creates .cmd files; on Unix, it creates shell scripts
	const isWindows = os.platform() === 'win32';
	const treeSitterCmd = isWindows ? 'tree-sitter.cmd' : 'tree-sitter';
	
	// Use cross-platform command execution - use correct command: build --wasm --docker
	const command = `${treeSitterCmd} build --wasm --docker "${folderPath}"`;
	
	console.log(`Executing: ${command}`);
	
	// Execute with appropriate shell for the platform
	if (isWindows) {
		// On Windows, use the system shell to handle .cmd files properly
		child_process.execSync(command, {
			stdio: 'inherit',
			cwd: path.resolve(PROJECT_ROOT, '..'), // Execute from project root
			encoding: 'utf8',
			shell: process.env.comspec || 'cmd.exe' // Use Windows command processor
		});
	} else {
		// On Unix systems, execute directly or use bash
		child_process.execSync(command, {
			stdio: 'inherit',
			cwd: path.resolve(PROJECT_ROOT, '..'), // Execute from project root
			encoding: 'utf8',
			shell: '/bin/sh' // Use standard shell on Unix
		});
	}

	// Rename to a consistent name if necessary
	if (grammar.filename) {
		const sourceName = grammar.filename;
		const targetName = `${grammar.name}.wasm`;
		const sourcePath = path.join(outputPath, sourceName);
		const targetPath = path.join(outputPath, targetName);
		
		// Check if source file exists with the expected name
		try {
			await fs.promises.access(sourcePath);
			await fs.promises.rename(sourcePath, targetPath);
		} catch {
			// If the expected name doesn't exist, try to find the actual generated file
			// It might be generated with the default name
			const defaultName = `${grammar.name.replace('tree-sitter-', '')}.wasm`;
			const defaultPath = path.join(outputPath, defaultName);
			try {
				await fs.promises.access(defaultPath);
				await fs.promises.rename(defaultPath, targetPath);
			} catch {
				// If neither expected name exists, try to find any .wasm file in the output directory
				const files = await fs.promises.readdir(outputPath);
				const wasmFile = files.find(file => file.endsWith('.wasm') && file.includes(grammar.name.replace('tree-sitter-', '')));
				if (wasmFile) {
					const foundPath = path.join(outputPath, wasmFile);
					await fs.promises.rename(foundPath, targetPath);
				}
			}
		}
	}
}