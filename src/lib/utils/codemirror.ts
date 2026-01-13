/**
 * Shared CodeMirror utilities for consistent editor setup across the app.
 */

// Syntax highlighting colors - aligned with node color palette
export const SYNTAX_COLORS = {
	keyword: '#E57373',   // Red - control flow, imports
	operator: '#0070C0', // PathSim blue - symbols, operators
	special: '#FFB74D',  // Orange - classes, types, decorators
	number: '#4DB6AC',   // Teal - numeric literals
	string: '#81C784',   // Green - string literals
	function: '#0070C0', // PathSim blue - function names
	comment: { dark: '#505060', light: '#909098' },  // Same as line numbers
	invalid: '#BA68C8',  // Purple - errors
	// Theme-specific values for variables and punctuation
	variable: { dark: '#e0e0e0', light: '#383a42' },
	punctuation: { dark: '#abb2bf', light: '#505050' }
} as const;

// Cached CodeMirror modules
let cachedModules: CodeMirrorModules | null = null;

export interface CodeMirrorModules {
	EditorView: typeof import('@codemirror/view').EditorView;
	EditorState: typeof import('@codemirror/state').EditorState;
	keymap: typeof import('@codemirror/view').keymap;
	basicSetup: typeof import('codemirror').basicSetup;
	python: typeof import('@codemirror/lang-python').python;
	oneDark: typeof import('@codemirror/theme-one-dark').oneDark;
	HighlightStyle: typeof import('@codemirror/language').HighlightStyle;
	syntaxHighlighting: typeof import('@codemirror/language').syntaxHighlighting;
	indentUnit: typeof import('@codemirror/language').indentUnit;
	tags: typeof import('@lezer/highlight').tags;
}

/**
 * Dynamically load CodeMirror modules (cached after first load)
 */
export async function loadCodeMirrorModules(): Promise<CodeMirrorModules> {
	if (cachedModules) return cachedModules;

	const [viewModule, stateModule, cmModule, pythonModule, themeModule, langModule, highlightModule] = await Promise.all([
		import('@codemirror/view'),
		import('@codemirror/state'),
		import('codemirror'),
		import('@codemirror/lang-python'),
		import('@codemirror/theme-one-dark'),
		import('@codemirror/language'),
		import('@lezer/highlight')
	]);

	cachedModules = {
		EditorView: viewModule.EditorView,
		EditorState: stateModule.EditorState,
		keymap: viewModule.keymap,
		basicSetup: cmModule.basicSetup,
		python: pythonModule.python,
		oneDark: themeModule.oneDark,
		HighlightStyle: langModule.HighlightStyle,
		syntaxHighlighting: langModule.syntaxHighlighting,
		indentUnit: langModule.indentUnit,
		tags: highlightModule.tags
	};

	return cachedModules;
}

/**
 * Create syntax highlighting style for the given theme
 */
export function createHighlightStyle(modules: CodeMirrorModules, isDark: boolean) {
	const { HighlightStyle, tags } = modules;
	const varColor = isDark ? SYNTAX_COLORS.variable.dark : SYNTAX_COLORS.variable.light;
	const punctColor = isDark ? SYNTAX_COLORS.punctuation.dark : SYNTAX_COLORS.punctuation.light;
	const commentColor = isDark ? SYNTAX_COLORS.comment.dark : SYNTAX_COLORS.comment.light;

	return HighlightStyle.define([
		{ tag: tags.keyword, color: SYNTAX_COLORS.keyword },
		{ tag: tags.operator, color: SYNTAX_COLORS.operator },
		{ tag: tags.special(tags.variableName), color: SYNTAX_COLORS.special },
		{ tag: tags.typeName, color: SYNTAX_COLORS.special },
		{ tag: tags.atom, color: SYNTAX_COLORS.number },
		{ tag: tags.number, color: SYNTAX_COLORS.number },
		{ tag: tags.bool, color: SYNTAX_COLORS.number },
		{ tag: tags.string, color: SYNTAX_COLORS.string },
		{ tag: tags.character, color: SYNTAX_COLORS.string },
		{ tag: tags.regexp, color: SYNTAX_COLORS.string },
		{ tag: tags.escape, color: SYNTAX_COLORS.operator },
		{ tag: tags.variableName, color: varColor },
		{ tag: tags.definition(tags.variableName), color: varColor },
		{ tag: tags.propertyName, color: varColor },
		{ tag: tags.function(tags.variableName), color: SYNTAX_COLORS.function },
		{ tag: tags.function(tags.propertyName), color: SYNTAX_COLORS.function },
		{ tag: tags.definition(tags.function(tags.variableName)), color: SYNTAX_COLORS.function },
		{ tag: tags.labelName, color: varColor },
		{ tag: tags.comment, color: commentColor, fontStyle: 'italic' },
		{ tag: tags.blockComment, color: commentColor, fontStyle: 'italic' },
		{ tag: tags.docComment, color: commentColor, fontStyle: 'italic' },
		{ tag: tags.invalid, color: '#ffffff', backgroundColor: SYNTAX_COLORS.invalid },
		{ tag: tags.punctuation, color: punctColor },
		{ tag: tags.bracket, color: punctColor },
		{ tag: tags.className, color: SYNTAX_COLORS.special },
		{ tag: tags.attributeName, color: varColor },
		{ tag: tags.attributeValue, color: SYNTAX_COLORS.string },
		{ tag: tags.self, color: SYNTAX_COLORS.special }
	]);
}

export interface EditorOptions {
	/** Whether the editor is read-only */
	readOnly?: boolean;
	/** Custom keybindings */
	keymaps?: { key: string; run: (view: import('@codemirror/view').EditorView) => boolean }[];
	/** Callback when document changes */
	onDocChange?: (doc: string) => void;
}

/**
 * Create CodeMirror extensions for a Python editor
 */
export function createEditorExtensions(
	modules: CodeMirrorModules,
	isDark: boolean,
	options: EditorOptions = {}
): import('@codemirror/state').Extension[] {
	const { EditorView, EditorState, keymap, basicSetup, python, oneDark, syntaxHighlighting, indentUnit } = modules;

	const extensions: import('@codemirror/state').Extension[] = [];

	// Custom keymaps must come BEFORE basicSetup to take precedence
	if (options.keymaps && options.keymaps.length > 0) {
		extensions.push(keymap.of(options.keymaps));
	}

	extensions.push(
		basicSetup,
		python(),
		indentUnit.of('    '), // 4-space indentation for Python
		syntaxHighlighting(createHighlightStyle(modules, isDark))
	);

	// Read-only mode
	if (options.readOnly) {
		extensions.push(EditorState.readOnly.of(true));
	}

	// Document change listener
	if (options.onDocChange) {
		const callback = options.onDocChange;
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					callback(update.state.doc.toString());
				}
			})
		);
	}

	// Dark theme chrome (gutters, background, etc.)
	if (isDark) {
		extensions.push(oneDark);
	}

	return extensions;
}
