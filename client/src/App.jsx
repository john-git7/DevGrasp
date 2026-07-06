import { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from './components/ChatMessage';

export default function App() {
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
  // Chat History State
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isConversationsExpanded, setIsConversationsExpanded] = useState({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  
  // PR State
  const [openPRs, setOpenPRs] = useState({}); // { repoUrl: [pr1, pr2] }
  const [selectedPR, setSelectedPR] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
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

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const sr = new SR();
    sr.continuous = false;
    sr.interimResults = true;
    sr.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript).join('');
      setInput(transcript);
    };
    sr.onend = () => setIsListening(false);
    speechRecognitionRef.current = sr;
  }, []); // runs once

  const toggleListening = () => {
    const sr = speechRecognitionRef.current;
    if (!sr) return alert("Voice not supported");
    isListening ? sr.stop() : sr.start();
    setIsListening(prev => !prev);
  };


  // Fetch indexed repos
  const fetchIndexedRepos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/repos/indexed`);
      if (res.ok) {
        const data = await res.json();
        setIndexedRepos(data);
      }
    } catch (err) {
      console.error("Failed to fetch indexed repos", err);
    }
  };

  useEffect(() => { fetchIndexedRepos(); }, []);

  const indexRepo = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;
    setIsIndexing(true);
    setIndexProgress(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/repos/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoUrl }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start indexing');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            try {
              const data = JSON.parse(dataStr);
              if (data.status === 'error') {
                 alert('Error: ' + data.error);
                 setIsIndexing(false);
                 fetchIndexedRepos(); // Update sidebar to show INCOMPLETE
                 return;
              }
              if (data.status === 'complete') {
                 setIsIndexing(false);
                 setRepoUrl('');
                 fetchIndexedRepos();
                 return;
              }
              setIndexProgress(data);
            } catch (err) {}
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to index repository. Is the backend running?');
      setIsIndexing(false);
    }
  };

  // Fetch conversations for selected repo
  const fetchConversations = async (repoUrl) => {
    if (!repoUrl) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/history?repoId=${encodeURIComponent(repoUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  // Load a specific conversation
  const loadConversation = async (convoId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/conversation/${convoId}`);
      if (res.ok) {
        const data = await res.json();
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/conversation/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
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
  const fetchPRs = async (repoUrl) => {
    if (!repoUrl) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/repos/prs?repoUrl=${encodeURIComponent(repoUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setOpenPRs(prev => ({ ...prev, [repoUrl]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch PRs", err);
    }
  };

  // When repo changes, load history, reset chat, fetch PRs
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

  const sendMessage = async (e) => {
    if(e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add the user message immediately, before the API call!
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      let endpoint = `${import.meta.env.VITE_API_URL}/api/chat`;
      let payload = { message: userMessage, repoUrl: selectedRepo, conversationId: currentConversationId };

      if (isBugTraceMode) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/bug-trace`;
        payload = { stackTrace: userMessage, repoUrl: selectedRepo };
        setIsBugTraceMode(false); // Reset mode after sending
      } else if (selectedPR) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/pr-review`;
        payload = { message: userMessage, repoUrl: selectedRepo, prNumber: selectedPR.number, conversationId: currentConversationId };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.conversationId) {
                setCurrentConversationId(data.conversationId);
                // Refresh history list so the new chat shows up immediately
                if (selectedRepo) fetchConversations(selectedRepo);
              }
              if (data.status) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  newMessages[lastIdx] = { ...newMessages[lastIdx], status: data.status };
                  return newMessages;
                });
              }
              if (data.text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  newMessages[lastIdx] = { ...newMessages[lastIdx], content: newMessages[lastIdx].content + data.text };
                  return newMessages;
                });
              }
              if (data.error) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  newMessages[lastIdx] = { ...newMessages[lastIdx], content: `⚠️ **System Error:** ${data.error}` };
                  return newMessages;
                });
              }
            } catch (err) {}
          }
        }
      }
    } catch (error) {
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

  const generateOnboarding = async () => {
    if (!selectedRepo || isLoading) return;
    setIsLoading(true);
    startNewChat();
    
    // Add dummy messages for UI state
    setMessages([
      { role: 'user', content: 'Generate an onboarding guide for this codebase.' },
      { role: 'assistant', content: '' }
    ]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: selectedRepo }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.conversationId) {
                setCurrentConversationId(data.conversationId);
                fetchConversations(selectedRepo);
              }
              if (data.status) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], status: data.status };
                  return newMsgs;
                });
              }
              if (data.text) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: newMsgs[newMsgs.length - 1].content + data.text };
                  return newMsgs;
                });
              }
              if (data.error) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: `⚠️ **System Error:** ${data.error}` };
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
        scrollToBottom();
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: "Sorry, I encountered an error." };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateTechDebt = async () => {
    if (!selectedRepo || isLoading) return;
    setIsLoading(true);
    startNewChat();
    
    setMessages([
      { role: 'user', content: 'Generate a Tech Debt Radar report.' },
      { role: 'assistant', content: '' }
    ]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/tech-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: selectedRepo }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.conversationId) {
                setCurrentConversationId(data.conversationId);
                fetchConversations(selectedRepo);
              }
              if (data.status) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], status: data.status };
                  return newMsgs;
                });
              }
              if (data.text) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: newMsgs[newMsgs.length - 1].content + data.text };
                  return newMsgs;
                });
              }
              if (data.error) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: `⚠️ **System Error:** ${data.error}` };
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
        scrollToBottom();
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: "Sorry, I encountered an error." };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateCommitStory = async () => {
    if (!selectedRepo || isLoading) return;
    setIsLoading(true);
    startNewChat();
    
    setMessages([
      { role: 'user', content: 'Generate a Commit Story for the last 20 commits.' },
      { role: 'assistant', content: '' }
    ]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/commit-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: selectedRepo, commitCount: 20 }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.conversationId) {
                setCurrentConversationId(data.conversationId);
                fetchConversations(selectedRepo);
              }
              if (data.status) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], status: data.status };
                  return newMsgs;
                });
              }
              if (data.text) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: newMsgs[newMsgs.length - 1].content + data.text };
                  return newMsgs;
                });
              }
              if (data.error) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: `⚠️ **System Error:** ${data.error}` };
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
        scrollToBottom();
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: "Sorry, I encountered an error." };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle citation click to show file content
  const handleCitationClick = useCallback(async (filePath) => {
    if (!selectedRepo) return;
    setIsFileLoading(true);
    setViewingFile({ path: filePath, content: '' }); // open modal in loading state
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/repos/file?repoUrl=${encodeURIComponent(selectedRepo)}&filePath=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
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
    <div className="flex h-[100dvh] bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      
      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl h-[85vh] max-h-[800px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#121214]">
              <div className="flex items-center gap-3 truncate">
                <svg className="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <span className="h-2 w-2 bg-indigo-500 rounded-full"></span>
                    <span className="h-2 w-2 bg-purple-500 rounded-full"></span>
                    <span className="h-2 w-2 bg-indigo-500 rounded-full"></span>
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
      
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar - Sleek & Modern */}
      <aside className={`w-[280px] bg-[#09090b] border-r border-white/5 flex flex-col z-50 shrink-0 fixed inset-y-0 left-0 transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex justify-between items-center">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-zinc-100 tracking-tight">
              DevMind
            </h1>
          </div>
          {/* Close button for mobile */}
          <button 
            className="md:hidden text-zinc-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-4 border-b border-white/5 flex-shrink-0">
          <p className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest">Add Repository</p>
          <form onSubmit={indexRepo} className="flex flex-col gap-2.5">
            <input 
              type="text" 
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="github.com/user/repo"
              className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 text-white w-full transition-all placeholder:text-zinc-600"
            />
            <button 
              type="submit" 
              disabled={isIndexing || !repoUrl}
              className="bg-indigo-600/90 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-zinc-600 text-white px-3 py-2 rounded-md text-xs font-medium transition-all w-full"
            >
              {isIndexing ? 'Indexing...' : 'Index Repository'}
            </button>
          </form>

          {isIndexing && indexProgress && (
            <div className="mt-3 p-2 bg-white/5 rounded-md border border-white/5">
              <div className="flex justify-between mb-1.5 text-[10px]">
                <span className="text-indigo-400 truncate pr-2">
                  {indexProgress.status === 'fetching' ? 'Fetching...' : indexProgress.file}
                </span>
                <span className="text-zinc-500 font-mono">{indexProgress.current}/{indexProgress.total}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-1 rounded-full transition-all duration-300" 
                  style={{ width: indexProgress.total > 0 ? `${(indexProgress.current / indexProgress.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
          <p className="text-[10px] font-semibold text-zinc-500 mb-2 px-2 uppercase tracking-widest">Workspaces</p>
          {indexedRepos.length === 0 ? (
            <p className="text-xs text-zinc-700 px-2 mt-4">No repositories indexed.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {indexedRepos.map(repoObj => {
                // Support both old backend (strings) and new backend (objects)
                const repo = typeof repoObj === 'string' ? repoObj : repoObj.repoUrl;
                if (!repo) return null;
                const repoName = repo.split('/').slice(-2).join('/');
                const isSelected = selectedRepo === repo;
                const isExpanded = isConversationsExpanded[repo];

                return (
                  <div key={repo}>
                    <button 
                      onClick={() => {
                        setSelectedRepo(repo);
                        setIsConversationsExpanded(prev => ({ ...prev, [repo]: !prev[repo] }));
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex items-center justify-between group ${
                        isSelected 
                          ? 'border-l-2 border-[#1D9E75] bg-white/10 text-white font-bold' 
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#1D9E75]' : 'text-zinc-600 group-hover:text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L15.19 12l-1.47-1.47a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-3.28 4.72a.75.75 0 001.06-1.06l-4.5-4.5a.75.75 0 00-1.06 1.06l4.5 4.5z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{repoName}</span>
                      </div>
                      {repoObj.status === 'indexing' && (
                        <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 animate-pulse" title="Still indexing files">INDEXING</span>
                      )}
                      {repoObj.status === 'error' && (
                        <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400" title="Index failed. Re-index to resume.">INCOMPLETE</span>
                      )}
                    </button>
                    
                    {/* Collapsible History */}
                    {isSelected && isExpanded && (
                      <div className="pl-6 pt-1 pb-2 flex flex-col gap-1 border-l border-white/5 ml-3 mt-1">
                        <div className="flex flex-col gap-1 mb-2 border-b border-white/5 pb-2">
                          <button 
                            onClick={startNewChat}
                            className={`text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-all text-zinc-400 hover:bg-white/5 hover:text-zinc-200 ${!currentConversationId ? 'bg-white/5 text-white' : ''}`}
                          >
                            + New Chat
                          </button>
                          <button 
                            onClick={generateOnboarding}
                            className={`text-left px-3 py-1.5 rounded-md text-[11px] font-bold transition-all text-indigo-400 hover:bg-indigo-500/10`}
                          >
                            📖 Generate Onboarding Guide
                          </button>
                          <button 
                            onClick={generateTechDebt}
                            className={`text-left px-3 py-1.5 rounded-md text-[11px] font-bold transition-all text-rose-400 hover:bg-rose-500/10`}
                          >
                            🚨 Tech Debt Radar
                          </button>
                          <button 
                            onClick={generateCommitStory}
                            className={`text-left px-3 py-1.5 rounded-md text-[11px] font-bold transition-all text-emerald-400 hover:bg-emerald-500/10`}
                          >
                            📜 Commit Story <span className="font-normal opacity-70">(last 20 commits)</span>
                          </button>
                        </div>
                        {conversations.map(conv => (
                          <div
                            key={conv._id}
                            className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-all group ${
                              currentConversationId === conv._id
                                ? 'bg-indigo-500/10 text-indigo-300'
                                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                            }`}
                          >
                            <button
                              onClick={() => loadConversation(conv._id)}
                              className="flex-1 text-left truncate flex items-center justify-between mr-2 py-0.5"
                            >
                              <span className="truncate pr-2">{conv.title}</span>
                              <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {new Date(conv.createdAt).toLocaleDateString()}
                              </span>
                            </button>
                            <button
                              onClick={(e) => deleteConversation(conv._id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-white/10 rounded transition-all flex-shrink-0"
                              title="Delete chat"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        {/* Open PRs Section */}
                        <div className="mt-2 pt-2 border-t border-white/5">
                          <p className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest px-2">Open PRs</p>
                          {!openPRs[repo] ? (
                            <p className="text-[10px] text-zinc-600 px-2">Loading PRs...</p>
                          ) : openPRs[repo].length === 0 ? (
                            <p className="text-[10px] text-zinc-600 px-2">No open PRs.</p>
                          ) : (
                            openPRs[repo].map(pr => (
                              <button
                                key={pr.number}
                                onClick={() => {
                                  setSelectedPR(pr);
                                  startNewChat();
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all flex flex-col gap-0.5 group ${
                                  selectedPR?.number === pr.number
                                    ? 'bg-amber-500/10 text-amber-300'
                                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-bold truncate pr-2">#{pr.number}</span>
                                  <span className="text-[9px] opacity-70">by {pr.author}</span>
                                </div>
                                <span className="truncate w-full">{pr.title}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Model & System Info Panel */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex-shrink-0">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D9E75] shadow-[0_0_8px_rgba(29,158,117,0.5)]"></span>
              Gemini 3.5 Flash
            </div>
            <span className="font-mono">1M Tokens</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area - Radial Gradient Background */}
      <main className="flex-1 flex flex-col min-h-0 relative bg-[#09090b] overflow-hidden w-full max-w-full">
        {/* Mobile Header Toggle */}
        <div className="md:hidden flex-shrink-0 px-4 py-3 border-b border-white/5 flex items-center gap-3 z-10 relative bg-[#09090b]">
          <button 
            className="text-zinc-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-zinc-200">DevMind</span>
        </div>

        {selectedRepo && (
          <div className="flex-shrink-0 px-4 md:px-6 py-2.5 border-b border-white/5 flex items-center gap-2 z-10 relative">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></span>
            <span className="text-xs text-zinc-400 font-mono truncate max-w-[200px] md:max-w-none">
              {selectedRepo.split('/').slice(-2).join('/')}
            </span>
            <span className="ml-auto text-[10px] text-zinc-600 whitespace-nowrap">RAG enabled</span>
          </div>
        )}

        {/* Subtle glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none"></div>

        {/* Main Chat Content Area */}
        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 pt-6 relative z-10">
          <div className="max-w-[780px] mx-auto w-full flex flex-col gap-4 min-h-full">
            
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4 min-h-[60vh]">
                <div className="w-12 h-12 border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-zinc-300 tracking-tight">How can I help you code?</h2>
              </div>
            )}

            {messages.map((msg, index) => (
              <ChatMessage 
                key={index} 
                content={msg.content} 
                role={msg.role} 
                status={msg.status}
                onCitationClick={handleCitationClick}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar - fixed height wrapper at bottom */}
        <div className="flex-shrink-0 w-full px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4 z-20 flex flex-col items-center gap-3 border-t border-white/5 bg-[#09090b]">

          {/* PR Context Banner */}
          {selectedPR && (
            <div className="max-w-2xl w-full flex items-center justify-between px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in slide-in-from-bottom-2 fade-in">
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
            className="max-w-2xl w-full relative flex items-center glass-pill rounded-2xl md:rounded-3xl pointer-events-auto transition-all focus-within:border-indigo-500/30 focus-within:ring-4 focus-within:ring-indigo-500/10"
          >
             <div className="flex items-center pl-1 md:pl-2 pr-1 md:pr-2">
              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleListening}
                title="Voice input"
                className={`p-1.5 md:p-2 rounded-full transition-colors ${isListening ? 'text-red-400 bg-red-400/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10'}`}
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
                title="Bug Context Tracer Mode"
                className={`p-1.5 md:p-2 rounded-full transition-colors ${isBugTraceMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10'}`}
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
                disabled={isLoading}
                placeholder="Paste your stack trace or error log here to trace the bug..."
                rows="2"
                className="flex-1 bg-transparent py-2.5 px-2 focus:outline-none text-indigo-200 placeholder-indigo-500/50 text-sm font-medium resize-none min-h-[60px]"
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
                disabled={isLoading}
                placeholder={isListening ? "Listening..." : "Message DevMind..."}
                className="flex-1 bg-transparent py-3.5 px-2 focus:outline-none text-zinc-100 placeholder-zinc-500 text-sm font-medium"
              />
            )}

            <div className="pr-2 pl-2">
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:bg-white/5 disabled:text-white/20 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </div>
          </form>
          
          <div className="text-center mt-1 text-[10px] text-zinc-500 pointer-events-auto">
            DevMind can make mistakes. Please verify important code.
          </div>
        </div>
      </main>
    </div>
  );
}
