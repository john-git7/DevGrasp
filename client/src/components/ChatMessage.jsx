import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

const ChatMessage = React.memo(({ content, role, onCitationClick, status }) => {
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

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[85%] rounded-2xl px-5 py-4 ${
          isUser 
            ? 'bg-[#18181b] text-zinc-900 rounded-br-sm shadow-sm font-medium' 
            : 'bg-[#18181b] border border-white/5 text-zinc-300 rounded-bl-sm shadow-md'
        }`}
      >

        <div className="text-sm leading-relaxed prose prose-invert max-w-none">
          {displayText ? (
            <ReactMarkdown 
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({className, children, ...props}) {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-black/40 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-white/5" {...props}>
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
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></span>
                <span className="h-1.5 w-1.5 bg-purple-500 rounded-full"></span>
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></span>
              </span>
              <span className="text-xs font-mono text-zinc-400 animate-pulse">{status || 'Thinking...'}</span>
            </div>
          )}
        </div>
        
        {citations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[10px] text-zinc-500 mb-2 font-semibold uppercase tracking-wider">Sources Cited</p>
            <div className="flex flex-wrap gap-2">
              {citations.map((cite, idx) => (
                <button 
                  key={idx}
                  onClick={() => onCitationClick && onCitationClick(cite)}
                  className="px-2 py-1 bg-white/5 border border-white/5 text-indigo-300 rounded-md text-[11px] font-mono break-all hover:bg-white/10 hover:text-indigo-200 transition-colors cursor-pointer text-left"
                >
                  {cite}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
