import React, { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export default function ContextMenu({
  id,
  top,
  left,
  right,
  bottom,
  onClick,
  onDuplicate,
  ...props
}) {
  const { setNodes, setEdges } = useReactFlow();

  const duplicateNode = useCallback(() => {
    onDuplicate(id);
  }, [id, onDuplicate]);

  const deleteNode = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
    onClick && onClick(); // Close menu after action
  }, [id, setNodes, setEdges, onClick]);

  return (
    <div
      style={{ top, left, right, bottom }}
      className="context-menu"
      {...props}
    >
      <p style={{ margin: '0.5em' }}>
        <small>node: {id}</small>
      </p>
      <button onClick={duplicateNode}>duplicate</button>
      <button onClick={deleteNode}>delete</button>
    </div>
  );
}