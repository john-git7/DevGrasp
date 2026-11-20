import { useState, useCallback } from 'react';
import api from '../lib/api';

export function useConversations(onMessagesLoaded?: (messages: any[]) => void) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isConversationsExpanded, setIsConversationsExpanded] = useState<Record<string, boolean>>({});

  const fetchConversations = useCallback(async (repoUrl: string) => {
    if (!repoUrl) return;
    try {
      const res = await api.get(`/api/chat/history?repoId=${encodeURIComponent(repoUrl)}`);
      if (res.status === 200) {
        setConversations(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  }, []);

  const loadConversation = useCallback(async (convoId: string, onLoad?: (messages: any[]) => void) => {
    try {
      const res = await api.get(`/api/chat/conversation/${convoId}`);
      if (res.status === 200) {
        const msgs = res.data.messages || [];
        if (onLoad) {
          onLoad(msgs);
        } else if (onMessagesLoaded) {
          onMessagesLoaded(msgs);
        }
        setCurrentConversationId(convoId);
      }
    } catch (err) {
      console.error('Failed to load conversation', err);
    }
  }, [onMessagesLoaded]);

  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent, onCurrentDeleted?: () => void) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this chat?')) return;

    try {
      const res = await api.delete(`/api/chat/conversation/${id}`);
      if (res.status === 200) {
        setConversations(prev => prev.filter(c => c._id !== id));
        if (currentConversationId === id && onCurrentDeleted) {
          onCurrentDeleted();
          setCurrentConversationId(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete chat', err);
    }
  }, [currentConversationId]);

  const startNewChat = useCallback((onClearMessages?: () => void) => {
    if (onClearMessages) onClearMessages();
    setCurrentConversationId(null);
  }, []);

  return {
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    isConversationsExpanded,
    setIsConversationsExpanded,
    fetchConversations,
    loadConversation,
    deleteConversation,
    startNewChat,
  };
}
