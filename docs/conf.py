# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "PathView"
copyright = "2025, Tasnim Zulfiqar, James Dark, Remi Delaporte-Mathurin"
author = "Tasnim Zulfiqar, James Dark, Remi Delaporte-Mathurin"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = []

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "sphinx_book_theme"
html_static_path = ["_static"]

html_theme_options = {
    "repository_url": "https://github.com/festim-dev/PathView",
    "use_repository_button": True,
    "use_edit_page_button": True,
    "repository_branch": "main",
    "path_to_docs": "./docs",
    "icon_links": [
        {
            "name": "GitHub Discussions",
            "url": "https://github.com/festim-dev/pathview/discussions",
            "icon": "fa-solid fa-comments",
        },
        {
            "name": "Slack",
            "url": "https://join.slack.com/t/festim-dev/shared_invite/zt-246hw8d6o-htWASLsbdosUo_2nRKCf9g",
            "icon": "fa-brands fa-slack",
        },
    ],
    "article_header_end": [
        "navbar-icon-links",
        "article-header-buttons",
    ],
}

html_sidebars = {
    "**": [
        "navbar-logo",
        "search-button-field",
        "sbt-sidebar-nav",
    ],
}

html_title = "PathView Documentation"
