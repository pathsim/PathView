// * Imports *
import { useState, useCallback, useEffect, useRef, version } from 'react';
import {
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles/App.css';
import { getApiEndpoint } from './config.js';
import {
  getGraphDataFromURL,
  generateShareableURL,
  updateURLWithGraphData,
  clearGraphDataFromURL
} from './utils/urlSharing.js';
import Sidebar from './components/Sidebar';
import NodeSidebar from './components/NodeSidebar';
import { DnDProvider, useDnD } from './components/DnDContext.jsx';
import EventsTab from './components/EventsTab.jsx';
import GlobalVariablesTab from './components/GlobalVariablesTab.jsx';
import { makeEdge } from './components/CustomEdge';
import { nodeTypes, nodeDynamicHandles } from './nodeConfig.js';
import LogDock from './components/LogDock.jsx';
import TopBar from './components/TopBar.jsx';
import GraphView from './components/GraphView.jsx';
import EdgeDetails from './components/EdgeDetails.jsx';
import SolverPanel from './components/SolverPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import ShareModal from './components/ShareModal.jsx';

// * Declaring variables *

// Default solver parameters
const DEFAULT_SOLVER_PARAMS = {
  dt: '0.01',
  dt_min: '1e-16',
  dt_max: '',
  Solver: 'SSPRK22',
  tolerance_fpi: '1e-10',
  iterations_max: '200',
  log: 'true',
  simulation_duration: '10.0',
  extra_params: '{}'
};

// Defining initial nodes and edges. In the data section, we have label, but also parameters specific to the node.
const initialNodes = [];
const initialEdges = [];

// For Drag and Drop functionality
const DnDFlow = () => {
  // State management for nodes and edges: adds the initial nodes and edges to the graph and handles node selection
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('graph');
  const [simulationResults, setSimulationResults] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [nodeCounter, setNodeCounter] = useState(1);
  const [menu, setMenu] = useState(null);
  const [copiedNode, setCopiedNode] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const ref = useRef(null);
  const [csvData, setCsvData] = useState(null);
  const [htmlData, setHtmlData] = useState(null);
  const reactFlowWrapper = useRef(null);
  // const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  // const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();
  const [type] = useDnD();

  // for the log dock
  const [dockOpen, setDockOpen] = useState(false);
  const onToggleLogs = useCallback(() => setDockOpen(o => !o), []);
  const [logLines, setLogLines] = useState([]);
  const sseRef = useRef(null);
  const append = (line) => setLogLines((prev) => [...prev, line]);

  // for version information
  const [versionInfo, setVersionInfo] = useState(null);

  // const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDragStart = (event, nodeType) => {
    setType(nodeType);
    event.dataTransfer.setData('text/plain', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };


  // Solver parameters state
  const [solverParams, setSolverParams] = useState(DEFAULT_SOLVER_PARAMS);

  // Global variables state
  const [globalVariables, setGlobalVariables] = useState([]);
  const [events, setEvents] = useState([]);

  // Python code editor state
  const [pythonCode, setPythonCode] = useState("# Define your Python variables and functions here\n# Example:\n# my_variable = 42\n# def my_function(x):\n#     return x * 2\n");

  // State for URL sharing feedback
  const [shareUrlFeedback, setShareUrlFeedback] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareableURL, setShareableURL] = useState('');
  const [urlMetadata, setUrlMetadata] = useState(null);

  // Load graph data from URL on component mount
  useEffect(() => {
    const loadGraphFromURL = () => {
      const urlGraphData = getGraphDataFromURL();
      if (urlGraphData) {
        try {
          // Validate that it's a valid graph file
          if (!urlGraphData.nodes || !Array.isArray(urlGraphData.nodes)) {
            console.warn("Invalid graph data in URL");
            return;
          }

          // Load the graph data and ensure nodeColor exists on all nodes
          const {
            nodes: loadedNodes,
            edges: loadedEdges,
            nodeCounter: loadedNodeCounter,
            solverParams: loadedSolverParams,
            globalVariables: loadedGlobalVariables,
            events: loadedEvents,
            pythonCode: loadedPythonCode
          } = urlGraphData;

          // Ensure all loaded nodes have a nodeColor property
          const nodesWithColors = (loadedNodes || []).map(node => ({
            ...node,
            data: {
              ...node.data,
              nodeColor: node.data.nodeColor || '#DDE6ED'
            }
          }));

          setNodes(nodesWithColors);
          setEdges(loadedEdges || []);
          setSelectedNode(null);
          setNodeCounter(loadedNodeCounter ?? loadedNodes.length);
          setSolverParams(loadedSolverParams ?? DEFAULT_SOLVER_PARAMS);
          setGlobalVariables(loadedGlobalVariables ?? []);
          setEvents(loadedEvents ?? []);
          setPythonCode(loadedPythonCode ?? "# Define your Python variables and functions here\n# Example:\n# my_variable = 42\n# def my_function(x):\n#     return x * 2\n");

          console.log('Graph loaded from URL successfully');
        } catch (error) {
          console.error('Error loading graph from URL:', error);
        }
      }
    };

    loadGraphFromURL();
  }, []); // Empty dependency array means this runs once on mount

  const [defaultValues, setDefaultValues] = useState({});
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState('');
  const [nodeDocumentation, setNodeDocumentation] = useState({});
  const [isDocumentationExpanded, setIsDocumentationExpanded] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(true);

  // Function to fetch default values for a node type (with caching)
  const fetchDefaultValues = async (nodeType) => {
    // Check if we already have cached values for this node type
    if (defaultValues[nodeType]) {
      return defaultValues[nodeType];
    }

    try {
      const response = await fetch(getApiEndpoint(`/default-values/${nodeType}`));
      if (response.ok) {
        const defaults = await response.json();
        // Cache the values
        setDefaultValues(prev => ({
          ...prev,
          [nodeType]: defaults
        }));
        return defaults;
      } else {
        console.error('Failed to fetch default values');
        return {};
      }
    } catch (error) {
      console.error('Error fetching default values:', error);
      return {};
    }
  };

  // Function to fetch version information
  const fetchVersionInfo = async () => {
    try {
      const response = await fetch(getApiEndpoint('/version'));
      if (response.ok) {
        const versionData = await response.json();
        setVersionInfo(versionData);
        return versionData;
      } else {
        console.error('Failed to fetch version information');
        return null;
      }
    } catch (error) {
      console.error('Error fetching version information:', error);
      return null;
    }
  };

  // Function to fetch documentation for a node type
  const fetchNodeDocumentation = async (nodeType) => {
    try {
      const response = await fetch(getApiEndpoint(`/get-docs/${nodeType}`));
      if (response.ok) {
        const result = await response.json();
        return {
          html: result.html || result.docstring || 'No documentation available for this node type.',
          text: result.docstring || 'No documentation available for this node type.'
        };
      } else {
        console.error('Failed to fetch documentation');
        return {
          html: '<p>Failed to load documentation.</p>',
          text: 'Failed to load documentation.'
        };
      }
    } catch (error) {
      console.error('Error fetching documentation:', error);
      return {
        html: '<p>Error loading documentation.</p>',
        text: 'Error loading documentation.'
      };
    }
  };

  // Function to preload all documentation at startup
  const preloadAllDocumentation = async () => {
    const availableTypes = Object.keys(nodeTypes);

    try {
      // Convert types array to a string (or could be sent as JSON array)
      const response = await fetch(getApiEndpoint(`/get-all-docs`));

      if (response.ok) {
        const allDocs = await response.json();
        setNodeDocumentation(allDocs);
      } else {
        console.error('Failed to preload documentation');
        // Fallback: initialize empty documentation for all types
        const documentationCache = {};
        availableTypes.forEach(nodeType => {
          documentationCache[nodeType] = {
            html: '<p>No documentation available for this node type.</p>',
            text: 'No documentation available for this node type.'
          };
        });
        setNodeDocumentation(documentationCache);
      }
    } catch (error) {
      console.error('Error preloading documentation:', error);
      // Fallback: initialize empty documentation for all types
      const documentationCache = {};
      availableTypes.forEach(nodeType => {
        documentationCache[nodeType] = {
          html: '<p>Error loading documentation.</p>',
          text: 'Error loading documentation.'
        };
      });
      setNodeDocumentation(documentationCache);
    }
  };

  // Function to preload all default values at startup
  const preloadDefaultValues = async () => {
    const availableTypes = Object.keys(nodeTypes);

    try {
      const response = await fetch(getApiEndpoint(`/default-values-all`));

      if (response.ok) {
        const allDefaults = await response.json();
        setDefaultValues(allDefaults);
      } else {
        console.error('Failed to preload default values');
        // Fallback: initialize empty defaults for all types
        const defaultValuesCache = {};
        availableTypes.forEach(nodeType => {
          defaultValuesCache[nodeType] = {};
        });
        setDefaultValues(defaultValuesCache);
      }
    } catch (error) {
      console.error('Error preloading default values:', error);
      // Fallback: initialize empty defaults for all types
      const defaultValuesCache = {};
      availableTypes.forEach(nodeType => {
        defaultValuesCache[nodeType] = {};
      });
      setDefaultValues(defaultValuesCache);
    }
  };

  // Preload all default values and documentation when component mounts
  useEffect(() => {
    preloadDefaultValues();
    preloadAllDocumentation();
    fetchVersionInfo(); // Fetch version information on component mount
  }, []);

  const onDrop = useCallback(
    async (event) => {
      event.preventDefault();

      // check if the dropped element is valid
      if (!type) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNodeId = nodeCounter.toString();

      // Fetch default values for this node type
      let defaults = {};

      try {
        defaults = await fetchDefaultValues(type);
      } catch (error) {
        console.warn(`Failed to fetch default values for ${type}, using empty defaults:`, error);
        defaults = {};
      }

      // Create node data with label and initialize all expected fields as empty strings
      let nodeData = {
        label: `${type} ${newNodeId}`,
        nodeColor: '#DDE6ED' // Default node color
      };

      // if node in nodeDynamicHandles, ensure add outputCount and inputCount to data
      if (nodeDynamicHandles.includes(type)) {
        nodeData.inputCount = 1;
        nodeData.outputCount = 1;
      }

      // Initialize all expected parameters as empty strings
      Object.keys(defaults).forEach(key => {
        nodeData[key] = '';
      });

      const newNode = {
        id: newNodeId,
        type: type,
        position: position,
        data: nodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setNodeCounter((count) => count + 1);
    },
    [screenToFlowPosition, type, nodeCounter, fetchDefaultValues, setDefaultValues, setNodes, setNodeCounter],
  );

  // Function to save a graph to computer with "Save As" dialog
  const saveGraph = async () => {
    const graphData = {
      version: versionInfo ? Object.fromEntries(Object.entries(versionInfo).filter(([key]) => key !== 'status')) : 'unknown',
      nodes,
      edges,
      nodeCounter,
      solverParams,
      globalVariables,
      events,
      pythonCode
    };

    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
      try {
        // Modern approach: Use File System Access API for proper "Save As" dialog
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'pathview_graph.json',
          types: [{
            description: 'JSON files',
            accept: {
              'application/json': ['.json']
            }
          }]
        });

        // Create a writable stream and write the data
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(graphData, null, 2));
        await writable.close();

      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error saving file:', error);
          alert('Failed to save file.');
        }
        // User cancelled the dialog - no error message needed
      }
    } else {
      // Fallback for browsers (like Firefox and Safari) that don't support File System Access API
      const blob = new Blob([JSON.stringify(graphData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph.json';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Function to load a saved graph from computer
  const loadGraph = async () => {
    // Check if File System Access API is supported
    if ('showOpenFilePicker' in window) {
      try {
        // Modern approach: Use File System Access API
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON files',
            accept: {
              'application/json': ['.json']
            }
          }],
          multiple: false
        });

        const file = await fileHandle.getFile();
        const text = await file.text();

        try {
          const graphData = JSON.parse(text);

          // Validate that it's a valid graph file
          if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
            alert("Invalid file format. Please select a valid graph JSON file.");
            return;
          }

          // Load the graph data and ensure nodeColor exists on all nodes
          const {
            nodes: loadedNodes,
            edges: loadedEdges,
            nodeCounter: loadedNodeCounter,
            solverParams: loadedSolverParams,
            globalVariables: loadedGlobalVariables,
            events: loadedEvents,
            pythonCode: loadedPythonCode
          } = graphData;

          // Ensure all loaded nodes have a nodeColor property
          const nodesWithColors = (loadedNodes || []).map(node => ({
            ...node,
            data: {
              ...node.data,
              nodeColor: node.data.nodeColor || '#DDE6ED'
            }
          }));

          setNodes(nodesWithColors);
          setEdges(loadedEdges || []);
          setSelectedNode(null);
          setNodeCounter(loadedNodeCounter ?? loadedNodes.length);
          setSolverParams(loadedSolverParams ?? DEFAULT_SOLVER_PARAMS);
          setGlobalVariables(loadedGlobalVariables ?? []);
          setEvents(loadedEvents ?? []);
          setPythonCode(loadedPythonCode ?? "# Define your Python variables and functions here\n# Example:\n# my_variable = 42\n# def my_function(x):\n#     return x * 2\n");
        } catch (error) {
          console.error('Error parsing file:', error);
          alert('Error reading file. Please make sure it\'s a valid JSON file.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error opening file:', error);
          alert('Failed to open file.');
        }
        // User cancelled the dialog - no error message needed
      }
    } else {
      // Fallback for browsers that don't support File System Access API
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';

      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const graphData = JSON.parse(e.target.result);

            if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
              alert("Invalid file format. Please select a valid graph JSON file.");
              return;
            }

            const {
              nodes: loadedNodes,
              edges: loadedEdges,
              nodeCounter: loadedNodeCounter,
              solverParams: loadedSolverParams,
              globalVariables: loadedGlobalVariables,
              events: loadedEvents,
              pythonCode: loadedPythonCode
            } = graphData;

            // Ensure all loaded nodes have a nodeColor property
            const nodesWithColors = (loadedNodes || []).map(node => ({
              ...node,
              data: {
                ...node.data,
                nodeColor: node.data.nodeColor || '#DDE6ED'
              }
            }));

            setNodes(nodesWithColors);
            setEdges(loadedEdges || []);
            setSelectedNode(null);
            setNodeCounter(loadedNodeCounter ?? loadedNodes.length);
            setSolverParams(loadedSolverParams ?? DEFAULT_SOLVER_PARAMS);
            setGlobalVariables(loadedGlobalVariables ?? []);
            setEvents(loadedEvents ?? []);
            setPythonCode(loadedPythonCode ?? "# Define your Python variables and functions here\n# Example:\n# my_variable = 42\n# def my_function(x):\n#     return x * 2\n");
          } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error reading file. Please make sure it\'s a valid JSON file.');
          }
        };

        reader.readAsText(file);
        document.body.removeChild(fileInput);
      };

      document.body.appendChild(fileInput);
      fileInput.click();
    }
  };

  // Allows user to clear user inputs and go back to default settings
  const resetGraph = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNode(null);
    setNodeCounter(0);
    setSolverParams(DEFAULT_SOLVER_PARAMS);
    setGlobalVariables([]);
    // Clear URL when resetting graph
    clearGraphDataFromURL();
  };

  // Share current graph via URL
  const shareGraphURL = async () => {
    const graphData = {
      version: versionInfo ? Object.fromEntries(Object.entries(versionInfo).filter(([key]) => key !== 'status')) : 'unknown',
      nodes,
      edges,
      nodeCounter,
      solverParams,
      globalVariables,
      events,
      pythonCode
    };

    try {
      const urlResult = generateShareableURL(graphData);
      if (urlResult) {
        setShareableURL(urlResult.url);
        setUrlMetadata({
          length: urlResult.length,
          isSafe: urlResult.isSafe,
          maxLength: urlResult.maxLength
        });
        setShowShareModal(true);
        // Only update browser URL if it's safe length
        if (urlResult.isSafe) {
          updateURLWithGraphData(graphData, true);
        }
      } else {
        setShareUrlFeedback('Error generating share URL');
        setTimeout(() => setShareUrlFeedback(''), 3000);
      }
    } catch (error) {
      console.error('Error sharing graph URL:', error);
      setShareUrlFeedback('Error generating share URL');
      setTimeout(() => setShareUrlFeedback(''), 3000);
    }
  };

  const downloadCsv = async () => {
    if (!csvData) return;

    const { time, series } = csvData;
    const labels = Object.keys(series);
    const header = ["time", ...labels].join(",");
    const rows = [header];

    time.forEach((t, i) => {
      const row = [t];
      for (const label of labels) {
        const val = series[label][i] ?? "NaN";
        row.push(val);
      }
      rows.push(row.join(","));
    });

    const csvString = rows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const filename = `simulation_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

    try {
      if ("showSaveFilePicker" in window) {
        const options = {
          suggestedName: filename,
          types: [{
            description: "CSV File",
            accept: { "text/csv": [".csv"] }
          }]
        };

        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        throw new Error("showSaveFilePicker not supported");
      }
    } catch (err) {
      console.warn("Falling back to automatic download:", err);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  };

  const downloadHtml = async () => {
    const blob = new Blob([htmlData], { type: "text/html" });
    const filename = `simulation_${new Date().toISOString().replace(/[:.]/g, "-")}.html`;

    try {
      if ("showSaveFilePicker" in window) {
        const options = {
          suggestedName: filename,
          types: [{
            description: "HTML File",
            accept: { "text/html": [".html"] }
          }]
        };

        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        throw new Error("showSaveFilePicker not supported");
      }
    } catch (err) {
      console.warn("Falling back to automatic download:", err);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  };



  // Allows user to save to python script
  const saveToPython = async () => {
    try {
      const graphData = {
        nodes,
        edges,
        nodeCounter,
        solverParams,
        globalVariables,
        pythonCode,
        events
      };

      const response = await fetch(getApiEndpoint('/convert-to-python'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graph: graphData }),
      });

      const result = await response.json();

      if (result.success) {
        // Check if File System Access API is supported
        if ('showSaveFilePicker' in window) {
          try {
            // Modern approach: Use File System Access API for proper "Save As" dialog
            const fileHandle = await window.showSaveFilePicker({
              suggestedName: 'pathsim_script.py',
              types: [{
                description: 'Python files',
                accept: {
                  'text/x-python': ['.py']
                }
              }]
            });

            // Create a writable stream and write the Python script
            const writable = await fileHandle.createWritable();
            await writable.write(result.script);
            await writable.close();
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('Error saving Python file:', error);
              alert('Failed to save Python script.');
            }
            // User cancelled the dialog - no error message needed
          }
        } else {
          // Fallback for browsers (Firefox, Safari) that don't support File System Access API
          const blob = new Blob([result.script], { type: 'text/x-python' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'pathsim_script.py';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        alert(`Error generating Python script: ${result.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate Python script. Make sure the backend is running.');
    }
  };
  // Function to run pathsim simulation
  const runPathsim = async () => {
    setDockOpen(true);
    setLogLines([]);

    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(getApiEndpoint('/logs/stream'));
    sseRef.current = es;

    es.addEventListener('start', () => append('log stream connected…'));
    es.onmessage = (evt) => append(evt.data);
    es.onerror = () => { append('log stream error'); es.close(); sseRef.current = null; };

    try {
      const graphData = {
        nodes,
        edges,
        solverParams,
        globalVariables,
        events,
        pythonCode
      };

      const response = await fetch(getApiEndpoint('/run-pathsim'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graph: graphData }),
      });

      // Check if response is ok first
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response has content
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Server returned empty response');
      }

      // Try to parse JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error(`Invalid JSON response: ${jsonError.message}`);
      }

      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

      if (result.success) {
        // Store results and switch to results tab
        setSimulationResults(result.plot);
        setCsvData(result.csv_data);
        setHtmlData(result.html);
        setActiveTab('results');
      } else {
        alert(`Error running Pathsim simulation: ${result.error}`);
      }
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response || 'No response object'
      });

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }

      // Provide more specific error messages
      let errorMessage = 'Failed to run Pathsim simulation. Make sure the backend is running.';

      if (error.message.includes('JSON')) {
        errorMessage = 'Server response was not valid JSON. This might be due to a server error or network issue.';
      } else if (error.message.includes('HTTP')) {
        errorMessage = `Server error: ${error.message}`;
      } else if (error.message.includes('empty response')) {
        errorMessage = 'Server returned empty response. The simulation might have failed silently.';
      }

      alert(`${errorMessage} : ${error.message}`);
    }
  };

  //When user connects two nodes by dragging, creates an edge according to the styles in our makeEdge function
  const onConnect = useCallback(
    (params) => {
      let edgeId = `e${params.source}-${params.target}`;

      // If sourceHandle or targetHandle is specified, append it to the edge ID
      if (params.sourceHandle) {
        edgeId += `-from_${params.sourceHandle}`;
      }

      if (params.targetHandle) {
        edgeId += `-to_${params.targetHandle}`;
      }
      const newEdge = makeEdge({
        id: edgeId,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      });

      setEdges([...edges, newEdge]);
    },
    [edges, setEdges]
  );
  // Function that when we click on a node, sets that node as the selected node
  const onNodeClick = async (event, node) => {
    setSelectedNode(node);
    setSelectedEdge(null); // Clear selected edge when selecting a node
    // Reset all edge styles when selecting a node
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          strokeWidth: 2,
          stroke: '#ECDFCC',
        },
        markerEnd: {
          ...e.markerEnd,
          color: '#ECDFCC',
        },
      }))
    );

    // Fetch default values and documentation for this node type
    if (node.type && !defaultValues[node.type]) {
      const defaults = await fetchDefaultValues(node.type);
      setDefaultValues(prev => ({ ...prev, [node.type]: defaults }));
    }

    if (node.type && !nodeDocumentation[node.type]) {
      const docs = await fetchNodeDocumentation(node.type);
      setNodeDocumentation(prev => ({ ...prev, [node.type]: docs }));
    }
  };
  // Function that when we click on an edge, sets that edge as the selected edge
  const onEdgeClick = (event, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null); // Clear selected node when selecting an edge
    // Update edge styles to highlight the selected edge
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          strokeWidth: e.id === edge.id ? 3 : 2,
          stroke: e.id === edge.id ? '#ffd700' : '#ECDFCC',
        },
        markerEnd: {
          ...e.markerEnd,
          color: e.id === edge.id ? '#ffd700' : '#ECDFCC',
        },
      }))
    );
  };
  // Function to deselect everything when clicking on the background
  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setMenu(null); // Close context menu when clicking on pane
    // Reset all edge styles when deselecting
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          strokeWidth: 2,
          stroke: '#ECDFCC',
        },
        markerEnd: {
          ...e.markerEnd,
          color: '#ECDFCC',
        },
      }))
    );
  };

  // Function to pop context menu when right-clicking on a node
  const onNodeContextMenu = useCallback(
    (event, node) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // Get the ReactFlow pane's bounding rectangle to calculate relative position
      const pane = ref.current.getBoundingClientRect();

      // Position the context menu directly at the click coordinates relative to the pane
      setMenu({
        id: node.id,
        top: event.clientY - pane.top,
        left: event.clientX - pane.left,
        right: false,
        bottom: false,
      });
    },
    [setMenu],
  );

  // Function to delete the selected node
  const deleteSelectedNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
      );
      setSelectedNode(null);
    }
  };
  // Function to delete the selected edge
  const deleteSelectedEdge = () => {
    if (selectedEdge) {
      setEdges((eds) => {
        const filteredEdges = eds.filter((edge) => edge.id !== selectedEdge.id);
        // Reset styles for remaining edges
        return filteredEdges.map((e) => ({
          ...e,
          style: {
            ...e.style,
            strokeWidth: 2,
            stroke: '#ECDFCC',
          },
          markerEnd: {
            ...e.markerEnd,
            color: '#ECDFCC',
          },
        }));
      });
      setSelectedEdge(null);
    }
  };

  // Function to duplicate a node
  const duplicateNode = useCallback((nodeId, options = {}) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newNodeId = nodeCounter.toString();

    // Calculate position based on source (context menu vs keyboard)
    let position;
    if (options.fromKeyboard) {
      // For keyboard shortcuts, place the duplicate at a more visible offset
      position = {
        x: node.position.x + 100,
        y: node.position.y + 100,
      };
    } else {
      // For context menu, use smaller offset
      position = {
        x: node.position.x + 50,
        y: node.position.y + 50,
      };
    }

    const newNode = {
      ...node,
      selected: false,
      dragging: false,
      id: newNodeId,
      position,
      data: {
        ...node.data,
        label: node.data.label ? node.data.label.replace(node.id, newNodeId) : `${node.type} ${newNodeId}`
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeCounter((count) => count + 1);
    setMenu(null); // Close the context menu
  }, [nodes, nodeCounter, setNodeCounter, setNodes, setMenu]);

  // Keyboard event handler for deleting selected items
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger deletion if user is typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle Ctrl+C (copy)
      if (event.ctrlKey && event.key === 'c' && selectedNode) {
        event.preventDefault();
        setCopiedNode(selectedNode);
        setCopyFeedback(`Copied: ${selectedNode.data.label || selectedNode.id}`);

        // Clear feedback after 2 seconds
        setTimeout(() => {
          setCopyFeedback('');
        }, 2000);

        console.log('Node copied:', selectedNode.id);
        return;
      }

      // Handle Ctrl+V (paste)
      if (event.ctrlKey && event.key === 'v' && copiedNode) {
        event.preventDefault();
        duplicateNode(copiedNode.id, { fromKeyboard: true });
        return;
      }

      // Handle Ctrl+D (duplicate selected node directly)
      if (event.ctrlKey && event.key === 'd' && selectedNode) {
        event.preventDefault();
        duplicateNode(selectedNode.id, { fromKeyboard: true });
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedEdge) {
          deleteSelectedEdge();
        } else if (selectedNode) {
          deleteSelectedNode();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEdge, selectedNode, copiedNode, duplicateNode, setCopyFeedback]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Tab Navigation */}
      <TopBar activeTab={activeTab} setActiveTab={setActiveTab} versionInfo={versionInfo} />

      {/* Graph Editor Tab */}
      {activeTab === 'graph' && (
        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            data-sidebar-state={sidebarVisible ? 'expanded' : 'collapsed'}
            className="sidebar-container"
            style={{
              position: 'relative',
              width: sidebarVisible ? '250px' : '0px',
              height: '100%',
              transition: 'width 0.5s ease',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'fixed',
                left: sidebarVisible ? '0px' : '-250px',
                top: '50px', // Account for top bar height
                width: '250px',
                height: 'calc(100vh - 50px)',
                transition: 'left 0.5s ease',
                zIndex: 10,
                borderRight: '1px solid #ccc',
                backgroundColor: '#1e1e2f'
              }}
            >
              <Sidebar />
            </div>
          </div>

          {/* Main content area that moves with sidebar */}
          <div style={{ position: 'relative', flex: 1, height: '100%' }}>
            <GraphView
              refEl={ref}
              reactFlowWrapperRef={reactFlowWrapper}
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
              menu={menu}
              duplicateNode={duplicateNode}
              copyFeedback={copyFeedback}
              ui={{
                selectedNode, selectedEdge,
                deleteSelectedNode, deleteSelectedEdge,
                saveGraph, loadGraph, resetGraph, saveToPython, runPathsim,
                shareGraphURL,
                dockOpen, setDockOpen, onToggleLogs,
                showKeyboardShortcuts, setShowKeyboardShortcuts,
                sidebarVisible, setSidebarVisible,
              }}
            />

            {/* Log Dock */}
            <LogDock
              open={dockOpen}
              onClose={() => setDockOpen(false)}
              lines={logLines}
              progress={null}
            />

            {/* Node Sidebar */}
            <NodeSidebar
              selectedNode={selectedNode}
              defaultValues={defaultValues}
              setNodes={setNodes}
              setSelectedNode={setSelectedNode}
              isEditingLabel={isEditingLabel}
              setIsEditingLabel={setIsEditingLabel}
              tempLabel={tempLabel}
              setTempLabel={setTempLabel}
              nodeDocumentation={nodeDocumentation}
              isDocumentationExpanded={isDocumentationExpanded}
              setIsDocumentationExpanded={setIsDocumentationExpanded}
            />

            {/* Edge Details */}
            <EdgeDetails
              selectedEdge={selectedEdge}
              onClose={() => setSelectedEdge(null)}
              onDelete={deleteSelectedEdge}
            />
          </div>
        </div>
      )}

      {/* Events tab */}
      {activeTab === 'events' && <EventsTab events={events} setEvents={setEvents} />}

      {/* Solver Parameters Tab */}
      {
        activeTab === 'solver' && (
          <SolverPanel
            solverParams={solverParams}
            setSolverParams={setSolverParams}
            setActiveTab={setActiveTab}
          />
        )
      }

      {/* Global Variables Tab */}
      {
        activeTab === 'globals' && (
          <GlobalVariablesTab
            globalVariables={globalVariables}
            setGlobalVariables={setGlobalVariables}
            setActiveTab={setActiveTab}
            pythonCode={pythonCode}
            setPythonCode={setPythonCode}
          />
        )
      }

      {/* Results Tab */}
      {
        activeTab === 'results' && (
          <ResultsPanel
            simulationResults={simulationResults}
            downloadHtml={downloadHtml}
            downloadCsv={downloadCsv}
          />
        )
      }

      {/* Share URL Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareableURL={shareableURL}
        urlMetadata={urlMetadata}
      />

    </div >
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <DnDFlow />
      </DnDProvider>
    </ReactFlowProvider>
  );
}

