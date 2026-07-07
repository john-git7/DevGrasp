import React from 'react';
import QuotaTimer from './QuotaTimer';

export default function WorkspaceModal({
  isOpen,
  onClose,
  indexedRepos,
  selectedRepo,
  setSelectedRepo,
  isConversationsExpanded,
  setIsConversationsExpanded,
  startNewChat,
  generateOnboarding,
  generateTechDebt,
  generateCommitStory,
  conversations,
  currentConversationId,
  loadConversation,
  deleteConversation,
  openPRs,
  setSelectedPR,
  selectedPR,
  pauseIndexing,
  indexRepo,
  deleteWorkspace,
  indexProgress
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="apple-modal-backdrop absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl apple-glass-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 h-[80vh] max-h-[800px]">
        <div className="px-5 py-4 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-[var(--color-apple-glass)]">
          <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans">Select Workspace</h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-apple-text)]/70 hover:text-[var(--color-apple-text)] transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-apple-bg)] no-scrollbar">
          {indexedRepos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--color-apple-text)]/60">No repositories indexed yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {indexedRepos.map(repoObj => {
                const repo = typeof repoObj === 'string' ? repoObj : repoObj.repoUrl;
                if (!repo) return null;
                const repoName = repo.split('/').slice(-2).join('/');
                const isSelected = selectedRepo === repo;
                const isExpanded = isConversationsExpanded[repo];

                return (
                  <div key={repo} className="bg-[var(--color-apple-glass)] rounded-2xl overflow-hidden border border-[var(--color-apple-border)]">
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedRepo(repo);
                        setIsConversationsExpanded(prev => ({ ...prev, [repo]: !prev[repo] }));
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected 
                          ? 'border-l-4 border-[var(--color-apple-border)] bg-[var(--color-apple-blue)]/10 text-[var(--color-apple-text)] font-bold' 
                          : 'text-[var(--color-apple-text)]/80 hover:bg-[var(--color-apple-blue)]/5 hover:text-[var(--color-apple-text)] font-medium border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <svg className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[var(--color-apple-blue)]' : 'text-[var(--color-apple-text)]/50 group-hover:text-[var(--color-apple-text)]/80'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L15.19 12l-1.47-1.47a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-3.28 4.72a.75.75 0 001.06-1.06l-4.5-4.5a.75.75 0 00-1.06 1.06l4.5 4.5z" clipRule="evenodd" />
                        </svg>
                        <div className="flex flex-col truncate">
                          <span className="truncate">{repoName}</span>
                          {repoObj.lastUpdated && (
                            <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-[var(--color-apple-blue)]/70' : 'text-[var(--color-apple-text)]/40 group-hover:text-[var(--color-apple-text)]/60'}`}>
                              Updated: {new Date(repoObj.lastUpdated).toLocaleDateString()} {new Date(repoObj.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                      </div>
                      {repoObj.status === 'indexing' && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-[var(--color-apple-blue)]/20 text-[var(--color-apple-blue)] animate-pulse">INDEXING</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pauseIndexing(repoObj.repoUrl);
                              }}
                              className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--color-apple-text)]/10 text-[var(--color-apple-text)] hover:bg-[var(--color-apple-text)]/20 transition-colors border border-[var(--color-apple-border)]"
                            >
                              PAUSE
                            </button>
                          </div>
                          {indexProgress?.isWaiting && (
                            <QuotaTimer waitTime={indexProgress.waitTime} message="Quota Exceeded" />
                          )}
                        </div>
                      )}
                      {(repoObj.status === 'error' || repoObj.status === 'paused') && (
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 uppercase">{repoObj.status}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              indexRepo(null, repoObj.repoUrl);
                            }}
                            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--color-apple-blue)] text-[var(--color-apple-bg)] hover:bg-[var(--color-apple-blue)]/80 transition-colors"
                          >
                            RESUME
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {isSelected && isExpanded && (
                      <div className="px-4 py-3 bg-[var(--color-apple-bg)]/50 flex flex-col gap-4 border-t border-[var(--color-apple-border)]">
                        {/* Quick Actions */}
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => { startNewChat(); onClose(); }}
                              className="text-left px-3 py-2 rounded-2xl text-xs font-bold transition-all bg-[var(--color-apple-glass)] text-[var(--color-apple-text)] hover:bg-[var(--color-apple-blue)] hover:text-[var(--color-apple-bg)]"
                            >
                              + New Chat
                            </button>
                            <button 
                              onClick={() => { generateOnboarding(); onClose(); }}
                              className="text-left px-3 py-2 rounded-2xl text-xs font-bold transition-all bg-[var(--color-apple-glass)] text-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/20"
                            >
                              📖 Onboarding Guide
                            </button>
                            <button 
                              onClick={() => { generateTechDebt(); onClose(); }}
                              className="text-left px-3 py-2 rounded-2xl text-xs font-bold transition-all bg-[var(--color-apple-glass)] text-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/20"
                            >
                              🚨 Tech Debt Radar
                            </button>
                            <button 
                              onClick={() => { generateCommitStory(); onClose(); }}
                              className="text-left px-3 py-2 rounded-2xl text-xs font-bold transition-all bg-[var(--color-apple-glass)] text-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/20"
                            >
                              📜 Commit Story
                            </button>
                          </div>
                          <button 
                            onClick={() => deleteWorkspace(repo)}
                            className="w-full text-center mt-2 px-3 py-2 rounded-2xl text-xs font-bold transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                          >
                            Delete Workspace
                          </button>
                        </div>

                        {/* Recent Chats */}
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--color-apple-text)]/50 mb-2 uppercase tracking-widest">Recent Chats</p>
                          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar">
                            {conversations.length === 0 ? (
                              <p className="text-xs text-[var(--color-apple-text)]/40 italic">No history yet.</p>
                            ) : conversations.map(conv => (
                              <div
                                key={conv._id}
                                className={`flex items-center justify-between px-3 py-1.5 rounded-2xl text-xs transition-all group ${
                                  currentConversationId === conv._id
                                    ? 'bg-[var(--color-apple-blue)]/20 text-[var(--color-apple-text)] font-medium'
                                    : 'text-[var(--color-apple-text)]/70 hover:bg-[var(--color-apple-glass)] hover:text-[var(--color-apple-text)]'
                                }`}
                              >
                                <button
                                  onClick={() => { loadConversation(conv._id); onClose(); }}
                                  className="flex-1 text-left truncate flex items-center justify-between mr-2 py-0.5"
                                >
                                  <span className="truncate pr-2">{conv.title}</span>
                                  <span className="text-[10px] opacity-50 whitespace-nowrap">
                                    {new Date(conv.createdAt).toLocaleDateString()}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => deleteConversation(conv._id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-apple-text)]/50 hover:text-red-400 hover:bg-[var(--color-apple-bg)] rounded transition-all flex-shrink-0"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Open PRs Section */}
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--color-apple-text)]/50 mb-2 uppercase tracking-widest">Open PRs</p>
                          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar">
                            {!openPRs[repo] ? (
                              <p className="text-xs text-[var(--color-apple-text)]/40 italic">Loading PRs...</p>
                            ) : openPRs[repo].length === 0 ? (
                              <p className="text-xs text-[var(--color-apple-text)]/40 italic">No open PRs.</p>
                            ) : (
                              openPRs[repo].map(pr => (
                                <button
                                  key={pr.number}
                                  onClick={() => {
                                    setSelectedPR(pr);
                                    startNewChat();
                                    onClose();
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-2xl text-xs transition-all flex flex-col gap-1 group border ${
                                    selectedPR?.number === pr.number
                                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                                      : 'bg-[var(--color-apple-glass)] text-[var(--color-apple-text)]/80 border-transparent hover:bg-[var(--color-apple-blue)]/20 hover:text-[var(--color-apple-text)]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-bold truncate pr-2">#{pr.number}</span>
                                    <span className="text-[10px] opacity-70">by {pr.author}</span>
                                  </div>
                                  <span className="truncate w-full">{pr.title}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
