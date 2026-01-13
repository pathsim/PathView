import React from 'react';
import { Handle } from '@xyflow/react';

export default function BubblerNode({ data }) {
  return (
    <div
      style={{
        width: 210,
        height: 140,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 8,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginTop: '30%', textAlign: 'center' }}>{data.label}</div>

      {/* Labels for sample in handles */}

      <div style={{ 
        position: 'absolute', 
        left: '2px', 
        bottom: '20%', 
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'right'
      }}>
        Sample in
      </div>
      <div style={{ 
        position: 'absolute', 
        left: '6px', 
        top: '29%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>
        soluble
      </div>
      <div style={{ 
        position: 'absolute', 
        left: '6px', 
        top: '62%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>
        insoluble
      </div>

      <Handle type="target" id="sample_in_soluble" position="left" style={{ background: '#555', top: '33%' }} />
      <Handle type="target" id="sample_in_insoluble" position="left" style={{ background: '#555', top: '66%' }} />

      <div style={{ 
        position: 'absolute', 
        top: '6px', 
        left: '6%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>
        Vials 1
      </div>
      <div style={{ 
        position: 'absolute', 
        top: '6px', 
        left: '38%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>2</div>

      <div style={{ 
        position: 'absolute', 
        top: '6px', 
        left: '58%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>
        3
      </div>
      <div style={{ 
        position: 'absolute', 
        top: '6px', 
        left: '78%', 
        fontSize: '12px',
        fontWeight: 'normal',
      }}>
        4
      </div>

      <Handle type="source" id="vial1" position="top" style={{ background: '#555', left: '20%'}} />
      <Handle type="source" id="vial2" position="top" style={{ background: '#555', left: '40%' }} />
      <Handle type="source" id="vial3" position="top" style={{ background: '#555', left: '60%' }} />
      <Handle type="source" id="vial4" position="top" style={{ background: '#555', left: '80%' }} />


      <div style={{ 
        position: 'absolute', 
        right: '6px', 
        bottom: '50%', 
        fontSize: '12px',
        fontWeight: 'normal',
        textAlign: 'right'
      }}>
        out
      </div>

      <Handle type="source" id="sample_out" position="right" style={{ background: '#555' }} />
    </div>
  );
}
