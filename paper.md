---
title: 'PathView: A Graphical User Interface for System Simulation'
tags:
  - Python
  - block diagram
  - system modelling
authors:
  - name: Remi Delaporte-Mathurin
    orcid: 0000-0003-1064-8882
    corresponding: true
    affiliation: 1
  - name: Tasnim Zulfiqar
    affiliation: 1
  - name: James Dark
    orcid: 0000-0002-0456-7210
    affiliation: 1
affiliations:
 - name: Plasma Science and Fusion Center, Massachusetts Institute of Technology, Cambridge, 02139, USA
   index: 1
   ror: 042nb2s44
date: 12 August 2025
bibliography: paper.bib

---

# Summary

`PathView` is an interactive, browser-based graphical interface for the system simulation framework `PathSim` [@Rother2025]. It enables users to build models quickly in an intuitive, visual environment. Built with `ReactFlow` [@reactflow], `PathView` allows users to:

- Drag and drop simulation nodes onto a canvas.
- Connect nodes to define system structure.
- Create and manage subsystems for hierarchical modelling.
- Configure event detection and advanced simulation options.
- Configure solver parameters
- Easily extend functionality through a modular architecture.

In addition to mirroring nearly all of `PathSim`'s capabilities, `PathView` uses `Jinja2` [@jinja] templates to generate fully executable Python scripts from graphical models, enabling seamless transition between GUI-based and code-based workflows.

# Statement of need

`PathSim` is a powerful and flexible simulation framework for modelling complex systems. However, building large-scale or intricate models solely through Python scripting can be cumbersome and error-prone, particularly for new users or for projects that benefit from visual inspection of system layout. This is for example the case for nuclear fusion fuel cycle applications [@meschini_modeling_2023; @meschini_impact_2025].
Many established simulation platforms, such as MathWorks Simulink [@simulink] or Aspen Plus [@aspen], provide graphical user interfaces to enhance usability, model comprehension, and collaboration. Until now, such a visual modelling environment was missing for `PathSim`.
`PathView` fills this gap by providing a modern, interactive, and extensible GUI, reducing the barrier to entry for new users and improving productivity for experienced modellers.

# Examples

`PathView` includes several pre-built example graphs in the [example_graphs](https://github.com/festim-dev/pathview/tree/main/example_graphs) directory that demonstrate different functionalities:
   
- ``harmonic_oscillator.json`` - Simple oscillator simulation (see \autoref{fig:example} and \autoref{fig:example_results})
- ``pid.json`` - PID controller example
- ``linear_feedback.json`` - Linear feedback system
- ``pendulum.json`` - Pendulum example
- ``spectrum.json`` - Spectral analysis example
- ``bouncing_ball.json`` - Example showcasing event detection
- ``thermostat.json`` - Thermostat demo with event detection
- ``stick_slip.json`` - Example showcasing the use of the ``Switch`` block

![Graph editor tab (harmonic oscillator demo).\label{fig:example}](example.png){ width=100% }

![Results tab with interactive graph (harmonic oscillator demo).\label{fig:example_results}](example_results.png){ width=100% }

We also provide an example demonstrating the integration of external tools in``festim_two_walls.json``: a two-wall hydrogen diffusion model integrating the FESTIM hydrogen tranport code [@delaporte-mathurin_festim_2024].

# Features

- **Node creation and connection**: Choose from 60+ different simulation node types, configure parameters, and connect them visually.
- **Integrated simulation**: Run `PathSim` simulations directly from the GUI.
- **Interactive visualisation**: Embedded `plotly` plots for interactive data exploration. Export results data to CSV or export graph to HTML.
- **Advanced global variables**: Define global variables, including via an integrated Python editor for complex expressions.
- **Flexible I/O**: Save and load models in JSON format; export to Python scripts for advanced or automated use.
- **Modular and extensible**: Designed for easy integration of new node types and custom functionality.
- **Custom styling**: Change node colours for improved readability.


# References