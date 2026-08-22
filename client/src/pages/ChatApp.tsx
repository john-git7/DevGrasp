import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import RepoModal from '../components/RepoModal';
import WorkspaceModal from '../components/WorkspaceModal';
import FileViewerModal from '../components/FileViewerModal';
import SettingsModal from '../components/SettingsModal';
import { streamSSE } from '../utils/streamSSE';
import api from '../lib/api';
import { AuthContext } from '../context/AuthContext';

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(null);
  const [indexedRepos, setIndexedRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isBugTraceMode, setIsBugTraceMode] = useState(false);
  const [indexError, setIndexError] = useState(null);
  const [isSkippingFile, setIsSkippingFile] = useState(false);
  
  // Model Settings State
  const [chatModel, setChatModel] = useState(() => {
    const saved = localStorage.getItem('chatModel');
    if (!saved || saved.includes('1.5')) return 'gemini-3.5-flash';
    return saved;
  });
  const [embeddingModel, setEmbeddingModel] = useState(() => {
    const saved = localStorage.getItem('embeddingModel');
    if (!saved || saved === 'text-embedding-004') return 'gemini-embedding-2';
    return saved;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repoAnalysis, setRepoAnalysis] = useState(null);

  useEffect(() => { localStorage.setItem('chatModel', chatModel); }, [chatModel]);
  useEffect(() => { localStorage.setItem('embeddingModel', embeddingModel); }, [embeddingModel]);

  // Prevent accidental refresh while indexing
  useEffect(() => {
    const handleBeforeUnload = (e) => {
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

  // Chat History State
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isConversationsExpanded, setIsConversationsExpanded] = useState({});
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const { logout } = useContext(AuthContext);
  const [viewingFile, setViewingFile] = useState(null);
  
  // Real-time usage tracking
  // usageStatus state removed as it was unused
  const [isFileLoading, setIsFileLoading] = useState(false);
  
  // PR State
  const [openPRs, setOpenPRs] = useState({}); // { repoUrl: [pr1, pr2] }
  const [selectedPR, setSelectedPR] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };
  
  // Intelligent auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Voice Recognition Setup
  const speechRecognitionRef = useRef(null);
  const baselineInputRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const sr = new SR();
    sr.continuous = true;
    sr.interimResults = true;
    
    sr.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInput(baselineInputRef.current + (baselineInputRef.current ? ' ' : '') + currentTranscript);
    };
    
    sr.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    
    sr.onend = () => {
      setIsListening(false);
    };
    
    speechRecognitionRef.current = sr;
  }, []); // runs once

  const toggleListening = () => {
    const sr = speechRecognitionRef.current;
    if (!sr) return alert("Voice input is not supported in this browser (try Chrome/Edge).");
    
    if (isListening) {
      sr.stop();
      setIsListening(false);
    } else {
      try {
        baselineInputRef.current = input;
        sr.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        // If it's already started, just ignore the error.
      }
    }
  };


  // Fetch indexed repos
  const fetchIndexedRepos = async () => {
    try {
      const res = await api.get('/api/repos/indexed');
      if (res.status === 200) {
        const data = res.data;
        setIndexedRepos(data);
      }
    } catch (err) {
      console.error("Failed to fetch indexed repos", err);
    }
  };

  useEffect(() => { 
    fetchIndexedRepos(); 
    
    // Poll for API usage metrics every 3 seconds
    const fetchUsage = async () => {
      try {
        const res = await api.get('/api/status/usage');
        if (res.status === 200) {
          // const data = res.data;
          // usageStatus was removed
        }
      } catch {
        // fail silently
      }
    };
    fetchUsage();
    const usageInterval = setInterval(fetchUsage, 3000);
    return () => clearInterval(usageInterval);
  }, []);

  const pauseIndexing = async (url) => {
    try {
      await api.post('/api/repos/pause', { url });
      setIsIndexing(false);
      fetchIndexedRepos();
    } catch (e) {
      console.error('Failed to pause indexing', e);
    }
  };

  const skipCurrentFile = async (url, filePath) => {
    setIsSkippingFile(true);
    try {
      await api.post('/api/repos/skip-file', { url, filePath });
      // Instant UI response - show "Skipping..." inside the progress text
      setIndexProgress(prev => prev ? { ...prev, isWaiting: false, message: 'Skipping file...' } : null);
    } catch (e) {
      console.error('Failed to skip file', e);
      alert('Failed to skip file: ' + (e.response?.data?.error || e.message));
    } finally {
      setIsSkippingFile(false);
    }
  };

  const deleteWorkspace = async (url) => {
    if (!window.confirm("Are you sure you want to completely delete this workspace and all its data?")) return;
    try {
      const res = await api.delete('/api/repos/delete', { data: { url } });
      if (res.status === 200) {
        if (selectedRepo === url) {
          setSelectedRepo(null);
          setMessages([]);
        }
        fetchIndexedRepos();
      } else {
        alert("Failed to delete workspace");
      }
    } catch (e) {
      console.error('Failed to delete workspace', e);
    }
  };

  const analyzeRepo = async (e, targetUrl = null) => {
    if(e) e.preventDefault();
    const urlToAnalyze = targetUrl || repoUrl;
    if (!urlToAnalyze) return;
    
    setIsIndexing(true);
    setIndexProgress({ status: 'fetching', repoUrl: urlToAnalyze });
    setIndexError(null);
    setRepoAnalysis(null);

    try {
      const response = await api.post('/api/repos/analyze', { url: urlToAnalyze });
      
      if (response.status !== 200) {
        throw new Error('Failed to analyze repository');
      }

      const analysis = response.data;
      setRepoAnalysis(analysis);
      setIsIndexing(false);
      setIndexProgress(null);
    } catch (e) {
      console.error('Failed to analyze repository', e);
      setIndexError(e.message || 'Failed to analyze repository');
      setIsIndexing(false);
      setIndexProgress(null);
    }
  };

  const indexRepo = async (e, targetUrl = null, excludedExtensions = null) => {
    if(e) e.preventDefault();
    const urlToIndex = targetUrl || repoUrl;
    if (!urlToIndex) return;
    
    setRepoAnalysis(null); // Clear analysis modal
    setIsIndexing(true);
    setIndexProgress({ status: 'starting', repoUrl: urlToIndex });
    setIndexError(null);
    try {
      const payload: any = { url: urlToIndex, embeddingModel };
      if (excludedExtensions !== null) {
        payload.excludedExtensions = excludedExtensions;
      }
      
      // Fire-and-forget: start the job and get immediate 200 OK
      const response = await api.post('/api/repos/index', payload);
      
      if (response.status !== 200) {
        const errData = response.data || {};
        throw new Error(errData.error || 'Failed to start indexing');
      }

      // Poll /api/repos/status every 2 seconds for live progress
      const poll = async () => {
        try {
          const statusRes = await api.get(`/api/repos/status?url=${encodeURIComponent(urlToIndex)}`);
          if (statusRes.status !== 200) throw new Error('Status check failed');
          const data = statusRes.data;

          if (data.status === 'complete') {
            setIsIndexing(false);
            setRepoUrl('');
            setIndexProgress(null);
            setIsRepoModalOpen(false);
            fetchIndexedRepos();
            return;
          }

          if (data.status === 'error') {
            setIndexError(data.error || 'Indexing failed. Click Resume to try again.');
            setIsIndexing(false);
            setIndexProgress(null);
            fetchIndexedRepos();
            return;
          }

          if (data.status === 'paused') {
            // Job was paused by user (pause button) — stop polling and let user resume
            setIsIndexing(false);
            setIndexProgress(null);
            fetchIndexedRepos();
            return;
          }

          // Still indexing (including quota_wait) — keep polling
          setIndexProgress({
            status: data.status,
            repoUrl: urlToIndex,
            current: data.indexedFiles || 0,
            total: data.totalFiles || 0,
            file: data.currentFile || '',
            isWaiting: data.status === 'quota_wait',
            waitTime: data.waitTime || 60000,
            message: data.status === 'quota_wait'
              ? `⏳ Rate limit hit — waiting for API quota to reset...`
              : `Indexing files... (${data.indexedFiles || 0}/${data.totalFiles || 0})`,
          });

          // Poll faster during quota_wait to detect when it resumes
          setTimeout(poll, data.status === 'quota_wait' ? 5000 : 2000);
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
          setIndexError('Lost connection to server. Check if backend is running.');
          setIsIndexing(false);
          setIndexProgress(null);
        }
      };

      // Start polling after a short delay to let the server kick off the job
      setTimeout(poll, 1500);

    } catch (err) {
      console.error(err);
      setIndexError(err.message || 'Failed to start indexing. Is the backend running?');
      setIsIndexing(false);
      setIndexProgress(null);
    }
  };

  // Fetch conversations for selected repo
  const fetchConversations = async (repoUrl) => {
    if (!repoUrl) return;
    try {
      const res = await api.get(`/api/chat/history?repoId=${encodeURIComponent(repoUrl)}`);
      if (res.status === 200) {
        const data = res.data;
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  // Load a specific conversation
  const loadConversation = async (convoId) => {
    try {
      const res = await api.get(`/api/chat/conversation/${convoId}`);
      if (res.status === 200) {
        const data = res.data;
        setMessages(data.messages);
        setCurrentConversationId(convoId);
      }
    } catch (err) {
      console.error("Failed to load conversation", err);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      const res = await api.delete(`/api/chat/conversation/${id}`);
      if (res.status === 200) {
        setConversations(prev => prev.filter(c => c._id !== id));
        if (currentConversationId === id) {
          startNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  // Fetch PRs for selected repo
  const fetchPRs = async (repoUrl: string) => {
    if (!repoUrl) return;
    try {
      const res = await api.get(`/api/repos/prs?repoUrl=${encodeURIComponent(repoUrl)}`);
      if (res.status === 200) {
        const data = res.data;
        setOpenPRs(prev => ({ ...prev, [repoUrl]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch PRs", err);
      setOpenPRs(prev => ({ ...prev, [repoUrl]: [] }));
    }
  };

  const handleEditMessage = async (index, newContent) => {
    if (isLoading) return;
    
    if (currentConversationId) {
      try {
        await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: index });
      } catch(e) { console.error(e); }
    }
    
    setMessages(prev => prev.slice(0, index));
    sendMessage(null, newContent);
  };

  const handleRetryMessage = async (index) => {
    if (isLoading) return;
    const userMessageIndex = index - 1;
    if (userMessageIndex < 0) return;
    const oldContent = messages[userMessageIndex].content;
    
    if (currentConversationId) {
      try {
        await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: userMessageIndex });
      } catch(e) { console.error(e); }
    }
    
    setMessages(prev => prev.slice(0, userMessageIndex));
    sendMessage(null, oldContent);
  };

  useEffect(() => {
    if (selectedRepo) {
      fetchConversations(selectedRepo);
      fetchPRs(selectedRepo);
      startNewChat();
      setSelectedPR(null);
    } else {
      setConversations([]);
      setSelectedPR(null);
    }
  }, [selectedRepo]);

  const sendMessage = async (e?: React.FormEvent | null, customText: string | null = null) => {
    if(e) e.preventDefault();
    const userMessage = customText || input.trim();
    if (!userMessage || isLoading) return;

    if (!customText) setInput('');
    setIsLoading(true);

    // Add the user message immediately, before the API call!
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      let endpoint = `${import.meta.env.VITE_API_URL}/api/chat`;
      let payload: any = { message: userMessage, repoUrl: selectedRepo, conversationId: currentConversationId, chatModel, embeddingModel };

      if (userMessage === 'Generate a Tech Debt Radar report.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/tech-debt`;
      } else if (userMessage === 'Generate an onboarding guide for this codebase.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/onboarding`;
      } else if (userMessage === 'Generate a Commit Story for the last 20 commits.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/commit-story`;
      } else if (isBugTraceMode) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/bug-trace`;
        payload = { stackTrace: userMessage, repoUrl: selectedRepo, chatModel, embeddingModel };
        setIsBugTraceMode(false); // Reset mode after sending
      } else if (selectedPR) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/pr-review`;
        payload = { message: userMessage, repoUrl: selectedRepo, prNumber: selectedPR.number, conversationId: currentConversationId, chatModel, embeddingModel };
      }

      await streamSSE(endpoint, payload, {}, {
        onConversationId: (id) => {
          setCurrentConversationId(id);
          if (selectedRepo) fetchConversations(selectedRepo);
        },
        onStatus: (status) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            newMessages[lastIdx] = { ...newMessages[lastIdx], status };
            return newMessages;
          });
        },
        onText: (text) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            newMessages[lastIdx] = { ...newMessages[lastIdx], content: newMessages[lastIdx].content + text };
            return newMessages;
          });
        },
        onError: (errorMsg) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            newMessages[lastIdx] = { ...newMessages[lastIdx], content: `⚠️ **System Error:** ${errorMsg}` };
            return newMessages;
          });
        }
      });
    } catch (error) {
      console.error('[sendMessage] Fatal error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        newMessages[lastIdx] = { ...newMessages[lastIdx], content: "Sorry, I encountered an error." };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateOnboarding = () => {
    sendMessage(null, 'Generate an onboarding guide for this codebase.');
  };

  const generateTechDebt = () => {
    sendMessage(null, 'Generate a Tech Debt Radar report.');
  };

  const generateCommitStory = () => {
    sendMessage(null, 'Generate a Commit Story for the last 20 commits.');
  };


  // Handle citation click to show file content
  const handleCitationClick = useCallback(async (filePath) => {
    if (!selectedRepo) return;
    setIsFileLoading(true);
    setViewingFile({ path: filePath, content: '' }); // open modal in loading state
    try {
      const res = await api.get(`/api/repos/file?repoUrl=${encodeURIComponent(selectedRepo)}&filePath=${encodeURIComponent(filePath)}`);
      if (res.status === 200) {
        const data = res.data;
        setViewingFile({ path: filePath, content: data.content });
      } else {
        setViewingFile({ path: filePath, content: 'Error loading file content. File might not be indexed properly.' });
      }
    } catch (err) {
      console.error(err);
      setViewingFile({ path: filePath, content: 'Network error while loading file.' });
    } finally {
      setIsFileLoading(false);
    }
  }, [selectedRepo]);

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
        indexRepo={indexRepo}
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
        startNewChat={startNewChat}
        generateOnboarding={generateOnboarding}
        generateTechDebt={generateTechDebt}
        generateCommitStory={generateCommitStory}
        conversations={conversations}
        currentConversationId={currentConversationId}
        loadConversation={loadConversation}
        deleteConversation={deleteConversation}
        openPRs={openPRs}
        setSelectedPR={setSelectedPR}
        selectedPR={selectedPR}
        deleteWorkspace={deleteWorkspace}
      />

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
        

        {/* Main Chat Content Area */}
        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 pt-6 relative z-10">
          <div className="max-w-[780px] mx-auto w-full flex flex-col gap-4 min-h-full">
            
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-start justify-center max-w-2xl mx-auto space-y-6 min-h-[60vh] px-4">
                <h2 className="text-2xl font-bold text-[var(--color-apple-text)] tracking-tight">Welcome to DevGrasp</h2>
                <div className="space-y-4 text-[13px] sm:text-sm text-[var(--color-apple-text)]/70 font-medium">
                  <p>
                    A contextual coding environment connected directly to your repositories.
                  </p>
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
                      <li>Vector-based context retrieval</li>
                      <li>Interactive Pull Request reviews</li>
                      <li>Automated codebase onboarding guides</li>
                      <li>Architecture and tech debt analysis</li>
                      <li>Historical commit story generation</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, index) => {
              return (
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
              );
            })}
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
              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={!selectedRepo}
                title={!selectedRepo ? "Select a workspace first" : "Voice input"}
                className={`p-1.5 md:p-2 rounded-full transition-colors ${!selectedRepo ? 'opacity-50 cursor-not-allowed text-[var(--color-apple-text)]/30' : isListening ? 'text-rose-400 bg-rose-400/20' : 'text-[var(--color-apple-text)]/50 hover:text-[var(--color-apple-text)] hover:bg-[var(--color-apple-blue)]/20'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 md:w-5 md:h-5">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </button>

              {/* Bug Trace Toggle Button */}
              <button
                type="button"
                onClick={() => setIsBugTraceMode(!isBugTraceMode)}
                disabled={!selectedRepo}
                title={!selectedRepo ? "Select a workspace first" : "Bug Context Tracer Mode"}
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
                placeholder={!selectedRepo ? "Select a workspace to start chatting..." : "Paste your stack trace or error log here to trace the bug..."}
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
                placeholder={!selectedRepo ? "Select a workspace to start chatting..." : isListening ? "Listening..." : "Message DevGrasp..."}
                className="flex-1 bg-transparent py-3.5 px-2 focus:outline-none text-[var(--color-apple-text)] placeholder-[var(--color-apple-text)]/50 text-sm font-medium"
              />
            )}

            <div className="pr-2 pl-2">
              <button 
                type="submit"
                disabled={isLoading || !input.trim() || !selectedRepo}
                title={!selectedRepo ? "Select a workspace first" : "Send message"}
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
