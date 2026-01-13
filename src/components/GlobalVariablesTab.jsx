import { isValidPythonIdentifier } from '../utils.js';


import PythonCodeEditor from './PythonCodeEditor';
import '../styles/PythonCodeEditor.css';

export const IdeWithAutocomplete = ({ pythonCode, setPythonCode }) => {
  const handleCodeExecution = (result) => {
    if (result.success) {
      console.log('Code executed successfully:', result);
      // You can add notifications here if needed
    } else {
      console.error('Code execution failed:', result.error);
    }
  };

  return (
    <div>
      <PythonCodeEditor 
        code={pythonCode}
        onCodeChange={setPythonCode}
        onExecute={handleCodeExecution}
        height="500px"
      />
    </div>
  );
};

const GlobalVariablesTab = ({ 
  globalVariables, 
  setGlobalVariables, 
  setActiveTab,
  pythonCode,
  setPythonCode
}) => {

  const addGlobalVariable = () => {
    const newVariable = {
      id: Date.now().toString(),
      name: '',
      value: '',
      nameError: false
    };
    setGlobalVariables([...globalVariables, newVariable]);
  };

  const removeGlobalVariable = (id) => {
    setGlobalVariables(globalVariables.filter(variable => variable.id !== id));
  };

  const updateGlobalVariable = (id, field, value) => {
    setGlobalVariables(globalVariables.map(variable => {
      if (variable.id === id) {
        const updatedVariable = { ...variable, [field]: value };

        // Validate name field
        if (field === 'name') {
          updatedVariable.nameError = value !== '' && !isValidPythonIdentifier(value);
        }

        return updatedVariable;
      }
      return variable;
    }));
  };

  return (
    <div style={{
      width: '100%',
      height: 'calc(100vh - 50px)',
      paddingTop: '50px',
      backgroundColor: '#1e1e2f',
      overflow: 'auto',
    }}>
      <div style={{
        padding: '40px',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <h1 style={{ color: '#ffffff', marginBottom: '30px', textAlign: 'center' }}>
          Global Variables
        </h1>
        <div style={{
          backgroundColor: '#2c2c54',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        }}>
          <p style={{
            color: '#cccccc',
            marginBottom: '20px',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            Define global variables that can be used in node definitions throughout your model.
          </p>

          {globalVariables.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#888',
              padding: '40px 20px',
              fontStyle: 'italic'
            }}>
              No global variables defined. Click "Add Variable" to create one.
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              {globalVariables.map((variable) => (
                <div key={variable.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '15px',
                  alignItems: 'start',
                  marginBottom: '15px',
                  padding: '15px',
                  backgroundColor: '#1e1e2f',
                  borderRadius: '8px',
                  border: '1px solid #555'
                }}>
                  <div>
                    <label style={{
                      color: '#ffffff',
                      display: 'block',
                      marginBottom: '5px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      Variable Name:
                    </label>
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => updateGlobalVariable(variable.id, 'name', e.target.value)}
                      placeholder="variable_name"
                      style={{
                        width: '95%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: variable.nameError ? '2px solid #e74c3c' : '1px solid #666',
                        backgroundColor: '#2c2c54',
                        color: '#ffffff',
                        fontSize: '14px'
                      }}
                    />
                    {variable.nameError && (
                      <div style={{
                        color: '#e74c3c',
                        fontSize: '11px',
                        marginTop: '3px',
                        fontStyle: 'italic'
                      }}>
                        Invalid Python variable name
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{
                      color: '#ffffff',
                      display: 'block',
                      marginBottom: '5px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      Value:
                    </label>
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => updateGlobalVariable(variable.id, 'value', e.target.value)}
                      placeholder="0.5"
                      style={{
                        width: '95%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #666',
                        backgroundColor: '#2c2c54',
                        color: '#ffffff',
                        fontSize: '14px'
                      }}
                    />
                    {/* Placeholder div to maintain alignment */}
                    <div style={{
                      height: variable.nameError ? '20px' : '0px',
                      fontSize: '11px',
                      marginTop: '3px'
                    }}>
                      {/* Empty space to match error message height */}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                    paddingTop: '10px' // Align with input field (label height + margin)
                  }}>
                    <button
                      onClick={() => removeGlobalVariable(variable.id)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                      title="Remove variable"
                    >
                      −
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            marginTop: '20px'
          }}>
            <button
              onClick={addGlobalVariable}
              style={{
                padding: '12px 24px',
                backgroundColor: '#78A083',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              + Add Variable
            </button>
            <button
              style={{
                padding: '12px 24px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              onClick={() => setActiveTab('graph')}
            >
              Back to Graph Editor
            </button>
          </div>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#2c2c54',
          borderRadius: '8px',
          border: '1px solid #555'
        }}>
          <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Usage Instructions:</h3>
          <ul style={{ color: '#cccccc', lineHeight: '1.6' }}>
            <li><strong>Variable names</strong> must be valid Python identifiers (start with letter/underscore, contain only letters/digits/underscores)</li>
            <li><strong>Cannot use Python keywords</strong> like "if", "for", "class", "def", etc.</li>
            <li>Use meaningful names (e.g., "flow_rate", "temperature", "my_constant")</li>
            <li>Use numeric values, expressions, or references to other variables</li>
            <li>Variables can be referenced in node parameters using their exact names</li>
            <li>Variables are saved and loaded with your graph files</li>
          </ul>
        </div>
        {/* Python Code Editor Section */}
        <div style={{ maxWidth: '1000px', margin: '30px auto 0' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px', textAlign: 'center' }}>
            Python Code Editor
          </h2>
          <div style={{
            backgroundColor: '#2a2a3f',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #444'
          }}>
            <p style={{ color: '#bbbbbb', marginBottom: '20px', textAlign: 'center' }}>
              Define Python variables and functions here. They will be available in your event functions and throughout the simulation.
            </p>
            <IdeWithAutocomplete 
              pythonCode={pythonCode}
              setPythonCode={setPythonCode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalVariablesTab;
