import React, { useCallback, useState, useEffect } from 'react';
import { Handle, useUpdateNodeInternals } from '@xyflow/react';
import CustomHandle from './CustomHandle';

export default function AddSubNode({ id, data }) {
    const updateNodeInternals = useUpdateNodeInternals();
    const [inputHandleCount, setInputHandleCount] = useState(parseInt(data.inputCount) || 2);

    // Handle operations string, removing surrounding quotes if they exist
    let operations = data.operations || Array(inputHandleCount).fill('+'); // Default to positive inputs the length of inputHandleCount
    if (operations.length >= 2 &&
        ((operations[0] === '"' && operations[operations.length - 1] === '"') ||
            (operations[0] === "'" && operations[operations.length - 1] === "'"))) {
        operations = operations.slice(1, -1);
    }

    useEffect(() => {
        if (data.inputCount !== undefined && parseInt(data.inputCount) !== inputHandleCount) {
            setInputHandleCount(parseInt(data.inputCount) || 2);
            updateNodeInternals(id);
        }
    }, [data.inputCount, inputHandleCount, id, updateNodeInternals]);

    // Calculate node size based on number of inputs
    const nodeSize = Math.max(60, inputHandleCount * 15 + 30);

    return (
        <div
            style={{
                width: nodeSize,
                height: nodeSize,
                background: data.nodeColor || '#DDE6ED',
                color: 'black',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '24px',
                position: 'relative',
                cursor: 'pointer',
                border: '2px solid #333',
            }}
        >
            <div>Σ</div>

            {/* Input Handles distributed around the left side of the circle */}
            {Array.from({ length: inputHandleCount }).map((_, index) => {
                // Distribute handles around the left semicircle
                const angle = inputHandleCount === 1
                    ? Math.PI // Single input at the left (180 degrees)
                    : Math.PI * (0.5 + index / (inputHandleCount - 1)); // From top-left to bottom-left

                const x = 50 + 50 * Math.cos(angle); // x position as percentage
                const y = 50 + 50 * Math.sin(angle); // y position as percentage

                // Get the operation for this input (default to '+' if not specified)
                const operation = operations[index] || '?';

                // Calculate label position at a smaller radius that scales with node size
                // Smaller nodes get smaller label radius to avoid overlapping with center
                const labelRadius = Math.max(0.6, 0.85 - (60 / nodeSize) * 0.25);
                const labelX = 50 + 50 * labelRadius * Math.cos(angle);
                const labelY = 50 + 50 * labelRadius * Math.sin(angle);

                return (
                    <React.Fragment key={`target-${index}`}>
                        <CustomHandle
                            type="target"
                            position="left"
                            id={`target-${index}`}
                            style={{
                                background: '#555',
                                position: 'absolute',
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        />
                        {/* Operation label at consistent radius inside the circle */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${labelX}%`,
                                top: `${labelY}%`,
                                transform: 'translate(-50%, -50%)',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: operation === '+' ? '#555' : '#555',
                                pointerEvents: 'none',
                            }}
                        >
                            {operation}
                        </div>
                    </React.Fragment>
                );
            })}

            {/* Single output handle on the right */}
            <Handle
                type="source"
                position="right"
                style={{
                    background: '#555',
                    right: '-6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
            />
        </div>
    );
}
