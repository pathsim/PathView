import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function LogDock({ open, onClose, lines, progress }) {
  const [height, setHeight] = useState(0.3 * window.innerHeight);
  const startYRef = useRef(0);
  const startHRef = useRef(height);
  const resizingRef = useRef(false);

  // to ensure the height is within bounds if window is resized
  useEffect(() => {
    const onResize = () => {
      const maxH = Math.round(window.innerHeight * 0.9);
      setHeight((h) => Math.min(Math.max(h, 120), maxH));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!resizingRef.current) return;
    const dy = startYRef.current - e.clientY; // dragging up increases height
    const next = Math.round(startHRef.current + dy);
    const minH = 120;
    const maxH = Math.round(window.innerHeight * 0.9);
    setHeight(Math.min(Math.max(next, minH), maxH));
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopResizing);
  }, [onMouseMove]);

  const onMouseDownHandle = (e) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = height;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResizing);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        background: '#111',
        color: '#ddd',
        borderTop: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDownHandle}
        title="Drag to resize"
        style={{
          height: 3,
          cursor: 'ns-resize',
          background:
            '#111',
        }}
      />
      {/* Header */}
      <div style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong>Simulation Logs</strong>
        {typeof progress === 'number' && (
          <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3 }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#78A083',
              borderRadius: 3
            }} />
          </div>
        )}
        <button onClick={onClose} style={{ marginLeft: 'auto' }}>Close</button>
      </div>

      {/* Log Lines */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: '8px 12px',
        whiteSpace: 'pre-wrap'
      }}>
        {lines.length ? lines.join('\n') : 'Waiting for output…'}
      </div>
    </div>
  );
}
