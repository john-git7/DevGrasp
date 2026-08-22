import React, { useState, useEffect } from 'react';
import api from '../lib/api';

const CHAT_MODELS = {
  'gemini-3.5-flash': {
    name: 'Gemini 3.5 Flash',
    description: 'Latest lightweight generation. Exceptional speed and improved coding context.',
    limits: { rpm: 15, tpm: 1000000, rpd: 1500 }
  },
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    description: 'Older lightweight generation. Fast and has a massive 1 million token context window.',
    limits: { rpm: 15, tpm: 1000000, rpd: 1500 }
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Mid-generation model with a good balance of speed and cost.',
    limits: { rpm: 15, tpm: 1000000, rpd: 1500 }
  },
  'gemini-3.1-pro-preview': {
    name: 'Gemini 3.1 Pro (Preview)',
    description: 'High reasoning capabilities. Requires paid Google AI tier.',
    limits: { rpm: 2, tpm: 32000, rpd: 50 }
  }
};

const EMBEDDING_MODELS = {
  'local-MiniLM': {
    name: 'Local MiniLM (Offline / Free)',
    description: 'Runs offline on your CPU using all-MiniLM-L6-v2 (23MB). 100% free with unlimited requests. Note: Requires creating a MongoDB Atlas Vector Index named "LocalMiniLM" with 384 dimensions (cosine similarity).',
    limits: { rpm: 'Unlimited' }
  },
  'gemini-embedding-2': {
    name: 'Gemini Embedding 2',
    description: 'Latest high-performance embedding model. Highly recommended for codebase semantic search and RAG.',
    limits: { rpm: 1500 }
  },
  'gemini-embedding-2-preview': {
    name: 'Gemini Embedding 2 Preview',
    description: 'Preview version of the latest embedding model.',
    limits: { rpm: 1500 }
  },
  'gemini-embedding-001': {
    name: 'Gemini Embedding 001 (Legacy)',
    description: 'Legacy embedding model kept for backward compatibility.',
    limits: { rpm: 1500 }
  }
};

export default function SettingsModal({
  isOpen,
  onClose,
  chatModel,
  setChatModel,
  embeddingModel,
  setEmbeddingModel
}) {
  const [usage, setUsage] = useState({ rpm: 0, tpm: 0, nextRefresh: null });
  const [timeLeft, setTimeLeft] = useState(0);

  // Fetch usage periodically
  useEffect(() => {
    if (!isOpen) return;
    const fetchUsage = async () => {
      try {
        const res = await api.get('/api/status/usage');
        if (res.status === 200) {
          setUsage(res.data.chat);
        }
      } catch (err) {
        console.error("Failed to fetch usage metrics", err);
      }
    };
    
    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Local countdown timer
  useEffect(() => {
    if (!usage.nextRefresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(0);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((usage.nextRefresh - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [usage.nextRefresh]);

  if (!isOpen) return null;

  const currentChatLimits = CHAT_MODELS[chatModel]?.limits || { rpm: 15, tpm: 1000000, rpd: 1500 };
  const rpmPercent = Math.min(100, (usage.rpm / currentChatLimits.rpm) * 100);
  const tpmPercent = Math.min(100, (usage.tpm / currentChatLimits.tpm) * 100);
  const isHighUsage = rpmPercent > 80 || tpmPercent > 80;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="apple-modal-backdrop absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-[var(--color-apple-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-[#1c1c1e]">
          <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans flex items-center gap-2">
            <span>⚙️</span> Model Settings
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
        <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[80vh] no-scrollbar">
          
          {/* Global Notice */}
          <div className="bg-[var(--color-apple-blue)]/10 border border-[var(--color-apple-blue)]/30 rounded-xl p-3 text-xs text-[var(--color-apple-blue)] leading-relaxed">
            <strong>Note:</strong> You are currently using the Google Gemini <strong>Free Tier</strong>. Usage limits are strictly enforced by Google. Chat requests and Codebase Indexing consume separate quotas.
          </div>

          {/* Chat Model Selection */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-[var(--color-apple-text)] uppercase tracking-wider opacity-80">Chat Model</label>
            <select
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              className="w-full bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-apple-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-apple-blue)] appearance-none font-medium transition-all"
            >
              {Object.entries(CHAT_MODELS).map(([key, data]) => (
                <option key={key} value={key}>{data.name}</option>
              ))}
            </select>
            <div className="px-1">
              <p className="text-[11px] text-[var(--color-apple-text)]/60 leading-relaxed">
                <strong>Use Case:</strong> {CHAT_MODELS[chatModel]?.description}
              </p>
            </div>
            
            {/* Dynamic Chat Limits Bar */}
            <div className="mt-2 bg-[var(--color-apple-bg)]/50 border border-[var(--color-apple-border)] rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[var(--color-apple-text)]/50 uppercase tracking-widest">Local Chat Usage</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${isHighUsage && timeLeft > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-[var(--color-apple-blue)]/20 text-[var(--color-apple-blue)]'}`}>
                  {timeLeft > 0 ? `RESET IN ${timeLeft}S` : 'QUOTA READY'}
                </span>
              </div>
              
              <div className="flex flex-col gap-3">
                {/* RPM */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-apple-text)]/70 font-semibold leading-none">
                    <span>Requests / Min (RPM)</span>
                    <span>{usage.rpm} / {currentChatLimits.rpm}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--color-apple-border)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${rpmPercent > 80 ? 'bg-red-500' : rpmPercent > 50 ? 'bg-orange-400' : 'bg-[var(--color-apple-blue)]'}`}
                      style={{ width: `${rpmPercent}%` }}
                    />
                  </div>
                </div>
                
                {/* TPM */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-apple-text)]/70 font-semibold leading-none">
                    <span>Tokens / Min (TPM)</span>
                    <span>{usage.tpm > 1000 ? (usage.tpm/1000).toFixed(1)+'k' : usage.tpm} / {currentChatLimits.tpm > 1000 ? (currentChatLimits.tpm/1000).toFixed(0)+'k' : currentChatLimits.tpm}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--color-apple-border)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${tpmPercent > 80 ? 'bg-red-500' : tpmPercent > 50 ? 'bg-orange-400' : 'bg-[var(--color-apple-blue)]'}`}
                      style={{ width: `${tpmPercent}%` }}
                    />
                  </div>
                </div>

                <div className="text-[9px] text-[var(--color-apple-text)]/40 text-right mt-1 font-medium">
                  Daily Limit: {currentChatLimits.rpd} Requests/Day
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--color-apple-border)] w-full"></div>

          {/* Embedding Model Selection */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-[var(--color-apple-text)] uppercase tracking-wider opacity-80">Embedding Model</label>
            <select
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              className="w-full bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-apple-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-apple-blue)] appearance-none font-medium transition-all"
            >
              {Object.entries(EMBEDDING_MODELS).map(([key, data]) => (
                <option key={key} value={key}>{data.name}</option>
              ))}
            </select>
            <div className="px-1">
              <p className="text-[11px] text-[var(--color-apple-text)]/60 leading-relaxed">
                <strong>Use Case:</strong> {EMBEDDING_MODELS[embeddingModel]?.description}
              </p>
              <p className="text-[10px] text-orange-400 mt-2 font-medium">
                Note: Embedding limits ({EMBEDDING_MODELS[embeddingModel]?.limits.rpm} RPM) are consumed heavily during codebase indexing. They are tracked globally by Google and managed automatically by the indexer.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
