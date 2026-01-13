import React, { useState } from 'react';
import { useDnD } from './DnDContext';
import { nodeCategories, getNodeDisplayName } from '../nodeConfig.js';

export default () => {
  const [_, setType] = useDnD();
  const [expandedCategories, setExpandedCategories] = useState({
    'Sources': false,
    'Processing': true,
    'Math': true,
    'Control': false,
    'Fuel Cycle': false,
    'Output': true
  });

  const onDragStart = (event, nodeType) => {
    setType(nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // Get CSS class for node based on category
  const getNodeClass = (categoryName) => {
    const categoryClasses = {
      'Sources': 'dndnode input',
      'Output': 'dndnode output',
      'Processing': 'dndnode processing',
      'Math': 'dndnode math',
      'Others': 'dndnode others',
      'Filters': 'dndnode filters',
      'Control': 'dndnode control',
      'Fuel Cycle': 'dndnode fuel-cycle'
    };
    return categoryClasses[categoryName] || 'dndnode';
  };

  return (
    <aside style={{
      padding: '16px',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: '#1e1e2f',
      borderRight: '1px solid #555',
      boxSizing: 'border-box'
    }}>
      <div className="description" style={{
        marginBottom: '16px',
        fontSize: '14px',
        color: '#cccccc',
        textAlign: 'center'
      }}>
        Drag nodes to the canvas to add them to your graph
      </div>

      {Object.entries(nodeCategories).map(([categoryName, categoryData]) => (
        <div key={categoryName} style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '8px 12px',
              backgroundColor: '#2c2c54',
              borderRadius: '4px',
              marginBottom: '8px',
              userSelect: 'none'
            }}
            onClick={() => toggleCategory(categoryName)}
          >
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#ffffff'
            }}>
              {categoryName}
            </h4>
            <span style={{
              fontSize: '12px',
              transform: expandedCategories[categoryName] ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: '#cccccc'
            }}>
              ▶
            </span>
          </div>

          {expandedCategories[categoryName] && (
            <div style={{ paddingLeft: '8px' }}>
              <div className="sidebar-description">
                {categoryData.description}
              </div>

              {categoryData.nodes.map(nodeType => (
                <div
                  key={nodeType}
                  className={getNodeClass(categoryName)}
                  draggable
                  style={{
                    margin: '4px 0',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    cursor: 'grab',
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={(e) => {
                    const currentBg = window.getComputedStyle(e.target).backgroundColor;
                    const currentBorder = window.getComputedStyle(e.target).borderLeftColor;
                    e.target.style.backgroundColor = currentBg;
                    e.target.style.borderColor = '#78A083';
                    e.target.style.borderLeftColor = currentBorder;
                    e.target.style.transform = 'translateX(4px)';
                    e.target.style.color = '#ffffff';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#555';
                    e.target.style.transform = 'translateX(0px)';
                    e.target.style.color = '#ffffff';
                    e.target.style.boxShadow = 'none';
                  }}
                  onDragStart={(e) => {
                    e.target.style.cursor = 'grabbing';
                    onDragStart(e, nodeType);
                  }}
                  onDragEnd={(e) => {
                    e.target.style.cursor = 'grab';
                  }}
                >
                  <span>{getNodeDisplayName(nodeType)}</span>
                  <span style={{
                    fontSize: '12px',
                    color: '#888',
                  }}>
                    ⋮⋮
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
};