import React from 'react';

export default function EdgeDetails({ edge, onClose, onDelete }) {
    if (!edge) return null;

    return (
        <div
            className="sidebar-scrollable"
            style={{
                position: 'absolute',
                right: 0,
                top: 20,
                height: '100vh',
                width: '300px',
                background: '#2c2c54',
                color: '#ffffff',
                borderLeft: '1px solid #ccc',
                boxShadow: '-4px 0 8px rgba(0,0,0,0.1)',
                zIndex: 10,
                overflowY: 'auto',
                overflowX: 'hidden',
            }}
        >
            <div style={{ padding: '20px' }}>
                <h3>Selected Edge</h3>

                <div style={{ marginBottom: '10px' }}>
                    <strong>ID:</strong> {edge.id}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <strong>Source:</strong> {edge.source}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <strong>Target:</strong> {edge.target}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <strong>Type:</strong> {edge.type}
                </div>

                <br />
                <button
                    style={{
                        marginTop: 10,
                        marginRight: 10,
                        padding: '8px 12px',
                        backgroundColor: '#78A083',
                        color: 'white',
                        border: 'none',
                        borderRadius: 5,
                        cursor: 'pointer',
                    }}
                    onClick={onClose}
                >
                    Close
                </button>
                <button
                    style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: 5,
                        cursor: 'pointer',
                    }}
                    onClick={onDelete}
                >
                    Delete Edge
                </button>
            </div>
        </div>
    );
}
