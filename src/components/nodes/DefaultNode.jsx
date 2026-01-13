import React from 'react';
import { Handle } from '@xyflow/react';

export default function DefaultNode({ data }) {
  return (
    <div
      style={{
        width: 180,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 8,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      <Handle type="target" position="left" style={{ background: '#555' }} />
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}
