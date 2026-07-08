import React from 'react';

export default function WorkspaceModal({
  isOpen,
  onClose,
  indexedRepos,
  selectedRepo,
  setSelectedRepo,
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
  deleteWorkspace
}) {
  if (!isOpen) return null;

  const currentRepoObj = indexedRepos.find(r => 
    (typeof r === 'string' ? r : r.repoUrl) === selectedRepo
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="apple-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl bg-[var(--color-apple-bg)] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 h-[85vh] max-h-[850px] border border-[var(--color-apple-border)]">
        
        {/* LEFT PANE: Repository List */}
        <div className={`w-full md:w-1/3 md:min-w-[250px] md:max-w-[320px] bg-[var(--color-apple-glass)] border-r border-[var(--color-apple-border)] flex-col h-full ${selectedRepo ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-5 py-5 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-black/20">
            <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans">Workspaces</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 no-scrollbar">
            {indexedRepos.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-sm text-[var(--color-apple-text-muted)]">No workspaces found.</p>
              </div>
            ) : (
              indexedRepos.map(repoObj => {
                const repo = typeof repoObj === 'string' ? repoObj : repoObj.repoUrl;
                if (!repo) return null;
                const repoName = repo.split('/').slice(-2).join('/');
                const isSelected = selectedRepo === repo;

                return (
                  <button
                    key={repo}
                    onClick={() => setSelectedRepo(repo)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3 group ${
                      isSelected 
                        ? 'bg-[var(--color-apple-blue)] shadow-md shadow-blue-500/20 text-white font-semibold' 
                        : 'text-[var(--color-apple-text)] hover:bg-[var(--color-apple-glass-hover)] font-medium'
                    }`}
                  >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[var(--color-apple-text-muted)] group-hover:text-[var(--color-apple-text)]'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L15.19 12l-1.47-1.47a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-3.28 4.72a.75.75 0 001.06-1.06l-4.5-4.5a.75.75 0 00-1.06 1.06l4.5 4.5z" clipRule="evenodd" />
                    </svg>
                    <div className="flex flex-col truncate">
                      <span className="truncate">{repoName}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Details & Actions */}
        <div className={`flex-1 flex-col h-full bg-[var(--color-apple-bg)] relative ${!selectedRepo ? 'hidden md:flex' : 'flex'}`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] text-[var(--color-apple-text)] p-2 rounded-full transition-colors border border-[var(--color-apple-border)] hidden md:block"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {selectedRepo && (
            <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--color-apple-border)]/30 bg-[var(--color-apple-glass)]">
              <button onClick={() => setSelectedRepo(null)} className="flex items-center gap-1 text-[var(--color-apple-blue)] font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>
              <span className="font-bold truncate max-w-[180px]">{selectedRepo.split('/').slice(-2).join('/')}</span>
              <button onClick={onClose} className="p-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {!selectedRepo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-[var(--color-apple-glass)] rounded-2xl flex items-center justify-center text-[var(--color-apple-text-muted)] mb-4 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-apple-text)] mb-2">Select a Workspace</h3>
              <p className="text-sm text-[var(--color-apple-text-muted)] max-w-sm">
                Choose a repository from the left sidebar to view recent chats, open pull requests, and AI-powered insights.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="mb-8 pr-4 md:pr-12">
                <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--color-apple-text)] tracking-tight mb-2 hidden md:block">
                  {selectedRepo.split('/').slice(-2).join('/')}
                </h2>
                {currentRepoObj && currentRepoObj.lastUpdated && (
                  <p className="text-sm text-[var(--color-apple-text-muted)] flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Last indexed: {new Date(currentRepoObj.lastUpdated).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Quick Actions Grid */}
              <div className="mb-10">
                <h3 className="text-sm font-bold text-[var(--color-apple-text-muted)] uppercase tracking-wider mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => { startNewChat(); onClose(); }}
                    className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/20 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-apple-text)] group-hover:text-blue-400 transition-colors">New Chat</h4>
                      <p className="text-xs text-[var(--color-apple-text-muted)] mt-1">Start a fresh conversation about this codebase.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => { onClose(); generateOnboarding(); }}
                    className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-apple-bg)] text-purple-400 flex items-center justify-center border border-[var(--color-apple-border)]">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-apple-text)]">Onboarding Guide</h4>
                      <p className="text-xs text-[var(--color-apple-text-muted)] mt-1">Generate an architecture and setup overview.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => { onClose(); generateTechDebt(); }}
                    className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-apple-bg)] text-amber-400 flex items-center justify-center border border-[var(--color-apple-border)]">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-apple-text)]">Tech Debt Radar</h4>
                      <p className="text-xs text-[var(--color-apple-text-muted)] mt-1">Identify legacy code, bottlenecks, and refactoring targets.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => { onClose(); generateCommitStory(); }}
                    className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-apple-bg)] text-teal-400 flex items-center justify-center border border-[var(--color-apple-border)]">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-apple-text)]">Commit Story</h4>
                      <p className="text-xs text-[var(--color-apple-text-muted)] mt-1">Summarize recent repository activity and changes.</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Recent Chats Section */}
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-apple-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    Recent Chats
                  </h3>
                  <div className="flex flex-col gap-2">
                    {conversations.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] text-center text-[var(--color-apple-text-muted)] text-sm">
                        No history yet. Start a new chat!
                      </div>
                    ) : conversations.map(conv => (
                      <div
                        key={conv._id}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-all group ${
                          currentConversationId === conv._id
                            ? 'bg-[var(--color-apple-blue)]/20 text-[var(--color-apple-text)] border border-[var(--color-apple-blue)]/30'
                            : 'bg-[var(--color-apple-glass)] text-[var(--color-apple-text)] border border-[var(--color-apple-border)] hover:border-[var(--color-apple-text-muted)]/50'
                        }`}
                      >
                        <button
                          onClick={() => { loadConversation(conv._id); onClose(); }}
                          className="flex-1 text-left truncate pr-4"
                        >
                          <div className="font-semibold truncate mb-1">{conv.title}</div>
                          <div className="text-xs text-[var(--color-apple-text-muted)]">
                            {new Date(conv.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={(e) => deleteConversation(conv._id, e)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-[var(--color-apple-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open PRs Section */}
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-apple-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                    </svg>
                    Open Pull Requests
                  </h3>
                  <div className="flex flex-col gap-2">
                    {!openPRs[selectedRepo] ? (
                      <div className="p-4 rounded-2xl bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] text-center text-[var(--color-apple-text-muted)] text-sm">
                        <span className="animate-pulse">Loading PRs...</span>
                      </div>
                    ) : openPRs[selectedRepo].length === 0 ? (
                      <div className="p-4 rounded-2xl bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] text-center text-[var(--color-apple-text-muted)] text-sm">
                        No open PRs found.
                      </div>
                    ) : (
                      openPRs[selectedRepo].map(pr => (
                        <button
                          key={pr.number}
                          onClick={() => {
                            setSelectedPR(pr);
                            startNewChat();
                            onClose();
                          }}
                          className={`w-full text-left p-4 rounded-2xl text-sm transition-all flex flex-col gap-1 border ${
                            selectedPR?.number === pr.number
                              ? 'bg-emerald-500/10 text-emerald-100 border-emerald-500/30'
                              : 'bg-[var(--color-apple-glass)] text-[var(--color-apple-text)] border-[var(--color-apple-border)] hover:border-[var(--color-apple-text-muted)]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-bold text-emerald-400">#{pr.number}</span>
                            <span className="text-xs text-[var(--color-apple-text-muted)]">by {pr.author}</span>
                          </div>
                          <span className="truncate w-full font-medium">{pr.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-auto pt-8 border-t border-[var(--color-apple-border)]/30">
                <button 
                  onClick={() => {
                    deleteWorkspace(selectedRepo);
                    setSelectedRepo(null);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 w-fit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Remove Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
