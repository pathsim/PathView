import React, { useCallback, useState, useEffect } from 'react';
import { Handle, useUpdateNodeInternals } from '@xyflow/react';

export function DynamicHandleNode({ id, data }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [inputHandleCount, setInputHandleCount] = useState(parseInt(data.inputCount) || 0);
  const [outputHandleCount, setOutputHandleCount] = useState(parseInt(data.outputCount) || 0);

  useEffect(() => {
    let shouldUpdate = false;

    if (data.inputCount !== undefined && parseInt(data.inputCount) !== inputHandleCount) {
      setInputHandleCount(parseInt(data.inputCount) || 0);
      shouldUpdate = true;
    }

    if (data.outputCount !== undefined && parseInt(data.outputCount) !== outputHandleCount) {
      setOutputHandleCount(parseInt(data.outputCount) || 0);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      updateNodeInternals(id);
    }
  }, [data.inputCount, data.outputCount, inputHandleCount, outputHandleCount, id, updateNodeInternals]);



  return (
    <div
      style={{
        width: Math.max(180, (data.label?.length || 8) * 8 + 40),
        height: Math.max(60, Math.max(inputHandleCount, outputHandleCount) * 25 + 30),
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
      {/* Input Handles (left side) */}
      {Array.from({ length: inputHandleCount }).map((_, index) => {
        const topPercentage = inputHandleCount === 1 ? 50 : ((index + 1) / (inputHandleCount + 1)) * 100;
        return (
          <React.Fragment key={`target-${index}`}>
            <Handle
              key={`target-${index}`}
              type="target"
              position="left"
              id={`target-${index}`}
              style={{
                background: '#555',
                top: `${topPercentage}%`
              }}
            />
            {/* Input label for multiple inputs */}
            {inputHandleCount > 1 && (
              <div
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
                {index + 1}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Output Handles (right side) */}
      {Array.from({ length: outputHandleCount }).map((_, index) => {
        const topPercentage = outputHandleCount === 1 ? 50 : ((index + 1) / (outputHandleCount + 1)) * 100;
        return (
          <React.Fragment key={`source-${index}`}>
            <Handle
              key={`source-${index}`}
              type="source"
              position="right"
              id={`source-${index}`}
              style={{
                background: '#555',
                top: `${topPercentage}%`
              }}
            />
            {/* Output label for multiple outputs */}
            {outputHandleCount > 1 && (
              <div
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
                {index + 1}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Main content */}
      <div style={{
        textAlign: 'center',
        wordWrap: 'break-word',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div>{data.label}</div>
      </div>
    </div>
  );
}