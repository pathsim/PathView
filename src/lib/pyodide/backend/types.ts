/**
 * REPL Backend Types
 * Transport-agnostic interface for Python execution backends
 */

// ============================================================================
// Protocol Types
// ============================================================================

/**
 * Request messages (main thread → backend)
 */
export type REPLRequest =
	| { type: 'init' }
	| { type: 'exec'; id: string; code: string }
	| { type: 'eval'; id: string; expr: string }
	| { type: 'stream-start'; id: string; expr: string }
	| { type: 'stream-stop' }
	| { type: 'stream-exec'; code: string };

/**
 * Error response variant (extracted for type-safe handling)
 */
export type REPLErrorResponse = { type: 'error'; id?: string; error: string; traceback?: string };

/**
 * Response messages (backend → main thread)
 */
export type REPLResponse =
	| { type: 'ready' }
	| { type: 'ok'; id: string }
	| { type: 'value'; id: string; value: string }
	| REPLErrorResponse
	| { type: 'stdout'; value: string }
	| { type: 'stderr'; value: string }
	| { type: 'progress'; value: string }
	| { type: 'stream-data'; id: string; value: string }
	| { type: 'stream-done'; id: string };

// ============================================================================
// Backend State
// ============================================================================

/**
 * Backend state tracked by the main thread
 */
export interface BackendState {
	initialized: boolean;
	loading: boolean;
	error: string | null;
	progress: string;
}

// ============================================================================
// Backend Interface
// ============================================================================

/**
 * Backend Interface
 *
 * Any Python execution backend must implement this interface.
 * Backends handle the actual execution of Python code, whether via
 * Pyodide in a Web Worker, a local Flask server, or a remote service.
 *
 * ## Lifecycle
 * - `init()` - Initialize the backend (load runtime, connect, etc.)
 * - `terminate()` - Clean up resources
 *
 * ## Execution
 * - `exec(code)` - Execute Python code (no return value)
 * - `evaluate(expr)` - Evaluate expression and return JSON result
 *
 * ## Streaming
 * The streaming API runs an autonomous loop that:
 * 1. Processes queued code (from `execDuringStreaming`)
 * 2. Steps a generator expression
 * 3. Sends results via callback
 *
 * This enables live simulation updates while allowing runtime
 * parameter changes via code injection between steps.
 */
export interface Backend {
	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	/**
	 * Initialize the backend
	 * Resolves when ready to execute code
	 */
	init(): Promise<void>;

	/**
	 * Terminate the backend and clean up resources
	 */
	terminate(): void;

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	/**
	 * Get current backend state
	 */
	getState(): BackendState;

	/**
	 * Subscribe to state changes
	 * @returns Unsubscribe function
	 */
	subscribe(callback: (state: BackendState) => void): () => void;

	/**
	 * Check if backend is ready
	 */
	isReady(): boolean;

	/**
	 * Check if backend is loading
	 */
	isLoading(): boolean;

	/**
	 * Get current error (if any)
	 */
	getError(): string | null;

	// -------------------------------------------------------------------------
	// Execution
	// -------------------------------------------------------------------------

	/**
	 * Execute Python code (no return value)
	 * @param code - Python code to execute
	 * @param timeout - Optional timeout in milliseconds
	 */
	exec(code: string, timeout?: number): Promise<void>;

	/**
	 * Evaluate a Python expression and return the result
	 * @param expr - Python expression to evaluate
	 * @param timeout - Optional timeout in milliseconds
	 * @returns Parsed JSON result
	 */
	evaluate<T = unknown>(expr: string, timeout?: number): Promise<T>;

	// -------------------------------------------------------------------------
	// Streaming
	// -------------------------------------------------------------------------

	/**
	 * Start autonomous streaming loop
	 *
	 * The backend will continuously:
	 * 1. Execute any queued code (from execDuringStreaming)
	 * 2. Evaluate the expression
	 * 3. Call onData with the result
	 * 4. Repeat until expression returns {done: true} or stopStreaming is called
	 *
	 * @param expr - Expression to evaluate repeatedly (should return {done, result})
	 * @param onData - Callback for each result
	 * @param onDone - Callback when streaming completes
	 * @param onError - Callback for errors
	 */
	startStreaming<T>(
		expr: string,
		onData: (data: T) => void,
		onDone: () => void,
		onError: (error: Error) => void
	): void;

	/**
	 * Stop the streaming loop
	 * The backend will send stream-done when it actually stops
	 */
	stopStreaming(): void;

	/**
	 * Check if streaming is active
	 */
	isStreaming(): boolean;

	/**
	 * Execute code during active streaming
	 *
	 * Code is queued and executed between generator steps.
	 * Use this for runtime parameter changes, event injection, etc.
	 * Errors in queued code are reported but don't stop the stream.
	 *
	 * @param code - Python code to execute
	 */
	execDuringStreaming(code: string): void;

	// -------------------------------------------------------------------------
	// Output Callbacks
	// -------------------------------------------------------------------------

	/**
	 * Set callback for stdout output
	 */
	onStdout(callback: (value: string) => void): void;

	/**
	 * Set callback for stderr output
	 */
	onStderr(callback: (value: string) => void): void;
}
