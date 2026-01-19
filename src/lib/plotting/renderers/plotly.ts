/**
 * Plotly renderer - converts ProcessedPlot/ProcessedTrace to Plotly format
 */

import type { ProcessedPlot, ProcessedTrace } from '../core/types';
import { LINE_DASH_PLOTLY, MARKER_SYMBOL_PLOTLY } from '../core/constants';
import { getCssVar, formatFrequency } from '../core/utils';

// ============================================================
// PLOTLY CONFIGURATION
// ============================================================

/** Common plot configuration */
export const PLOTLY_CONFIG: Partial<Plotly.Config> = {
	responsive: true,
	displaylogo: false,
	displayModeBar: 'hover',
	modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
	modeBarButtonsToAdd: [],
	scrollZoom: true,
	doubleClick: 'reset'
};

// ============================================================
// TRACE CONVERSION
// ============================================================

/**
 * Convert ProcessedTrace to Plotly ScatterData
 * @param trace - Processed trace data
 * @param useDecimated - Whether to use decimated data (for previews)
 */
export function toPlotlyTrace(
	trace: ProcessedTrace,
	useDecimated: boolean = false
): Partial<Plotly.ScatterData> {
	const { style, ghost, signalIndex, label } = trace;
	const x = useDecimated ? trace.xDecimated : trace.x;
	const y = useDecimated ? trace.yDecimated : trace.y;

	// Determine mode based on line/marker settings
	const showLines = style.lineStyle !== null;
	const showMarkers = style.markerStyle !== null;
	let mode: 'lines' | 'markers' | 'lines+markers' = 'lines';
	if (showLines && showMarkers) mode = 'lines+markers';
	else if (showMarkers) mode = 'markers';

	const plotlyTrace: Partial<Plotly.ScatterData> = {
		x,
		y,
		type: 'scatter',
		mode,
		name: label,
		legendgroup: `signal-${signalIndex}`
	};

	// Ghost trace settings
	if (ghost) {
		plotlyTrace.opacity = ghost.opacity;
		plotlyTrace.showlegend = false;
		plotlyTrace.hoverinfo = 'skip';
	} else {
		// Main trace hover template
		plotlyTrace.hovertemplate =
			`<b style="color:${style.color}">${label}</b><br>` +
			`x = %{x:.4g}<br>y = %{y:.4g}<extra></extra>`;
	}

	// Line configuration
	if (showLines && style.lineStyle) {
		plotlyTrace.line = {
			color: style.color,
			width: ghost ? 1 : 1.5,
			dash: LINE_DASH_PLOTLY[style.lineStyle] as Plotly.Dash
		};
	}

	// Marker configuration
	if (showMarkers && style.markerStyle) {
		plotlyTrace.marker = {
			symbol: MARKER_SYMBOL_PLOTLY[style.markerStyle],
			size: ghost ? 5 : 6,
			color: style.color
		};
		plotlyTrace.cliponaxis = false;
	}

	return plotlyTrace;
}

/**
 * Convert ProcessedTrace to Plotly ScatterData for spectrum (with custom hover)
 * @param trace - Processed trace data
 * @param frequencies - Original frequency values for hover labels
 */
export function toPlotlySpectrumTrace(
	trace: ProcessedTrace,
	frequencies?: number[]
): Partial<Plotly.ScatterData> {
	const plotlyTrace = toPlotlyTrace(trace, false);

	// Add frequency customdata for hover
	if (!trace.ghost && frequencies) {
		plotlyTrace.customdata = frequencies;
		plotlyTrace.hovertemplate =
			`<b style="color:${trace.style.color}">${trace.label}</b><br>` +
			`f = %{customdata:.2f} Hz<br>mag = %{y:.4g}<extra></extra>`;
	}

	return plotlyTrace;
}

// ============================================================
// LAYOUT BUILDING
// ============================================================

/**
 * Build base layout using CSS variables
 * Reads current theme automatically from computed styles
 */
