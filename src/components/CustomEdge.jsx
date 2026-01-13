import { MarkerType } from '@xyflow/react';

const defaultEdgeStyle = {
  strokeWidth: 2,
  stroke: '#ECDFCC',
};

const defaultMarkerEnd = {
  type: MarkerType.ArrowClosed,
  width: 20,
  height: 20,
  color: '#ECDFCC',
};

export function makeEdge({ id, source, target, sourceHandle, targetHandle, type = 'smoothstep', label, dashed = false}) {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type,
    label,
    data: { },
    style: {
      ...defaultEdgeStyle,
      ...(dashed ? { strokeDasharray: '4 3' } : {}),
    },
    markerEnd: defaultMarkerEnd,
  };
}
