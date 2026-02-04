/**
 * Theme color definitions
 * Single source of truth for SVG export - matches CSS variables in app.css
 */

/** Theme color interface */
export interface ThemeColors {
	/** Main background color */
	surface: string;
	/** Raised surface (cards, panels) */
	surfaceRaised: string;
	/** Border/edge color */
	border: string;
	/** Connection edge color */
	edge: string;
	/** Primary text color */
	text: string;
	/** Muted text color */
	textMuted: string;
	/** Disabled text color (lighter than muted) */
	textDisabled: string;
	/** Accent color (default node color) */
	accent: string;
}

/** Theme color definitions matching app.css */
export const THEMES: Record<'light' | 'dark', ThemeColors> = {
	dark: {
		surface: '#08080c',
		surfaceRaised: '#1c1c26',
		border: 'rgba(255, 255, 255, 0.08)',
		edge: '#808090',
		text: '#f0f0f5',
		textMuted: '#808090',
		textDisabled: '#505060',
		accent: '#0070C0'
	},
	light: {
		surface: '#f0f0f4',
		surfaceRaised: '#ffffff',
		border: 'rgba(0, 0, 0, 0.10)',
		edge: '#808090',  // inherits from :root
		text: '#1a1a1f',
		textMuted: '#808090',  // inherits from :root
		textDisabled: '#909098',
		accent: '#0070C0'
	}
} as const;

export type ThemeName = keyof typeof THEMES;

/**
 * Get current theme name from document (for browser context)
 * Returns 'dark' as default for SSR/headless
 */
export function getCurrentThemeName(): ThemeName {
	if (typeof document === 'undefined') return 'dark';
	return (document.documentElement.getAttribute('data-theme') as ThemeName) || 'dark';
}

/**
 * Get current theme colors
 * @param theme - Theme name, or 'auto' to detect from document
 */
export function getThemeColors(theme: ThemeName | 'auto' = 'auto'): ThemeColors {
	const themeName = theme === 'auto' ? getCurrentThemeName() : theme;
	return THEMES[themeName];
}
