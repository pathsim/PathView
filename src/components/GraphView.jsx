import { ReactFlow, Controls, MiniMap, Background } from '@xyflow/react';
import ContextMenu from './ContextMenu';

export default function GraphView(props) {
    const {
        refEl, nodes, edges, onNodesChange, onEdgesChange, onConnect,
        onNodeClick, onEdgeClick, onPaneClick, onNodeContextMenu,
        nodeTypes, onDrop, onDragStart, onDragOver,
        menu, duplicateNode, copyFeedback,
        ui, reactFlowWrapperRef,
    } = props;

    return (
        <div className="dndflow" style={{ flex: 1, position: 'relative' }}>
            <div className="reactflow-wrapper" ref={reactFlowWrapperRef} style={{ width: '100%', height: '100%' }}>
                <ReactFlow
                    ref={refEl}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    onNodeContextMenu={onNodeContextMenu}
                    nodeTypes={nodeTypes}
                    onDrop={onDrop}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                    <Background variant="dots" gap={12} size={1} />

                    {menu && <ContextMenu onClick={onPaneClick} onDuplicate={duplicateNode} {...menu} />}

                    <FloatingButtons {...ui} />
                    <CopyToast copyFeedback={copyFeedback} />
                    {ui.showKeyboardShortcuts && <KeyboardShortcuts onClose={() => ui.setShowKeyboardShortcuts(false)} />}
                </ReactFlow>
            </div>
        </div>
    );
}

function FloatingButtons({
    selectedNode, selectedEdge,
    deleteSelectedNode, deleteSelectedEdge,
    saveGraph, loadGraph, resetGraph, saveToPython, runPathsim,
    shareGraphURL,
    dockOpen, onToggleLogs,
    sidebarVisible, setSidebarVisible
}) {
    return (
        <>
            {/* Delete Edge, Delete Node, Save, Load, New graph, Save to Python, Run */}
            <button
                style={{
                    position: 'absolute',
                    left: 50,
                    top: 70,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: selectedEdge ? '#e74c3c' : '#cccccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: selectedEdge ? 'pointer' : 'not-allowed',
                }}
                onClick={deleteSelectedEdge}
                disabled={!selectedEdge}
            >
                Delete Edge
            </button>
            <button
                style={{
                    position: 'absolute',
                    left: 50,
                    top: 120,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: selectedNode ? '#e74c3c' : '#cccccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: selectedNode ? 'pointer' : 'not-allowed',
                }}
                onClick={deleteSelectedNode}
                disabled={!selectedNode}
            >
                Delete Node
            </button>
            <button
                style={{
                    position: 'absolute',
                    right: 20,
                    top: 20,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                }}
                onClick={saveGraph}
            >
                Save File
            </button>
            <button
                style={{
                    position: 'absolute',
                    right: 140,
                    top: 20,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                }}
                onClick={loadGraph}
            >
                Load File
            </button>
            <button
                style={{
                    position: 'absolute',
                    left: 50,
                    top: 20,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                }}
                onClick={resetGraph}
            >
                New graph
            </button>

            {/* Sidebar Toggle Button - strudel-flow style */}
            <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="sidebar-trigger"
                style={{
                    position: 'absolute',
                    left: 15,
                    top: 20,
                    zIndex: 1000,
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'transparent',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // transition: 'all 0.2s ease',
                    padding: '0'
                }}
                title="Toggle Sidebar"
            >
                {/* PanelLeft icon - similar to lucide-react */}
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        color: '#ffffff',
                        transition: 'color 0.2s ease'
                    }}
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
            </button>

            <button
                style={{
                    position: 'absolute',
                    right: 20,
                    top: 80,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                }}
                onClick={saveToPython}
            >
                Save to <br />Python
            </button>
            <button
                style={{
                    position: 'absolute',
                    right: 20,
                    top: 143,
                    zIndex: 10,
                    padding: '8px 8px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}
                onClick={shareGraphURL}
            >
                🔗
            </button>
            <button
                style={{
                    position: 'absolute',
                    right: 20,
                    top: 185,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#78A083',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}
                onClick={runPathsim}
            >
                <span style={{ fontSize: '14px', lineHeight: '1' }}>▶</span>
                Run
            </button>
            <button
                style={{
                    position: 'absolute',
                    right: 20,
                    top: 230,
                    zIndex: 10,
                    padding: '8px 12px',
                    backgroundColor: '#444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer'
                }}
                onClick={onToggleLogs}
            >
                {dockOpen ? 'Hide Logs' : 'Show Logs'}
            </button>
        </>
    );
}

function CopyToast({ copyFeedback }) {
    if (!copyFeedback) return null;
    return (
        <div style={{
            position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#78A083', color: '#fff', padding: '8px 16px', borderRadius: 4, zIndex: 1000, fontSize: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
            {copyFeedback}
        </div>
    );
}

function KeyboardShortcuts({ show, onClose }) {
    if (!show) return null; // nothing rendered if false

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '50%',
                right: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.31)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: '12px',
                zIndex: 10,
                maxWidth: '200px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '4px',
                }}
            >
                <strong>Keyboard Shortcuts:</strong>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        padding: '0 0 0 8px',
                        lineHeight: '1',
                    }}
                    title="Close shortcuts panel"
                >
                    ×
                </button>
            </div>
            Ctrl+C: Copy selected node<br />
            Ctrl+V: Paste copied node<br />
            Ctrl+D: Duplicate selected node<br />
            Del/Backspace: Delete selection<br />
            Right-click: Context menu
        </div>
    );
}