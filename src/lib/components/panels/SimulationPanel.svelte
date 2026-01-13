<script lang="ts">
	import { onDestroy } from 'svelte';
	import { settingsStore } from '$lib/stores/settings';
	import { tooltip } from '$lib/components/Tooltip.svelte';
	import { paramInput } from '$lib/actions/paramInput';
	import { truncateResultHistory } from '$lib/pyodide/bridge';
	import type { SolverType } from '$lib/nodes/types';
	import { DEFAULT_SIMULATION_SETTINGS } from '$lib/nodes/types';

	// Local state from store
	let settings = $state(settingsStore.get());

	const unsubscribe = settingsStore.subscribe((s) => {
		settings = s;
	});

	onDestroy(unsubscribe);

	// Solver matrix: [row][col] = solvers
	// Rows: Adaptive, Fixed
	// Cols: Explicit, Implicit
	const solverMatrix: { adaptive: { explicit: SolverType[]; implicit: SolverType[] }; fixed: { explicit: SolverType[]; implicit: SolverType[] } } = {
		adaptive: {
			explicit: ['RKBS32', 'RKCK54'],
			implicit: ['GEAR52A', 'ESDIRK43']
		},
		fixed: {
			explicit: ['SSPRK22', 'RK4'],
			implicit: ['BDF2']
		}
	};

	// Help text for all parameters
	const helpText = {
		// Solver matrix
		adaptive: 'Automatically adjusts step size for accuracy and speed',
		fixed: 'Uses constant step size (dt) throughout simulation',
		explicit: 'Fast, direct computation. Best for non-stiff systems',
		implicit: 'Solves equations iteratively. Handles stiff systems',
		// Main settings
		duration: 'Total simulation time in seconds',
		dt: 'Initial/fixed time step size in seconds',
		// Tolerances
		rtol: 'Relative error tolerance for adaptive solvers',
		atol: 'Absolute error tolerance for adaptive solvers',
		ftol: 'Fixed-point iteration tolerance for implicit solvers and algebraic loops',
		// Timestep limits
		dt_min: 'Minimum allowed timestep for adaptive solvers',
		dt_max: 'Maximum allowed timestep for adaptive solvers',
		// Visualization
		ghostTraces: 'Number of previous simulation traces to show faded'
	};

	// Update settings
	function updateSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
		settingsStore.update({ [key]: value });
	}

	function selectSolver(solver: SolverType) {
		updateSetting('solver', solver);
	}

	function setGhostTraces(n: number) {
		if (n < settings.ghostTraces) {
			// Truncate history when reducing (keeps newest, drops oldest)
			truncateResultHistory(n);
		}
		updateSetting('ghostTraces', n);
	}
</script>

