import { isValidPythonIdentifier } from '../utils.js';

const makeVarName = (node) => {
  // Create a base variable name from the node label
  const baseVarName = node.data.label.replace(/\s+/g, '_').toLowerCase();

  // Make the variable name unique by appending a number
  let varName = baseVarName;
  varName = `${baseVarName}_${node.id}`;

  if (!isValidPythonIdentifier(varName)) {
    // add var_ prefix if it doesn't start with a letter or underscore
    varName = `var_${varName}`;
  }

  return varName;
}

const NodeSidebar = ({
  selectedNode,
  defaultValues,
  setNodes,
  setSelectedNode,
  isEditingLabel,
  setIsEditingLabel,
  tempLabel,
  setTempLabel,
  nodeDocumentation,
  isDocumentationExpanded,
  setIsDocumentationExpanded
}) => {
  if (!selectedNode) return null;

  return (
    <div
      className="sidebar-scrollable"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '300px',
        background: '#1e1e2f',
        color: '#ffffff',
        borderLeft: '1px solid #ccc',
        boxShadow: '-4px 0 8px rgba(0,0,0,0.1)',
        zIndex: 10,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      <div style={{ padding: '20px' }}>
        {isEditingLabel ? (
          <input
            type="text"
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={() => {
              // Update the node label
              const updatedNode = {
                ...selectedNode,
                data: { ...selectedNode.data, label: tempLabel },
              };
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === selectedNode.id ? updatedNode : node
                )
              );
              setSelectedNode(updatedNode);
              setIsEditingLabel(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur(); // This will trigger onBlur
              }
              if (e.key === 'Escape') {
                setTempLabel(selectedNode.data.label); // Reset to original
                setIsEditingLabel(false);
              }
            }}
            autoFocus
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#ffffff',
              backgroundColor: '#2a2a3e',
              border: '2px solid #007bff',
              borderRadius: '4px',
              padding: '8px 12px',
              width: '100%',
              marginBottom: '16px',
              outline: 'none'
            }}
          />
        ) : (
          <h3
            onClick={() => {
              setTempLabel(selectedNode.data.label);
              setIsEditingLabel(true);
            }}
            style={{
              cursor: 'pointer',
              margin: '0 0 16px 0',
              padding: '8px 12px',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease',
              backgroundColor: 'transparent',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#2a2a3e';
              e.target.style.borderColor = '#444';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = 'transparent';
            }}
            title="Click to edit label"
          >
            {selectedNode.data.label}
          </h3>
        )}
        <h4 style={{
          margin: '12px 0 8px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#a8b3cf',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #343556',
          paddingBottom: '8px'
        }}>TYPE: {selectedNode.type}</h4>
        <h4 style={{
          margin: '12px 0 8px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#a8b3cf',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #343556',
          paddingBottom: '8px'
        }}>ID: {selectedNode.id}</h4>
        <h4 style={{
          margin: '12px 0 8px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#a8b3cf',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #343556',
          paddingBottom: '8px'
        }}>varname: {makeVarName(selectedNode)}</h4>

        {(() => {
          // Get default values for this node type
          const nodeDefaults = defaultValues[selectedNode.type] || {};

          // Create a list of all possible parameters (both current data and defaults)
          // Exclude 'label' and 'nodeColor' since they're handled separately
          const allParams = new Set([
            ...Object.keys(selectedNode.data).filter(key => key !== 'label' && key !== 'nodeColor'),
            ...Object.keys(nodeDefaults).filter(key => key !== 'label' && key !== 'nodeColor')
          ]);

          return Array.from(allParams)
            .map(key => {
              const currentValue = selectedNode.data[key] || '';
              const defaultValue = nodeDefaults[key];
              const placeholder = defaultValue !== undefined && defaultValue !== null ?
                String(defaultValue) : '';

              return (
                <div key={key} style={{ marginBottom: '10px' }}>
                  <label style={{
                    color: '#ffffff',
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '14px'
                  }}>
                    {key}:
                  </label>
                  <input
                    type="text"
                    value={currentValue}
                    placeholder={placeholder}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const updatedNode = {
                        ...selectedNode,
                        data: { ...selectedNode.data, [key]: newValue },
                      };

                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNode.id ? updatedNode : node
                        )
                      );
                      setSelectedNode(updatedNode);
                    }}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #555',
                      backgroundColor: '#2a2a3e',
                      color: '#ffffff',
                      fontSize: '14px'
                    }}
                  />
                </div>
              );
            });
        })()}

        {/* Color Picker Section */}
        <div style={{
          marginTop: '20px',
          marginBottom: '20px',
          borderTop: '1px solid #555',
          paddingTop: '15px'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#a8b3cf',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Node Color</h4>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <input
              type="color"
              value={selectedNode.data.nodeColor || '#DDE6ED'}
              onChange={(e) => {
                const newColor = e.target.value;
                const updatedNode = {
                  ...selectedNode,
                  data: { ...selectedNode.data, nodeColor: newColor },
                };

                setNodes((nds) =>
                  nds.map((node) =>
                    node.id === selectedNode.id ? updatedNode : node
                  )
                );
                setSelectedNode(updatedNode);
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                border: '2px solid #555',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: '0'
              }}
            />

            <input
              type="text"
              value={selectedNode.data.nodeColor || '#DDE6ED'}
              onChange={(e) => {
                const newColor = e.target.value;
                const updatedNode = {
                  ...selectedNode,
                  data: { ...selectedNode.data, nodeColor: newColor },
                };

                setNodes((nds) =>
                  nds.map((node) =>
                    node.id === selectedNode.id ? updatedNode : node
                  )
                );
                setSelectedNode(updatedNode);
              }}
              placeholder="#DDE6ED"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: '#2a2a3e',
                color: '#ffffff',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            />
          </div>

          {/* Color preset buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginTop: '12px'
          }}>
            {['#DDE6ED', '#FFE5E5', '#E5F3FF', '#E5FFE5', '#FFF5E5', '#F0E5FF', '#FFE5F5', '#E5FFFF'].map(color => (
              <button
                key={color}
                onClick={() => {
                  const updatedNode = {
                    ...selectedNode,
                    data: { ...selectedNode.data, nodeColor: color },
                  };

                  setNodes((nds) =>
                    nds.map((node) =>
                      node.id === selectedNode.id ? updatedNode : node
                    )
                  );
                  setSelectedNode(updatedNode);
                }}
                style={{
                  width: '100%',
                  height: '30px',
                  backgroundColor: color,
                  border: selectedNode.data.nodeColor === color ? '2px solid #007bff' : '1px solid #666',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedNode.data.nodeColor !== color) {
                    e.target.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
                title={color}
              />
            ))}
          </div>
        </div>

        <br />
        <button
          style={{
            marginTop: 10,
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => setSelectedNode(null)}
        >
          Close
        </button>

        {/* Documentation Section */}
        <div style={{
          marginTop: '20px',
          borderTop: '1px solid #555',
          paddingTop: '15px'
        }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '8px 0',
              borderRadius: '4px'
            }}
            onClick={() => setIsDocumentationExpanded(!isDocumentationExpanded)}
          >
            <h4 style={{
              color: '#ffffff',
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              Class Documentation
            </h4>
            <span style={{
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 'bold',
              transform: isDocumentationExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              userSelect: 'none'
            }}>
              ▶
            </span>
          </div>

          {isDocumentationExpanded && (
            <div
              className="documentation-content"
              style={{
                backgroundColor: '#2a2a3e',
                border: '1px solid #555',
                borderRadius: '4px',
                padding: '12px',
                minHeight: '120px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.4',
                color: '#e8e8e8',
                marginTop: '8px'
              }}
              dangerouslySetInnerHTML={{
                __html: nodeDocumentation[selectedNode.type]?.html || 'Loading documentation...'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeSidebar;
