# PathView
An interactive visual tool built with React Flow and a python (Flask) backend for system modelling using PathSim.

# Required Installations
Make sure the following are installed on your system:
- Node.js + npm
- Python 3.8+
- pip for Python package management

# Project Structure
```bash
pathview/

├── package.json          # Frontend (React) dependencies

├── requirements.txt      # Backend dependencies

├── src/

│   ├── backend.py        # Python backend API

│   ├── components/       # JSx components

│   ├── python/           # python package source

│   ├── main.jsx

│   ├── App.jsx           # main App

│   ├── nodeConfig.js     # file to configure all the nodes

```

# Installation and Setup
Once in the directory, install frontend and backend dependencies:

Front end
```bash
npm install
```
Back end

Recommend setting up a virtual environment. Proceed as follows:
```bash
cd src
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt  # install the web app requirements (eg. Flask)
pip install -e .[dev]  # install the python module containing pathsim utils
```
# Running Application
You can run both frontend and backend at once
```
npm run start:both
```
This will:
- Start the React frontend at http://localhost:5173
- Start the Flask backend at http://localhost:8000

If you are working on one side, you can also run the following commands for front end and back end respectively:
```
npm run dev
```
```
npm run start:backend
```


# Building the documentation

The project uses Sphinx to generate documentation from the reStructuredText files in the `docs/` directory.

## Prerequisites
Make sure you have Sphinx installed:
```bash
pip install sphinx sphinx-book-theme
```

## Building HTML Documentation
To build the HTML documentation:
```bash
cd docs
make html
```

The generated documentation will be available in `docs/_build/html/index.html`.

## Viewing the Documentation
After building, you can view the documentation by opening `docs/_build/html/index.html` in your web browser, or serve it locally:
```bash
# From the docs/_build/html directory
python -m http.server 8080
```
Then visit http://localhost:8080 in your browser.


