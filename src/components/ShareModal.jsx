import React, { useState, useEffect } from 'react';

const ShareModal = ({ isOpen, onClose, shareableURL, urlMetadata }) => {
    const [copyFeedback, setCopyFeedback] = useState('');

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareableURL);
            setCopyFeedback('Copied!');
        } catch (error) {
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = shareableURL;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopyFeedback('Copied!');
            } catch (fallbackError) {
                setCopyFeedback('Failed to copy');
            }
        }

        // Clear feedback after 2 seconds
        setTimeout(() => setCopyFeedback(''), 2000);
    };

    // Reset feedback when modal opens
    useEffect(() => {
        if (isOpen) {
            setCopyFeedback('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isLongURL = urlMetadata && !urlMetadata.isSafe;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: 8,
                    padding: 24,
                    maxWidth: 500,
                    width: '90%',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: 'none',
                        border: 'none',
                        fontSize: 18,
                        cursor: 'pointer',
                        color: '#666',
                        padding: 4,
                    }}
                >
                    ×
                </button>

                {/* Header */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>🔗</span>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                            Share Your Patterns
                        </h3>
                    </div>
                    <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                        Copy this URL to share your workflow with others.
                    </p>

                    {/* URL Length Warning */}
                    {isLongURL && (
                        <div style={{
                            marginTop: 12,
                            padding: '8px 12px',
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffeeba',
                            borderRadius: 4,
                            fontSize: 13
                        }}>
                            <div style={{ color: '#856404', fontWeight: 500, marginBottom: 4 }}>
                                ⚠️ Large URL Warning
                            </div>
                            <div style={{ color: '#856404' }}>
                                This URL is {urlMetadata?.length || 0} characters long. Some servers may reject URLs longer than {urlMetadata?.maxLength || 4000} characters. Consider using the "Save File" option for complex graphs.
                            </div>
                        </div>
                    )}
                </div>

                {/* URL input and copy button */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="text"
                        value={shareableURL}
                        readOnly
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            fontSize: 14,
                            backgroundColor: '#f9f9f9',
                            color: '#333',
                        }}
                        onClick={(e) => e.target.select()}
                    />
                    <button
                        onClick={handleCopy}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: copyFeedback === 'Copied!' ? '#27ae60' : '#4A90E2',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 500,
                            minWidth: 60,
                            transition: 'background-color 0.2s',
                        }}
                    >
                        {copyFeedback || 'Copy'}
                    </button>
                </div>

                {/* Additional info */}
                <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                    <p style={{ margin: 0 }}>
                        This URL contains your complete graph configuration including nodes, connections, parameters, and code.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
