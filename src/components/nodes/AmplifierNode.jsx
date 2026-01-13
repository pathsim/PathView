import React from 'react';
import { Handle } from '@xyflow/react';

export function AmplifierNode({ data }) {
  return (
    <div
      style={{
        width: 90,
        height: 60,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 8,
        padding: 8,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Amplifier symbol */}
      <div style={{ 
        fontSize: '16px',
        fontWeight: 'bold',
        marginBottom: '2px',
      }}>
        ×{data.gain || 'K'}
      </div>
      
      {/* Optional label */}
      {data.label && (
        <div style={{ 
          fontSize: '10px',
          textAlign: 'center',
        }}>
          {data.label}
        </div>
      )}

      <Handle type="target" position="left" style={{ background: '#555' }} />
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}

export function AmplifierNodeReverse({ data }) {
  return (
    <div
      style={{
        width: 90,
        height: 60,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 8,
        padding: 8,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Amplifier symbol with reverse indicator */}
      <div style={{ 
        fontSize: '16px',
        fontWeight: 'bold',
        marginBottom: '2px',
      }}>
        ×{data.gain || 'K'}
      </div>
      
      {/* Optional label */}
      {data.label && (
        <div style={{ 
          fontSize: '10px',
          textAlign: 'center',
        }}>
          {data.label}
        </div>
      )}

      <Handle type="target" position="right" style={{ background: '#555' }} />
      <Handle type="source" position="left" style={{ background: '#555' }} />
    </div>
  );
}
