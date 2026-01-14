# Imports Summary
### For the purpose of better understanding the project and isolating that functionality which will be attributed to a Flask backend, I commented these imports and split them up

This is a page that quickly runs through the top level imports in the root Svelte page for PathView
For this purpose of implementing backend functionality that provides an alternative to Pyodide the most relevant

#### **Svelte Default Imports** *(irrelevant to backend)*  
Simple packages imported from Svelte for the purpose of transition animations and other native tools

#### **Svelte Component Imports** *(irrelevant to backend)*  
These are the custom UI Components that are rendered on the home page

#### **Store (and Registry) Imports** *(possibly relevant to backend?)*  
From what I can see these stores help organize the data organization of multiple data structures whether that includes core data structures like graphs and events or abitrary. Core to all of this functionality is the Svelte writable 

#### **Pyodide and Python Functionality Imports** *(relevant to backend)*
These are the functions and data structures that setup pyodide's client-side web assembly and run the two functions ```runGraphStreamingSImulation``` and ```validateGraphSimulation```. The goal of the Flask backend will be to provide a Flask alternative to these Pyodide functions

#### **Miscellaneous Imports** *(irrelevant to backend)*
There are other imports such as imports that handle console specific settings and actions, constants, type imports, and other 