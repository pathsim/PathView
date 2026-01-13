// Functions for managing global variables
const isValidPythonIdentifier = (name) => {
    // Check if name is empty
    if (!name) return false;

    // Python identifier rules:
    // - Must start with letter or underscore
    // - Can contain letters, digits, underscores
    // - Cannot be a Python keyword
    const pythonKeywords = [
        'False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue',
        'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
        'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
        'raise', 'return', 'try', 'while', 'with', 'yield'
    ];

    // Check if it's a keyword
    if (pythonKeywords.includes(name)) return false;

    // Check pattern: must start with letter or underscore, followed by letters, digits, or underscores
    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return pattern.test(name);
};

export { isValidPythonIdentifier };