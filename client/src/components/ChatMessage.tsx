import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface ChatMessageProps {
  content: string;
  role: string;
  onCitationClick?: (citation: string) => void;
  status?: string;
  warning?: string;
  onEdit?: (newContent: string) => void;
  onRetry?: () => void;
  isLatest?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ content, role, onCitationClick, status, warning, onEdit, onRetry, isLatest }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  let displayText = content;
  let citations = [];
  const isUser = role === 'user';

  if (!isUser && content) {
    const citationIndex = content.lastIndexOf('__CITATIONS__:');
    if (citationIndex !== -1) {
      displayText = content.substring(0, citationIndex).trim();
      const citationStr = content.substring(citationIndex + '__CITATIONS__:'.length).trim();
      citations = citationStr.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }
  }

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== content) {
      onEdit(editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} group relative`}>
      <div 
        className={`max-w-[85%] w-full sm:w-auto rounded-2xl px-5 py-4 relative ${
          isUser 
            ? 'bg-[var(--color-apple-glass)] text-[var(--color-apple-text)] rounded-br-sm shadow-sm font-bold' 
            : 'bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)]/30 text-[var(--color-apple-text)] rounded-bl-sm shadow-md'
        }`}
      >
        
        {isUser && !isEditing && onEdit && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute -left-10 top-2 opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-white transition-opacity bg-[var(--color-apple-glass)] rounded-full border border-[var(--color-apple-border)]"
            title="Edit message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </button>
        )}

        {isEditing ? (
          <div className="flex flex-col gap-3 w-full min-w-[250px] sm:min-w-[400px]">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-[var(--color-apple-bg)] text-[var(--color-apple-text)] border border-[var(--color-apple-border)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-apple-blue)] resize-none min-h-[100px]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                  setEditContent(content);
                  setIsEditing(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-apple-blue)] text-white rounded-lg hover:bg-[var(--color-apple-blue-hover)] transition-colors"
              >
                Save & Submit
              </button>
            </div>
          </div>
        ) : (
          <>
            {warning && (
              <div className="mb-4 bg-orange-500/10 border border-orange-500/30 text-orange-400 p-3 rounded-lg text-sm flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{warning}</span>
              </div>
            )}
            <div className="text-sm leading-relaxed prose prose-invert max-w-none">
              {displayText ? (
                <ReactMarkdown 
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code({className, children, ...props}) {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-[var(--color-apple-bg)] text-[var(--color-apple-blue)] font-mono px-1.5 py-0.5 rounded border border-[var(--color-apple-border)]/30" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return <code className={className} {...props}>{children}</code>;
                    }
                  }}
                >
                  {displayText}
                </ReactMarkdown>
              ) : (
                <div className="flex items-center gap-3 py-1">
                  <span className="inline-flex space-x-1 items-center animate-pulse">
                    <span className="h-1.5 w-1.5 bg-[var(--color-apple-blue)] rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-[var(--color-apple-glass)] rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-[var(--color-apple-blue)] rounded-full"></span>
                  </span>
                  <span className="text-xs font-mono text-[var(--color-apple-text)]/70 animate-pulse">{status || 'Thinking...'}</span>
                </div>
              )}
            </div>
            
            {citations.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--color-apple-border)]">
                <p className="text-[10px] text-[var(--color-apple-text)]/50 mb-2 font-semibold uppercase tracking-wider">Sources Cited</p>
                <div className="flex flex-wrap gap-2">
                  {citations.map((cite, idx) => (
                    <button 
                      key={idx}
                      onClick={() => onCitationClick && onCitationClick(cite)}
                      className="px-2 py-1 bg-[var(--color-apple-glass)]/50 border border-[var(--color-apple-border)]/30 text-[var(--color-apple-text)] rounded-md text-[11px] font-mono break-all hover:bg-[var(--color-apple-glass)] hover:text-[var(--color-apple-text)] transition-colors cursor-pointer text-left"
                    >
                      {cite}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isUser && isLatest && onRetry && displayText && (
              <div className="mt-4 pt-3 border-t border-[var(--color-apple-border)] flex justify-end">
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-[var(--color-apple-glass)] text-zinc-400 hover:text-white border border-transparent hover:border-[var(--color-apple-border)] rounded-lg text-xs font-medium transition-all"
                  title="Retry response"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Retry
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
