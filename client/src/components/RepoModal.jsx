import React from 'react';
import QuotaTimer from './QuotaTimer';

export default function RepoModal({
  isOpen,
  onClose,
  repoUrl,
  setRepoUrl,
  analyzeRepo,
  repoAnalysis,
  indexRepo,
  isIndexing,
  indexProgress,
  pauseIndexing,
  skipCurrentFile,
  isSkippingFile,
  fetchIndexedRepos,
  indexedRepos = [],
  indexError,
  setIndexError,
  deleteWorkspace
}) {
  const [excludedExtensions, setExcludedExtensions] = React.useState([]);

  React.useEffect(() => {
    if (repoAnalysis && repoAnalysis.extensions) {
      setExcludedExtensions(
        repoAnalysis.extensions.filter(ext => ext.defaultExclude).map(ext => ext.extension)
      );
    }
  }, [repoAnalysis]);

  if (!isOpen) return null;

  const handleToggleExtension = (ext) => {
    setExcludedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const handleRepoValidation = (e, repoUrl) => {
    // Ensure we handle trailing slashes and .git extensions properly for robust matching
    const normalizeUrl = (url) => url.replace(/\.git$/, '').replace(/\/$/, '').toLowerCase();
    const normalizedTarget = normalizeUrl(repoUrl);

    const isDuplicate = indexedRepos.some(repo => {
      // repo can be a string (old format) or an object
      const existingUrl = typeof repo === 'string' ? repo : repo.repoUrl;
      const isComplete = typeof repo === 'string' ? true : repo.status === 'complete';
      return isComplete && normalizeUrl(existingUrl) === normalizedTarget;
    });

    if (isDuplicate) {
      setIndexError("This repository is already indexed and exists in your workspace!");
      return;
    }

    setIndexError(null);
    analyzeRepo(e, repoUrl);
  };

  const handleIndexStart = (e) => {
    e.preventDefault();
    indexRepo(e, repoAnalysis.repoUrl, excludedExtensions);
  };

  const handleAnalyzeSubmit = (e) => {
    e.preventDefault();
    if (!repoUrl) return;
    handleRepoValidation(e, repoUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="apple-modal-backdrop absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-lg apple-glass-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh]">
        <div className="px-5 py-4 border-b border-[var(--color-apple-border)]/30 flex justify-between items-center bg-[var(--color-apple-glass)] flex-shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-apple-text)] tracking-tight font-sans">
            {repoAnalysis ? 'Review Files' : 'Add Repository'}
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

        <div className="p-6 bg-[var(--color-apple-bg)] overflow-y-auto">
          {indexError && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium flex items-center justify-between">
              <span>{indexError}</span>
              <button onClick={() => setIndexError(null)} className="ml-2 text-red-400 hover:text-white p-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {isIndexing ? (
            <div className="flex flex-col gap-2 items-center justify-center p-6 border border-[var(--color-apple-border)] rounded-2xl bg-[var(--color-apple-glass)] text-center">
              <svg className="w-8 h-8 text-[var(--color-apple-blue)] animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-sm font-bold text-[var(--color-apple-text)]">Indexing in Progress</h3>
              <p className="text-xs text-[var(--color-apple-text)]/60">
                You are currently indexing a repository. Please wait for it to finish or pause it before adding a new one.
              </p>
            </div>
          ) : repoAnalysis ? (
            <div className="flex flex-col gap-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                  Why exclude files?
                </p>
                <p className="opacity-80 leading-relaxed">
                  Indexing large datasets, media files, and logs is time-consuming and quickly drains your API quota. These files provide no semantic value to the AI context. Unchecked extensions below will be skipped.
                </p>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {repoAnalysis.extensions.map(ext => (
                  <label key={ext.extension} className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)]/50 cursor-pointer hover:bg-[var(--color-apple-blue)]/5 transition-colors group">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={!excludedExtensions.includes(ext.extension)}
                        onChange={() => handleToggleExtension(ext.extension)}
                        className="w-4 h-4 rounded border-[var(--color-apple-border)] bg-[var(--color-apple-bg)] text-[var(--color-apple-blue)] focus:ring-[var(--color-apple-blue)]/50"
                      />
                      <span className="text-sm font-medium text-[var(--color-apple-text)] font-mono">{ext.extension}</span>
                    </div>
                    <span className="text-xs text-[var(--color-apple-text)]/50 group-hover:text-[var(--color-apple-text)]/70">{ext.count} files</span>
                  </label>
                ))}
              </div>

              <button 
                onClick={handleIndexStart}
                className="bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/90 text-[var(--color-apple-bg)] px-4 py-3 rounded-2xl text-sm font-bold transition-all w-full shadow-lg shadow-[var(--color-apple-blue)]/20 mt-2"
              >
                Start Indexing ({repoAnalysis.totalFiles - repoAnalysis.extensions.filter(e => excludedExtensions.includes(e.extension)).reduce((sum, e) => sum + e.count, 0)} files)
              </button>
            </div>
          ) : (
            <form onSubmit={handleAnalyzeSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-apple-text)]/70 mb-2 uppercase tracking-widest">GitHub Repository URL</label>
                <input 
                  type="text" 
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="github.com/facebook/react"
                  className="bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-apple-text)] text-[var(--color-apple-text)] w-full transition-all placeholder:text-[var(--color-apple-text)]/40"
                />
              </div>
              <button 
                type="submit" 
                disabled={!repoUrl}
                className="bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue)]/90 disabled:bg-[var(--color-apple-glass)] disabled:text-[var(--color-apple-text)]/40 text-[var(--color-apple-bg)] px-4 py-3 rounded-2xl text-sm font-bold transition-all w-full shadow-sm"
              >
                Analyze Repository
              </button>
            </form>
          )}

          {!isIndexing && !repoAnalysis && indexedRepos.filter(r => typeof r !== 'string' && r.status !== 'complete').length > 0 && (
            <div className="mt-6 border-t border-[var(--color-apple-border)]/30 pt-4">
              <p className="text-[10px] font-semibold text-[var(--color-apple-text)]/50 mb-3 uppercase tracking-widest">Incomplete Workspaces</p>
              <div className="flex flex-col gap-2">
                {indexedRepos.filter(r => typeof r !== 'string' && r.status !== 'complete').map(repoObj => {
                  const repoName = repoObj.repoUrl.split('/').slice(-2).join('/');
                  return (
                    <div key={repoObj.repoUrl} className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)]/50">
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-sm font-medium text-[var(--color-apple-text)] truncate">{repoName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{repoObj.status}</span>
                          <span className="text-[10px] text-[var(--color-apple-text)]/40 font-mono">{repoObj.indexedFiles}/{repoObj.totalFiles}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            indexRepo(e, repoObj.repoUrl);
                          }}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-apple-blue)] text-[var(--color-apple-bg)] hover:bg-[var(--color-apple-blue)]/90 transition-colors"
                        >
                          Resume
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (deleteWorkspace) {
                              deleteWorkspace(repoObj.repoUrl);
                            }
                          }}
                          className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 hover:text-red-500 transition-colors"
                          title="Delete Workspace"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isIndexing && indexProgress && (
            <div className="mt-5 p-4 bg-[var(--color-apple-glass)] rounded-2xl border border-[var(--color-apple-border)]/30">
              <div className="flex justify-between items-center mb-2 text-xs">
                <span className="text-[var(--color-apple-text)] truncate pr-2 font-medium">
                  {indexProgress.isWaiting ? (
                    <div className="flex flex-col gap-1 select-none">
                      <QuotaTimer waitTime={indexProgress.waitTime} message="Rate limit hit — pausing" />
                      {indexProgress.file && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-orange-400/60 font-mono truncate max-w-[200px]">
                            Paused on: {indexProgress.file}
                          </span>
                          <button
                            type="button"
                            disabled={isSkippingFile}
                            onClick={() => skipCurrentFile(indexProgress.repoUrl, indexProgress.file)}
                            className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300 hover:bg-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
                            title="Skip indexing this file and permanently exclude it"
                          >
                            {isSkippingFile ? 'Skipping...' : 'Skip'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : indexProgress.status === 'fetching' ? (
                    'Fetching files...'
                  ) : (
                    <div className="flex items-center gap-2 select-none">
                      <span className="truncate max-w-[220px]" title={indexProgress.file}>
                        {indexProgress.file}
                      </span>
                      {indexProgress.file && (
                        <button
                          type="button"
                          disabled={isSkippingFile}
                          onClick={() => skipCurrentFile(indexProgress.repoUrl, indexProgress.file)}
                          className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300 hover:bg-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
                          title="Skip indexing this file and permanently exclude it"
                        >
                          {isSkippingFile ? 'Skipping...' : 'Skip'}
                        </button>
                      )}
                    </div>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-apple-text)]/70 font-mono">{indexProgress.current}/{indexProgress.total}</span>
                  <button
                    onClick={() => pauseIndexing(indexProgress.repoUrl)}
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
