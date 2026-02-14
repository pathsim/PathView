<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { scale, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { PATHVIEW_VERSION, EXTRACTED_VERSIONS } from '$lib/constants/dependencies';

	interface Example {
		name: string;
		description: string;
		filename: string;
		basename: string;
	}

	interface Props {
		onNew: () => void;
		onClose: () => void;
	}

	let { onNew, onClose }: Props = $props();

	const examples: Example[] = [
		{ filename: 'feedback-system.json', basename: 'feedback-system', name: 'Feedback System', description: 'Linear feedback system with delayed step excitation' },
		{ filename: 'harmonic-oscillator.json', basename: 'harmonic-oscillator', name: 'Harmonic Oscillator', description: 'Linear spring-mass-damper system' },
		{ filename: 'squarewave-lpf.json', basename: 'squarewave-lpf', name: 'Squarewave LPF', description: 'Low pass filtering of a square wave' },
		{ filename: 'pid-subsystem.json', basename: 'pid-subsystem', name: 'PID Loop', description: 'Classic PID control loop as subsystem' },
		{ filename: 'thermostat.json', basename: 'thermostat', name: 'Thermostat', description: 'Relay based thermostat heating system' },
		{ filename: 'cascade-subsystem.json', basename: 'cascade-subsystem', name: 'Cascade PI', description: 'Cascade PI controller with subsystems' },
		{ filename: 'bouncing-ball.json', basename: 'bouncing-ball', name: 'Bouncing Ball', description: 'Bouncing ball with event-based collision' },
		{ filename: 'fmcw-radar.json', basename: 'fmcw-radar', name: 'FMCW Radar', description: 'Frequency-modulated continuous wave radar' },
		{ filename: 'vanderpol.json', basename: 'vanderpol', name: 'Van der Pol', description: 'Van der Pol oscillator system' }
	];

	let isDark = $state(true);

	onMount(() => {
		const updateTheme = () => {
			isDark = document.documentElement.getAttribute('data-theme') !== 'light';
		};
		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

		return () => observer.disconnect();
	});

	function handleNew() {
		onNew();
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="dialog-backdrop" transition:fade={{ duration: 150 }} onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="modal glass-panel" transition:scale={{ start: 0.95, duration: 200, easing: cubicOut }} onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
		<div class="version-info">
			PathView {PATHVIEW_VERSION} · {Object.entries(EXTRACTED_VERSIONS).map(([pkg, ver]) => `${pkg.replace('_', '-')} ${ver}`).join(' · ')}
		</div>
		<div class="header">
			<img src="{base}/pathview_logo.png" alt="PathView" class="logo" />
		</div>

		<div class="actions">
			<button class="action-card" onclick={handleNew}>
				<Icon name="new-canvas" size={20} />
				<span class="action-label">New</span>
			</button>

			<a href="https://pathsim.org" target="_blank" class="action-card">
				<Icon name="home" size={20} />
				<span class="action-label">Home</span>
			</a>

			<a href="https://docs.pathsim.org" target="_blank" class="action-card">
				<Icon name="book" size={20} />
				<span class="action-label">Docs</span>
			</a>

			<a href="https://github.com/pathsim/pathview" target="_blank" class="action-card">
				<Icon name="github" size={20} />
				<span class="action-label">GitHub</span>
			</a>

			<a href="https://github.com/pathsim/pathview/issues/new/choose" target="_blank" class="action-card">
				<Icon name="alert-triangle" size={20} />
				<span class="action-label">Issue</span>
			</a>

			<a href="https://milanrother.com/#services" target="_blank" class="action-card">
				<Icon name="activity" size={20} />
				<span class="action-label">Consulting</span>
			</a>
		</div>

		<div class="separator"></div>

		<div class="examples-section">
			<div class="examples-grid">
				{#each examples as example}
					<a class="example-card" href="?model={base}/examples/{example.filename}">
						<div class="example-info">
							<div class="example-name">{example.name}</div>
							<div class="example-description">{example.description}</div>
						</div>
						<div class="example-preview">
							<img
								src="{base}/examples/screenshots/{example.basename}-{isDark ? 'dark' : 'light'}.png"
								alt="{example.name} preview"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	/* Uses global .dialog-backdrop from app.css */

	.modal {
		position: relative;
		width: 90%;
		max-width: 780px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--surface);
		overflow: hidden;
	}

	.version-info {
		position: absolute;
		top: 8px;
		right: 12px;
		font-size: 9px;
		color: var(--text-disabled);
	}

	.header {
		text-align: center;
		padding: 24px 0;
	}

	.logo {
		height: 100px;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 8px;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		font-family: inherit;
	}

	.action-card :global(svg) {
		color: var(--accent);
		transition: transform 0.15s ease;
	}

	.action-card:hover :global(svg) {
		transform: scale(1.2);
	}

	.action-label {
		font-size: 11px;
		font-weight: 500;
	}

	.separator {
		height: 1px;
		background: var(--border);
		margin: 0 -24px;
	}

	.examples-section {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		margin: -16px -24px -24px -24px;
	}

	.examples-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-auto-rows: min-content;
		align-items: start;
		gap: 10px;
		overflow-y: auto;
		max-height: 420px;
		padding: 16px;
	}

	.example-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		padding: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		overflow: hidden;
		font-family: inherit;
		text-decoration: none;
		color: inherit;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.example-card:hover {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.example-info {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1;
		padding: 6px 8px;
		text-align: left;
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		transition: padding 0.15s ease;
	}

	.example-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.example-description {
		font-size: 10px;
		color: var(--text-muted);
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		transition: max-height 0.15s ease, opacity 0.15s ease, margin 0.15s ease;
	}

	.example-card:hover .example-description {
		max-height: 100px;
		opacity: 1;
		margin-top: 4px;
	}

	.example-preview {
		background: var(--surface);
		width: 100%;
		padding-top: 28px; /* Space for the header */
	}

	.example-preview img {
		display: block;
		width: 100%;
		height: auto;
	}

	@media (max-width: 700px) {
		.examples-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 600px) {
		.actions {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 500px) {
		.examples-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
