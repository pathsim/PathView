===============================
Installation Guide
===============================

System Requirements
-------------------

Before installing PathView, ensure your system meets the following requirements:

**Required Software:**
   - Node.js 18+ and npm
   - Python 3.8 or higher
   - pip for Python package management
   - Git (for development)


Installation Steps
------------------

1. **Clone the Repository**
   
   .. code-block:: bash

      git clone https://github.com/festim-dev/pathview.git
      cd pathview

2. **Install Frontend Dependencies**
   
   .. code-block:: bash
   
      npm install

3. **Set Up Python Environment**
   
   We recommend using a virtual environment:
   
   .. code-block:: bash
   
      # Create virtual environment
      python -m venv venv
      
      # Activate virtual environment
      # On Linux/macOS:
      source venv/bin/activate
      
      # On Windows:
      venv\Scripts\activate
   
   Alternatively, you can use Conda:

   .. code-block:: bash

      conda create -n pathview python=3.8
      conda activate pathview
      pip install --upgrade pip
      pip install -e .
   
4. **Install Backend Dependencies**
   
   .. code-block:: bash
   
      pip install -r requirements.txt

5. **Verify Installation**
   
   .. code-block:: bash
   
      # Run both frontend and backend
      npm run start:both

   The application should be available at:

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
