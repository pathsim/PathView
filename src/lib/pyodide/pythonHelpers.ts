/**
 * Python code templates for REPL operations
 * These are injected into the Python namespace as helper functions
 */

/**
 * Setup code injected after REPL initialization
 * Provides helper functions for data extraction
 */
export const REPL_SETUP_CODE = `
import json
import gc
import numpy as np

def _to_json(obj):
    """Convert Python object to JSON-serializable form."""
    if hasattr(obj, 'tolist'):
        return obj.tolist()
    if isinstance(obj, (set, frozenset)):
        return list(obj)
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    return obj

def _step_streaming_gen():
    """Step the streaming generator and return result dict."""
    global _sim_streaming, _sim_gen
    if '_sim_gen' not in globals() or not _sim_streaming:
        return {'done': True, 'result': None}
    try:
        result = next(_sim_gen)
        return {'done': False, 'result': result}
    except StopIteration:
        _sim_streaming = False
        return {'done': True, 'result': None}

def _extract_scope_data(blocks, node_id_map, incremental=False):
    """Extract data from Scope blocks recursively.

    If incremental=True, only returns data accumulated since last read.
    """
    scope_data = {}

    def find_scopes(block_list):
        for block in block_list:
            block_name = type(block).__name__
            block_id = node_id_map.get(id(block), str(id(block)))

            if block_name == 'Scope':
                try:
                    data = block.read(incremental=incremental)
                    if data is not None:
                        time_arr, signals = data
                        labels = list(block.labels) if hasattr(block, 'labels') and block.labels else []
                        scope_data[block_id] = {
                            'time': time_arr.tolist() if hasattr(time_arr, 'tolist') else list(time_arr),
                            'signals': [s.tolist() if hasattr(s, 'tolist') else list(s) for s in signals],
                            'labels': labels
                        }
                except Exception as e:
                    print(f"Error reading Scope: {e}")
            elif block_name == 'Subsystem':
                if hasattr(block, 'blocks'):
                    find_scopes(block.blocks)

    find_scopes(blocks)
    return scope_data


def _extract_spectrum_data(blocks, node_id_map):
    """Extract data from Spectrum blocks recursively."""
    spectrum_data = {}

    def find_spectrums(block_list):
        for block in block_list:
            block_name = type(block).__name__
            block_id = node_id_map.get(id(block), str(id(block)))

            if block_name == 'Spectrum':
                try:
                    data = block.read()
                    if data is not None:
                        freq_arr, magnitude = data

                        # Convert complex to magnitude if needed
                        if np.iscomplexobj(magnitude):
                            magnitude = np.abs(magnitude)

                        freq_list = freq_arr.tolist() if hasattr(freq_arr, 'tolist') else list(freq_arr)

                        # Handle both single array and list of arrays
                        if hasattr(magnitude, 'ndim') and magnitude.ndim == 1:
                            mag_list = [magnitude.tolist()]
                        elif hasattr(magnitude, 'ndim') and magnitude.ndim == 2:
                            mag_list = [m.tolist() for m in magnitude]
                        else:
                            mag_list = [m.tolist() if hasattr(m, 'tolist') else list(m) for m in magnitude]

                        labels = list(block.labels) if hasattr(block, 'labels') and block.labels else []
                        spectrum_data[block_id] = {
                            'frequency': freq_list,
                            'magnitude': mag_list,
                            'labels': labels
                        }
                except Exception as e:
                    print(f"Error reading Spectrum: {e}")
            elif block_name == 'Subsystem':
                if hasattr(block, 'blocks'):
                    find_spectrums(block.blocks)

    find_spectrums(blocks)
    return spectrum_data


def _extract_all_data(blocks, node_id_map, node_name_map=None, incremental=False):
    """Extract all recording block data.

    If incremental=True, only returns data accumulated since last read.
    """
    return {
        'scopeData': _extract_scope_data(blocks, node_id_map, incremental=incremental),
        'spectrumData': _extract_spectrum_data(blocks, node_id_map),
        'nodeNames': node_name_map or {}
    }
`;

