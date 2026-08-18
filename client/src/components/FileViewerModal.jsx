import React, { useState, useEffect } from 'react';
import api from '../lib/api';

const FileViewerModal = ({ isOpen, onClose, filePath, repoUrl }) => {
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 

    useEffect(() => {
        if (isOpen && filePath && repoUrl) {
            const fetchFileContent = async () => {
                setLoading(true);
                setError(null);
                try {
                    const response = await api.get('/api/repos/file', { 
                        params: { repoUrl, filePath } 
                    });
                    setFileContent(response.data.content);
                } catch (err) {
                    setError(err.response?.data?.error || err.message);
                }       
                setLoading(false);
            };  
            fetchFileContent();
        }
    }, [isOpen, filePath, repoUrl]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="apple-modal-backdrop absolute inset-0" onClick={onClose}></div>
            <div className="relative w-full max-w-6xl apple-glass-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-[var(--color-apple-glass)]">
                    <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans flex items-center gap-2">
                        Viewing: {filePath}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-[var(--color-apple-text)]/70 hover:text-[var(--color-apple-text)] transition-colors p-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col p-6 overflow-y-auto max-h-[80vh] no-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-apple-blue)]"></div>
                        </div>
                    ) : error ? (
                        <div className="text-red-500 text-center font-medium bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</div>
                    ) : (       
                        <pre className="bg-[#1e1e1e] text-gray-200 p-6 rounded-xl overflow-auto text-sm font-mono shadow-inner border border-gray-700">
                            <code>{fileContent}</code>
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileViewerModal;