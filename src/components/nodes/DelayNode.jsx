import React from 'react';
import { Handle } from '@xyflow/react';

export default function DelayNode({ data }) {
  return (
    <div
      style={{
        width: 80,
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
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Delay notation */}
      <div style={{ 
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        marginBottom: '4px'
      }}>
        z<sup>-1</sup>
      </div>
      
      {/* Optional label */}
      {data.label && (
        <div style={{ 
          fontSize: '10px',
          textAlign: 'center'
        }}>
          {data.label}
        </div>
      )}

      <Handle type="target" position="left" style={{ background: '#555' }} />
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}