/**
 * Generate code to run a simulation and extract results
 */
export function generateRunCode(simulationCode: string): string {
	return `
import sys
import traceback

_simulation_error = None

try:
${indentCode(simulationCode, 4)}
except Exception as e:
    tb = traceback.format_exc()
    _simulation_error = f"{type(e).__name__}: {e}"
    print("=" * 60, file=sys.stderr)
    print("SIMULATION ERROR", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(tb, file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    raise
`;
}

/**
 * Generate code to extract simulation results
 */
export const EXTRACT_RESULTS_EXPR = `_extract_all_data(blocks, _node_id_map, _node_name_map if '_node_name_map' in globals() else {})`;

/**
 * Generate validation code for code context
 */
export function generateValidationSetupCode(codeContextBase64: string): string {
	return `
import base64

_validation_namespace = {'np': np}
_validation_errors = []

# Decode and execute code context
_code_context = base64.b64decode("${codeContextBase64}").decode('utf-8')
try:
    exec(_code_context, _validation_namespace)
except Exception as e:
    _validation_errors.append({
        'nodeId': '__code_context__',
        'param': '',
        'error': f"Code context error: {type(e).__name__}: {e}"
    })
`;
}

/**
 * Generate validation code for parameter expressions
 */
export function generateParamValidationCode(nodeParamsBase64: string): string {
	return `
import json
import base64

if not _validation_errors:
    _node_params = json.loads(base64.b64decode("${nodeParamsBase64}").decode('utf-8'))

    for node_id, params in _node_params.items():
        for param_name, expr in params.items():
            if expr is None or expr == '':
                continue
            try:
                eval(str(expr), _validation_namespace)
            except Exception as e:
                _validation_errors.append({
                    'nodeId': node_id,
                    'param': param_name,
                    'error': f"{type(e).__name__}: {e}"
                })
`;
}

/**
 * Expression to get validation result
 */
export const VALIDATION_RESULT_EXPR = `{'valid': len(_validation_errors) == 0, 'errors': _validation_errors}`;

/**
 * Code to clear simulation state - deletes everything except clean globals
 */
export const CLEAR_STATE_CODE = `
import gc
_cg = globals().get('_clean_globals', None)
if _cg is not None:
    for _var in list(globals().keys()):
        if _var not in _cg and _var != '_cg':
            try:
                del globals()[_var]
            except:
                pass
    del _cg
gc.collect()
`;

/**
 * Code to clean up temporary variables after simulation
 * (Subset cleanup for use during simulation, not full reset)
 */
export const CLEANUP_TEMP_CODE = `
import gc
for _var in ['_simulation_error', '_validation_errors', '_validation_namespace']:
    if _var in globals():
        try:
            del globals()[_var]
        except:
            pass
gc.collect()
`;

/**
 * Generate code to start streaming simulation
 */
export function generateStreamingStartCode(duration: string, tickrate: number = 10, reset: boolean = true): string {
	return `
_sim_gen = sim.run_streaming(
    duration=${duration},
    reset=${reset ? 'True' : 'False'},
    tickrate=${tickrate},
    func_callback=lambda: _extract_all_data(blocks, _node_id_map, _node_name_map if '_node_name_map' in globals() else {}, incremental=True)
)
_sim_streaming = True
`;
}

/**
 * Expression to step generator and get result in single evaluate call
 */
export const STREAMING_STEP_EXPR = `_step_streaming_gen()`;

/**
 * Code to stop streaming and clean up generator
 */
export const STREAMING_STOP_CODE = `
_sim_streaming = False
if '_sim_gen' in globals():
    try:
        _sim_gen.close()
    except:
        pass
`;

/**
 * Helper to indent code
 */
function indentCode(code: string, spaces: number): string {
	const indent = ' '.repeat(spaces);
	return code
		.split('\n')
		.map((line) => indent + line)
		.join('\n');
}

/**
 * Helper to escape code for base64 encoding
 */
export function toBase64(str: string): string {
	// Use encodeURIComponent to handle Unicode, then btoa
	return btoa(unescape(encodeURIComponent(str)));
}
