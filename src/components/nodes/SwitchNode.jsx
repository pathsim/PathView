import React from 'react';
import { Handle } from '@xyflow/react';

export default function SwitchNode({ data }) {
  return (
    <div
      style={{
        width: 180,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 0,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginBottom: 4, marginLeft: 20}}>{data.label}</div>

      <Handle type="target" id="target-0" position="left" style={{ background: '#555', top: "33%" }} />
      <div
      style={{
          position: 'absolute',
          left: '8px',
          top: `33%`,
          transform: 'translateY(-50%)',
          fontSize: '10px',
          fontWeight: 'normal',
          color: '#666',
          pointerEvents: 'none',
      }}
      >
      0
      </div>
      <Handle type="target" id="target-1" position="left" style={{ background: '#555', top: "66%" }} />

      <div
      style={{
          position: 'absolute',
          left: '8px',
          top: `66%`,
          transform: 'translateY(-50%)',
          fontSize: '10px',
          fontWeight: 'normal',
          color: '#666',
          pointerEvents: 'none',
      }}
      >
      1
      </div>
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}