export function getBaseLayout(): Partial<Plotly.Layout> {
	const textMuted = getCssVar('--text-muted');
	const textDisabled = getCssVar('--text-disabled');
	const surfaceRaised = getCssVar('--surface-raised');
	const border = getCssVar('--border');
	const accent = getCssVar('--accent');

	return {
		paper_bgcolor: 'transparent',
		plot_bgcolor: 'transparent',
		font: {
			color: textMuted,
			family: 'Inter, system-ui, sans-serif',
			size: 11
		},
		margin: {
			l: 60,
			r: 15,
			t: 10,
			b: 45
		},
		xaxis: {
			gridcolor: border,
			gridwidth: 0.5,
			zeroline: false,
			linecolor: border,
			linewidth: 1.5,
			tickfont: { size: 10, color: textDisabled },
			title: { standoff: 10 }
		},
		yaxis: {
			gridcolor: border,
			gridwidth: 0.5,
			zeroline: false,
			linecolor: border,
			linewidth: 1.5,
			tickfont: { size: 10, color: textDisabled },
			title: { standoff: 5 }
		},
		legend: {
			bgcolor: surfaceRaised,
			bordercolor: border,
			borderwidth: 1,
			font: { size: 10, color: textMuted },
			x: 0.01,
			xanchor: 'left',
			y: 0.99,
			yanchor: 'top'
		},
		modebar: {
			bgcolor: 'transparent',
			color: textDisabled,
			activecolor: accent
		},
		hoverlabel: {
			bgcolor: surfaceRaised,
			bordercolor: border,
			font: { color: textMuted, size: 11 }
		}
	};
}

/**
 * Build Plotly layout from ProcessedPlot
 */
export function toPlotlyLayout(plot: ProcessedPlot): Partial<Plotly.Layout> {
	const { type, title, layout, frequencies } = plot;
	const baseLayout = getBaseLayout();

	// Axis labels
	const xAxisTitle = type === 'scope' ? 'Time (s)' : 'Frequency (Hz)';
	const yAxisLabel = type === 'scope'
		? (title.toLowerCase().startsWith('scope') ? title : `Scope: ${title}`)
		: (title.toLowerCase().startsWith('spectrum') ? title : `Spectrum: ${title}`);

	const result: Partial<Plotly.Layout> = {
		...baseLayout,
		xaxis: {
			...baseLayout.xaxis,
			title: { text: xAxisTitle, font: { size: 11 }, standoff: 10 },
			type: layout.xAxisScale
		},
		yaxis: {
			...baseLayout.yaxis,
			title: { text: yAxisLabel, font: { size: 11 }, standoff: 5 },
			type: layout.yAxisScale
		},
		showlegend: layout.showLegend,
		hovermode: 'closest' as const
	};

	// Spectrum: add frequency tick labels
	if (type === 'spectrum' && frequencies && frequencies.length > 0) {
		const numTicks = Math.min(6, frequencies.length);
		const step = Math.max(1, Math.floor((frequencies.length - 1) / (numTicks - 1)));
		const tickvals: number[] = [];
		const ticktext: string[] = [];

		for (let i = 0; i < frequencies.length; i += step) {
			tickvals.push(i);
			ticktext.push(formatFrequency(frequencies[i]));
		}
		if (tickvals[tickvals.length - 1] !== frequencies.length - 1) {
			tickvals.push(frequencies.length - 1);
			ticktext.push(formatFrequency(frequencies[frequencies.length - 1]));
		}

		result.xaxis = { ...result.xaxis, tickvals, ticktext, tickangle: 0 };
	}

	return result;
}

/**
 * Create an empty plot layout with "No data" annotation
 */
export function createEmptyLayout(baseLayout: Partial<Plotly.Layout>): Partial<Plotly.Layout> {
	const annotationColor = getCssVar('--text-disabled');
	return {
		...baseLayout,
		annotations: [
			{
				text: 'No data',
				xref: 'paper',
				yref: 'paper',
				x: 0.5,
				y: 0.5,
				showarrow: false,
				font: { size: 14, color: annotationColor }
			}
		]
	};
}
