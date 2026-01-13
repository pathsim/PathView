import { Handle, useNodeConnections } from '@xyflow/react';


export default function IntegratorNode({ data }) {
  const connections = useNodeConnections({
    handleType: "target",
  });

  return (
    <div
      style={{
        width: 180,
        background: data.nodeColor || '#DDE6ED',
        color: 'black',
        borderRadius: 8,
        padding: 10,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginBottom: 4 }}>{data.label}</div>

      <Handle type="target" position="left" style={{ background: '#555' }} isConnectable={connections.length < 1}/>
      <Handle type="source" position="right" style={{ background: '#555' }} />
    </div>
  );
}
