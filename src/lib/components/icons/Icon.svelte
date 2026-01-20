<script lang="ts">
	interface Props {
		name: string;
		size?: number;
	}

	let { name, size = 14 }: Props = $props();
</script>

{#if name === 'trash'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="3 6 5 6 21 6"/>
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
	</svg>
{:else if name === 'settings'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="3"/>
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
	</svg>
{:else if name === 'copy'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
		<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
	</svg>
{:else if name === 'rotate'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M23 4v6h-6"/>
		<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
	</svg>
{:else if name === 'plus'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="5" x2="12" y2="19"/>
		<line x1="5" y1="12" x2="19" y2="12"/>
	</svg>
{:else if name === 'maximize'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
	</svg>
{:else if name === 'select-all'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
		<path d="M9 12l2 2 4-4"/>
	</svg>
{:else if name === 'undo'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M3 7v6h6"/>
		<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
	</svg>
{:else if name === 'redo'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 7v6h-6"/>
		<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
	</svg>
{:else if name === 'enter'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
		<polyline points="10 17 15 12 10 7"/>
		<line x1="15" y1="12" x2="3" y2="12"/>
	</svg>
{:else if name === 'exit'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
		<polyline points="16 17 21 12 16 7"/>
		<line x1="21" y1="12" x2="9" y2="12"/>
	</svg>
{:else if name === 'zap'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
	</svg>
{:else if name === 'grid'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="7" height="7" rx="1"/>
		<rect x="14" y="3" width="7" height="7" rx="1"/>
		<rect x="3" y="14" width="7" height="7" rx="1"/>
		<rect x="14" y="14" width="7" height="7" rx="1"/>
	</svg>
{:else if name === 'type'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="4 7 4 4 20 4 20 7"/>
		<line x1="9" y1="20" x2="15" y2="20"/>
		<line x1="12" y1="4" x2="12" y2="20"/>
	</svg>
{:else if name === 'pin'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="17" x2="12" y2="22"/>
		<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
	</svg>
{:else if name === 'pin-filled'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="17" x2="12" y2="22"/>
		<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
	</svg>
{:else if name === 'x'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="18" y1="6" x2="6" y2="18"/>
		<line x1="6" y1="6" x2="18" y2="18"/>
	</svg>
{:else if name === 'check'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="20 6 9 17 4 12"/>
	</svg>
{:else if name === 'search'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<line x1="21" y1="21" x2="16.65" y2="16.65"/>
	</svg>
{:else if name === 'chevron-down'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="6 9 12 15 18 9"/>
	</svg>
{:else if name === 'chevron-up'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="18 15 12 9 6 15"/>
	</svg>
{:else if name === 'chevron-right'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="9 18 15 12 9 6"/>
	</svg>
{:else if name === 'chevron-left'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="15 18 9 12 15 6"/>
	</svg>
{:else if name === 'download'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
		<polyline points="7 10 12 15 17 10"/>
		<line x1="12" y1="15" x2="12" y2="3"/>
	</svg>
{:else if name === 'upload'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
		<polyline points="17 8 12 3 7 8"/>
		<line x1="12" y1="3" x2="12" y2="15"/>
	</svg>
{:else if name === 'play'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="5 3 19 12 5 21 5 3"/>
	</svg>
{:else if name === 'pause'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="6" y="4" width="4" height="16"/>
		<rect x="14" y="4" width="4" height="16"/>
	</svg>
{:else if name === 'stop'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
	</svg>
{:else if name === 'eye'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
		<circle cx="12" cy="12" r="3"/>
	</svg>
{:else if name === 'eye-off'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
		<line x1="1" y1="1" x2="23" y2="23"/>
	</svg>
{:else if name === 'code'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="16 18 22 12 16 6"/>
		<polyline points="8 6 2 12 8 18"/>
	</svg>
{:else if name === 'terminal'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="4 17 10 11 4 5"/>
		<line x1="12" y1="19" x2="20" y2="19"/>
	</svg>
{:else if name === 'info'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<line x1="12" y1="16" x2="12" y2="12"/>
		<line x1="12" y1="8" x2="12.01" y2="8"/>
	</svg>
{:else if name === 'alert-triangle'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
		<line x1="12" y1="9" x2="12" y2="13"/>
		<line x1="12" y1="17" x2="12.01" y2="17"/>
	</svg>
{:else if name === 'folder'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
	</svg>
{:else if name === 'file'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
		<polyline points="13 2 13 9 20 9"/>
	</svg>
{:else if name === 'save'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
		<polyline points="17 21 17 13 7 13 7 21"/>
		<polyline points="7 3 7 8 15 8"/>
	</svg>
{:else if name === 'keyboard'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
		<path d="M6 8h.001"/>
		<path d="M10 8h.001"/>
		<path d="M14 8h.001"/>
		<path d="M18 8h.001"/>
		<path d="M8 12h.001"/>
		<path d="M12 12h.001"/>
		<path d="M16 12h.001"/>
		<path d="M7 16h10"/>
	</svg>
{:else if name === 'external-link'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
		<polyline points="15 3 21 3 21 9"/>
		<line x1="10" y1="14" x2="21" y2="3"/>
	</svg>
{:else if name === 'menu'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="3" y1="12" x2="21" y2="12"/>
		<line x1="3" y1="6" x2="21" y2="6"/>
		<line x1="3" y1="18" x2="21" y2="18"/>
	</svg>
{:else if name === 'home'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
		<polyline points="9 22 9 12 15 12 15 22"/>
	</svg>
{:else if name === 'book'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
	</svg>
{:else if name === 'layers'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="12 2 2 7 12 12 22 7 12 2"/>
		<polyline points="2 17 12 22 22 17"/>
		<polyline points="2 12 12 17 22 12"/>
	</svg>
{:else if name === 'activity'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
	</svg>
{:else if name === 'file-plus'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
		<polyline points="14 2 14 8 20 8"/>
		<line x1="12" y1="18" x2="12" y2="12"/>
		<line x1="9" y1="15" x2="15" y2="15"/>
	</svg>
{:else if name === 'new-canvas'}
	<!-- Square with plus at top-left corner, arms aligned with edges -->
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="2" y1="5" x2="8" y2="5"/>
		<line x1="5" y1="2" x2="5" y2="8"/>
		<path d="M13 5h8v16H5V13"/>
	</svg>
{:else if name === 'spacebar'}
	<!-- Spacebar key glyph -->
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="2" y="8" width="20" height="8" rx="2"/>
	</svg>
{:else if name === 'help-circle'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
		<line x1="12" y1="17" x2="12.01" y2="17"/>
	</svg>
{:else if name === 'loader'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 12a9 9 0 1 1-6.219-8.56"/>
	</svg>
{:else if name === 'sun'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="5"/>
		<line x1="12" y1="1" x2="12" y2="3"/>
		<line x1="12" y1="21" x2="12" y2="23"/>
		<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
		<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
		<line x1="1" y1="12" x2="3" y2="12"/>
		<line x1="21" y1="12" x2="23" y2="12"/>
		<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
		<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
	</svg>
{:else if name === 'moon'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
	</svg>
{:else if name === 'bar-chart'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="18" y1="20" x2="18" y2="10"/>
		<line x1="12" y1="20" x2="12" y2="4"/>
		<line x1="6" y1="20" x2="6" y2="14"/>
	</svg>
{:else if name === 'bar-chart-2'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="12" width="4" height="9"/>
		<rect x="10" y="8" width="4" height="13"/>
		<rect x="17" y="4" width="4" height="17"/>
	</svg>
{:else if name === 'map'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2"/>
		<rect x="12" y="12" width="7" height="7" rx="1"/>
	</svg>
{:else if name === 'zoom-in'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		<line x1="11" y1="8" x2="11" y2="14"/>
		<line x1="8" y1="11" x2="14" y2="11"/>
	</svg>
{:else if name === 'zoom-out'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		<line x1="8" y1="11" x2="14" y2="11"/>
	</svg>
{:else if name === 'square'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2"/>
	</svg>
{:else if name === 'skip-forward'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="5 4 15 12 5 20 5 4"/>
		<line x1="19" y1="5" x2="19" y2="19"/>
	</svg>
{:else if name === 'play-filled'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<polygon points="5 3 19 12 5 21 5 3"/>
	</svg>
{:else if name === 'stop-filled'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<rect x="6" y="6" width="12" height="12" rx="1"/>
	</svg>
{:else if name === 'skip-forward-filled'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<path d="M5 4l10 8-10 8V4z"/>
		<rect x="17" y="5" width="3" height="14" rx="1"/>
	</svg>
{:else if name === 'crosshair'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
	</svg>
{:else if name === 'clipboard'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
		<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
	</svg>
{:else if name === 'list'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="8" y1="6" x2="21" y2="6"/>
		<line x1="8" y1="12" x2="21" y2="12"/>
		<line x1="8" y1="18" x2="21" y2="18"/>
		<line x1="3" y1="6" x2="3.01" y2="6"/>
		<line x1="3" y1="12" x2="3.01" y2="12"/>
		<line x1="3" y1="18" x2="3.01" y2="18"/>
	</svg>
{:else if name === 'braces'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/>
		<path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>
	</svg>
{:else if name === 'table'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<!-- Outer rectangle -->
		<rect x="3" y="3" width="18" height="18" rx="2"/>
		<!-- Horizontal lines -->
		<line x1="3" y1="9" x2="21" y2="9"/>
		<line x1="3" y1="15" x2="21" y2="15"/>
		<!-- Vertical line -->
		<line x1="9" y1="3" x2="9" y2="21"/>
	</svg>
{:else if name === 'heart'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
	</svg>
{:else if name === 'github'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
	</svg>
{:else if name === 'arrow-right'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="5" y1="12" x2="19" y2="12"/>
		<polyline points="12 5 19 12 12 19"/>
	</svg>
{:else if name === 'arrow-left'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="19" y1="12" x2="5" y2="12"/>
		<polyline points="12 19 5 12 12 5"/>
	</svg>
{:else if name === 'box'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
		<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
		<line x1="12" y1="22.08" x2="12" y2="12"/>
	</svg>
{:else if name === 'flask'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M9 3h6"/>
		<path d="M10 9V3"/>
		<path d="M14 9V3"/>
		<path d="M10 9a5 5 0 0 0-4.24 7.66L4 20a1 1 0 0 0 .86 1.5h14.28a1 1 0 0 0 .86-1.5l-1.76-3.34A5 5 0 0 0 14 9"/>
	</svg>
{:else if name === 'car'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
		<circle cx="7" cy="17" r="2"/>
		<path d="M9 17h6"/>
		<circle cx="17" cy="17" r="2"/>
	</svg>
{:else if name === 'image'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
		<circle cx="8.5" cy="8.5" r="1.5"/>
		<polyline points="21 15 16 10 5 21"/>
	</svg>
{:else if name === 'font-size-increase'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<text x="2" y="18" font-size="16" font-weight="700" font-family="system-ui, sans-serif">A</text>
		<text x="14" y="18" font-size="16" font-weight="700" font-family="system-ui, sans-serif">a</text>
	</svg>
{:else if name === 'font-size-decrease'}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<text x="2" y="18" font-size="11" font-weight="700" font-family="system-ui, sans-serif">A</text>
		<text x="10" y="18" font-size="11" font-weight="700" font-family="system-ui, sans-serif">a</text>
	</svg>
{:else}
	<span class="text-icon">{name}</span>
{/if}

<style>
	svg {
		display: inline-block;
		vertical-align: middle;
	}
	.text-icon {
		font-size: inherit;
	}
</style>