<div class="simulation-panel">
	<div class="settings-grid">
		<div class="setting-item">
			<label for="duration">
				<span>Duration</span>
				<span class="help-icon" use:tooltip={helpText.duration}>?</span>
			</label>
			<div class="input-with-unit">
				<input
					id="duration"
					type="text"
					class="code-input"
					value={settings.duration}
					placeholder={DEFAULT_SIMULATION_SETTINGS.duration}
					oninput={(e) => updateSetting('duration', e.currentTarget.value)}
					spellcheck="false"
					use:paramInput
				/>
				<span class="unit">s</span>
			</div>
		</div>

		<div class="setting-item">
			<label for="dt">
				<span>Time Step</span>
				<span class="help-icon" use:tooltip={helpText.dt}>?</span>
			</label>
			<div class="input-with-unit">
				<input
					id="dt"
					type="text"
					class="code-input"
					value={settings.dt}
					placeholder={DEFAULT_SIMULATION_SETTINGS.dt}
					oninput={(e) => updateSetting('dt', e.currentTarget.value)}
					spellcheck="false"
					use:paramInput
				/>
				<span class="unit">s</span>
			</div>
		</div>

	</div>

	<!-- Solver Matrix (transposed: rows=explicit/implicit, cols=adaptive/fixed) -->
	<div class="solver-section">
		<span class="section-label">Solver</span>
		<div class="solver-matrix">
			<!-- Column headers -->
			<div class="matrix-header corner"></div>
			<div class="matrix-header col-header">
				<span>Adaptive</span>
				<span class="help-icon" use:tooltip={helpText.adaptive}>?</span>
			</div>
			<div class="matrix-header col-header">
				<span>Fixed</span>
				<span class="help-icon" use:tooltip={helpText.fixed}>?</span>
			</div>

			<!-- Explicit row -->
			<div class="matrix-header row-header">
				<span class="rotated-text">Explicit</span>
				<span class="help-icon" use:tooltip={helpText.explicit}>?</span>
			</div>
			<div class="matrix-cell">
				{#each solverMatrix.adaptive.explicit as solver}
					<button
						class="solver-pill"
						class:selected={settings.solver === solver}
						onclick={() => selectSolver(solver)}
					>
						{solver}
					</button>
				{/each}
			</div>
			<div class="matrix-cell">
				{#each solverMatrix.fixed.explicit as solver}
					<button
						class="solver-pill"
						class:selected={settings.solver === solver}
						onclick={() => selectSolver(solver)}
					>
						{solver}
					</button>
				{/each}
			</div>

			<!-- Implicit row -->
			<div class="matrix-header row-header">
				<span class="rotated-text">Implicit</span>
				<span class="help-icon" use:tooltip={helpText.implicit}>?</span>
			</div>
			<div class="matrix-cell">
				{#each solverMatrix.adaptive.implicit as solver}
					<button
						class="solver-pill"
						class:selected={settings.solver === solver}
						onclick={() => selectSolver(solver)}
					>
						{solver}
					</button>
				{/each}
			</div>
			<div class="matrix-cell">
				{#each solverMatrix.fixed.implicit as solver}
					<button
						class="solver-pill"
						class:selected={settings.solver === solver}
						onclick={() => selectSolver(solver)}
					>
						{solver}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tolerances -->
	<div class="settings-grid">
		<div class="setting-item">
			<label for="rtol">
				<span>Rel. Tolerance</span>
				<span class="help-icon" use:tooltip={helpText.rtol}>?</span>
			</label>
			<input
				id="rtol"
				type="text"
				class="code-input"
				value={settings.rtol}
				placeholder={DEFAULT_SIMULATION_SETTINGS.rtol}
				oninput={(e) => updateSetting('rtol', e.currentTarget.value)}
				spellcheck="false"
				use:paramInput
			/>
		</div>
		<div class="setting-item">
			<label for="atol">
				<span>Abs. Tolerance</span>
				<span class="help-icon" use:tooltip={helpText.atol}>?</span>
			</label>
			<input
				id="atol"
				type="text"
				class="code-input"
				value={settings.atol}
				placeholder={DEFAULT_SIMULATION_SETTINGS.atol}
				oninput={(e) => updateSetting('atol', e.currentTarget.value)}
				spellcheck="false"
				use:paramInput
			/>
		</div>
		<div class="setting-item">
			<label for="ftol">
				<span>FP Tolerance</span>
				<span class="help-icon" use:tooltip={helpText.ftol}>?</span>
			</label>
			<input
				id="ftol"
				type="text"
				class="code-input"
				value={settings.ftol}
				placeholder={DEFAULT_SIMULATION_SETTINGS.ftol}
				oninput={(e) => updateSetting('ftol', e.currentTarget.value)}
				spellcheck="false"
				use:paramInput
			/>
		</div>
	</div>

	<!-- Timestep Limits -->
	<div class="settings-grid">
		<div class="setting-item">
			<label for="dt_min">
				<span>Min Timestep</span>
				<span class="help-icon" use:tooltip={helpText.dt_min}>?</span>
			</label>
			<div class="input-with-unit">
				<input
					id="dt_min"
					type="text"
					class="code-input"
					value={settings.dt_min}
					placeholder={DEFAULT_SIMULATION_SETTINGS.dt_min}
					oninput={(e) => updateSetting('dt_min', e.currentTarget.value)}
					spellcheck="false"
					use:paramInput
				/>
				<span class="unit">s</span>
			</div>
		</div>
		<div class="setting-item">
			<label for="dt_max">
				<span>Max Timestep</span>
				<span class="help-icon" use:tooltip={helpText.dt_max}>?</span>
			</label>
			<div class="input-with-unit">
				<input
					id="dt_max"
					type="text"
					class="code-input"
					value={settings.dt_max}
					placeholder={DEFAULT_SIMULATION_SETTINGS.dt_max}
					oninput={(e) => updateSetting('dt_max', e.currentTarget.value)}
					spellcheck="false"
					use:paramInput
				/>
				<span class="unit">s</span>
			</div>
		</div>
	</div>

	<!-- Visualization -->
	<div class="setting-item full-width">
		<span class="setting-label">
			<span>Ghost Traces</span>
			<span class="help-icon" use:tooltip={helpText.ghostTraces}>?</span>
		</span>
		<div class="ghost-selector">
			{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as n}
				<button
					class="ghost-pill"
					class:active={settings.ghostTraces === n}
					onclick={() => setGhostTraces(n)}
				>
					{n}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.simulation-panel {
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-sm);
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.setting-item.full-width {
		grid-column: 1 / -1;
	}

	.setting-item label,
	.setting-item .setting-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.setting-item input {
		width: 100%;
		padding: 6px 8px;
		font-size: 12px;
	}

	.input-with-unit {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.input-with-unit input {
		flex: 1;
	}

	.unit {
		font-size: 10px;
		color: var(--text-disabled);
		min-width: 12px;
	}

	/* Code input styling for Python expressions */
	.code-input {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: -0.3px;
	}

	/* Solver matrix */
	.solver-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.section-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.solver-matrix {
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		gap: 1px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs);
	}

	.matrix-header {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 9px;
		color: var(--text-disabled);
		padding: 4px 6px;
	}

	.matrix-header.col-header {
		justify-content: center;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.matrix-header.row-header {
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-weight: 500;
		padding: 6px 4px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.rotated-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
		white-space: nowrap;
	}

	.help-icon {
		font-size: 9px;
		font-weight: 600;
		color: var(--text-disabled);
		cursor: help;
		flex-shrink: 0;
	}

	.help-icon:hover {
		color: var(--text-muted);
	}

	.matrix-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
		align-items: center;
		justify-content: center;
	}

	.solver-pill {
		padding: 4px 0;
		width: 64px;
		text-align: center;
		font-size: 10px;
		font-weight: 500;
		font-family: var(--font-mono);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.solver-pill:hover {
		border-color: var(--border-focus);
		color: var(--text);
	}

	.solver-pill.selected {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface-raised));
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Ghost traces pill selector */
	.ghost-selector {
		display: flex;
		gap: 4px;
	}

	.ghost-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 24px;
		font-size: 10px;
		font-weight: 500;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.ghost-pill:hover {
		background: var(--surface-hover);
		border-color: var(--border-focus);
		color: var(--text);
	}

	.ghost-pill.active {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface-raised));
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
