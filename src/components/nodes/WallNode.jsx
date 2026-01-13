import React from 'react';
import { Handle } from '@xyflow/react';

export default function WallNode({ data }) {
  return (
    <div
      style={{
        width: 50,
        height: 180,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 0,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      {/* Left side handles with labels */}
      <Handle type="target" id="c_0" position="left" style={{ background: '#555', top: '40%' }} />
      <div style={{ 
        position: 'absolute', 
        left: '5px', 
        top: '35%', 
        fontSize: '12px',
        fontWeight: 'normal'
      }}>
        c₀
      </div>
      
      <Handle type="source" id="flux_0" position="left" style={{ background: '#555', top: '60%' }} />
      <div style={{ 
        position: 'absolute', 
        left: '5px', 
        top: '55%', 
        fontSize: '12px',
        fontWeight: 'normal'
      }}>
        φ₀
      </div>

      {/* Right side handles with labels */}
      <Handle type="target" id="c_L" position="right" style={{ background: '#555', top: '40%' }} />
      <div style={{ 
        position: 'absolute', 
        right: '5px', 
        top: '35%', 
        fontSize: '12px',
        fontWeight: 'normal'
      }}>
        cₗ
      </div>
      
      <Handle type="source" id="flux_L" position="right" style={{ background: '#555', top: '60%' }} />
      <div style={{ 
        position: 'absolute', 
        right: '5px', 
        top: '55%', 
        fontSize: '12px',
        fontWeight: 'normal'
      }}>
        φₗ
      </div>
    </div>
  );
}
