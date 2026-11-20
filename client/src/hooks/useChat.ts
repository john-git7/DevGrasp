import { useState, useEffect, useRef, useCallback } from 'react';
import { streamSSE } from '../utils/streamSSE';
import api from '../lib/api';

export function useChat(selectedRepo: string | null, currentConversationId: string | null, onConversationCreated?: (id: string) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBugTraceMode, setIsBugTraceMode] = useState(false);

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

  useEffect(() => { localStorage.setItem('chatModel', chatModel); }, [chatModel]);
  useEffect(() => { localStorage.setItem('embeddingModel', embeddingModel); }, [embeddingModel]);

  // PR State
  const [openPRs, setOpenPRs] = useState<Record<string, any[]>>({});
  const [selectedPR, setSelectedPR] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchPRs = useCallback(async (repoUrl: string) => {
    if (!repoUrl) return;
    try {
      const res = await api.get(`/api/repos/prs?repoUrl=${encodeURIComponent(repoUrl)}`);
      if (res.status === 200) {
        setOpenPRs(prev => ({ ...prev, [repoUrl]: res.data }));
      }
    } catch (err) {
      console.error('Failed to fetch PRs', err);
      setOpenPRs(prev => ({ ...prev, [repoUrl]: [] }));
    }
  }, []);

  const sendMessage = async (e?: React.FormEvent | null, customText: string | null = null) => {
    if (e) e.preventDefault();
    const userMessage = customText || input.trim();
    if (!userMessage || isLoading) return;

    if (!customText) setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      let endpoint = `${import.meta.env.VITE_API_URL}/api/chat`;
      let payload: any = {
        message: userMessage,
        repoId: selectedRepo,
        conversationId: currentConversationId,
        chatModel,
        embeddingModel,
      };

      if (userMessage === 'Generate a Tech Debt Radar report.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/tech-debt`;
      } else if (userMessage === 'Generate an onboarding guide for this codebase.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/onboarding`;
      } else if (userMessage === 'Generate a Commit Story for the last 20 commits.') {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/commit-story`;
      } else if (isBugTraceMode) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/bug-trace`;
        payload = { stackTrace: userMessage, repoUrl: selectedRepo, chatModel, embeddingModel };
        setIsBugTraceMode(false);
      } else if (selectedPR) {
        endpoint = `${import.meta.env.VITE_API_URL}/api/chat/pr-review`;
        payload = {
          message: userMessage,
          repoUrl: selectedRepo,
          prNumber: selectedPR.number,
          conversationId: currentConversationId,
          chatModel,
          embeddingModel,
        };
      }

      await streamSSE(endpoint, payload, {}, {
        onConversationId: (id) => {
          if (onConversationCreated) onConversationCreated(id);
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
        },
      });
    } catch (error) {
      console.error('[sendMessage] Fatal error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        newMessages[lastIdx] = { ...newMessages[lastIdx], content: 'Sorry, I encountered an error.' };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (index: number, newContent: string) => {
    if (isLoading) return;
    if (currentConversationId) {
      try {
        await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: index });
      } catch (e) { console.error(e); }
    }
    setMessages(prev => prev.slice(0, index));
    sendMessage(null, newContent);
  };

  const handleRetryMessage = async (index: number) => {
    if (isLoading) return;
    const userMessageIndex = index - 1;
    if (userMessageIndex < 0) return;
    const oldContent = messages[userMessageIndex].content;
    if (currentConversationId) {
      try {
        await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: userMessageIndex });
      } catch (e) { console.error(e); }
    }
    setMessages(prev => prev.slice(0, userMessageIndex));
    sendMessage(null, oldContent);
  };

  const generateOnboarding = () => sendMessage(null, 'Generate an onboarding guide for this codebase.');
  const generateTechDebt = () => sendMessage(null, 'Generate a Tech Debt Radar report.');
  const generateCommitStory = () => sendMessage(null, 'Generate a Commit Story for the last 20 commits.');

  return {
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
    setOpenPRs,
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
  };
}
