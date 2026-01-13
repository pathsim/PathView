import React from 'react';
import { Handle } from '@xyflow/react';

export function Splitter2Node({ data }) {
  return (
    <div
      style={{
        width: 100,
        height: 100,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 0,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Splitter visualization */}
      <svg width="100%" height="100%" viewBox="0 0 60 30" style={{ display: 'block' }}>
        {/* Input line from left */}
        <path 
          d="M 5 15 L 20 15" 
          stroke="#333" 
          strokeWidth="2" 
          fill="none"
        />
        {/* Split point (triangle) */}
        <path 
          d="M 20 10 L 30 15 L 20 20 Z" 
          fill="#333"
        />
        {/* Upper output line */}
        <path 
          d="M 30 15 L 40 15 L 40 8 L 55 8" 
          stroke="#333" 
          strokeWidth="2" 
          fill="none"
        />
        {/* Lower output line */}
        <path 
          d="M 30 15 L 40 15 L 40 22 L 55 22" 
          stroke="#333" 
          strokeWidth="2" 
          fill="none"
        />
      </svg>
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      <Handle type="target" position="left" style={{ background: '#555' }} />

      <div style={{ 
        position: 'absolute', 
        right: '4px', 
        top: '12%', 
        transform: 'translateX(-50%)', 
        fontSize: '12px',
        fontWeight: 'normal',
        alignContent: 'center',
        verticalAlign: 'middle',
      }}>
        1
      </div>
      <Handle type="source" id="source1" position="right" style={{ background: '#555', top: '20%' }} />

      <div style={{ 
        position: 'absolute', 
        right: '4px', 
        top: '70%', 
        transform: 'translateX(-50%)', 
        fontSize: '12px',
        fontWeight: 'normal',
        alignContent: 'center',
        verticalAlign: 'middle',
      }}>
        2
      </div>
      <Handle type="source" id="source2" position="right" style={{ background: '#555', top: '80%' }} />
    </div>
  );
}

export function Splitter3Node({ data }) {
  return (
    <div
      style={{
        width: 100,
        height: 100,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 0,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
        {/* Three-way splitter lines */}
        <svg width="100%" height="100%" viewBox="0 0 60 40" style={{ display: 'block' }}>
          {/* Input line from left */}
          <path 
            d="M 5 20 L 20 20" 
            stroke="#333" 
            strokeWidth="2" 
            fill="none"
          />
          {/* Split point (triangle) */}
          <path 
            d="M 20 15 L 30 20 L 20 25 Z" 
            fill="#333"
          />
          {/* Upper output line */}
          <path 
            d="M 30 20 L 40 20 L 40 8 L 55 8" 
            stroke="#333" 
            strokeWidth="2" 
            fill="none"
          />
          {/* Middle output line */}
          <path 
            d="M 30 20 L 55 20" 
            stroke="#333" 
            strokeWidth="2" 
            fill="none"
          />
          {/* Lower output line */}
          <path 
            d="M 30 20 L 40 20 L 40 32 L 55 32" 
            stroke="#333" 
            strokeWidth="2" 
            fill="none"
          />
        </svg>
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      <Handle type="target" position="left" style={{ background: '#555' }} />

      <div style={{ 
        position: 'absolute', 
        right: '4px', 
        top: '12%', 
        transform: 'translateX(-50%)', 
        fontSize: '12px',
        fontWeight: 'normal',
        alignContent: 'center',
        verticalAlign: 'middle',
      }}>
        1
      </div>
      <Handle type="source" id="source1" position="right" style={{ background: '#555', top: '20%' }} />

      <div style={{ 
        position: 'absolute', 
        right: '4px', 
        top: '40%', 
        transform: 'translateX(-50%)', 
        fontSize: '12px',
        fontWeight: 'normal',
        alignContent: 'center',
        verticalAlign: 'middle',
      }}>
        2
      </div>

      <Handle type="source" id="source2" position="right" style={{ background: '#555', top: '50%' }} />

      <div style={{ 
        position: 'absolute', 
        right: '4px', 
        top: '70%', 
        transform: 'translateX(-50%)', 
        fontSize: '12px',
        fontWeight: 'normal',
        alignContent: 'center',
        verticalAlign: 'middle',
      }}>
        3
      </div>
      <Handle type="source" id="source3" position="right" style={{ background: '#555', top: '80%' }} />
    </div>
  );
}
