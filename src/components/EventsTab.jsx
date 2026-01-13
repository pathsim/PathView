import { useState } from 'react';

// Define default parameters for each event type
const eventDefaults = {
  'Schedule': {
    t_start: '0',
    t_end: 'None',
    t_period: '1',
    func_act: '',
    tolerance: '1e-16'
  },
  'ScheduleList': {
    times_evt: '',
    func_act: '',
    tolerance: '1e-16'
  },
  'ZeroCrossingDown': {
    func_evt: '',
    func_act: '',
    tolerance: '1e-8'
  },
  'ZeroCrossingUp': {
    func_evt: '',
    func_act: '',
    tolerance: '1e-8'
  },
  'ZeroCrossing': {
    func_evt: '',
    func_act: '',
    tolerance: '1e-8'
  },
  'Condition': {
    func_evt: '',
    func_act: '',
    tolerance: '1e-8'
  }
};

const EventsTab = ({ events, setEvents }) => {
  // Initialize with defaults for the initial event type
  const initialEventType = 'ZeroCrossingDown';
  const [currentEvent, setCurrentEvent] = useState(() => {
    return {
      name: '',
      type: initialEventType,
      ...eventDefaults[initialEventType]
    };
  });

  // State to track if we're editing an existing event
  const [editingEventId, setEditingEventId] = useState(null);

  const eventTypes = [
    'Condition',
    'Schedule',
    'ScheduleList',
    'ZeroCrossing',
    'ZeroCrossingUp',
    'ZeroCrossingDown'
  ];

  const handleInputChange = (field, value) => {
    setCurrentEvent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTypeChange = (newType) => {
    // When type changes, reset the event to defaults for that type
    const defaults = eventDefaults[newType] || {};
    setCurrentEvent({
      name: currentEvent.name, // Keep the name
      type: newType,
      ...defaults
    });
  };

  const addEvent = () => {
    if (currentEvent.name) {
      // Validate required fields based on event type

      // For Schedule, func_act is required
      if (['Schedule', 'ScheduleList'].includes(currentEvent.type) && !currentEvent.func_act) {
        alert('func_act is required for Schedule events');
        return;
      }

      // For other event types, both func_evt and func_act are typically required
      if (!['Schedule', 'ScheduleList'].includes(currentEvent.type) && (!currentEvent.func_evt || !currentEvent.func_act)) {
        alert('Both func_evt and func_act are required for this event type');
        return;
      }

      setEvents(prev => [...prev, { ...currentEvent, id: Date.now() }]);

      // Reset to defaults for current type
      const resetDefaults = eventDefaults[currentEvent.type] || {};
      setCurrentEvent({
        name: '',
        type: currentEvent.type,
        ...resetDefaults
      });
    }
  };

  const editEvent = (event) => {
    setCurrentEvent({ ...event });
    setEditingEventId(event.id);
  };

  const saveEditedEvent = () => {
    if (currentEvent.name) {

      // For Schedule, func_act is required
      if (currentEvent.type === 'Schedule' && !currentEvent.func_act) {
        alert('func_act is required for Schedule events');
        return;
      }

      // For other event types, both func_evt and func_act are typically required
      if (currentEvent.type !== 'Schedule' && (!currentEvent.func_evt || !currentEvent.func_act)) {
        alert('Both func_evt and func_act are required for this event type');
        return;
      }

      setEvents(prev => prev.map(event =>
        event.id === editingEventId ? { ...currentEvent } : event
      ));

      // Reset form and exit edit mode
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    // Reset to defaults for current type
    const resetDefaults = eventDefaults[currentEvent.type] || {};
    setCurrentEvent({
      name: '',
      type: currentEvent.type,
      ...resetDefaults
    });
  };

  const deleteEvent = (id) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  };

  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 50px)',
      paddingTop: '0px',
      backgroundColor: '#1e1e2f',
      overflow: 'auto',
    }}>
      <div style={{
        padding: '10px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h1 style={{ color: '#ffffff', marginBottom: '20px', textAlign: 'center' }}>
          Events
        </h1>

        {/* Add New Event Form */}
        <div style={{
          backgroundColor: '#2a2a3f',
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '30px',
          border: '1px solid #444'
        }}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>
            {editingEventId ? 'Edit Event' : 'Add New Event'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <label style={{ color: '#ffffff', display: 'block', marginBottom: '8px' }}>
                Event Name:
              </label>
              <input
                type="text"
                value={currentEvent.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., E1, shutdown_event"
                style={{
                  width: '80%',
                  padding: '10px',
                  backgroundColor: '#1e1e2f',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ width: '100%', maxWidth: '400px' }}>
              <label style={{ color: '#ffffff', display: 'block', marginBottom: '8px' }}>
                Event Type:
              </label>
              <select
                value={currentEvent.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                style={{
                  width: '85%',
                  padding: '10px',
                  backgroundColor: '#1e1e2f',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '14px',
                }}
              >
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic parameter fields based on event type */}
          <div style={{ gap: '20px', marginTop: '20px' }}>
            {(() => {
              const typeDefaults = eventDefaults[currentEvent.type] || {};
              const allParams = new Set([
                // don't include 'name', 'type', since included above + 'id' cannot be edited
                ...Object.keys(currentEvent).filter(key => key !== 'name' && key !== 'type' && key !== 'id'),
                ...Object.keys(typeDefaults)
              ]);

              return Array.from(allParams).map(key => {
                const currentValue = currentEvent[key] || '';
                const defaultValue = typeDefaults[key];
                const placeholder = defaultValue !== undefined && defaultValue !== null ?
                  String(defaultValue) : '';

                // Check if this is a function parameter (contains 'func' in the name)
                const isFunctionParam = key.toLowerCase().includes('func');

                return (
                  <div key={key} style={{ width: '100%', maxWidth: isFunctionParam ? '600px' : '400px' }}>
                    <label style={{
                      color: '#ffffff',
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}>
                      {key}:
                    </label>
                    {isFunctionParam ? (
                      <textarea
                        value={currentValue}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={placeholder || `eg. def ${key}(t):\n    # Your code here\n    return result`}
                        style={{
                          width: '80%',
                          minHeight: '100px',
                          padding: '10px',
                          backgroundColor: '#1e1e2f',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={placeholder}
                        style={{
                          width: '50%',
                          padding: '10px',
                          backgroundColor: '#1e1e2f',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '14px',
                        }}
                      />
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
            {editingEventId ? (
              <>
                <button
                  onClick={saveEditedEvent}
                  style={{
                    backgroundColor: '#78A083',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    backgroundColor: '#6c757d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={addEvent}
                style={{
                  backgroundColor: '#78A083',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Events List */}
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px', textAlign: 'center' }}>Defined Events ({events.length})</h2>

          {events.length === 0 ? (
            <div style={{
              backgroundColor: '#2a2a3f',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              color: '#888',
              border: '1px solid #444'
            }}>
              No events defined yet. Add an event above to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {events.map((event, index) => (
                <div
                  key={event.id}
                  style={{
                    backgroundColor: '#2a2a3f',
                    borderRadius: '8px',
                    padding: '20px',
                    border: editingEventId === event.id ? '2px solid #007bff' : '1px solid #444',
                    boxShadow: editingEventId === event.id ? '0 0 10px rgba(0, 123, 255, 0.3)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ color: '#ffffff', margin: 0 }}>
                        {event.name} ({event.type})
                      </h3>
                      {editingEventId === event.id && (
                        <span style={{
                          color: '#007bff',
                          fontSize: '12px',
                          fontStyle: 'italic',
                          marginTop: '4px',
                          display: 'block'
                        }}>
                          Currently editing this event
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => editEvent(event)}
                        style={{
                          backgroundColor: '#007bff',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        style={{
                          backgroundColor: '#dc3545',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Display parameters dynamically */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {Object.entries(event)
                      .filter(([key]) => key !== 'id' && key !== 'name' && key !== 'type')
                      .map(([key, value]) => {
                        const isFunctionParam = key.toLowerCase().includes('func');

                        return (
                          <div key={key}>
                            <h4 style={{
                              color: '#ccc',
                              margin: '0 0 8px 0',
                              fontSize: '14px',
                              textTransform: 'capitalize'
                            }}>
                              {key.replace(/_/g, ' ')}:
                            </h4>
                            {isFunctionParam ? (
                              <pre style={{
                                backgroundColor: '#1e1e2f',
                                padding: '12px',
                                borderRadius: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                margin: 0,
                                overflow: 'auto',
                                border: '1px solid #555',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {value || '(not defined)'}
                              </pre>
                            ) : (
                              <code style={{
                                backgroundColor: '#1e1e2f',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                color: '#78A083',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                border: '1px solid #555',
                                display: 'block'
                              }}>
                                {value || '(not set)'}
                              </code>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventsTab;