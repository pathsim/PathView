import React from 'react';
import { Handle } from '@xyflow/react';

export default function StepSourceNode({ data }) {
  return (
    <div
      style={{
        width: 100,
        height: 100,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 12,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Step function visualization */}
      <div style={{ 
        width: '70%', 
        height: '50%', 
        margin: '0 auto 8px auto',
        position: 'relative',
        background: 'white',
        border: '2px solid #333',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        {/* Step function path */}
        <svg width="100%" height="100%" viewBox="0 0 50 30" style={{ display: 'block' }}>
          <path 
            d="M 5 25 L 25 25 L 25 5 L 45 5" 
            stroke="#333" 
            strokeWidth="2" 
            fill="none"
          />
        </svg>
      </div>
      <div style={{ marginBottom: 4, textAlign: 'center' }}>{data.label}</div>

      <Handle type="source" position="bottom" style={{ background: '#555' }} />
    </div>
  );
}
