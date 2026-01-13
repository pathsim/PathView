import React from 'react';

export default function SolverPanel({ solverParams, setSolverParams, onBack }) {
    return (
        <div style={{
            width: '100%',
            height: 'calc(100vh - 50px)',
            paddingTop: '50px',
            backgroundColor: '#1e1e2f',
            overflow: 'auto',
        }}>
            <div style={{
                padding: '40px',
                maxWidth: '800px',
                margin: '0 auto',
            }}>
                <h1 style={{ color: '#ffffff', marginBottom: '30px', textAlign: 'center' }}>
                    Solver Parameters
                </h1>
                <div style={{
                    backgroundColor: '#2c2c54',
                    padding: '30px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '20px',
                        marginBottom: '20px'
                    }}>
                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Time Step (dt):
                            </label>
                            <input
                                type="text"
                                value={solverParams.dt}
                                onChange={(e) => setSolverParams({ ...solverParams, dt: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Minimum Time Step (dt_min):
                            </label>
                            <input
                                type="text"
                                value={solverParams.dt_min}
                                onChange={(e) => setSolverParams({ ...solverParams, dt_min: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Maximum Time Step (dt_max):
                            </label>
                            <input
                                type="text"
                                value={solverParams.dt_max}
                                onChange={(e) => setSolverParams({ ...solverParams, dt_max: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Solver Type:
                            </label>
                            <select
                                value={solverParams.Solver}
                                onChange={(e) => setSolverParams({ ...solverParams, Solver: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="SSPRK22">SSPRK22</option>
                                <option value="SSPRK33">SSPRK33</option>
                                <option value="SSPRK34">SSPRK34</option>
                                <option value="RK4">RK4</option>
                                <option value="RKBS32">RKBS32</option>
                                <option value="RKCK54">RKCK54</option>
                                <option value="RKDP54">RKDP54</option>
                                <option value="RKDP87">RKDP87</option>
                                <option value="RKF21">RKF21</option>
                                <option value="RKF45">RKF45</option>
                                <option value="RKF78">RKF78</option>
                                <option value="RKV65">RKV65</option>
                                <option value="BDF">BDF</option>
                                <option value="EUF">EUF</option>
                                <option value="EUB">EUB</option>
                                <option value="GEAR21">GEAR21</option>
                                <option value="GEAR32">GEAR32</option>
                                <option value="GEAR43">GEAR43</option>
                                <option value="GEAR54">GEAR54</option>
                                <option value="GEAR52A">GEAR52A</option>
                                <option value="DIRK2">DIRK2</option>
                                <option value="DIRK3">DIRK3</option>
                                <option value="ESDIRK32">ESDIRK32</option>
                                <option value="ESDIRK4">ESDIRK4</option>
                                <option value="ESDIRK43">ESDIRK43</option>
                                <option value="ESDIRK54">ESDIRK54</option>
                                <option value="ESDIRK85">ESDIRK85</option>
                                <option value="STEADYSTATE">SteadyState</option>

                            </select>
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                FPI Tolerance:
                            </label>
                            <input
                                type="text"
                                value={solverParams.tolerance_fpi}
                                onChange={(e) => setSolverParams({ ...solverParams, tolerance_fpi: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Maximum Iterations:
                            </label>
                            <input
                                type="text"
                                value={solverParams.iterations_max}
                                onChange={(e) => setSolverParams({ ...solverParams, iterations_max: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Simulation Duration:
                            </label>
                            <input
                                type="text"
                                value={solverParams.simulation_duration}
                                onChange={(e) => setSolverParams({ ...solverParams, simulation_duration: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={solverParams.log === 'true'}
                                    onChange={(e) => setSolverParams({ ...solverParams, log: e.target.checked ? 'true' : 'false' })}
                                    style={{
                                        marginRight: '10px',
                                        transform: 'scale(1.2)',
                                        cursor: 'pointer'
                                    }}
                                />
                                Enable Logging
                            </label>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{
                                color: '#ffffff',
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 'bold'
                            }}>
                                Extra Parameters (JSON):
                            </label>
                            <textarea
                                value={solverParams.extra_params}
                                onChange={(e) => setSolverParams({ ...solverParams, extra_params: e.target.value })}
                                style={{
                                    width: '95%',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    border: '1px solid #555',
                                    backgroundColor: '#1e1e2f',
                                    color: '#ffffff',
                                    fontSize: '14px',
                                    minHeight: '80px',
                                    fontFamily: 'monospace',
                                    resize: 'vertical'
                                }}
                                placeholder='{"tolerance_lte_abs": 1e-8, "tolerance_lte_rel": 1e-6}'
                            />
                            <div style={{
                                color: '#cccccc',
                                fontSize: '12px',
                                marginTop: '5px',
                                fontStyle: 'italic'
                            }}>
                                Additional solver parameters as JSON dictionary (e.g., tolerances, custom settings)
                            </div>
                        </div>
                    </div>

                    <div style={{
                        textAlign: 'center',
                        marginTop: '30px'
                    }}>
                        <button
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#78A083',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                marginRight: '15px'
                            }}
                            onClick={() => {
                                // Reset to default values
                                setSolverParams({
                                    dt: '0.01',
                                    dt_min: '1e-16',
                                    dt_max: '',
                                    Solver: 'SSPRK22',
                                    tolerance_fpi: '1e-10',
                                    iterations_max: '200',
                                    log: 'true',
                                    simulation_duration: '50.0'
                                });
                            }}
                        >
                            Reset to Defaults
                        </button>
                        <button
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#3498db',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold'
                            }}
                            onClick={() => setActiveTab('graph')}
                        >
                            Back to Graph Editor
                        </button>
                    </div>
                </div>

                <div style={{
                    marginTop: '30px',
                    padding: '20px',
                    backgroundColor: '#2c2c54',
                    borderRadius: '8px',
                    border: '1px solid #555'
                }}>
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Parameter Descriptions:</h3>
                    <ul style={{ color: '#cccccc', lineHeight: '1.6' }}>
                        <li><strong>dt:</strong> Base time step for simulation</li>
                        <li><strong>dt_min:</strong> Minimum allowed time step</li>
                        <li><strong>dt_max:</strong> Maximum allowed time step</li>
                        <li><strong>Solver:</strong> Numerical integration method</li>
                        <li><strong>tolerance_fpi:</strong> Tolerance for fixed point iterations</li>
                        <li><strong>iterations_max:</strong> Maximum number of iterations per time step</li>
                        <li><strong>simulation_duration:</strong> Total duration of the simulation (in time units)</li>
                        <li><strong>log:</strong> Enable/disable logging during simulation</li>
                        <li><strong>extra_params:</strong> Additional solver parameters as JSON dictionary (e.g., tolerance_lte_abs, tolerance_lte_rel for numerical solvers)</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}