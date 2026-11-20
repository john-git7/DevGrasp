import { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import RepoModal from '../components/RepoModal';
import WorkspaceModal from '../components/WorkspaceModal';
import SettingsModal from '../components/SettingsModal';
import api from '../lib/api';
import { AuthContext } from '../context/AuthContext';
import { useVoice } from '../hooks/useVoice';
import { useConversations } from '../hooks/useConversations';
import { useRepos } from '../hooks/useRepos';
import { useChat } from '../hooks/useChat';

export default function ChatApp() {
  const { logout } = useContext(AuthContext);

  // Modal & File Viewer State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);

  // 1. Conversations Hook
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    fetchConversations,
    loadConversation,
    deleteConversation,
    startNewChat,
  } = useConversations();

  // 2. Repositories Hook
  const {
    repoUrl,
    setRepoUrl,
    isIndexing,
    indexProgress,
    indexedRepos,
    selectedRepo,
    setSelectedRepo,
    indexError,
    setIndexError,
    isSkippingFile,
    repoAnalysis,
    pauseIndexing,
    skipCurrentFile,
    deleteWorkspace,
    analyzeRepo,
    indexRepo,
  } = useRepos('gemini-embedding-2');

  // 3. Chat State Hook
  const {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    isBugTraceMode,
    setIsBugTraceMode,
    chatModel,
    setChatModel,
    embeddingModel,
    setEmbeddingModel,
    openPRs,
    selectedPR,
    setSelectedPR,
    messagesEndRef,
    fetchPRs,
    sendMessage,
    handleEditMessage,
    handleRetryMessage,
    generateOnboarding,
    generateTechDebt,
    generateCommitStory,
  } = useChat(selectedRepo, currentConversationId, (id) => {
    setCurrentConversationId(id);
    if (selectedRepo) fetchConversations(selectedRepo);
  });

  // 4. Voice Input Hook
  const { isListening, toggleListening } = useVoice(setInput, input);

  // Prevent accidental refresh while indexing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isIndexing) {
        e.preventDefault();
        const msg = 'Indexing is in progress. Are you sure you want to leave?';
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isIndexing]);

  // Sync conversations and PRs on repo selection
  useEffect(() => {
    if (selectedRepo) {
      fetchConversations(selectedRepo);
      fetchPRs(selectedRepo);
      setCurrentConversationId(null);
      setMessages([]);
      setSelectedPR(null);
    } else {
      setSelectedPR(null);
    }
  }, [selectedRepo, fetchConversations, fetchPRs, setCurrentConversationId, setMessages, setSelectedPR]);

  // Handle citation click to show file content
  const handleCitationClick = useCallback(async (filePath: string) => {
    if (!selectedRepo) return;
    setIsFileLoading(true);
    setViewingFile({ path: filePath, content: '' });
    try {
      const res = await api.get(`/api/repos/file?repoUrl=${encodeURIComponent(selectedRepo)}&filePath=${encodeURIComponent(filePath)}`);
      if (res.status === 200) {
        setViewingFile({ path: filePath, content: res.data.content });
      } else {
        setViewingFile({ path: filePath, content: 'Error loading file content.' });
      }
    } catch (err) {
      console.error(err);
      setViewingFile({ path: filePath, content: 'Network error while loading file.' });
    } finally {
      setIsFileLoading(false);
    }
  }, [selectedRepo]);

  // Handle loading a previous conversation and displaying its messages
  const handleLoadConversation = useCallback((convoId: string) => {
    loadConversation(convoId, (msgs) => setMessages(msgs));
    setIsHistoryOpen(false);
    setIsWorkspaceModalOpen(false);
  }, [loadConversation, setMessages]);

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--color-apple-bg)] text-zinc-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[var(--color-apple-border)] flex items-center justify-between px-4 sm:px-6 bg-[var(--color-apple-bg)]/80 backdrop-blur-xl sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
          <div className="w-15 h-15 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-transparent group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="DevGrasp Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-apple-text)] tracking-tight hidden sm:block group-hover:text-[var(--color-apple-blue)] transition-colors">
            DevGrasp
          </h1>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] px-2.5 sm:px-4 py-2 rounded-full text-xs font-semibold text-[var(--color-apple-text)] transition-colors"
              title="Settings"
            >
              <span>⚙️</span>
              <span className="hidden md:inline">Settings</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 sm:gap-2 bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] px-2.5 sm:px-4 py-2 rounded-full text-xs font-semibold text-red-500 transition-colors"
              title="Log out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="hidden md:inline">Log out</span>
            </button>
          </div>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className={`flex items-center gap-1.5 sm:gap-2 bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] px-2.5 sm:px-4 py-2 rounded-full text-xs font-semibold text-[var(--color-apple-text)] transition-colors ${isHistoryOpen ? 'border-[var(--color-apple-blue)] text-[var(--color-apple-blue)]' : ''}`}
            title="Chat History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">History</span>
            {conversations.length > 0 && (
              <span className="bg-[var(--color-apple-blue)] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {conversations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsWorkspaceModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[var(--color-apple-bg)] text-[var(--color-apple-text)] hover:bg-[var(--color-apple-bg)]/80 border border-[var(--color-apple-border)] transition-colors text-xs sm:text-sm font-bold truncate max-w-[140px] sm:max-w-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="truncate hidden sm:inline">Workspace {selectedRepo ? `(${selectedRepo.split('/').slice(-2).join('/')})` : ''}</span>
            <span className="truncate sm:hidden">{selectedRepo ? selectedRepo.split('/').slice(-2).join('/') : 'Workspace'}</span>
          </button>
          
          <button
            onClick={() => setIsRepoModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[var(--color-apple-blue)] text-[var(--color-apple-bg)] hover:bg-[var(--color-apple-blue)]/90 transition-colors text-xs sm:text-sm font-bold flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">Add Repo</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <RepoModal 
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        analyzeRepo={analyzeRepo}
        repoAnalysis={repoAnalysis}
        indexRepo={(e, targetUrl, exclusions) => indexRepo(e, targetUrl, exclusions, () => setIsRepoModalOpen(false))}
        isIndexing={isIndexing}
        indexProgress={indexProgress}
        pauseIndexing={pauseIndexing}
        skipCurrentFile={skipCurrentFile}
        isSkippingFile={isSkippingFile}
        indexedRepos={indexedRepos}
        indexError={indexError}
        setIndexError={setIndexError}
        deleteWorkspace={deleteWorkspace}
      />
      
      <WorkspaceModal 
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        indexedRepos={indexedRepos.filter(r => typeof r === 'string' || r.status === 'complete')}
        selectedRepo={selectedRepo}
        setSelectedRepo={setSelectedRepo}
        startNewChat={() => startNewChat(() => setMessages([]))}
        generateOnboarding={generateOnboarding}
        generateTechDebt={generateTechDebt}
        generateCommitStory={generateCommitStory}
        conversations={conversations}
        currentConversationId={currentConversationId}
        loadConversation={handleLoadConversation}
        deleteConversation={(id, e) => deleteConversation(id, e, () => setMessages([]))}
        openPRs={openPRs}
        setSelectedPR={setSelectedPR}
        selectedPR={selectedPR}
        deleteWorkspace={(url) => deleteWorkspace(url, () => setMessages([]))}
      />

      {/* History Slide-over Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsHistoryOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-[var(--color-apple-bg)] border-l border-[var(--color-apple-border)] h-full z-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[var(--color-apple-border)] flex items-center justify-between bg-[var(--color-apple-glass)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--color-apple-text)] flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-[var(--color-apple-blue)]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Chat History
                </h3>
                <p className="text-xs text-[var(--color-apple-text-muted)] truncate max-w-[220px]">
                  {selectedRepo ? selectedRepo.split('/').slice(-2).join('/') : 'No workspace selected'}
                </p>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-apple-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Action: New Chat */}
            <div className="p-3 border-b border-[var(--color-apple-border)]/50">
              <button
                onClick={() => {
                  startNewChat(() => setMessages([]));
                  setIsHistoryOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue-hover)] text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Start New Chat
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {!selectedRepo ? (
                <div className="p-8 text-center text-xs text-[var(--color-apple-text-muted)]">
                  Please select a workspace to view chat history.
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-apple-text-muted)] flex flex-col items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 opacity-40">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <span>No previous chats yet.</span>
                  <span>Ask a question in chat to start one!</span>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = currentConversationId === conv._id;
                  return (
                    <div
                      key={conv._id}
                      className={`flex items-center justify-between p-3 rounded-xl text-xs transition-all group ${
                        isActive
                          ? 'bg-[var(--color-apple-blue)]/20 border border-[var(--color-apple-blue)]/40 text-[var(--color-apple-text)]'
                          : 'bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] text-[var(--color-apple-text)]'
                      }`}
                    >
                      <button
                        onClick={() => handleLoadConversation(conv._id)}
                        className="flex-1 text-left truncate pr-2"
                        title={conv.title}
                      >
                        <div className="font-semibold truncate mb-1">{conv.title || 'Untitled Conversation'}</div>
                        <div className="text-[11px] text-[var(--color-apple-text-muted)]">
                          {new Date(conv.createdAt).toLocaleDateString()} &middot; {new Date(conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </button>
                      <button
                        onClick={(e) => deleteConversation(conv._id, e, () => {
                          if (currentConversationId === conv._id) setMessages([]);
                        })}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-apple-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete chat"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl h-[85vh] max-h-[800px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#121214]">
              <div className="flex items-center gap-3 truncate">
                <svg className="w-5 h-5 text-[#0a84ff] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-mono text-sm text-zinc-200 truncate">{viewingFile.path}</h3>
              </div>
              <button 
                onClick={() => setViewingFile(null)}
                className="text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-md p-1.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[#09090b]">
              {isFileLoading && !viewingFile.content ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <span className="inline-flex space-x-1 items-center animate-pulse">
                    <span className="h-2 w-2 bg-[#0a84ff] rounded-full"></span>
                    <span className="h-2 w-2 bg-[#0a84ff] rounded-full"></span>
                    <span className="h-2 w-2 bg-[#0a84ff] rounded-full"></span>
                  </span>
                  <p className="mt-4 text-xs font-medium">Loading file...</p>
                </div>
              ) : (
                <pre className="text-[13px] font-mono text-zinc-300 whitespace-pre-wrap font-medium">
                  <code>{viewingFile.content}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden w-full max-w-full">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 pt-6 relative z-10">
          <div className="max-w-[780px] mx-auto w-full flex flex-col gap-4 min-h-full">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-start justify-center max-w-2xl mx-auto space-y-6 min-h-[60vh] px-4">
                <h2 className="text-2xl font-bold text-[var(--color-apple-text)] tracking-tight">Welcome to DevGrasp</h2>
                <div className="space-y-4 text-[13px] sm:text-sm text-[var(--color-apple-text)]/70 font-medium">
                  <p>A contextual coding environment connected directly to your repositories.</p>
                  <div className="mt-6">
                    <h3 className="font-bold text-[var(--color-apple-text)] mb-2">Getting Started</h3>
                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                      <li>Add a GitHub repository URL using the Add Repo button.</li>
                      <li>Select your workspace to load the codebase context.</li>
                      <li>Ask questions, debug issues, or generate code in the chat below.</li>
                    </ul>
                  </div>
                  <div className="mt-6">
                    <h3 className="font-bold text-[var(--color-apple-text)] mb-2">Capabilities</h3>
                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                      <li>Vector-based context retrieval with AST token slicing</li>
                      <li>Interactive Pull Request reviews with diff analysis</li>
                      <li>Automated codebase onboarding guides</li>
                      <li>Architecture and tech debt assessment</li>
                      <li>Historical commit story narrative generation</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <ChatMessage 
                key={index} 
                content={msg.content} 
                role={msg.role} 
                status={msg.status}
                warning={msg.warning}
                onCitationClick={handleCitationClick}
                onEdit={(newContent) => handleEditMessage(index, newContent)}
                onRetry={() => handleRetryMessage(index)}
                isLatest={index === messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="flex-shrink-0 w-full px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4 z-20 flex flex-col items-center gap-3 border-t border-[var(--color-apple-border)] bg-[var(--color-apple-glass)]">
          {/* PR Context Banner */}
          {selectedPR && (
            <div className="max-w-2xl w-full flex items-center justify-between px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-in slide-in-from-bottom-2 fade-in">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span className="text-xs font-medium text-amber-300">
                  <span className="font-bold">PR Review Mode:</span> #{selectedPR.number} - {selectedPR.title}
                </span>
              </div>
              <button
                onClick={() => setSelectedPR(null)}
                className="text-amber-400/70 hover:text-amber-400 p-1 hover:bg-amber-400/10 rounded-md transition-colors"
                title="Exit PR Mode"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <form 
            onSubmit={sendMessage}
            className={`max-w-2xl w-full relative flex items-center apple-glass-pill rounded-2xl md:rounded-3xl pointer-events-auto transition-all focus-within:border-[var(--color-apple-text)] ${!selectedRepo ? 'opacity-60 grayscale-[50%]' : ''}`}
          >
            <div className="flex items-center pl-1 md:pl-2 pr-1 md:pr-2">
              <button
                type="button"
                onClick={toggleListening}
                disabled={!selectedRepo}
                title={!selectedRepo ? 'Select a workspace first' : 'Voice input'}
                className={`p-1.5 md:p-2 rounded-full transition-colors ${!selectedRepo ? 'opacity-50 cursor-not-allowed text-[var(--color-apple-text)]/30' : isListening ? 'text-rose-400 bg-rose-400/20' : 'text-[var(--color-apple-text)]/50 hover:text-[var(--color-apple-text)] hover:bg-[var(--color-apple-blue)]/20'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-5 md:h-5">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setIsBugTraceMode(!isBugTraceMode)}
                disabled={!selectedRepo}
                title={!selectedRepo ? 'Select a workspace first' : 'Bug Context Tracer Mode'}
                className={`p-1.5 md:p-2 rounded-full transition-colors ${!selectedRepo ? 'opacity-50 cursor-not-allowed text-[var(--color-apple-text)]/30' : isBugTraceMode ? 'text-[var(--color-apple-blue)] bg-[var(--color-apple-blue)]/20' : 'text-[var(--color-apple-text)]/50 hover:text-[var(--color-apple-text)] hover:bg-[var(--color-apple-blue)]/20'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-5 md:h-5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {isBugTraceMode ? (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading || !selectedRepo}
                placeholder={!selectedRepo ? 'Select a workspace to start chatting...' : 'Paste your stack trace or error log here to trace the bug...'}
                rows={2}
                className="flex-1 bg-transparent py-2.5 px-2 focus:outline-none text-[var(--color-apple-text)] placeholder-[var(--color-apple-text)]/50 text-sm font-medium resize-none min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
            ) : (
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading || !selectedRepo}
                placeholder={!selectedRepo ? 'Select a workspace to start chatting...' : isListening ? 'Listening...' : 'Message DevGrasp...'}
                className="flex-1 bg-transparent py-3.5 px-2 focus:outline-none text-[var(--color-apple-text)] placeholder-[var(--color-apple-text)]/50 text-sm font-medium"
              />
            )}

            <div className="pr-2 pl-2">
              <button 
                type="submit"
                disabled={isLoading || !input.trim() || !selectedRepo}
                title={!selectedRepo ? 'Select a workspace first' : 'Send message'}
                className="p-2 rounded-2xl bg-[var(--color-apple-blue)] text-[var(--color-apple-bg)] hover:bg-[var(--color-apple-text)] disabled:bg-[var(--color-apple-blue)]/30 disabled:text-[var(--color-apple-text)]/30 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </div>
          </form>
          
          <div className="text-center mt-1 text-[10px] text-zinc-500 pointer-events-auto">
            DevGrasp can make mistakes. Please verify important code.
          </div>
        </div>
      </main>
      
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        chatModel={chatModel}
        setChatModel={setChatModel}
        embeddingModel={embeddingModel}
        setEmbeddingModel={setEmbeddingModel}
      />
    </div>
  );
}
