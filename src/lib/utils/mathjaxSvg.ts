/**
 * MathJax SVG renderer for export
 * Lazy-loads MathJax from CDN and renders LaTeX to standalone SVG
 */

declare global {
	interface Window {
		MathJax?: {
			tex2svg?: (latex: string, options?: { display?: boolean }) => HTMLElement;
			startup?: {
				promise?: Promise<void>;
				defaultReady?: () => void;
			};
			typesetPromise?: () => Promise<void>;
		};
	}
}

let mathjaxPromise: Promise<void> | null = null;
let mathjaxReady = false;

/**
 * Load MathJax from CDN (lazy, only when needed)
 */
function loadMathJax(): Promise<void> {
	if (mathjaxReady) return Promise.resolve();
	if (mathjaxPromise) return mathjaxPromise;

	mathjaxPromise = new Promise((resolve, reject) => {
		// Check if already fully loaded
		if (typeof window.MathJax?.tex2svg === 'function') {
			mathjaxReady = true;
			resolve();
			return;
		}

		// Configure MathJax before loading the script
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).MathJax = {
			tex: {
				inlineMath: [['$', '$']],
				displayMath: [['$$', '$$']]
			},
			svg: {
				fontCache: 'none' // Embed fonts for standalone SVG
			},
			startup: {
				typeset: false // Don't auto-typeset the page
			}
		};

		// Load MathJax script
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
		script.async = true;

		script.onload = () => {
			// Wait for MathJax to be fully initialized
			const waitForMathJax = () => {
				if (window.MathJax?.startup?.promise) {
					window.MathJax.startup.promise
						.then(() => {
							mathjaxReady = true;
							resolve();
						})
						.catch(reject);
				} else if (typeof window.MathJax?.tex2svg === 'function') {
					// Already ready
					mathjaxReady = true;
					resolve();
				} else {
					// Not ready yet, wait a bit
					setTimeout(waitForMathJax, 50);
				}
			};
			waitForMathJax();
		};

		script.onerror = () => {
			mathjaxPromise = null;
			reject(new Error('Failed to load MathJax from CDN'));
		};

		document.head.appendChild(script);

		// Timeout after 30 seconds
		setTimeout(() => {
			if (!mathjaxReady) {
				mathjaxPromise = null;
				reject(new Error('MathJax loading timed out'));
			}
		}, 30000);
	});

	return mathjaxPromise;
}

/**
 * Render LaTeX to SVG string
 * @param latex - LaTeX string (without delimiters)
 * @param displayMode - true for display math, false for inline
 * @returns SVG string (standalone, no external dependencies)
 */
export async function latexToSvg(latex: string, displayMode = false): Promise<string> {
	await loadMathJax();

	if (!window.MathJax?.tex2svg) {
		throw new Error('MathJax tex2svg not available');
	}

	const wrapper = window.MathJax.tex2svg(latex, { display: displayMode });
	const svg = wrapper.querySelector('svg');

	if (!svg) {
		throw new Error('MathJax did not produce SVG output');
	}

	return svg.outerHTML;
}

/**
 * Extract SVG dimensions from rendered output
 */
export function getSvgDimensions(svgString: string): { width: number; height: number } {
	const widthMatch = svgString.match(/width="([^"]+)"/);
	const heightMatch = svgString.match(/height="([^"]+)"/);

	const parseToPixels = (value: string): number => {
		const exMatch = value.match(/^([\d.]+)ex$/);
		if (exMatch) {
			return parseFloat(exMatch[1]) * 8;
		}
		const emMatch = value.match(/^([\d.]+)em$/);
		if (emMatch) {
			return parseFloat(emMatch[1]) * 10;
		}
		return parseFloat(value) || 20;
	};

	return {
		width: widthMatch ? parseToPixels(widthMatch[1]) : 20,
		height: heightMatch ? parseToPixels(heightMatch[1]) : 20
	};
}

/**
 * Preload MathJax (call early to avoid delay when exporting)
 */
export function preloadMathJax(): void {
	loadMathJax().catch((err) => {
		console.warn('MathJax preload failed:', err);
	});
}
