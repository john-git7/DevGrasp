import React from 'react';
import QuotaTimer from './QuotaTimer';

export default function RepoModal({
  isOpen,
  onClose,
  repoUrl,
  setRepoUrl,
  indexRepo,
  isIndexing,
  indexProgress,
  pauseIndexing,
  fetchIndexedRepos
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="apple-modal-backdrop absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-md apple-glass-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-4 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-[var(--color-apple-glass)]">
          <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans">Add Repository</h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-apple-text)]/70 hover:text-[var(--color-apple-text)] transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 bg-[var(--color-apple-bg)]">
          <form onSubmit={indexRepo} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-apple-text)]/70 mb-2 uppercase tracking-widest">GitHub Repository URL</label>
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="github.com/user/repo"
                className="bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-apple-text)] text-[var(--color-apple-text)] w-full transition-all placeholder:text-[var(--color-apple-text)]/40"
              />
            </div>
            <button 
              type="submit" 
              disabled={isIndexing || !repoUrl}
              className="bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/90 disabled:bg-[var(--color-apple-glass)] disabled:text-[var(--color-apple-text)]/40 text-[var(--color-apple-bg)] px-4 py-3 rounded-2xl text-sm font-bold transition-all w-full"
            >
              {isIndexing ? 'Indexing...' : 'Index Repository'}
            </button>
          </form>

          {isIndexing && indexProgress && (
            <div className="mt-5 p-4 bg-[var(--color-apple-glass)] rounded-2xl border border-[var(--color-apple-border)]/30">
              <div className="flex justify-between items-center mb-2 text-xs">
                <span className="text-[var(--color-apple-text)] truncate pr-2 font-medium">
                  {indexProgress.isWaiting ? (
                    <QuotaTimer waitTime={indexProgress.waitTime} message={indexProgress.waitMessage || "Quota Exceeded"} />
                  ) : indexProgress.status === 'fetching' ? (
                    'Fetching...'
                  ) : (
                    indexProgress.file
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-apple-text)]/70 font-mono">{indexProgress.current}/{indexProgress.total}</span>
                  <button
                    onClick={() => pauseIndexing(repoUrl)}
                    className="px-2 py-1 rounded bg-[var(--color-apple-blue)]/20 text-[var(--color-apple-text)] hover:bg-[var(--color-apple-blue)]/40 transition-colors text-xs font-bold"
                  >
                    Pause
                  </button>
                </div>
              </div>
              <div className={`w-full rounded-full h-1.5 overflow-hidden transition-colors ${indexProgress.isWaiting ? 'bg-orange-500/20' : 'bg-[var(--color-apple-bg)]'}`}>
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${indexProgress.isWaiting ? 'bg-orange-400' : 'bg-[var(--color-apple-blue)]'}`} 
                  style={{ width: indexProgress.total > 0 ? `${(indexProgress.current / indexProgress.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
