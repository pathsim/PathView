import React from 'react';
import { Handle } from '@xyflow/react';

export default function AdderNode({ data }) {
  return (
    <div
      style={{
        width: 60,
        height: 60,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '24px',
        position: 'relative',
        cursor: 'pointer',
        border: '2px solid #333',
      }}
    >
      <div>Σ</div>

      <Handle type="target" position="left" style={{ background: '#555' }} />
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}
