import React from 'react';
import Plot from 'react-plotly.js';

export default function ResultsPanel({ simulationResults, downloadHtml, downloadCsv }) {
    return (
        <div style={{
            width: '100%',
            height: 'calc(100vh - 50px)',
            paddingTop: '50px',
            backgroundColor: '#f5f5f5',
            overflow: 'auto',
        }}
        >
            <div style={{ padding: '20px', textAlign: 'center' }}>
                {simulationResults ? (
                    <>
                        <div style={{ textAlign: 'right', padding: '0 20px 10px 20px' }}>
                            <button
                                style={{
                                    backgroundColor: '#78A083',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                    marginRight: '10px',
                                }}
                                onClick={downloadHtml}
                            >
                                Download HTML
                            </button>
                            <button
                                style={{
                                    backgroundColor: '#78A083',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                }}
                                onClick={downloadCsv}
                            >
                                Download CSV
                            </button>
                        </div>

                        <Plot
                            data={JSON.parse(simulationResults).data}
                            layout={{
                                ...JSON.parse(simulationResults).layout,
                                autosize: true,
                            }}
                            config={{
                                responsive: true,
                                displayModeBar: true,
                                modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
                            }}
                            style={{ width: '100%', height: '600px' }}
                        />
                    </>
                ) : (
                    <p style={{ color: '#666', fontSize: '18px' }}>
                        No simulation results yet. Run a simulation from the Graph Editor tab to see results here.
                    </p>
                )}
            </div>
        </div>
    );
}
