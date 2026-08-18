import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  return (
    <div className="min-h-screen bg-[var(--color-apple-bg)] text-[var(--color-apple-text)] flex flex-col font-sans selection:bg-[var(--color-apple-blue)] selection:text-white">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)]">
            <img src="/logo.png" alt="DevGrasp Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight">DevGrasp</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button onClick={handleLogout} className="text-sm font-semibold hover:text-[var(--color-apple-blue)] transition-colors">
                Log out
              </button>
              <Link to="/chat" className="text-sm font-semibold bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] px-4 py-2 rounded-full transition-colors">
                Workspace
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold hover:text-[var(--color-apple-blue)] transition-colors">
                Log in
              </Link>
              <Link to="/register" className="text-sm font-semibold bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] px-4 py-2 rounded-full transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 pb-20">
        
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none -z-10 mt-20 ml-20"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] mb-8 text-xs font-semibold text-[var(--color-apple-blue)] shadow-lg backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-apple-blue)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-apple-blue)]"></span>
          </span>
          DevGrasp 2.0 is Live
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight max-w-4xl mb-6 leading-[1.1] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          Your Intelligent <br className="hidden sm:block" /> Codebase Companion
        </h1>
        
        <p className="text-lg sm:text-xl text-[var(--color-apple-text-muted)] max-w-2xl mb-10 leading-relaxed font-medium">
          DevGrasp indexes your repositories and provides instant, context-aware answers to your toughest coding questions. Stop grepping, start grasping.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {user ? (
            <Link to="/chat" className="px-8 py-4 bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue-hover)] text-white font-bold rounded-full text-lg transition-all shadow-lg shadow-[var(--color-apple-blue)]/30 hover:scale-105 active:scale-95 flex items-center gap-2">
              Go to Workspace
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          ) : (
            <Link to="/login" className="px-8 py-4 bg-[var(--color-apple-blue)] hover:bg-[var(--color-apple-blue-hover)] text-white font-bold rounded-full text-lg transition-all shadow-lg shadow-[var(--color-apple-blue)]/30 hover:scale-105 active:scale-95 flex items-center gap-2">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
          <a href="https://github.com" target="_blank" rel="noreferrer" className="px-8 py-4 bg-[var(--color-apple-glass)] hover:bg-[var(--color-apple-glass-hover)] border border-[var(--color-apple-border)] text-[var(--color-apple-text)] font-bold rounded-full text-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View Source
          </a>
        </div>

        {/* Floating Feature Cards */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl w-full text-left">
          <div className="bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] rounded-3xl p-6 backdrop-blur-xl hover:bg-[var(--color-apple-glass-hover)] transition-colors">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.45" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Semantic Indexing</h3>
            <p className="text-[var(--color-apple-text-muted)] text-sm leading-relaxed">
              We slice your codebase into intelligent chunks and embed them using state-of-the-art models so you can search by meaning, not just keywords.
            </p>
          </div>
          <div className="bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] rounded-3xl p-6 backdrop-blur-xl hover:bg-[var(--color-apple-glass-hover)] transition-colors">
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 text-purple-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">AI Architect</h3>
            <p className="text-[var(--color-apple-text-muted)] text-sm leading-relaxed">
              Instantly generate onboarding guides, map out tech debt, and review commit histories with our intelligent analysis tools.
            </p>
          </div>
          <div className="bg-[var(--color-apple-glass)] border border-[var(--color-apple-border)] rounded-3xl p-6 backdrop-blur-xl hover:bg-[var(--color-apple-glass-hover)] transition-colors">
            <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4 text-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
            <p className="text-[var(--color-apple-text-muted)] text-sm leading-relaxed">
              Your data is yours. With full multi-tenant architecture and JWT auth, your indexed repositories and chats are strictly private.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
