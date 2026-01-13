import '../styles/App.css';

const TABS = [
    { id: 'graph', label: 'Graph Editor' },
    { id: 'events', label: 'Events' },
    { id: 'solver', label: 'Solver Parameters' },
    { id: 'globals', label: 'Global Variables' },
    { id: 'results', label: 'Results' },
];

export default function TopBar({ activeTab, setActiveTab, versionInfo }) {
    return (
        <div className="top-bar">
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <h1 style={{ color: '#fff', margin: '0 20px 0 15px', fontSize: 20, fontWeight: 'bold' }}>PathView</h1>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.label}
                    </button>

                ))}
            </div>

            <HeaderActions versionInfo={versionInfo} />
        </div>
    );
}

function HeaderActions({ versionInfo }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* GitHubLink */}
            <a
                href="https://github.com/festim-dev/pathview"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    padding: '8px',
                    backgroundColor: '#000000ff',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(36, 41, 46, 0.3)',
                    textDecoration: 'none',
                    // border: '1px solid #ffffff',
                }}
                onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#1b1f23';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(36, 41, 46, 0.4)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#000000ff';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 6px rgba(36, 41, 46, 0.3)';
                }}
                title="View on GitHub"
            >
                <svg
                    width="24"
                    height="24"
                    fill="#ffffff"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
            </a>
            {/* HelpButton */}
            <button
                style={{
                    padding: '8px 12px',
                    backgroundColor: '#4A90E2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: '600',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(74, 144, 226, 0.3)',
                }}
                onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#357ABD';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.4)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#4A90E2';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 6px rgba(74, 144, 226, 0.3)';
                }}
                onClick={() => {
                    // Display version information and help
                    const pathsimVersion = versionInfo?.pathsim_version || 'Loading...';
                    const fcsVersion = versionInfo?.pathview_version || 'Loading...';

                    const message = `Version Information:\n` +
                        `• PathSim: ${pathsimVersion}\n` +
                        `• PathView: ${fcsVersion}\n\n`;

                    // Open the documentation URL in a new tab
                    window.open('https://festim-dev.github.io/PathView/usage.html', '_blank');

                    alert(message);
                }}
                title="Get help, documentation, and version information"
            >
                ?
            </button>
        </div>
    );
}