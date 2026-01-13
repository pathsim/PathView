import React from 'react';
import { Handle } from '@xyflow/react';
import CustomHandle from './CustomHandle';

// Factory function to create a FunctionNode component with specified inputs and outputs
export function createFunctionNode(numInputs, numOutputs) {
  return function FunctionNode({ data }) {
    // Calculate dynamic width based on handle counts and content
    const minWidth = 180;
    const labelWidth = (data.label?.length || 8) * 8; // Rough character width estimation
    const dynamicWidth = Math.max(minWidth, labelWidth + 40);
    
    // Calculate dynamic height based on maximum handle count
    const maxHandles = Math.max(numInputs, numOutputs);
    const minHeight = 60;
    const dynamicHeight = Math.max(minHeight, maxHandles * 25 + 30);

    const handleStyle = { background: '#555' };
    
    // Create input handles (targets)
    const inputHandles = [];
    for (let i = 0; i < numInputs; i++) {
      const handleId = `target-${i}`;
      const topPercentage = numInputs === 1 ? 50 : ((i + 1) / (numInputs + 1)) * 100;

      inputHandles.push(
        <CustomHandle
          key={handleId}
          id={handleId}
          type="target"
          position="left"
          style={{ ...handleStyle, top: `${topPercentage}%` }}
        />
      );
      
      // Add label for multiple inputs
      if (numInputs > 1) {
        inputHandles.push(
          <div
            key={`${handleId}-label`}
            style={{
              position: 'absolute',
              left: '8px',
              top: `${topPercentage}%`,
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 'normal',
              color: '#666',
              pointerEvents: 'none',
            }}
          >
            {i + 1}
          </div>
        );
      }
    }
    
    // Create output handles (sources)
    const outputHandles = [];
    for (let i = 0; i < numOutputs; i++) {
      const handleId = `source-${i}`;
      const topPercentage = numOutputs === 1 ? 50 : ((i + 1) / (numOutputs + 1)) * 100;
      
      outputHandles.push(
        <Handle
          key={handleId}
          id={handleId}
          type="source"
          position="right"
          style={{ ...handleStyle, top: `${topPercentage}%` }}
        />
      );
      
      // Add label for multiple outputs
      if (numOutputs > 1) {
        outputHandles.push(
          <div
            key={`${handleId}-label`}
            style={{
              position: 'absolute',
              right: '8px',
              top: `${topPercentage}%`,
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: 'normal',
              color: '#666',
              pointerEvents: 'none',
            }}
          >
            {i + 1}
          </div>
        );
      }
    }
    
    return (
      <div
        style={{
          width: dynamicWidth,
          height: dynamicHeight,
          background: data.nodeColor || '#DDE6ED',
          color: 'black',
          borderRadius: 0,
          padding: 10,
          fontWeight: 'bold',
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', wordWrap: 'break-word', maxWidth: '100%' }}>
          {data.label}
        </div>

        {inputHandles}
        {outputHandles}
      </div>
    );
  };
}

// Default FunctionNode with 1 input and 1 output
export default createFunctionNode(1, 1);
