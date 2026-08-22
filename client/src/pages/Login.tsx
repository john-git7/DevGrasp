import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-apple-bg)] font-[system-ui]">
      <div className="w-full max-w-md p-8 bg-[var(--color-apple-glass)] backdrop-blur-xl border border-[var(--color-apple-border)] rounded-3xl shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="DevGrasp Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-[var(--color-apple-text)] mb-2 tracking-tight">Welcome Back</h2>
        <p className="text-center text-[var(--color-apple-text-muted)] mb-8">Sign in to DevGrasp</p>
        
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-apple-text-muted)] mb-1 ml-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)] rounded-2xl px-4 py-3 text-[var(--color-apple-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-apple-text-muted)] mb-1 ml-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)] rounded-2xl px-4 py-3 text-[var(--color-apple-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-2xl transition-colors mt-6 shadow-lg shadow-blue-500/20"
          >
            Sign In
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--color-apple-text-muted)]">
          Don't have an account? <Link to="/register" className="text-blue-500 hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
