import { useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { python } from '@codemirror/lang-python';
import { getApiEndpoint } from '../config.js';


const PythonCodeEditor = ({ 
  code = "# Define your Python variables and functions here\n# Example:\n# my_variable = 42\n# def my_function(x):\n#     return x * 2\n",
  onCodeChange,
  onExecute,
  height = "400px"
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const handleCodeChange = useCallback((newCode) => {
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  }, [onCodeChange]);

  const executeCode = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch(getApiEndpoint('/execute-python'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });

      const result = await response.json();
      setExecutionResult(result);
      
      if (onExecute) {
        onExecute(result);
      }
    } catch (error) {
      setExecutionResult({
        success: false,
        error: `Network error: ${error.message}`
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="python-code-editor">
      <div className="editor-header">
        {/* <h3>Python Code Editor</h3> */}
        <button 
          onClick={executeCode}
          disabled={isExecuting}
          className="execute-btn"
        >
          {isExecuting ? 'Executing...' : 'Test Code'}
        </button>
      </div>
      
      <div className="editor-container" style={{ height }}>
        <CodeMirror 
          value={code} 
          onChange={handleCodeChange} 
          extensions={[python({ python: true })]} 
          theme={vscodeDark} 
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: true,
          }}
          style={{
            fontSize: '14px',
            height: '100%',
          }}
        />
      </div>

      {executionResult && (
        <div className={`execution-result ${executionResult.success ? 'success' : 'error'}`}>
          <div className="result-header">
            <strong>{executionResult.success ? 'Execution Result:' : 'Error:'}</strong>
          </div>
          
          {executionResult.success ? (
            <div>
              {executionResult.output && (
                <div className="output">
                  <strong>Output:</strong>
                  <pre>{executionResult.output}</pre>
                </div>
              )}
              
              {executionResult.variables && Object.keys(executionResult.variables).length > 0 && (
                <div className="variables">
                  <strong>Variables added to namespace:</strong>
                  <ul>
                    {Object.entries(executionResult.variables).map(([name, value]) => (
                      <li key={name}>
                        <code>{name}</code> = {JSON.stringify(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {executionResult.functions && executionResult.functions.length > 0 && (
                <div className="functions">
                  <strong>Functions added to namespace:</strong>
                  <ul>
                    {executionResult.functions.map((funcName) => (
                      <li key={funcName}>
                        <code>{funcName}()</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="error-message">
              <pre>{executionResult.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PythonCodeEditor;
