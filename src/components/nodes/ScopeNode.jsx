import React from 'react';
import { Handle } from '@xyflow/react';

export default function ScopeNode({ data }) {
  return (
    <div
      style={{
        width: 100,
        height: 120,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 12,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Small window/screen area */}
      <div 
        style={{
          width: '70%',
          height: '50%',
          background: '#f0f0f0',
          border: '2px solid #333',
          borderRadius: 4,
          margin: '0 auto 8px auto',
          position: 'relative',
        }}
      >
        {/* Inner screen area */}
        <div 
          style={{
            width: '80%',
            height: '70%',
            background: 'white',
            border: '1px solid #999',
            margin: '4px auto',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ marginBottom: 4, textAlign: 'center' }}>{data.label}</div>

      <Handle type="target" position="left" style={{ background: '#555' }} />
    </div>
  );
}
