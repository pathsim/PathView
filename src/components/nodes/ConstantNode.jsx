import React from 'react';
import { Handle } from '@xyflow/react';

export default function ConstantNode({ data }) {
  return (
    <div
      style={{
        width: 180,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 12,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
        border: '3px solid #2563eb',
      }}
    >
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      <Handle type="source" position="bottom" style={{ background: '#555' }} />
    </div>
  );
}
