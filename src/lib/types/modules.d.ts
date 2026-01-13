// Type declarations for external modules

// Plotly.js minified bundle
declare module 'plotly.js-dist-min' {
	import Plotly from 'plotly.js';
	export = Plotly;
}

// Pyodide CDN module
declare module 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs' {
	interface PyProxy {
		toJs(options?: { dict_converter?: typeof Object.fromEntries }): unknown;
		destroy(): void;
	}

	export interface PyodideInterface {
		loadPackage(packages: string | string[]): Promise<void>;
		runPythonAsync(code: string): Promise<unknown>;
		runPython(code: string): unknown;
		globals: {
			get(name: string): PyProxy;
		};
		FS: {
			writeFile(path: string, data: string | Uint8Array): void;
			readFile(path: string, options?: { encoding?: string }): string | Uint8Array;
			mkdir(path: string): void;
		};
		setStdout(options: { batched: (msg: string) => void }): void;
		setStderr(options: { batched: (msg: string) => void }): void;
	}

	export function loadPyodide(options?: {
		indexURL?: string;
		stdout?: (text: string) => void;
		stderr?: (text: string) => void;
	}): Promise<PyodideInterface>;
}
